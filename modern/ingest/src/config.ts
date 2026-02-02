import { readFileSync } from 'fs'
import { resolve } from 'path'
import YAML from 'yaml'

export interface IngestConfig {
  watchDir: string
  tempDir: string
  failedDir: string
  completedDir: string | null
  solr: {
    servers: string[]
    commitWithin: number
    batchSize: number
    maxConcurrent: number
  }
  processing: {
    compressedExtensions: string[]
    textExtensions: string[]
    maxFileSizeBytes: number
    pollIntervalMs: number
  }
  autoTagSource: boolean
  fieldMapping: Record<string, string[]>
  arrayFields: string[]
}

export function loadConfig(): IngestConfig {
  const configPath = resolve(import.meta.dirname, '../config/default.yaml')
  const raw = readFileSync(configPath, 'utf-8')
  return YAML.parse(raw) as IngestConfig
}
