import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import { extname } from 'path'
import { parse as csvParse } from 'csv-parse'
import { logger } from './logger.js'

/**
 * Streaming parser: reads a file line-by-line or record-by-record
 * and yields parsed objects.
 *
 * Supported formats:
 * - .jsonl / .json (one JSON object per line)
 * - .csv (comma-separated with header row)
 * - .tsv (tab-separated with header row)
 * - .txt (auto-detect: tries JSONL, then delimiter-separated)
 * - .sql (extracts INSERT INTO values)
 */
export async function* parseFile(
  filePath: string
): AsyncGenerator<Record<string, unknown>> {
  const ext = extname(filePath).toLowerCase()

  switch (ext) {
    case '.jsonl':
      yield* parseJsonl(filePath)
      break

    case '.json':
      yield* parseJsonFile(filePath)
      break

    case '.csv':
      yield* parseDelimited(filePath, ',')
      break

    case '.tsv':
      yield* parseDelimited(filePath, '\t')
      break

    case '.txt':
    case '.dat':
    case '.log':
      yield* parseAutoDetect(filePath)
      break

    case '.sql':
      yield* parseSql(filePath)
      break

    default:
      // Try JSONL as fallback
      yield* parseJsonl(filePath)
  }
}

/**
 * JSONL: one JSON object per line (most common for leak dumps)
 */
async function* parseJsonl(filePath: string): AsyncGenerator<Record<string, unknown>> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 1024 * 256 }),
    crlfDelay: Infinity,
  })

  let lineNum = 0
  let errors = 0

  for await (const line of rl) {
    lineNum++
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue

    // Handle JSON arrays: skip leading [ and trailing ]
    const clean = trimmed.replace(/^[\[\,]+/, '').replace(/[\]\,]+$/, '').trim()
    if (!clean || clean === '[' || clean === ']') continue

    try {
      const obj = JSON.parse(clean)
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        yield obj
      }
    } catch {
      errors++
      if (errors <= 5) {
        logger.warn({ lineNum, file: filePath }, 'Failed to parse JSON line')
      }
      if (errors === 6) {
        logger.warn({ file: filePath }, 'Suppressing further JSON parse warnings...')
      }
    }
  }

  if (errors > 0) {
    logger.info({ file: filePath, errors, total: lineNum }, 'JSONL parse complete with errors')
  }
}

/**
 * JSON file: either a single array of objects or a single object
 */
async function* parseJsonFile(filePath: string): AsyncGenerator<Record<string, unknown>> {
  // Try streaming JSONL first (many .json files are actually JSONL)
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 1024 * 256 }),
    crlfDelay: Infinity,
  })

  let firstLine = ''
  for await (const line of rl) {
    firstLine = line.trim()
    break
  }
  rl.close()

  if (firstLine.startsWith('[')) {
    // Array of objects — stream as JSONL (handles arrays split across lines)
    yield* parseJsonl(filePath)
  } else if (firstLine.startsWith('{')) {
    // Could be JSONL (one object per line)
    yield* parseJsonl(filePath)
  }
}

/**
 * CSV/TSV: header row + data rows, streamed via csv-parse
 */
async function* parseDelimited(
  filePath: string,
  delimiter: string
): AsyncGenerator<Record<string, unknown>> {
  const parser = createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 1024 * 256 }).pipe(
    csvParse({
      delimiter,
      columns: true,         // first row = headers
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
    })
  )

  for await (const record of parser) {
    yield record
  }
}

/**
 * Auto-detect: peek at first lines and decide format.
 */
