import type { QueryBuilderResult } from '~/types'

const COMMON_EMAIL_DOMAINS = [
  'gmail', 'yahoo', 'hotmail', 'outlook', 'aol', 'icloud', 'mail',
  'protonmail', 'zoho', 'msn', 'yandex', 'gmx', 'live', 'inbox',
  'ymail', 'comcast', 'verizon', 'att', 'sbcglobal', 'cox',
  'earthlink', 'charter', 'optonline', 'frontier', 'windstream',
  'btinternet', 'virginmedia', 'talktalk', 'sky', 'orange', 'tiscali',
]

function sanitizeQuery(query: string): string {
  return query
    .replace(/[^\w\s$:.@\-*\u0400-\u04FF]/gi, '?')
    .replace(/WRfKdFVogXnk82/g, '"')
}

function wrap(value: string): string {
  return `WRfKdFVogXnk82${value}WRfKdFVogXnk82`
}

interface FieldHandler {
  field: string
  transform?: (value: string, exact?: boolean) => string
  wrapExact?: boolean
  wrapAlways?: boolean
}

const FIELD_HANDLERS: Record<string, FieldHandler> = {
  firstName: { field: 'firstName', transform: (v) => v.replace(' ', '?') },
  lastName: { field: 'lastName', transform: (v) => v.replace(' ', '?') },
  birthYear: { field: 'birthYear' },
  ips: { field: 'ips', transform: (v) => wrap(v) },
  asn: { field: 'asn' },
  asnOrg: { field: 'asnOrg', wrapAlways: true },
  country: { field: 'country', wrapAlways: true },
  continent: { field: 'continent', wrapAlways: true },
  source: { field: 'source', wrapAlways: true },
  address: { field: 'address', wrapAlways: true },
  city: { field: 'city' },
  zipCode: { field: 'zipCode' },
  state: { field: 'state' },
  usernames: { field: 'usernames', wrapExact: true },
}

