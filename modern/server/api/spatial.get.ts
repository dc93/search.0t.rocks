import { queryForDocsSpatial } from '../utils/solr'

const LAT_LONG_REGEX = /^-?\d{1,3}(?:\.\d{1,20})?,-?\d{1,3}(?:\.\d{1,20})?$/

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  if (!query.latLong || typeof query.latLong !== 'string') {
    setResponseStatus(event, 400)
    return { error: true, message: 'Provide a latLong parameter (e.g. 38.81,-90.79).' }
  }

  if (!LAT_LONG_REGEX.test(query.latLong)) {
    setResponseStatus(event, 400)
    return { error: true, message: 'Please only send coordinates as lat,long.' }
  }

  const d = parseFloat((query.d as string) || '0.2')
  if (d < 0.1 || d > 1000) {
    setResponseStatus(event, 400)
    return { error: true, message: 'Distance (d) must be between 0.1 and 1000 km.' }
  }

  const result = await queryForDocsSpatial(query.latLong, d).catch(() => ({
    numDocs: 0,
    records: [],
  }))

  return result
})
