import axios from 'axios'
import type { SolrRecord, SolrResponse } from '~/types'

function getServers(): string[] {
  const config = useRuntimeConfig()
  return config.solrServers as string[]
}

function getRandServer(): string {
  const servers = getServers()
  return servers[Math.floor(Math.random() * servers.length)]
}

function getCollectionUrl(collection: string): string {
  return getRandServer().replace('BigData', collection)
}

export async function queryForDocs(
  query: string,
  limit = 100,
  start = 0,
  sort?: string
): Promise<SolrResponse> {
  const { data } = await axios.get(getRandServer(), {
    params: { q: query, rows: limit, sort, start },
  })
  return {
    numDocs: data.response.numFound,
    records: data.response.docs as SolrRecord[],
  }
}

export async function queryForDocsSpatial(
  latLong: string,
  distanceKm: number
): Promise<SolrResponse> {
  const { data } = await axios.get(getRandServer(), {
    params: {
      q: 'latLong:*',
      rows: 500,
      fq: '{!geofilt sfield=latLong}',
      pt: latLong,
      d: distanceKm,
    },
  })
  return {
    numDocs: data.response.numFound,
    records: data.response.docs as SolrRecord[],
  }
}

export async function queryForExportDocs(
  query: string,
  limit = 100,
  start = 0,
  sort?: string
): Promise<SolrResponse> {
  const { data } = await axios.get(getCollectionUrl('Exports'), {
    params: { q: query, rows: limit, sort, start },
  })
  return {
    numDocs: data.response.numFound,
    records: data.response.docs as SolrRecord[],
  }
}

export async function getWalletBalance(walletId: string): Promise<number> {
  try {
    const { data } = await axios.get(getCollectionUrl('Wallets'), {
      params: { q: `id:"${walletId}"` },
    })
    return data.response.docs[0]?.credits ?? 0
  } catch {
    return 0
  }
}

export async function addWalletBalance(
  walletId: string,
  credits: number
): Promise<boolean> {
  if (typeof credits !== 'number') throw new Error('Credits must be a number')

  const oldBalance = await getWalletBalance(walletId)
  const newBalance = oldBalance + credits

  try {
    await axios.post(
      getCollectionUrl('Wallets').replace('select', 'update'),
      { add: { doc: { id: walletId, credits: newBalance } } },
      { params: { commit: true } }
    )
    return true
  } catch {
    return false
  }
}

export async function removeWalletBalance(
  walletId: string,
  credits: number
): Promise<boolean> {
  if (typeof credits !== 'number') throw new Error('Credits must be a number')

  const oldBalance = await getWalletBalance(walletId)
  const newBalance = oldBalance - credits

  try {
    await axios.post(
      getCollectionUrl('Wallets').replace('select', 'update'),
      { add: { doc: { id: walletId, credits: newBalance } } },
      { params: { commit: true } }
    )
    return true
  } catch {
    return false
  }
}

export async function getSimilarRecords(
  record: SolrRecord
): Promise<SolrRecord[]> {
  const scoresList: Record<string, number> = {}
  const relatedDocIDs: string[] = []

  const fieldQueries = [
    ...(record.emails || []).map((email) =>
      axios
        .get(getRandServer(), {
          params: {
            q: `emails:"${email.replace(/"/gi, '').replace(/\//gi, '')}"`,
            rows: 20,
            fl: 'id',
          },
        })
        .then(({ data }) => {
          for (const doc of data.response.docs) {
            if (doc.id === record.id) continue
            scoresList[doc.id] = (scoresList[doc.id] ?? 0) + (scoresList[doc.id] ? 5 : 15)
            relatedDocIDs.push(doc.id)
          }
        })
    ),
    ...(record.usernames || []).map((username) =>
      axios
        .get(getRandServer(), {
          params: {
            q: `usernames:"${username.replace(/"/gi, '').replace(/\//gi, '')}"`,
            rows: 20,
            fl: 'id',
          },
        })
        .then(({ data }) => {
          for (const doc of data.response.docs) {
            if (doc.id === record.id) continue
            scoresList[doc.id] = (scoresList[doc.id] ?? 0) + (scoresList[doc.id] ? 5 : 15)
            relatedDocIDs.push(doc.id)
          }
        })
    ),
    ...['emails', 'usernames', 'phoneNumbers', 'address_search', 'firstName,lastName'].map(
      (fl) =>
        axios
          .get(getRandServer(), {
            params: {
              q: `id:${record.id}`,
              mlt: true,
              'mlt.fl': fl,
              'mlt.mindf': fl === 'emails' ? 2 : 1,
              'mlt.mintf': fl === 'emails' ? 2 : 1,
              'mlt.match.include': true,
            },
          })
          .then(({ data }) => {
            for (const item of data.moreLikeThis) {
              if (typeof item === 'object' && item.docs) {
                for (const relatedDoc of item.docs) {
                  scoresList[relatedDoc.id] =
                    (scoresList[relatedDoc.id] ?? 0) + relatedDoc.score
                  relatedDocIDs.push(relatedDoc.id)
                }
              }
            }
          })
    ),
  ]

  await Promise.all(fieldQueries.map((p) => p.catch(() => {})))

  const uniqueDocIDs = [...new Set(relatedDocIDs)]
  const results = await Promise.all(
    uniqueDocIDs.map((id) => queryForDocs(`id:${id}`).catch(() => ({ numDocs: 0, records: [] })))
  )

  const docs: SolrRecord[] = results.flatMap((r) =>
    r.records.map((rec) => ({
      ...rec,
      'similarity score': scoresList[rec.id] ?? 0,
    }))
  )

  docs.sort((a, b) => (scoresList[b.id] ?? 0) - (scoresList[a.id] ?? 0))

  return docs
}