export function buildQuery(
  requestedQuery: Record<string, string | string[]>
): QueryBuilderResult | { error: string } {
  const query: string[] = []
  const orQuery: string[] = []
  const notQuery: string[] = []
  const additionalQuery: string[] = []
  let doAdditionalQuery = false
  const isExact = !!requestedQuery.exact

  // Handle standard fields
  for (const [key, handler] of Object.entries(FIELD_HANDLERS)) {
    const value = requestedQuery[key]
    const notValue = requestedQuery[`not${key}`]

    if (value !== undefined && typeof value === 'string') {
      let processed = handler.transform ? handler.transform(value, isExact) : value
      if (handler.wrapAlways) {
        processed = wrap(processed)
      } else if (handler.wrapExact && isExact) {
        processed = wrap(processed)
      }
      query.push(`${handler.field}:${processed}`)
    }

    if (notValue !== undefined) {
      const values = Array.isArray(notValue) ? notValue : [notValue]
      for (const v of values) {
        const processed = handler.transform ? handler.transform(v, isExact) : v
        notQuery.push(`${handler.field}:${handler.wrapAlways ? wrap(processed) : processed}`)
      }
    }
  }

  // Handle domain (special exact logic)
  if (requestedQuery.domain !== undefined && typeof requestedQuery.domain === 'string') {
    const v = requestedQuery.domain.replace(' ', '?')
    query.push(isExact ? `domain:${wrap(v)}` : `domain:${v}`)
  }
  if (requestedQuery.notdomain !== undefined) {
    const values = Array.isArray(requestedQuery.notdomain)
      ? requestedQuery.notdomain
      : [requestedQuery.notdomain]
    for (const v of values) {
      notQuery.push(`domain:${wrap(v.replace(' ', '?'))}`)
    }
  }

  // Handle firstName + lastName additional email query
  if (
    requestedQuery.firstName &&
    requestedQuery.lastName &&
    typeof requestedQuery.firstName === 'string' &&
    typeof requestedQuery.lastName === 'string' &&
    !isExact
  ) {
    additionalQuery.push(
      `emails:${requestedQuery.firstName.replace(' ', '?')}?${requestedQuery.lastName.replace(' ', '?')}`
    )
    doAdditionalQuery = true
  }

  // Handle emails (complex logic)
  if (requestedQuery.emails !== undefined && typeof requestedQuery.emails === 'string') {
    const email = requestedQuery.emails
    const hasWildcard = email.includes('*')
    const emailNormalized = email.replace('@', '?')

    if (hasWildcard) {
      query.push(`emails:${emailNormalized}`)
    } else {
      query.push(isExact ? `emails:${wrap(emailNormalized)}` : `emails:${emailNormalized}`)
    }

    const emailSplit = email.split('@')

    if (!hasWildcard) {
      additionalQuery.push(`emails:${wrap(emailSplit[0])}`)
    }

    doAdditionalQuery = true

    if (emailSplit.length === 2) {
      const domain = emailSplit[1]
      const isCommon = COMMON_EMAIL_DOMAINS.some((d) =>
        domain.toLowerCase().startsWith(d)
      )
      if (!isCommon) {
        additionalQuery.push(`emails:${domain}`)
      }
    }
  }
  if (requestedQuery.notemails !== undefined) {
    const values = Array.isArray(requestedQuery.notemails)
      ? requestedQuery.notemails
      : [requestedQuery.notemails]
    for (const v of values) {
      notQuery.push(`emails:${wrap(v.replace('@', '?'))}`)
    }
  }

  // Handle VRN
  if (requestedQuery.VRN !== undefined && typeof requestedQuery.VRN === 'string') {
    query.push(`VRN:${requestedQuery.VRN.toLowerCase()}`)
  }
  if (requestedQuery.notVRN !== undefined) {
    const values = Array.isArray(requestedQuery.notVRN)
      ? requestedQuery.notVRN
      : [requestedQuery.notVRN]
    for (const v of values) {
      notQuery.push(`VRN:${v.toLowerCase()}`)
    }
  }

  // Handle phoneNumbers
  if (requestedQuery.phoneNumbers !== undefined && typeof requestedQuery.phoneNumbers === 'string') {
    const digits = requestedQuery.phoneNumbers.replace(/\D+/g, '')
    query.push(`phoneNumbers:${wrap(digits)}`)
    if (isExact) {
      additionalQuery.push(`phoneNumbers:1${digits}`, `phoneNumbers:7${digits}`)
      doAdditionalQuery = true
    }
  }
  if (requestedQuery.notphoneNumbers !== undefined) {
    const values = Array.isArray(requestedQuery.notphoneNumbers)
      ? requestedQuery.notphoneNumbers
      : [requestedQuery.notphoneNumbers]
    for (const v of values) {
      notQuery.push(`phoneNumbers:${v}`)
    }
  }

  // Handle passwords
  if (requestedQuery.passwords !== undefined) {
    if (typeof requestedQuery.passwords === 'string') {
      query.push(`passwords:${requestedQuery.passwords}`)
    } else if (Array.isArray(requestedQuery.passwords)) {
      for (const pw of requestedQuery.passwords) {
        orQuery.push(`passwords:${wrap(pw)}`)
      }
    }
  }
  if (requestedQuery.notpasswords !== undefined) {
    const values = Array.isArray(requestedQuery.notpasswords)
      ? requestedQuery.notpasswords
      : [requestedQuery.notpasswords]
    for (const v of values) {
      notQuery.push(`passwords:${v}`)
    }
  }

  // Handle VIN
  if (requestedQuery.vin !== undefined) {
    if (typeof requestedQuery.vin === 'string') {
      query.push(`vin:${requestedQuery.vin}`)
    } else if (Array.isArray(requestedQuery.vin)) {
      for (const v of requestedQuery.vin) {
        orQuery.push(`vin:${wrap(v)}`)
      }
    }
  }

  // Build final query string
  let queryBuilt = sanitizeQuery(query.join(' AND '))

  if (orQuery.length > 0) {
    const orPart = sanitizeQuery(orQuery.join(' OR '))
    queryBuilt = query.length > 0 ? `${queryBuilt} OR ${orPart}` : orPart
  }

  if (notQuery.length > 0) {
    if (query.length === 0) {
      return { error: 'Cannot use NOT queries without a positive query.' }
    }
    queryBuilt += ` NOT ${sanitizeQuery(notQuery.join(' NOT '))}`
  }

  return { query: queryBuilt, additionalQuery, doAdditionalQuery }
}

export { sanitizeQuery }
