import assert from 'node:assert/strict'
import test from 'node:test'
import { deflateRawSync } from 'node:zlib'
import { extractFirstImageFromZip, normalizeNovelAiImageResponse } from '../server/novelai-image-response.mjs'

function makeZip(name, payload) {
  const fileName = Buffer.from(name)
  const compressed = deflateRawSync(payload)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(8, 8)
  local.writeUInt32LE(compressed.length, 18)
  local.writeUInt32LE(payload.length, 22)
  local.writeUInt16LE(fileName.length, 26)

  const centralOffset = local.length + fileName.length + compressed.length
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt16LE(8, 10)
  central.writeUInt32LE(compressed.length, 20)
  central.writeUInt32LE(payload.length, 24)
  central.writeUInt16LE(fileName.length, 28)
  central.writeUInt32LE(0, 42)

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(central.length + fileName.length, 12)
  eocd.writeUInt32LE(centralOffset, 16)

  return Buffer.concat([local, fileName, compressed, central, fileName, eocd])
}

test('extracts a deflated PNG from a ZIP using the central directory sizes', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
  const result = extractFirstImageFromZip(makeZip('image.png', png))
  assert.equal(result.mimeType, 'image/png')
  assert.deepEqual(result.bytes, png)
})

test('passes through raw upstream image responses', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])
  const result = normalizeNovelAiImageResponse(png, 'image/png')
  assert.equal(result.mimeType, 'image/png')
  assert.deepEqual(result.bytes, png)
})