async function* parseAutoDetect(filePath: string): AsyncGenerator<Record<string, unknown>> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 1024 * 64 }),
    crlfDelay: Infinity,
  })

  const sampleLines: string[] = []
  for await (const line of rl) {
    sampleLines.push(line.trim())
    if (sampleLines.length >= 5) break
  }
  rl.close()

  if (sampleLines.length === 0) return

  const first = sampleLines[0]

  // JSON?
  if (first.startsWith('{') || first.startsWith('[')) {
    yield* parseJsonl(filePath)
    return
  }

  // Detect delimiter
  const tabCount = sampleLines.reduce((n, l) => n + (l.split('\t').length - 1), 0)
  const commaCount = sampleLines.reduce((n, l) => n + (l.split(',').length - 1), 0)
  const pipeCount = sampleLines.reduce((n, l) => n + (l.split('|').length - 1), 0)
  const colonCount = sampleLines.reduce((n, l) => n + (l.split(':').length - 1), 0)
  const semiCount = sampleLines.reduce((n, l) => n + (l.split(';').length - 1), 0)

  const delimiters = [
    { char: '\t', count: tabCount },
    { char: ',', count: commaCount },
    { char: '|', count: pipeCount },
    { char: ';', count: semiCount },
    { char: ':', count: colonCount },
  ].sort((a, b) => b.count - a.count)

  if (delimiters[0].count >= sampleLines.length) {
    // The top delimiter appears at least once per line
    logger.info({ file: filePath, delimiter: delimiters[0].char === '\t' ? 'TAB' : delimiters[0].char }, 'Auto-detected delimiter')
    yield* parseDelimited(filePath, delimiters[0].char)
    return
  }

  // Last resort: treat as combo-list format  email:password  or  user:pass
  // Common in leak dumps: each line is "identifier:credential"
  yield* parseComboList(filePath)
}

/**
 * Combo list: each line is "email:password" or "email;password"
 */
async function* parseComboList(filePath: string): AsyncGenerator<Record<string, unknown>> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 1024 * 256 }),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Try email:password
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx > 0) {
      const left = trimmed.substring(0, colonIdx).trim()
      const right = trimmed.substring(colonIdx + 1).trim()

      if (left.includes('@')) {
        yield { emails: left, passwords: right || undefined }
      } else {
        yield { usernames: left, passwords: right || undefined }
      }
      continue
    }

    // Try email;password
    const semiIdx = trimmed.indexOf(';')
    if (semiIdx > 0) {
      const left = trimmed.substring(0, semiIdx).trim()
      const right = trimmed.substring(semiIdx + 1).trim()
      if (left.includes('@')) {
        yield { emails: left, passwords: right || undefined }
      } else {
        yield { usernames: left, passwords: right || undefined }
      }
      continue
    }

    // Single value — treat as email if contains @, otherwise username
    if (trimmed.includes('@')) {
      yield { emails: trimmed }
    } else {
      yield { usernames: trimmed }
    }
  }
}

/**
 * SQL: extract INSERT INTO ... VALUES (...) rows
 */
async function* parseSql(filePath: string): AsyncGenerator<Record<string, unknown>> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 1024 * 256 }),
    crlfDelay: Infinity,
  })

  let columns: string[] = []

  for await (const line of rl) {
    const trimmed = line.trim()

    // Parse INSERT INTO table (col1, col2, ...) VALUES
    const insertMatch = trimmed.match(
      /INSERT\s+INTO\s+\S+\s*\(([^)]+)\)\s*VALUES/i
    )
    if (insertMatch) {
      columns = insertMatch[1].split(',').map((c) =>
        c.trim().replace(/[`'"]/g, '')
      )
    }

    // Extract VALUES tuples: (val1, val2, ...)
    const valueRegex = /\(([^)]+)\)/g
    let match: RegExpExecArray | null
    while ((match = valueRegex.exec(trimmed)) !== null) {
      if (columns.length === 0) continue

      const values = splitSqlValues(match[1])
      if (values.length !== columns.length) continue

      const record: Record<string, unknown> = {}
      for (let i = 0; i < columns.length; i++) {
        let val = values[i].trim()
        // Remove surrounding quotes
        if ((val.startsWith("'") && val.endsWith("'")) ||
            (val.startsWith('"') && val.endsWith('"'))) {
          val = val.slice(1, -1)
        }
        if (val !== 'NULL' && val !== 'null' && val !== '') {
          record[columns[i]] = val
        }
      }

      if (Object.keys(record).length > 0) {
        yield record
      }
    }
  }
}

/**
 * Split SQL values respecting quoted strings with commas inside.
 */
function splitSqlValues(input: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''

  for (const ch of input) {
    if (inQuote) {
      current += ch
      if (ch === quoteChar) inQuote = false
    } else if (ch === "'" || ch === '"') {
      inQuote = true
      quoteChar = ch
      current += ch
    } else if (ch === ',') {
      values.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }

  if (current.trim()) values.push(current.trim())
  return values
}
