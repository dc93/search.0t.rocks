import { Client } from '@elastic/elasticsearch'
import type { SolrRecord, SolrResponse } from '~/types'

let _client: Client | null = null

function getClient(): Client {
  if (!_client) {
    const config = useRuntimeConfig()
    _client = new Client({
      node: config.elasticsearchUrl || 'http://es01:9200',
      requestTimeout: 30000,
      maxRetries: 3,
    })
  }
  return _client
}

// ─── Index names ───────────────────────────────────────────
const INDEX_DATA = 'bigdata'
const INDEX_WALLETS = 'wallets'
const INDEX_EXPORTS = 'exports'

// ─── Data search ───────────────────────────────────────────

export async function queryForDocs(
  esQuery: Record<string, unknown>,
  limit = 100,
  from = 0
): Promise<SolrResponse> {
  const client = getClient()
  const { hits } = await client.search({
    index: INDEX_DATA,
    size: limit,
    from,
    query: esQuery as any,
    _source: true,
  })

  return {
    numDocs: typeof hits.total === 'number' ? hits.total : hits.total?.value ?? 0,
    records: (hits.hits ?? []).map((h) => ({
      id: h._id,
      ...(h._source as Record<string, unknown>),
    })) as SolrRecord[],
  }
}

// ─── Spatial search ────────────────────────────────────────

export async function queryForDocsSpatial(
  lat: number,
  lon: number,
  distanceKm: number
): Promise<SolrResponse> {
  const client = getClient()
  const { hits } = await client.search({
    index: INDEX_DATA,
    size: 500,
    query: {
      bool: {
        filter: {
          geo_distance: {
            distance: `${distanceKm}km`,
            latLong: { lat, lon },
          },
        },
      },
    },
  })

  return {
    numDocs: typeof hits.total === 'number' ? hits.total : hits.total?.value ?? 0,
    records: (hits.hits ?? []).map((h) => ({
      id: h._id,
      ...(h._source as Record<string, unknown>),
    })) as SolrRecord[],
  }
}

// ─── Exports ───────────────────────────────────────────────

export async function queryForExportDocs(
  walletId: string
): Promise<SolrResponse> {
  const client = getClient()
  const { hits } = await client.search({
    index: INDEX_EXPORTS,
    size: 100,
    query: { term: { wallet: walletId } },
    sort: [{ _doc: 'desc' }],
  })

  return {
    numDocs: typeof hits.total === 'number' ? hits.total : hits.total?.value ?? 0,
    records: (hits.hits ?? []).map((h) => ({
      id: h._id,
      ...(h._source as Record<string, unknown>),
    })) as SolrRecord[],
  }
}

export async function createExportJob(job: {
  id: string
  cost: number
  wallet: string
  query: string
  status: string
  count: number
}): Promise<void> {
  const client = getClient()
  await client.index({
    index: INDEX_EXPORTS,
    id: job.id,
    document: job,
    refresh: true,
  })
}

export async function updateExportJob(
  jobId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const client = getClient()
  await client.update({
    index: INDEX_EXPORTS,
    id: jobId,
    doc: fields,
    refresh: true,
  })
}

// ─── Wallets ───────────────────────────────────────────────

export async function getWalletBalance(walletId: string): Promise<number> {
  const client = getClient()
  try {
    const { _source } = await client.get({
      index: INDEX_WALLETS,
      id: walletId,
    })
    return (_source as any)?.credits ?? 0
  } catch (err: any) {
    if (err?.meta?.statusCode === 404) return 0
    return 0
  }
}

export async function addWalletBalance(
  walletId: string,
  credits: number
): Promise<boolean> {
  const client = getClient()
  const current = await getWalletBalance(walletId)
  try {
    await client.index({
      index: INDEX_WALLETS,
      id: walletId,
      document: { credits: current + credits },
      refresh: true,
    })
    return true
  } catch {
    return false
  }
}

export async function removeWalletBalance(
  walletId: string,
  credits: number
): Promise<boolean> {
  const client = getClient()
  const current = await getWalletBalance(walletId)
  try {
    await client.index({
      index: INDEX_WALLETS,
      id: walletId,
      document: { credits: current - credits },
      refresh: true,
    })
    return true
  } catch {
    return false
  }
}

