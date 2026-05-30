import { existsSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const data = readFileSync(new URL('./server/game/data.ts', import.meta.url), 'utf8')
const publicAssetsUrl = new URL('../public/assets/', import.meta.url)

function mappedAssetIds(recordName: string) {
  const start = app.indexOf(`const ${recordName}: Record<string, string> = {`)
  const end = app.indexOf('\n}', start)
  const record = app.slice(start, end)
  return [...record.matchAll(/['`]([^'`]+)['`]:\s*['`]([^'`]+)['`]/g)].map(([, id, path]) => ({ id, path }))
}

function itemDefIds() {
  const slotIds = [...data.matchAll(/slotItem\(\s*['`]([^'`]+)['`]/g)]
    .map((match) => match[1])
    .filter((id) => id !== 'starter-${n}')
  const classIds = [...data.matchAll(/classItem\(\s*['`][^'`]+['`]\s*,\s*\d+\s*,\s*['`]([^'`]+)['`]/g)]
    .map((match) => match[1])
  return [...new Set(['starter-1', 'starter-2', 'starter-3', 'starter-4', 'starter-5', 'starter-6', ...slotIds, ...classIds])]
}

function relicDefIds() {
  const relicBlock = data.slice(data.indexOf('export const RELIC_DEFS'), data.indexOf('export const ALL_ITEM_DEFS'))
  return [...relicBlock.matchAll(/\{\s*id:\s*['`]([^'`]+)['`]/g)].map((match) => match[1])
}

function assetUrl(assetPath: string) {
  return new URL(assetPath.replace(/^\/assets\//, ''), publicAssetsUrl)
}

function readUint24LE(bytes: Buffer, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
}

function webpSize(bytes: Buffer) {
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF')
  expect(bytes.toString('ascii', 8, 12)).toBe('WEBP')

  let offset = 12
  while (offset + 8 <= bytes.length) {
    const chunk = bytes.toString('ascii', offset, offset + 4)
    const length = bytes.readUInt32LE(offset + 4)
    const dataOffset = offset + 8

    if (chunk === 'VP8X') {
      return {
        width: readUint24LE(bytes, dataOffset + 4) + 1,
        height: readUint24LE(bytes, dataOffset + 7) + 1,
      }
    }

    if (chunk === 'VP8L') {
      const b1 = bytes[dataOffset + 1]
      const b2 = bytes[dataOffset + 2]
      const b3 = bytes[dataOffset + 3]
      const b4 = bytes[dataOffset + 4]
      return {
        width: 1 + (((b2 & 0x3f) << 8) | b1),
        height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
      }
    }

    if (chunk === 'VP8 ') {
      return {
        width: bytes.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: bytes.readUInt16LE(dataOffset + 8) & 0x3fff,
      }
    }

    offset = dataOffset + length + (length % 2)
  }

  throw new Error('Unsupported WebP format')
}

describe('equipment and relic icon assets', () => {
  it('maps every equipment and relic definition to a static 128px WebP icon under the asset budget', () => {
    const itemMappings = mappedAssetIds('itemIcons')
    const relicMappings = mappedAssetIds('relicIcons')

    expect(itemMappings.map((entry) => entry.id).sort()).toEqual(itemDefIds().sort())
    expect(relicMappings.map((entry) => entry.id).sort()).toEqual(relicDefIds().sort())

    const uniquePaths = new Set<string>()
    for (const mapping of [...itemMappings, ...relicMappings]) {
      expect(mapping.path).toMatch(/^\/assets\/(items|relics)\/[\w-]+\.webp$/)
      const url = assetUrl(mapping.path)
      expect(existsSync(url), mapping.path).toBe(true)
      const bytes = readFileSync(url)
      expect(webpSize(bytes), mapping.path).toEqual({ width: 128, height: 128 })
      uniquePaths.add(mapping.path)
    }

    let totalBytes = 0
    for (const path of uniquePaths) {
      const url = assetUrl(path)
      totalBytes += statSync(url).size
    }

    expect(totalBytes).toBeLessThanOrEqual(600 * 1024)
  })
})
