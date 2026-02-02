import { mkdir, rename, unlink, rm } from 'fs/promises'
import { basename, join } from 'path'
import { loadConfig } from './config.js'
import { logger } from './logger.js'
import { FileWatcher } from './watcher.js'
import { extractFile, cleanupExtracted } from './extractor.js'
import { parseFile } from './parser.js'
import { FieldNormalizer } from './normalizer.js'
import { EsImporter } from './esImporter.js'
import { SchemaDetector } from './schemaDetector.js'

async function main() {
  const config = loadConfig()

  logger.info('=== Ingest Pipeline Starting ===')
  logger.info({
    watchDir: config.watchDir,
    elasticsearchUrl: config.elasticsearch.url,
    index: config.elasticsearch.index,
    batchSize: config.elasticsearch.batchSize,
    maxConcurrent: config.elasticsearch.maxConcurrent,
    aiSchema: config.aiSchemaDetection.enabled ? 'enabled' : 'disabled',
  })

  // Ensure directories exist
  await mkdir(config.watchDir, { recursive: true })
  await mkdir(config.tempDir, { recursive: true })
  await mkdir(config.failedDir, { recursive: true })
  if (config.completedDir) {
    await mkdir(config.completedDir, { recursive: true })
  }

  const normalizer = new FieldNormalizer(config)
  const importer = new EsImporter(config)
  const watcher = new FileWatcher(config)

  // AI schema detector (Z.AI GLM-4.7)
  const aiConfig = {
    ...config.aiSchemaDetection,
    // Allow env var override for the API key
    apiKey: process.env.ZAI_API_KEY || config.aiSchemaDetection.apiKey,
  }
  const schemaDetector = new SchemaDetector(aiConfig)
  await schemaDetector.init()

  /**
   * Process a single file end-to-end:
   * 1. Extract (if compressed)
   * 2. Parse (streaming)
   * 3. Normalize fields
   * 4. Import to Solr in batches
   * 5. Cleanup
   */
  async function processFile(filePath: string): Promise<void> {
    const fileName = basename(filePath)
    const sourceName = fileName.replace(/\.(gz|zip|tar|7z|rar|bz2|xz|jsonl|json|csv|tsv|txt|sql|dat|log)$/gi, '')
    const startTime = Date.now()

    logger.info({ file: fileName }, 'Processing started')

    let extractedFiles: string[] = []

    try {
      // Step 1: Extract
      extractedFiles = await extractFile(filePath, config.tempDir)
      logger.info({ file: fileName, extractedCount: extractedFiles.length }, 'Extraction complete')

      let totalParsed = 0
      let totalNormalized = 0
      let totalSkipped = 0

      // Step 2: AI schema detection (one call per unique file structure)
      for (const textFile of extractedFiles) {
        const aiMapping = await schemaDetector.detect(textFile)
        normalizer.setAiSchema(aiMapping)
      }

      // Step 3-5: Parse → Normalize → Import (per extracted file)
      for (const textFile of extractedFiles) {
        logger.info({ file: basename(textFile) }, 'Parsing...')

        for await (const rawRecord of parseFile(textFile)) {
          totalParsed++

          // Normalize
          const normalized = normalizer.normalize(
            rawRecord as Record<string, unknown>,
            sourceName
          )

          if (normalized) {
            await importer.add(normalized)
            totalNormalized++
          } else {
            totalSkipped++
          }

          // Progress log every 100k records
          if (totalParsed % 100_000 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
            const rate = Math.round(totalParsed / (parseFloat(elapsed) || 1))
            logger.info({
              file: fileName,
              parsed: totalParsed,
              normalized: totalNormalized,
              skipped: totalSkipped,
              rate: `${rate} rec/s`,
              elapsed: `${elapsed}s`,
              ...importer.stats,
            }, 'Progress')
          }
        }
      }

      // Step 6: Flush remaining buffer
      await importer.flush()

      // Clear AI overrides for next file
      normalizer.clearAiSchema()

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const rate = Math.round(totalNormalized / (parseFloat(elapsed) || 1))

      logger.info({
        file: fileName,
        parsed: totalParsed,
        normalized: totalNormalized,
        skipped: totalSkipped,
        rate: `${rate} rec/s`,
        elapsed: `${elapsed}s`,
        ...importer.stats,
      }, 'Processing complete')

      // Step 6: Cleanup source file
      if (config.completedDir) {
        await rename(filePath, join(config.completedDir, fileName)).catch(() => {
          // rename fails across devices — fallback to delete
          return unlink(filePath)
        })
        logger.info({ file: fileName, dest: config.completedDir }, 'Moved to completed')
      } else {
        await unlink(filePath)
        logger.info({ file: fileName }, 'Deleted source file')
      }
    } catch (err) {
      logger.error({ err, file: fileName }, 'Processing failed')

      // Move to failed directory
      try {
        await rename(filePath, join(config.failedDir, fileName))
        logger.info({ file: fileName }, 'Moved to failed directory')
      } catch {
        logger.error({ file: fileName }, 'Could not move to failed directory')
      }
    } finally {
      // Cleanup extracted temp files
      await cleanupExtracted(config.tempDir, extractedFiles)

      // Cleanup any temp directories created during extraction
      try {
        const tempSubdirs = extractedFiles
          .map((f) => f.split('/').slice(0, -1).join('/'))
          .filter((d) => d.startsWith(config.tempDir) && d !== config.tempDir)
        for (const dir of [...new Set(tempSubdirs)]) {
          await rm(dir, { recursive: true, force: true }).catch(() => {})
        }
      } catch { /* best-effort cleanup */ }
    }
  }

  // Start watching
  watcher.start(processFile)

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...')
    await watcher.stop()
    await importer.flush()
    logger.info('Shutdown complete')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Keep alive
  logger.info(`Watching ${config.watchDir} for new files...`)
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error')
  process.exit(1)
})