// ─── Similar records (More Like This) ─────────────────────

export async function getSimilarRecords(
  record: SolrRecord
): Promise<SolrRecord[]> {
  const client = getClient()

  // Build MLT queries for various fields
  const mltFields: string[] = []
  const likeTexts: string[] = []

  if (record.emails?.length) {
    mltFields.push('emails')
    likeTexts.push(...record.emails)
  }
  if (record.usernames?.length) {
    mltFields.push('usernames')
    likeTexts.push(...record.usernames)
  }
  if (record.phoneNumbers?.length) {
    mltFields.push('phoneNumbers')
    likeTexts.push(...(Array.isArray(record.phoneNumbers) ? record.phoneNumbers : [record.phoneNumbers as any]))
  }
  if (record.firstName) likeTexts.push(record.firstName)
  if (record.lastName) likeTexts.push(record.lastName)

  if (likeTexts.length === 0) return []

  // Strategy 1: More Like This query
  const { hits } = await client.search({
    index: INDEX_DATA,
    size: 50,
    query: {
      more_like_this: {
        fields: ['emails', 'usernames', 'phoneNumbers', 'firstName', 'lastName'],
        like: likeTexts.join(' '),
        min_term_freq: 1,
        min_doc_freq: 1,
        max_query_terms: 25,
      },
    },
  })

  const scoreMap: Record<string, number> = {}
  const docs: SolrRecord[] = []

  for (const hit of hits.hits ?? []) {
    if (hit._id === record.id) continue
    const score = typeof hit._score === 'number' ? hit._score : 0
    scoreMap[hit._id!] = score
    docs.push({
      id: hit._id!,
      ...(hit._source as Record<string, unknown>),
      'similarity score': score,
    } as SolrRecord)
  }

  // Strategy 2: Direct term matches for emails/usernames (high relevance)
  const termQueries: Promise<void>[] = []

  for (const email of record.emails ?? []) {
    termQueries.push(
      client
        .search({
          index: INDEX_DATA,
          size: 20,
          query: { match_phrase: { emails: email } },
          _source: { includes: ['id'] },
        })
        .then(({ hits: h }) => {
          for (const hit of h.hits ?? []) {
            if (hit._id === record.id) continue
            scoreMap[hit._id!] = (scoreMap[hit._id!] ?? 0) + 15
          }
        })
        .catch(() => {})
    )
  }

  for (const username of record.usernames ?? []) {
    termQueries.push(
      client
        .search({
          index: INDEX_DATA,
          size: 20,
          query: { match_phrase: { usernames: username } },
          _source: { includes: ['id'] },
        })
        .then(({ hits: h }) => {
          for (const hit of h.hits ?? []) {
            if (hit._id === record.id) continue
            scoreMap[hit._id!] = (scoreMap[hit._id!] ?? 0) + 15
          }
        })
        .catch(() => {})
    )
  }

  await Promise.all(termQueries)

  // Merge scores into existing docs, fetch any new IDs
  const existingIds = new Set(docs.map((d) => d.id))
  const newIds = Object.keys(scoreMap).filter((id) => !existingIds.has(id) && id !== record.id)

  if (newIds.length > 0) {
    const { docs: fetched } = await client.mget({
      index: INDEX_DATA,
      ids: newIds.slice(0, 30),
    })
    for (const d of fetched) {
      if ('_source' in d && d.found) {
        docs.push({
          id: d._id,
          ...(d._source as Record<string, unknown>),
          'similarity score': scoreMap[d._id] ?? 0,
        } as SolrRecord)
      }
    }
  }

  // Update scores for existing docs
  for (const doc of docs) {
    if (scoreMap[doc.id] !== undefined) {
      doc['similarity score'] = scoreMap[doc.id]
    }
  }

  docs.sort((a, b) => ((b['similarity score'] as number) ?? 0) - ((a['similarity score'] as number) ?? 0))

  return docs.slice(0, 50)
}

// ─── Record count ──────────────────────────────────────────

export async function getTotalRecordCount(): Promise<number> {
  const client = getClient()
  try {
    const { count } = await client.count({ index: INDEX_DATA })
    return count
  } catch {
    return 0
  }
}
