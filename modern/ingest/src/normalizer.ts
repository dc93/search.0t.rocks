import { v4 as uuidv4 } from 'uuid'
import type { IngestConfig } from './config.js'
import { logger } from './logger.js'

/**
 * Field normalizer: maps arbitrary source field names to the canonical
 * Solr schema fields using the alias table from config.
 *
 * - Builds a reverse lookup map: alias (lowercase) → schemaField
 * - Wraps array-typed fields in arrays
 * - Generates a UUID if `id` is missing
 * - Optionally tags with `source`
 */
export class FieldNormalizer {
  /** alias (lowercase) → canonical schema field name */
  private aliasMap: Map<string, string>
  private arrayFields: Set<string>
  private autoTagSource: boolean

  constructor(config: IngestConfig) {
    this.aliasMap = new Map()
    this.arrayFields = new Set(config.arrayFields)
    this.autoTagSource = config.autoTagSource

    // Build reverse alias map
    for (const [schemaField, aliases] of Object.entries(config.fieldMapping)) {
      // The schema field itself is also a valid key
      this.aliasMap.set(schemaField.toLowerCase(), schemaField)
      for (const alias of aliases) {
        this.aliasMap.set(alias.toLowerCase(), schemaField)
      }
    }

    logger.info(`Normalizer initialized with ${this.aliasMap.size} field aliases`)
  }

  /**
   * Normalize a raw record object into a Solr-compatible document.
   */
  normalize(raw: Record<string, unknown>, sourceName?: string): Record<string, unknown> | null {
    const doc: Record<string, unknown> = {}

    for (const [rawKey, rawValue] of Object.entries(raw)) {
      if (rawValue === null || rawValue === undefined || rawValue === '') continue

      const key = rawKey.trim()
      const schemaField = this.resolveField(key)

      if (!schemaField) {
        // Unknown field — skip silently (common in diverse leak formats)
        continue
      }

      // Coerce value
      const value = this.coerceValue(schemaField, rawValue)
      if (value === null) continue

      // Handle array fields: merge if already present
      if (this.arrayFields.has(schemaField)) {
        const existing = doc[schemaField]
        if (Array.isArray(existing)) {
          const toAdd = Array.isArray(value) ? value : [value]
          ;(existing as unknown[]).push(...toAdd)
        } else {
          doc[schemaField] = Array.isArray(value) ? value : [value]
        }
      } else {
        // Scalar: first writer wins (don't overwrite)
        if (!(schemaField in doc)) {
          doc[schemaField] = value
        }
      }
    }

    // Must have at least one meaningful field besides id
    const meaningfulKeys = Object.keys(doc).filter((k) => k !== 'id' && k !== 'source')
    if (meaningfulKeys.length === 0) return null

    // Ensure id
    if (!doc.id || typeof doc.id !== 'string') {
      doc.id = uuidv4()
    }

    // Auto-tag source
    if (this.autoTagSource && sourceName && !doc.source) {
      doc.source = sourceName
    }

    // Merge lat/long from separate lat + lng fields
    if (!doc.latLong && doc._lat && doc._lng) {
      doc.latLong = `${doc._lat},${doc._lng}`
    }
    delete doc._lat
    delete doc._lng

    return doc
  }

  private resolveField(rawKey: string): string | null {
    const lower = rawKey.toLowerCase().trim()

    // Direct match
    const direct = this.aliasMap.get(lower)
    if (direct) return direct

    // Stripped underscores/hyphens
    const stripped = lower.replace(/[-_\s]/g, '')
    const strippedMatch = this.aliasMap.get(stripped)
    if (strippedMatch) return strippedMatch

    // Special cases for split lat/long
    if (lower === 'lat' || lower === 'latitude') return '_lat' as any
    if (lower === 'lng' || lower === 'lon' || lower === 'longitude') return '_lng' as any

    // Keep `id` as-is
    if (lower === 'id') return 'id'

    return null
  }

  private coerceValue(schemaField: string, rawValue: unknown): unknown {
    if (rawValue === null || rawValue === undefined) return null

    // Already an array — return as-is for array fields
    if (Array.isArray(rawValue)) {
      return rawValue.map((v) => String(v).trim()).filter(Boolean)
    }

    const str = String(rawValue).trim()
    if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'none') return null

    // Phone numbers: strip non-digits
    if (schemaField === 'phoneNumbers') {
      const digits = str.replace(/[^\d+]/g, '')
      return digits.length >= 7 ? digits : null
    }

    // VIN: uppercase, 17 chars
    if (schemaField === 'vin') {
      return str.toLowerCase()
    }

    // Names: lowercase for consistency
    if (['firstName', 'lastName', 'middleName', 'city'].includes(schemaField)) {
      return str.toLowerCase()
    }

    // State: uppercase abbreviation
    if (schemaField === 'state') {
      return str.length <= 3 ? str.toUpperCase() : str.toLowerCase()
    }

    // Emails: lowercase
    if (schemaField === 'emails') {
      return str.toLowerCase()
    }

    return str
  }
}
