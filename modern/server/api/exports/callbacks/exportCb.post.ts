import axios from 'axios'
import { addWalletBalance } from '../../../utils/solr'

function getSolrExportsUpdateUrl(): string {
  const config = useRuntimeConfig()
  const servers = config.solrServers as string[]
  return servers[Math.floor(Math.random() * servers.length)]
    .replace('BigData', 'Exports')
    .replace('select', 'update')
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (body.status === 'failed') {
    await addWalletBalance(body.walletId, body.cost)
  }

  await axios.post(
    getSolrExportsUpdateUrl(),
    {
      add: {
        doc: {
          id: body.jobid,
          cost: body.cost,
          wallet: body.walletId,
          query: body.query,
          status: body.status,
          count: body.exportCount,
          link: body.link,
        },
      },
    },
    { params: { commit: true } }
  )

  return { ok: true }
})
