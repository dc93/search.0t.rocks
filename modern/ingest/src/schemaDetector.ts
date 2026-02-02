import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { createHash } from 'crypto'
import { join } from 'path'
import { logger } from './logger.js'
import type { IngestConfig } from './config.js'

/**
 * AI-powered schema detector using Z.AI GLM-4.7.
 *
 * When the deterministic normalizer can't resolve a field, this module:
 * 1. Samples the first N lines from the file
 * 2. Sends them to GLM-4.7 to infer a field mapping
 * 3. Caches the result so the same structure isn't analyzed twice
 * 4. Returns a mapping: { originalFieldName → canonicalSchemaField }
 */

export interface SchemaMapping {
  /** original field name → canonical schema field (or null to skip) */
  fields: Record<string, string | null>
  /** detected delimiter (if applicable) */
  delimiter?: string
  /** confidence note from the LLM */
  note?: string
}

export interface SchemaDetectorConfig {
  enabled: boolean
  apiKey: string
  baseUrl: string
  model: string
  sampleLines: number
  cacheDir: string
  /** Temperature for the LLM (lower = more deterministic) */
  temperature: number
}

const CANONICAL_FIELDS = [
  'firstName', 'lastName', 'middleName', 'emails', 'usernames',
  'passwords', 'phoneNumbers', 'address', 'city', 'state', 'zipCode',
  'country', 'domain', 'ips', 'latLong', 'gender', 'birthYear',
  'vin', 'VRN', 'source', 'asn', 'asnOrg', 'income', 'notes',
  'photographs', 'dob', 'id',
]

export class SchemaDetector {
  private config: SchemaDetectorConfig
  private cache: Map<string, SchemaMapping> = new Map()

  constructor(config: SchemaDetectorConfig) {
    this.config = config
  }

  /**
   * Load any previously cached schemas from disk.
   */
  async init(): Promise<void> {
    if (!this.config.enabled) return

    try {
      await mkdir(this.config.cacheDir, { recursive: true })
      // Load existing cache files
      const { default: fg } = await import('fast-glob')
      const cacheFiles = await fg('*.json', { cwd: this.config.cacheDir, absolute: true })

      for (const file of cacheFiles) {
        try {
          const data = JSON.parse(await readFile(file, 'utf-8'))
          if (data.hash && data.mapping) {
            this.cache.set(data.hash, data.mapping)
          }
        } catch { /* skip corrupt cache files */ }
      }

      logger.info({ cached: this.cache.size }, 'Schema detector initialized with cached schemas')
    } catch (err) {
      logger.warn({ err }, 'Could not load schema cache, starting fresh')
    }
  }

  /**
   * Detect the schema of a file by sampling its first lines and asking GLM-4.7.
   * Returns null if AI detection is disabled or fails.
   */
  async detect(filePath: string): Promise<SchemaMapping | null> {
    if (!this.config.enabled || !this.config.apiKey) {
      return null
    }

    try {
      // Step 1: Sample lines
      const sample = await this.sampleFile(filePath)
      if (!sample || sample.length === 0) return null

      // Step 2: Check cache (hash of sample structure)
      const hash = this.hashSample(sample)
      const cached = this.cache.get(hash)
      if (cached) {
        logger.info({ file: filePath }, 'Using cached AI schema mapping')
        return cached
      }

      // Step 3: Ask GLM-4.7
      logger.info({ file: filePath, sampleSize: sample.length }, 'Requesting AI schema detection...')
      const mapping = await this.queryLLM(sample)

      if (mapping) {
        // Step 4: Cache
        this.cache.set(hash, mapping)
        await this.persistCache(hash, mapping)
        logger.info({ file: filePath, fields: Object.keys(mapping.fields).length }, 'AI schema detected and cached')
      }

      return mapping
    } catch (err) {
      logger.error({ err, file: filePath }, 'AI schema detection failed, falling back to deterministic')
      return null
    }
  }

