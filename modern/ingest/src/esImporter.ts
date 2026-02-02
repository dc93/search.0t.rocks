import { Client } from '@elastic/elasticsearch'
import type { IngestConfig } from './config.js'
import { logger } from './logger.js'

/**
 * Elasticsearch bulk importer with backpressure control.
 *
 * - Accumulates documents until batchSize is reached
 * - Uses the _bulk API for maximum throughput
 * - Limits concurrent uploads to maxConcurrent
 * - Retries on transient failures (5xx, connection errors)
 */
export class EsImporter {
  private client: Client
  private index: string
  private batchSize: number
  private maxConcurrent: number

  private buffer: Record<string, unknown>[] = []
  private inflight = 0
  private totalImported = 0
  private totalErrors = 0

  constructor(config: IngestConfig) {
    this.client = new Client({
      node: config.elasticsearch.url,
      requestTimeout: 60000,
      maxRetries: 3,
    })
    this.index = config.elasticsearch.index
    this.batchSize = config.elasticsearch.batchSize
    this.maxConcurrent = config.elasticsearch.maxConcurrent
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
      while (this.inflight >= this.maxConcurrent) {
        await sleep(100)
      }
      await this.flushBuffer()
    }
  }

  /**
   * Flush remaining buffer and wait for all in-flight.
   */
  async flush(): Promise<void> {
    while (this.buffer.length > 0) {
      while (this.inflight >= this.maxConcurrent) {
        await sleep(100)
      }
      await this.flushBuffer()
    }

    while (this.inflight > 0) {
      await sleep(100)
    }

    // Force refresh
    try {
      await this.client.indices.refresh({ index: this.index })
      logger.info('Elasticsearch refresh sent')
    } catch (err) {
      logger.error({ err }, 'Elasticsearch refresh failed')
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return

    const batch = this.buffer.splice(0, this.batchSize)
    this.inflight++

    try {
      await this.bulkIndex(batch)
    } catch (err) {
      this.totalErrors += batch.length
      logger.error({ err, batchSize: batch.length }, 'Failed to import batch')
    } finally {
      this.inflight--
    }
  }

  private async bulkIndex(
    batch: Record<string, unknown>[],
    retries = 3
  ): Promise<void> {
    // Build bulk body: alternating action/document lines
    const operations = batch.flatMap((doc) => {
      const id = doc.id as string | undefined
      const body = { ...doc }
      delete body.id

      return [
        { index: { _index: this.index, ...(id ? { _id: id } : {}) } },
        body,
      ]
    })

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.client.bulk({
          operations,
          refresh: false,
        })

        if (result.errors) {
          let errorCount = 0
          for (const item of result.items) {
            const action = item.index || item.create
            if (action?.error) {
              errorCount++
              if (errorCount <= 3) {
                logger.warn(
                  { type: action.error.type, reason: action.error.reason },
                  'Bulk item error'
                )
              }
            }
          }
          this.totalErrors += errorCount
          this.totalImported += batch.length - errorCount
        } else {
          this.totalImported += batch.length
        }

        return
      } catch (err: any) {
        const status = err?.meta?.statusCode

        // Client error (4xx) — don't retry
        if (status && status >= 400 && status < 500) {
          logger.error({ status, attempt }, 'ES rejected batch (4xx)')
          throw err
        }

        // Transient error — retry with backoff
        if (attempt < retries) {
          const delay = attempt * 2000
          logger.warn({ attempt, retries, delay }, 'Retrying bulk...')
          await sleep(delay)
        } else {
          throw err
        }
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
