import { ref } from 'vue'
import type { SearchQuery } from '~/types'

export const QUERY_OPTIONS = [
  'First Name', 'Last Name', 'Email', 'Username', 'Password',
  'Domain', 'IP Address', 'ASN Number', 'ASN Name', 'Continent',
  'Country', 'Phone', 'Address', 'License Plate Number', 'Birth Year',
  'VIN', 'City', 'State', 'Zip', 'Source',
] as const

export const QUERY_FIELD_MAP: Record<string, string> = {
  'First Name': 'firstName',
  'Last Name': 'lastName',
  'Email': 'emails',
  'Username': 'usernames',
  'Password': 'passwords',
  'Domain': 'domain',
  'IP Address': 'ips',
  'ASN Number': 'asn',
  'ASN Name': 'asnOrg',
  'Continent': 'continent',
  'Country': 'country',
  'Phone': 'phoneNumbers',
  'Address': 'address',
  'License Plate Number': 'VRN',
  'Birth Year': 'birthYear',
  'VIN': 'vin',
  'City': 'city',
  'State': 'state',
  'Zip': 'zipCode',
  'Source': 'source',
}

async function computeHash(algo: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const buffer = await crypto.subtle.digest(algo, encoder.encode(data))
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function generatePasswordHashes(password: string): Promise<string[]> {
  const hashes: string[] = []
  try {
    hashes.push(await computeHash('SHA-1', password))
    hashes.push(await computeHash('SHA-256', password))
    hashes.push(await computeHash('SHA-384', password))
    hashes.push(await computeHash('SHA-512', password))
  } catch {
    // Web Crypto may not support all algorithms in all environments
  }
  return hashes
}

export function useSearch() {
  const queries = ref<SearchQuery[]>([
    { field: 'First Name', value: '' },
  ])
  const exact = ref(false)
  const maxQueries = 5

  function addQuery() {
    if (queries.value.length >= maxQueries) return
    queries.value.push({ field: 'First Name', value: '' })
  }

  function removeQuery(index: number) {
    if (queries.value.length <= 1) return
    queries.value.splice(index, 1)
  }

  function hasValidQuery(): boolean {
    return queries.value.some((q) => q.value.trim().length > 0)
  }

  async function buildQueryString(): Promise<string> {
    const params = new URLSearchParams()

    for (const q of queries.value) {
      if (!q.value.trim()) continue

      const field = QUERY_FIELD_MAP[q.field]
      if (!field) continue

      const paramKey = q.not ? `not${field}` : field
      params.append(paramKey, q.value)

      // Extended password search: generate hashes and append them
      if (q.extendedSearch && field === 'passwords' && !q.not) {
        const hashes = await generatePasswordHashes(q.value)
        for (const hash of hashes) {
          params.append('passwords', hash)
        }
      }
    }

    if (exact.value) {
      params.set('exact', 'true')
    }

    return params.toString()
  }

  async function navigateToResults() {
    if (!hasValidQuery()) return
    const qs = await buildQueryString()
    if (qs) {
      navigateTo(`/records?${qs}`)
    }
  }

  return {
    queries,
    exact,
    maxQueries,
    addQuery,
    removeQuery,
    hasValidQuery,
    buildQueryString,
    navigateToResults,
  }
}
