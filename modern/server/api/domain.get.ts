import { queryForDocs } from '../utils/elasticsearch'
import { Client } from '@elastic/elasticsearch'

function getClient(): Client {
  const config = useRuntimeConfig()
  return new Client({
    node: config.elasticsearchUrl || 'http://es01:9200',
    requestTimeout: 30000,
    maxRetries: 3,
  })
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const domain = (query.domain as string || '').trim().toLowerCase()

  if (!domain) {
    setResponseStatus(event, 400)
    return { error: true, message: 'Domain parameter is required' }
  }

  const page = parseInt(query.page as string || '1', 10)
  const perPage = Math.min(parseInt(query.perPage as string || '50', 10), 200)
  const from = (page - 1) * perPage
  const dedup = query.dedup === 'true' || query.dedup === '1'

  const client = getClient()

  // Main query: match emails ending with @domain
  const esQuery = {
    bool: {
      should: [
        { wildcard: { 'emails.keyword': { value: `*@${domain}`, case_insensitive: true } } },
        { match: { domain } },
      ],
      minimum_should_match: 1,
    },
  }

  // Fetch records with optional dedup
  const searchParams: Record<string, unknown> = {
    index: 'bigdata',
    size: perPage,
    from,
    query: esQuery,
    _source: true,
  }

  if (dedup) {
    searchParams.collapse = { field: 'emails.keyword' }
  }

  // Run main search + aggregations in parallel
  const [searchResult, aggsResult] = await Promise.all([
    client.search(searchParams),
    client.search({
      index: 'bigdata',
      size: 0,
      query: esQuery,
      aggs: {
        total_emails: { cardinality: { field: 'emails.keyword' } },
        total_usernames: { cardinality: { field: 'usernames.keyword' } },
        has_password: {
          filter: { exists: { field: 'passwords' } },
        },
        top_sources: {
          terms: { field: 'source', size: 10 },
        },
        password_types: {
          terms: { field: 'passwords', size: 5 },
        },
      },
    }),
  ])

  const totalHits = typeof searchResult.hits.total === 'number'
    ? searchResult.hits.total
    : searchResult.hits.total?.value ?? 0

  const records = (searchResult.hits.hits ?? []).map((h) => ({
    id: h._id,
    ...(h._source as Record<string, unknown>),
  }))

  // Extract aggregation results
  const aggs = aggsResult.aggregations as Record<string, any> | undefined

  const stats = {
    totalRecords: totalHits,
    uniqueEmails: aggs?.total_emails?.value ?? 0,
    uniqueUsernames: aggs?.total_usernames?.value ?? 0,
    withPasswords: aggs?.has_password?.doc_count ?? 0,
    passwordExposureRate: totalHits > 0
      ? Math.round(((aggs?.has_password?.doc_count ?? 0) / totalHits) * 100)
      : 0,
    topSources: (aggs?.top_sources?.buckets ?? []).map((b: any) => ({
      source: b.key,
      count: b.doc_count,
    })),
  }

  return {
    domain,
    stats,
    records,
    page,
    perPage,
    totalPages: Math.ceil(totalHits / perPage),
  }
})
