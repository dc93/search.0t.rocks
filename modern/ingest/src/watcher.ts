import chokidar from 'chokidar'
import { stat } from 'fs/promises'
import { extname, basename } from 'path'
import type { IngestConfig } from './config.js'
import { logger } from './logger.js'

export type FileCallback = (filePath: string) => Promise<void>

/**
 * Watches a directory for new files and invokes callback.
 *
 * - Uses chokidar for cross-platform fs.watch + polling fallback
 * - Waits for file to be fully written (stable size check)
 * - Ignores hidden files, temp files, and already-processing files
 */
export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null
  private processing = new Set<string>()
  private config: IngestConfig
  private allExtensions: Set<string>

  constructor(config: IngestConfig) {
    this.config = config
    this.allExtensions = new Set([
      ...config.processing.compressedExtensions,
      ...config.processing.textExtensions,
    ])
  }

  start(onFile: FileCallback): void {
    const { watchDir, processing } = this.config

    logger.info({ dir: watchDir }, 'Starting file watcher')

    this.watcher = chokidar.watch(watchDir, {
      persistent: true,
      ignoreInitial: false,           // Process existing files on startup
      awaitWriteFinish: {
        stabilityThreshold: 5000,     // Wait 5s after last write
        pollInterval: 1000,
      },
      depth: 2,                       // Don't recurse too deep
      usePolling: false,
    })

    this.watcher.on('add', async (filePath) => {
      if (!this.shouldProcess(filePath)) return
      if (this.processing.has(filePath)) return

      this.processing.add(filePath)
      try {
        logger.info({ file: basename(filePath) }, 'New file detected')
        await onFile(filePath)
      } catch (err) {
        logger.error({ err, file: basename(filePath) }, 'Processing failed')
      } finally {
        this.processing.delete(filePath)
      }
    })

    this.watcher.on('error', (err) => {
      logger.error({ err }, 'Watcher error')
    })
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      logger.info('Watcher stopped')
    }
  }

  private shouldProcess(filePath: string): boolean {
    const name = basename(filePath)

    // Ignore hidden and temp files
    if (name.startsWith('.') || name.startsWith('~') || name.endsWith('.tmp')) {
      return false
    }

    // Check extension
    const ext = extname(name).toLowerCase()
    if (this.allExtensions.has(ext)) return true

    // Check compound extensions
    if (name.endsWith('.tar.gz') || name.endsWith('.tar.bz2') || name.endsWith('.tar.xz')) {
      return true
    }

    return false
  }
}
