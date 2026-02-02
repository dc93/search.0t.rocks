import { getWalletBalance } from '../../utils/elasticsearch'
import { markWalletRequested } from '../../utils/botDetection'

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

export default defineEventHandler(async (event) => {
  const walletId = getRouterParam(event, 'walletId')
  const headers = getHeaders(event) as Record<string, string | undefined>

  if (!walletId || !UUID_REGEX.test(walletId) || walletId.length !== 36) {
    setResponseStatus(event, 400)
    return { error: 'Invalid wallet ID.' }
  }

  // Track wallet request for bot detection
  const ip = headers['cf-connecting-ip'] || headers['x-forwarded-for'] || ''
  if (ip) markWalletRequested(ip)

  const credits = await getWalletBalance(walletId)
  return { credits }
})
