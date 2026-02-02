import { omit } from 'lodash-es'
import { queryForDocs, getSimilarRecords } from '../../utils/elasticsearch'
import {
  isAutomated,
  checkIPAutomatedSTDDEV,
  createFakeResponse,
} from '../../utils/botDetection'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const query = getQuery(event)
  const headers = getHeaders(event) as Record<string, string | undefined>

  if (!id) {
    setResponseStatus(event, 400)
    return { error: true, message: 'Missing document ID.' }
  }

  // Bot detection
  if (isAutomated(headers, query)) {
    return createFakeResponse(true)
  }
  if (checkIPAutomatedSTDDEV(headers)) {
    return createFakeResponse(true)
  }

  const result = await queryForDocs({ term: { _id: id } }, 1)
  const record = result.records[0]

  if (!record) {
    setResponseStatus(event, 404)
    return { error: true, message: 'Record not found.' }
  }

  const moreLikeThis = query.moreLikeThis === 'true'

  const similarRecords = moreLikeThis
    ? await getSimilarRecords(record).catch(() => [])
    : []

  return {
    record,
    related: similarRecords.map((r) => ({
      ...r,
      fields: Object.entries(omit(r, ['id', '_version_'])).map(
        ([key, value]) => ({ key, value })
      ),
    })),
  }
})
