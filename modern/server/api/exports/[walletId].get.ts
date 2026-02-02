import { queryForExportDocs } from '../../utils/solr'

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

export default defineEventHandler(async (event) => {
  const walletId = getRouterParam(event, 'walletId')

  if (!walletId || !UUID_REGEX.test(walletId)) {
    setResponseStatus(event, 400)
    return { error: true, message: 'Invalid wallet ID.' }
  }

  try {
    const result = await queryForExportDocs(`wallet:"${walletId}"`)
    return result.records.map((record: any) => ({
      ...record,
      jobid: record.id,
      exportCount: record.count,
    }))
  } catch {
    setResponseStatus(event, 500)
    return [{ id: 'internal error', query: 'Please try again.' }]
  }
})
