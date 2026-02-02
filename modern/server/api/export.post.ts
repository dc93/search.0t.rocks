import { v4 as uuidv4 } from 'uuid'
import { spawn } from 'child_process'
import {
  getWalletBalance,
  removeWalletBalance,
  createExportJob,
} from '../utils/elasticsearch'
import { buildEsQuery } from '../utils/queryBuilder'

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const query = getQuery(event)

  if (!body?.walletId || !body?.exportCount) {
    setResponseStatus(event, 400)
    return { error: true, message: 'Missing walletId or exportCount.' }
  }

  let exportCount = typeof body.exportCount === 'number'
    ? body.exportCount
    : parseInt(body.exportCount, 10)

  if (exportCount <= 0 || isNaN(exportCount)) {
    setResponseStatus(event, 400)
    return { error: true, message: 'Invalid export count.' }
  }

  if (!UUID_REGEX.test(body.walletId)) {
    setResponseStatus(event, 400)
    return { error: true, message: 'Invalid wallet ID.' }
  }

  const credits = await getWalletBalance(body.walletId)
  const cost = (exportCount - 100) / 10

  if (cost < 0) {
    setResponseStatus(event, 400)
    return { error: true, message: 'Invalid export count.' }
  }

  if (cost > credits) {
    setResponseStatus(event, 400)
    return { error: true, message: 'Insufficient credits.' }
  }

  // Build query
  const requestedQuery: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(query)) {
    if (key !== 'wt' && (typeof value === 'string' || Array.isArray(value))) {
      requestedQuery[key] = value as string | string[]
    }
  }

  const queryBuilt = buildEsQuery(requestedQuery)
  if ('error' in queryBuilt) {
    setResponseStatus(event, 400)
    return { error: true, message: queryBuilt.error }
  }

  const jobid = uuidv4()

  const payload = {
    status: 'started',
    jobid,
    cost,
    query: queryBuilt.queryDescription,
    exportCount,
    success: true,
    walletId: body.walletId,
  }

  // Deduct credits
  removeWalletBalance(body.walletId, cost).catch(console.error)

  // Store export job in Elasticsearch
  createExportJob({
    id: jobid,
    cost,
    wallet: body.walletId,
    query: queryBuilt.queryDescription,
    status: 'started',
    count: exportCount,
  }).catch(console.error)

  // Spawn export worker
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
  const pythonProcess = spawn('python3', ['exports/doExport.py', encodedPayload])

  pythonProcess.stdout.on('data', (data) => {
    console.log(`Export Job ${jobid}: ${data}`)
  })
  pythonProcess.stderr.on('data', (data) => {
    console.error(`Export Job ${jobid}: ${data}`)
  })

  return payload
})
