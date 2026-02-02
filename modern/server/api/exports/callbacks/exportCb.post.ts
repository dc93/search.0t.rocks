import { addWalletBalance, updateExportJob } from '../../../utils/elasticsearch'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (body.status === 'failed') {
    await addWalletBalance(body.walletId, body.cost)
  }

  await updateExportJob(body.jobid, {
    cost: body.cost,
    wallet: body.walletId,
    query: body.query,
    status: body.status,
    count: body.exportCount,
    link: body.link,
  })

  return { ok: true }
})