  /**
   * Read the first N lines from a file.
   */
  private async sampleFile(filePath: string): Promise<string[]> {
    const lines: string[] = []
    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 1024 * 64 }),
      crlfDelay: Infinity,
    })

    for await (const line of rl) {
      const trimmed = line.trim()
      if (trimmed) {
        lines.push(trimmed)
      }
      if (lines.length >= this.config.sampleLines) break
    }

    rl.close()
    return lines
  }

  /**
   * Hash the structural pattern of sample lines (not the actual data).
   * This way files with the same structure hit the cache even if data differs.
   */
  private hashSample(lines: string[]): string {
    // For structured data, hash the "shape": field names, delimiter pattern, column count
    // For JSONL, hash the keys of the first object
    // For delimited, hash the header row
    const first = lines[0]

    let structureKey: string

    if (first.startsWith('{')) {
      // JSONL — hash the sorted keys
      try {
        const obj = JSON.parse(first)
        structureKey = 'jsonl:' + Object.keys(obj).sort().join(',')
      } catch {
        structureKey = 'raw:' + first.substring(0, 200)
      }
    } else if (first.startsWith('INSERT')) {
      // SQL — hash the column names
      const match = first.match(/\(([^)]+)\)\s*VALUES/i)
      structureKey = 'sql:' + (match ? match[1] : first.substring(0, 200))
    } else {
      // Delimited — hash the header row (first line)
      structureKey = 'header:' + first.substring(0, 500)
    }

    return createHash('sha256').update(structureKey).digest('hex').substring(0, 16)
  }

  /**
   * Call Z.AI GLM-4.7 API to detect field mapping.
   */
  private async queryLLM(sampleLines: string[]): Promise<SchemaMapping | null> {
    const prompt = this.buildPrompt(sampleLines)

    const response = await fetch(this.config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: this.config.temperature,
        max_tokens: 2048,
        messages: [
          {
            role: 'system',
            content: `You are a data schema analyst for a threat intelligence platform. You analyze sample data from database dumps/leaks and map their fields to a canonical schema. You ONLY respond with valid JSON, no markdown, no explanation.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      logger.error({ status: response.status, body }, 'Z.AI API error')
      return null
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
    }

    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) {
      logger.warn('Empty response from Z.AI')
      return null
    }

    // Parse the JSON response
    try {
      // Strip markdown code fences if present
      const clean = content.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
      const result = JSON.parse(clean) as SchemaMapping

      // Validate: every mapped field must be canonical or null
      if (result.fields && typeof result.fields === 'object') {
        for (const [key, value] of Object.entries(result.fields)) {
          if (value !== null && !CANONICAL_FIELDS.includes(value)) {
            logger.warn({ field: key, mapped: value }, 'LLM suggested non-canonical field, removing')
            result.fields[key] = null
          }
        }
        return result
      }

      logger.warn('LLM response missing fields object')
      return null
    } catch (err) {
      logger.error({ err, content: content.substring(0, 500) }, 'Failed to parse LLM response as JSON')
      return null
    }
  }

  /**
   * Build the prompt for GLM-4.7.
   */
  private buildPrompt(sampleLines: string[]): string {
    const sample = sampleLines.slice(0, 50).join('\n')

    return `Analyze this data sample and map each field/column to one of these canonical fields:

CANONICAL FIELDS:
${CANONICAL_FIELDS.join(', ')}

If a field doesn't match any canonical field, map it to null.

DATA SAMPLE (first ${sampleLines.length} lines):
---
${sample}
---

Respond with ONLY a JSON object in this exact format:
{
  "fields": {
    "original_field_name": "canonicalFieldName or null",
    ...
  },
  "delimiter": "detected delimiter character or null",
  "note": "brief description of the data format"
}

Rules:
- Map every detected field/column to the closest canonical field
- Use null for fields that don't match (e.g. internal IDs, timestamps, metadata)
- For combo lists (email:password), indicate the format in the note
- For delimited files, the first line is likely the header
- Be precise: "mail" → "emails", "pwd" → "passwords", "ip_addr" → "ips", etc.`
  }

  /**
   * Persist a single schema mapping to disk cache.
   */
  private async persistCache(hash: string, mapping: SchemaMapping): Promise<void> {
    try {
      const file = join(this.config.cacheDir, `${hash}.json`)
      await writeFile(file, JSON.stringify({ hash, mapping, cachedAt: new Date().toISOString() }, null, 2))
    } catch (err) {
      logger.warn({ err }, 'Failed to persist schema cache')
    }
  }
}
