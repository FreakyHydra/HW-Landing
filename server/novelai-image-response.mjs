import { inflateRawSync } from 'node:zlib'

function mimeFromName(name, bytes) {
  const lower = name.toLowerCase()
  if (lower.endsWith('.webp') || bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || (bytes[0] === 0xff && bytes[1] === 0xd8)) return 'image/jpeg'
  return 'image/png'
}

function findEocd(bytes) {
  const minimum = Math.max(0, bytes.length - 65_557)
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset
  }
  throw new Error('NovelAI returned an invalid ZIP archive.')
}

export function extractFirstImageFromZip(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input)
  if (bytes.length < 22) throw new Error('NovelAI returned an empty or invalid image archive.')

  const eocd = findEocd(bytes)
  const entryCount = bytes.readUInt16LE(eocd + 10)
  let offset = bytes.readUInt32LE(eocd + 16)

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('NovelAI returned a malformed ZIP directory.')
    }

    const compressionMethod = bytes.readUInt16LE(offset + 10)
    const compressedSize = bytes.readUInt32LE(offset + 20)
    const fileNameLength = bytes.readUInt16LE(offset + 28)
    const extraLength = bytes.readUInt16LE(offset + 30)
    const commentLength = bytes.readUInt16LE(offset + 32)
    const localOffset = bytes.readUInt32LE(offset + 42)
    const name = bytes.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8')
    const imageLike = /\.(png|webp|jpe?g)$/i.test(name)

    if (imageLike) {
      if (localOffset + 30 > bytes.length || bytes.readUInt32LE(localOffset) !== 0x04034b50) {
        throw new Error('NovelAI returned a malformed ZIP image entry.')
      }
      const localNameLength = bytes.readUInt16LE(localOffset + 26)
      const localExtraLength = bytes.readUInt16LE(localOffset + 28)
      const dataStart = localOffset + 30 + localNameLength + localExtraLength
      const dataEnd = dataStart + compressedSize
      if (dataEnd > bytes.length) throw new Error('NovelAI returned a truncated ZIP image entry.')
      const compressed = bytes.subarray(dataStart, dataEnd)
      const image = compressionMethod === 0
        ? Buffer.from(compressed)
        : compressionMethod === 8
          ? inflateRawSync(compressed)
          : null
      if (!image) throw new Error(`Unsupported NovelAI ZIP compression method: ${compressionMethod}`)
      return { bytes: image, mimeType: mimeFromName(name, image) }
    }

    offset += 46 + fileNameLength + extraLength + commentLength
  }

  throw new Error('NovelAI image archive contained no supported image file.')
}

export function normalizeNovelAiImageResponse(bytes, contentType = '') {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  const type = contentType.toLowerCase()
  if (type.startsWith('image/')) return { bytes: buffer, mimeType: type.split(';')[0] }
  if (buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50) return extractFirstImageFromZip(buffer)
  throw new Error(`NovelAI returned an unsupported image response type: ${contentType || 'unknown'}`)
}
