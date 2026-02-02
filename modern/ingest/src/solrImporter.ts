import axios, { AxiosError } from 'axios'
import type { IngestConfig } from './config.js'
import { logger } from './logger.js'

/**
 * Solr batch importer with backpressure control.
 *
 * - Accumulates documents until batchSize is reached
 * - Posts batches to random Solr server
 * - Limits concurrent uploads to maxConcurrent
 * - Retries on transient failures (5xx, network errors)
 */
export class SolrImporter {
  private servers: string[]
  private batchSize: number
  private commitWithin: number
  private maxConcurrent: number

  private buffer: Record<string, unknown>[] = []
  private inflight = 0
  private totalImported = 0
  private totalErrors = 0

  constructor(config: IngestConfig) {
    this.servers = config.solr.servers
    this.batchSize = config.solr.batchSize
    this.commitWithin = config.solr.commitWithin
    this.maxConcurrent = config.solr.maxConcurrent
  }

  get stats() {
    return {
      imported: this.totalImported,
      errors: this.totalErrors,
      buffered: this.buffer.length,
      inflight: this.inflight,
    }
  }

  /**
   * Add a document to the buffer. Flushes automatically when buffer is full.
   * Applies backpressure by awaiting if too many concurrent uploads.
   */
  async add(doc: Record<string, unknown>): Promise<void> {
    this.buffer.push(doc)

    if (this.buffer.length >= this.batchSize) {
      // Backpressure: wait if we have too many in-flight
      while (this.inflight >= this.maxConcurrent) {
        await sleep(100)
      }
      await this.flushBuffer()
    }
  }

  /**
   * Flush remaining buffer and commit.
   */
  async flush(): Promise<void> {
    while (this.buffer.length > 0) {
      while (this.inflight >= this.maxConcurrent) {
        await sleep(100)
      }
      await this.flushBuffer()
    }

    // Wait for all in-flight to complete
    while (this.inflight > 0) {
      await sleep(100)
    }

    // Explicit commit
    await this.commit()
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return

    const batch = this.buffer.splice(0, this.batchSize)
    this.inflight++

    try {
      await this.postBatch(batch)
      this.totalImported += batch.length
    } catch (err) {
      this.totalErrors += batch.length
      logger.error({ err, batchSize: batch.length }, 'Failed to import batch')
    } finally {
      this.inflight--
    }
  }

  private async postBatch(
    batch: Record<string, unknown>[],
    retries = 3
  ): Promise<void> {
    const server = this.servers[Math.floor(Math.random() * this.servers.length)]

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await axios.post(
          server,
          batch,
          {
            params: { commitWithin: this.commitWithin },
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          }
        )
        return
      } catch (err) {
        const status = (err as AxiosError)?.response?.status

        // Client error (4xx) — don't retry
        if (status && status >= 400 && status < 500) {
          logger.error({ status, attempt }, 'Solr rejected batch (4xx)')
          throw err
        }

        // Transient error — retry with backoff
        if (attempt < retries) {
          const delay = attempt * 2000
          logger.warn({ attempt, retries, delay }, 'Retrying batch...')
          await sleep(delay)
        } else {
          throw err
        }
      }
    }
  }

  private async commit(): Promise<void> {
    const server = this.servers[Math.floor(Math.random() * this.servers.length)]
    try {
      await axios.get(server.replace('/update', '/update'), {
        params: { commit: true },
        timeout: 30000,
      })
      logger.info('Solr commit sent')
    } catch (err) {
      logger.error({ err }, 'Solr commit failed')
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
