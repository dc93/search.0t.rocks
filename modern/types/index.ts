export interface SolrRecord {
  id: string
  firstName?: string
  lastName?: string
  middleName?: string
  emails?: string[]
  usernames?: string[]
  passwords?: string[]
  phoneNumbers?: string[]
  address?: string
  city?: string
  state?: string
  zipCode?: string
  latLong?: string
  gender?: string
  birthYear?: string
  ethnicity?: string
  income?: string
  domain?: string
  ips?: string[]
  asn?: string
  asnOrg?: string
  country?: string
  continent?: string
  source?: string
  vin?: string
  autoMake?: string
  autoModel?: string
  autoYear?: string
  VRN?: string
  photographs?: string[]
  photos?: string[]
  notes?: string
  'similarity score'?: number
  _version_?: number
  [key: string]: unknown
}

export interface SolrResponse {
  numDocs: number
  records: SolrRecord[]
}

export interface QueryBuilderResult {
  query: string
  additionalQuery: string[]
  doAdditionalQuery: boolean
}

export interface WalletBalance {
  credits: number
}

export interface ExportJob {
  id: string
  jobid: string
  status: 'started' | 'complete' | 'failed'
  query: string
  cost: number
  count: number
  wallet: string
  link?: string
  exportCount?: number
}

export interface SearchQuery {
  field: string
  value: string
  not?: boolean
  extendedSearch?: boolean
}
