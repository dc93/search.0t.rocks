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

const HASH_TYPES = ['MD5', 'SHA1', 'SHA256', 'SHA512', 'SHA3', 'SHA224', 'SHA384', 'RIPEMD160']

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

  function buildQueryString(): string {
    const params = new URLSearchParams()

    for (const q of queries.value) {
      if (!q.value.trim()) continue

      const field = QUERY_FIELD_MAP[q.field]
      if (!field) continue

      const paramKey = q.not ? `not${field}` : field
      params.append(paramKey, q.value)

      // Extended password search: hashes are computed client-side
      // and appended as additional 'passwords' params
      if (q.extendedSearch && field === 'passwords') {
        // Hash generation is handled in the component via Web Crypto API
      }
    }

    if (exact.value) {
      params.set('exact', 'true')
    }

    return params.toString()
  }

  function navigateToResults() {
    const qs = buildQueryString()
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
    buildQueryString,
    navigateToResults,
  }
}
