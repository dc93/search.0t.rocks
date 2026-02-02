import { createReadStream } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { createHash } from 'crypto'
import { join } from 'path'
import { logger } from './logger.js'

/**
 * Tracks file hashes to prevent re-processing already imported files.
 *
 * Stores a JSON registry on disk mapping file hash → processing metadata.
 * Hash is computed from the first 64KB + file size (fast, avoids reading
 * multi-GB files entirely just for dedup).
 */

interface RegistryEntry {
  hash: string
  fileName: string
  processedAt: string
  recordsImported: number
  fileSize: number
}

export class FileHashRegistry {
  private registry: Map<string, RegistryEntry> = new Map()
  private registryPath: string
  private dirty = false

  constructor(registryDir: string) {
    this.registryPath = join(registryDir, 'processed-files.json')
  }

  async init(): Promise<void> {
    try {
      await mkdir(join(this.registryPath, '..'), { recursive: true })
      const data = await readFile(this.registryPath, 'utf-8')
      const entries: RegistryEntry[] = JSON.parse(data)
      for (const entry of entries) {
        this.registry.set(entry.hash, entry)
      }
      logger.info({ tracked: this.registry.size }, 'File hash registry loaded')
    } catch {
      logger.info('No existing file hash registry, starting fresh')
    }
  }

  /**
   * Compute a fast hash for a file: SHA-256 of (first 64KB + last 64KB + fileSize).
   * This avoids reading entire multi-GB files while still catching renamed duplicates.
   */
  async computeHash(filePath: string): Promise<{ hash: string; fileSize: number }> {
    const { stat } = await import('fs/promises')
    const stats = await stat(filePath)
    const fileSize = stats.size

    const hash = createHash('sha256')
    hash.update(`size:${fileSize}`)

    // Read first 64KB
    const headChunk = await this.readChunk(filePath, 0, 65536)
    hash.update(headChunk)

    // Read last 64KB if file is large enough
    if (fileSize > 131072) {
      const tailChunk = await this.readChunk(filePath, fileSize - 65536, 65536)
      hash.update(tailChunk)
    }

    return { hash: hash.digest('hex'), fileSize }
  }

  private readChunk(filePath: string, start: number, length: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      const stream = createReadStream(filePath, { start, end: start + length - 1 })
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', reject)
    })
  }

  /**
   * Check if a file has already been processed.
   */
  isProcessed(hash: string): RegistryEntry | null {
    return this.registry.get(hash) ?? null
  }

  /**
   * Mark a file as processed.
   */
  async markProcessed(hash: string, fileName: string, fileSize: number, recordsImported: number): Promise<void> {
    const entry: RegistryEntry = {
      hash,
      fileName,
      processedAt: new Date().toISOString(),
      recordsImported,
      fileSize,
    }
    this.registry.set(hash, entry)
    this.dirty = true
    await this.persist()
  }

  /**
   * Persist registry to disk.
   */
  async persist(): Promise<void> {
    if (!this.dirty) return
    try {
      const entries = Array.from(this.registry.values())
      await writeFile(this.registryPath, JSON.stringify(entries, null, 2))
      this.dirty = false
    } catch (err) {
      logger.warn({ err }, 'Failed to persist file hash registry')
    }
  }

  get size(): number {
    return this.registry.size
  }
}
