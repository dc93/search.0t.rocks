/**
 * Query builder: converts URL query params into Elasticsearch Query DSL.
 *
 * Returns a `bool` query with `must`, `should`, and `must_not` clauses.
 */

const COMMON_EMAIL_DOMAINS = [
  'gmail', 'yahoo', 'hotmail', 'outlook', 'aol', 'icloud', 'mail',
  'protonmail', 'zoho', 'msn', 'yandex', 'gmx', 'live', 'inbox',
  'ymail', 'comcast', 'verizon', 'att', 'sbcglobal', 'cox',
  'earthlink', 'charter', 'optonline', 'frontier', 'windstream',
  'btinternet', 'virginmedia', 'talktalk', 'sky', 'orange', 'tiscali',
]

// Fields that use `keyword` type for exact matching
const KEYWORD_FIELDS = new Set([
  'country', 'state', 'gender', 'ethnicity', 'source', 'zipCode',
  'autoMake', 'autoModel', 'autoYear', 'autoBody', 'autoClass',
])

// Fields that use `text` type (analyzed, supports partial match)
const TEXT_FIELDS = new Set([
  'firstName', 'lastName', 'middleName', 'emails', 'usernames',
  'address', 'city', 'asnOrg', 'domain', 'vin', 'VRN',
  'phoneNumbers', 'continent', 'dob',
])

export interface EsQueryResult {
  query: Record<string, unknown>
  additionalQueries: Record<string, unknown>[]
  queryDescription: string
}

export function buildEsQuery(
  params: Record<string, string | string[]>
): EsQueryResult | { error: string } {
  const must: Record<string, unknown>[] = []
  const should: Record<string, unknown>[] = []
  const mustNot: Record<string, unknown>[] = []
  const additionalQueries: Record<string, unknown>[] = []
  const isExact = params.exact === 'true' || params.exact === '1'
  const descriptions: string[] = []

  // All known searchable fields
  const allFields = [...KEYWORD_FIELDS, ...TEXT_FIELDS, 'passwords', 'ips', 'asn', 'birthYear']

  for (const field of allFields) {
    const positiveVal = params[field]
    const negativeVal = params[`not${field}`]

    if (positiveVal !== undefined) {
      const values = Array.isArray(positiveVal) ? positiveVal : [positiveVal]

      // Passwords with multiple values: OR logic (extended hash search)
      if (field === 'passwords' && values.length > 1) {
        must.push({
          bool: {
            should: values.map((pw) => ({ term: { passwords: pw } })),
            minimum_should_match: 1,
          },
        })
        descriptions.push(`passwords=[${values.length} variants]`)
        continue
      }

      for (const v of values) {
        if (!v.trim()) continue
        const clause = buildFieldClause(field, v.trim(), isExact)
        if (clause) {
          must.push(clause)
          descriptions.push(`${field}=${v}`)
        }
      }
    }

    if (negativeVal !== undefined) {
      const values = Array.isArray(negativeVal) ? negativeVal : [negativeVal]
      for (const v of values) {
        if (!v.trim()) continue
        const clause = buildFieldClause(field, v.trim(), isExact)
        if (clause) mustNot.push(clause)
      }
    }
  }

  // Handle emails: additional queries for local-part and domain
  if (params.emails !== undefined && typeof params.emails === 'string') {
    const email = params.emails
    const parts = email.split('@')

    if (parts.length === 2 && !email.includes('*')) {
      additionalQueries.push({ match_phrase: { emails: parts[0] } })

      const domain = parts[1]
      const isCommon = COMMON_EMAIL_DOMAINS.some((d) =>
        domain.toLowerCase().startsWith(d)
      )
      if (!isCommon) {
        additionalQueries.push({ match: { emails: domain } })
      }
    }
  }

  // Handle firstName + lastName: additional email-based wildcard
  if (
    params.firstName &&
    params.lastName &&
    typeof params.firstName === 'string' &&
    typeof params.lastName === 'string' &&
    !isExact
  ) {
    additionalQueries.push({
      wildcard: {
        'emails.keyword': {
          value: `*${params.firstName.toLowerCase()}*${params.lastName.toLowerCase()}*`,
        },
      },
    })
  }

  if (must.length === 0 && should.length === 0) {
    return { error: 'No query provided.' }
  }

  if (must.length === 0 && mustNot.length > 0) {
    return { error: 'Cannot use NOT queries without a positive query.' }
  }

  const boolQuery: Record<string, unknown> = {}
  if (must.length > 0) boolQuery.must = must
  if (should.length > 0) {
    boolQuery.should = should
    boolQuery.minimum_should_match = 1
  }
  if (mustNot.length > 0) boolQuery.must_not = mustNot

  return {
    query: { bool: boolQuery },
    additionalQueries,
    queryDescription: descriptions.join(', '),
  }
}

function buildFieldClause(
  field: string,
  value: string,
  exact: boolean
): Record<string, unknown> | null {
  if (!value) return null

  // Keyword fields → always exact term match
  if (KEYWORD_FIELDS.has(field)) {
    return { term: { [field]: value } }
  }

  // IP addresses → exact term
  if (field === 'ips') return { term: { ips: value } }

  // ASN → numeric
  if (field === 'asn') {
    const num = parseInt(value, 10)
    return isNaN(num) ? null : { term: { asn: num } }
  }

  // Birth year → exact
  if (field === 'birthYear') return { term: { birthYear: value } }

  // Passwords → exact term (hashes, plaintext)
  if (field === 'passwords') return { term: { passwords: value } }

  // Phone numbers → wildcard on digits
  if (field === 'phoneNumbers') {
    const digits = value.replace(/\D+/g, '')
    if (digits.length < 7) return null
    return { wildcard: { phoneNumbers: { value: `*${digits}*` } } }
  }

  // VIN → lowercase exact
  if (field === 'vin') return { term: { vin: value.toLowerCase() } }

  // VRN → analyzed match
  if (field === 'VRN') return { match: { VRN: value } }

  // Emails → wildcard if *, otherwise match/match_phrase
  if (field === 'emails') {
    if (value.includes('*')) {
      return { wildcard: { 'emails.keyword': { value: value.toLowerCase() } } }
    }
    return exact
      ? { match_phrase: { emails: value } }
      : { match: { emails: { query: value, operator: 'and' } } }
  }

  // Usernames → phrase for exact, match for fuzzy
  if (field === 'usernames') {
    return exact
      ? { match_phrase: { usernames: value } }
      : { match: { usernames: { query: value, operator: 'and' } } }
  }

  // Other text fields
  if (TEXT_FIELDS.has(field)) {
    return exact
      ? { match_phrase: { [field]: value } }
      : { match: { [field]: { query: value, operator: 'and' } } }
  }

  return { match: { [field]: value } }
}
