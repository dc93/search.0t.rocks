import { omit, uniqBy } from 'lodash-es'
import { queryForDocs } from '../utils/elasticsearch'
import { buildEsQuery } from '../utils/queryBuilder'
import {
  isAutomated,
  checkIPAutomatedSTDDEV,
  createFakeResponse,
  isWhitelistedApiKey,
} from '../utils/botDetection'
import type { SolrRecord } from '~/types'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const headers = getHeaders(event) as Record<string, string | undefined>

  // Bot detection
  if (isAutomated(headers, query)) {
    return createFakeResponse(query.wt === 'json')
  }
  if (checkIPAutomatedSTDDEV(headers)) {
    return createFakeResponse(query.wt === 'json')
  }

  // API access check
  if (query.wt === 'json') {
    const apiKey = (query.apikey as string) || headers['user-agent'] || ''
    if (!isWhitelistedApiKey(apiKey)) {
      setResponseStatus(event, 403)
      return {
        error: true,
        message: 'API Access requires a free API token. Please contact the administrator.',
      }
    }
  }

  // Build search query from params
  const requestedQuery: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(query)) {
    if (key !== 'wt' && key !== 'apikey' && key !== 'sofreshandsoclean') {
      if (typeof value === 'string' || Array.isArray(value)) {
        requestedQuery[key] = value as string | string[]
      }
    }
  }

  const queryBuilt = buildEsQuery(requestedQuery)
  if ('error' in queryBuilt) {
    setResponseStatus(event, 400)
    return { error: true, message: queryBuilt.error }
  }

  let totalRecordCount = 0

  const recordsResponse = await queryForDocs(queryBuilt.query).catch(() => ({
    numDocs: 0,
    records: [] as SolrRecord[],
  }))

  totalRecordCount += recordsResponse.numDocs
  let records = [...recordsResponse.records]

  // Additional queries (email local-part, domain, name-based email)
  const isExact = query.exact === 'true' || query.exact === '1' || query.exact === 'on'
  if (queryBuilt.additionalQueries.length > 0 && !isExact) {
    const limit = typeof query.sofreshandsoclean === 'string' ? 10000 : 100

    for (const addlQuery of queryBuilt.additionalQueries) {
      const additionalResponse = await queryForDocs(addlQuery, limit).catch(() => ({
        numDocs: 0,
        records: [] as SolrRecord[],
      }))

      totalRecordCount += additionalResponse.numDocs
      records.push(...additionalResponse.records)
    }
  }

  // Deduplicate and shape results
  let recordsFinal = records.map((record) => ({
    ...record,
    canMap: !!(record.address || record.latLong),
    fields: Object.entries(omit(record, ['id', '_version_'])).map(
      ([key, value]) => `${key}: ${value}`
    ),
  }))

  recordsFinal = uniqBy(recordsFinal, 'id')

  return {
    resultCount: totalRecordCount,
    count: recordsFinal.length,
    records: recordsFinal,
    query: queryBuilt.queryDescription,
  }
})
