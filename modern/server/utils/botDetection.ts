import { standardDeviation } from 'simple-statistics'
import crypto from 'crypto'

const blacklistedIps = new Set<string>()
const whitelistedApiKeys: string[] = []
const lastQueryTime: Record<string, number> = {}
const lastQueryTimes: Record<string, number[]> = {}
const numLookupsPerIP: Record<string, number> = {}
const walletRequestedIps = new Set<string>()

const WINDOW_SIZE = 40
const MIN_SAMPLES = 20
const STDDEV_THRESHOLD = 1800
const MAX_LOOKUPS = 200
const MIN_INTERVAL_MS = 5000

export function markWalletRequested(ip: string) {
  walletRequestedIps.add(ip)
}

export function isWhitelistedApiKey(key: string): boolean {
  return whitelistedApiKeys.includes(key)
}

export function isAutomated(headers: Record<string, string | undefined>, query: Record<string, unknown>): boolean {
  const ip = headers['cf-connecting-ip'] || headers['x-forwarded-for'] || ''
  const userAgent = headers['user-agent'] || ''

  if (blacklistedIps.has(ip)) return true

  if (whitelistedApiKeys.some((key) => userAgent.includes(key))) return false

  if (Object.keys(query).length === 1 && query.emails && walletRequestedIps.has(ip)) {
    return false
  }

  return false
}

export function checkIPAutomatedSTDDEV(headers: Record<string, string | undefined>): boolean {
  const ip = headers['cf-connecting-ip'] || headers['x-forwarded-for'] || ''
  const userAgent = headers['user-agent'] || ''

  if (whitelistedApiKeys.some((key) => userAgent.includes(key))) return false

  if (!ip || ip === '0.0.0.0') return true

  numLookupsPerIP[ip] = (numLookupsPerIP[ip] ?? 0) + 1

  if (numLookupsPerIP[ip] > MAX_LOOKUPS) {
    blacklistedIps.add(ip)
    return true
  }

  if (lastQueryTime[ip] === undefined) {
    lastQueryTime[ip] = Date.now()
    return false
  }

  const timeSinceLastQuery = Date.now() - lastQueryTime[ip]

  if (!lastQueryTimes[ip]) lastQueryTimes[ip] = []

  if (lastQueryTimes[ip].length < WINDOW_SIZE) {
    lastQueryTimes[ip].push(timeSinceLastQuery)
  } else {
    lastQueryTimes[ip].shift()
    lastQueryTimes[ip].push(timeSinceLastQuery)
  }

  if (lastQueryTimes[ip].length >= MIN_SAMPLES) {
    const sd = standardDeviation(lastQueryTimes[ip])
    if (sd < STDDEV_THRESHOLD) {
      blacklistedIps.add(ip)
      return true
    }

    if (lastQueryTimes[ip].every((t) => t < MIN_INTERVAL_MS)) {
      blacklistedIps.add(ip)
      return true
    }
  }

  lastQueryTime[ip] = Date.now()
  return false
}

export function createFakeResponse(json: boolean) {
  const fakeId = crypto.randomUUID()
  const records = [
    {
      id: fakeId,
      firstName: 'Automated scraping detected.',
      lastName: 'Please contact the administrator to be whitelisted.',
      email: 'This data is free to use. Do not pay for access.',
    },
  ]

  if (json) {
    return { resultCount: 0, count: 0, records }
  }

  // Non-JSON: return structure with field strings for template rendering
  return {
    resultCount: 0,
    count: 0,
    records: records.map((r) => ({
      ...r,
      fields: Object.entries(r)
        .filter(([k]) => k !== 'id')
        .map(([k, v]) => `${k}: ${v}`),
    })),
  }
}
