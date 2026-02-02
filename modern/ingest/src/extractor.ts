import { createReadStream } from 'fs'
import { mkdir, readdir, rename, unlink } from 'fs/promises'
import { join, extname, basename } from 'path'
import { createGunzip } from 'zlib'
import { pipeline } from 'stream/promises'
import { createWriteStream } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { logger } from './logger.js'

const execFileAsync = promisify(execFile)

/**
 * Extracts compressed files into a temp directory and returns
 * the paths of the extracted text files ready for parsing.
 *
 * For non-compressed files, returns the original path.
 */
export async function extractFile(
  filePath: string,
  tempDir: string
): Promise<string[]> {
  const ext = getCompoundExtension(filePath)

  switch (ext) {
    case '.gz':
      return [await extractGzip(filePath, tempDir)]

    case '.tar.gz':
    case '.tgz':
      return extractTar(filePath, tempDir)

    case '.zip':
      return extractZip(filePath, tempDir)

    case '.7z':
      return extract7z(filePath, tempDir)

    case '.rar':
      return extractRar(filePath, tempDir)

    case '.bz2':
      return [await extractBzip2(filePath, tempDir)]

    case '.xz':
      return [await extractXz(filePath, tempDir)]

    default:
      // Not compressed — return as-is
      return [filePath]
  }
}

function getCompoundExtension(filePath: string): string {
  const name = basename(filePath).toLowerCase()
  if (name.endsWith('.tar.gz')) return '.tar.gz'
  if (name.endsWith('.tar.bz2')) return '.tar.bz2'
  if (name.endsWith('.tar.xz')) return '.tar.xz'
  return extname(name)
}

async function extractGzip(filePath: string, tempDir: string): Promise<string> {
  const outName = basename(filePath).replace(/\.gz$/i, '')
  const outPath = join(tempDir, outName)
  await pipeline(
    createReadStream(filePath),
    createGunzip(),
    createWriteStream(outPath)
  )
  logger.info({ file: outName }, 'Extracted gzip')
  return outPath
}

async function extractBzip2(filePath: string, tempDir: string): Promise<string> {
  const outName = basename(filePath).replace(/\.bz2$/i, '')
  const outPath = join(tempDir, outName)
  await execFileAsync('bzip2', ['-dkc', filePath], { maxBuffer: 1024 * 1024 * 10 })
    .then(({ stdout }) => {
      const ws = createWriteStream(outPath)
      ws.write(stdout)
      ws.end()
    })
    .catch(async () => {
      // Fallback: use bunzip2 as pipe
      await execFileAsync('bash', ['-c', `bzip2 -dc "${filePath}" > "${outPath}"`])
    })
  logger.info({ file: outName }, 'Extracted bzip2')
  return outPath
}

async function extractXz(filePath: string, tempDir: string): Promise<string> {
  const outName = basename(filePath).replace(/\.xz$/i, '')
  const outPath = join(tempDir, outName)
  await execFileAsync('bash', ['-c', `xz -dc "${filePath}" > "${outPath}"`])
  logger.info({ file: outName }, 'Extracted xz')
  return outPath
}

async function extractTar(filePath: string, tempDir: string): Promise<string[]> {
  const extractDir = join(tempDir, basename(filePath).replace(/\.(tar\.gz|tgz)$/i, ''))
  await mkdir(extractDir, { recursive: true })
  await execFileAsync('tar', ['-xzf', filePath, '-C', extractDir])
  logger.info({ dir: extractDir }, 'Extracted tar.gz')
  return collectTextFiles(extractDir)
}

async function extractZip(filePath: string, tempDir: string): Promise<string[]> {
  const extractDir = join(tempDir, basename(filePath).replace(/\.zip$/i, ''))
  await mkdir(extractDir, { recursive: true })
  await execFileAsync('unzip', ['-o', filePath, '-d', extractDir])
  logger.info({ dir: extractDir }, 'Extracted zip')
  return collectTextFiles(extractDir)
}

async function extract7z(filePath: string, tempDir: string): Promise<string[]> {
  const extractDir = join(tempDir, basename(filePath).replace(/\.7z$/i, ''))
  await mkdir(extractDir, { recursive: true })
  await execFileAsync('7z', ['x', filePath, `-o${extractDir}`, '-y'])
  logger.info({ dir: extractDir }, 'Extracted 7z')
  return collectTextFiles(extractDir)
}

async function extractRar(filePath: string, tempDir: string): Promise<string[]> {
  const extractDir = join(tempDir, basename(filePath).replace(/\.rar$/i, ''))
  await mkdir(extractDir, { recursive: true })
  await execFileAsync('unrar', ['x', '-o+', filePath, extractDir])
  logger.info({ dir: extractDir }, 'Extracted rar')
  return collectTextFiles(extractDir)
}

const TEXT_EXTENSIONS = new Set([
  '.jsonl', '.json', '.csv', '.tsv', '.txt', '.sql', '.log', '.dat',
])

async function collectTextFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(d: string) {
    const entries = await readdir(d, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(d, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        files.push(full)
      }
    }
  }

  await walk(dir)
  return files
}

/**
 * Clean up extracted temp files for a given source.
 */
export async function cleanupExtracted(tempDir: string, filePaths: string[]): Promise<void> {
  for (const fp of filePaths) {
    if (fp.startsWith(tempDir)) {
      try {
        await unlink(fp)
      } catch { /* already deleted */ }
    }
  }
}
