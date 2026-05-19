import { itemDef } from './data'
import type { Area, GameItem } from './types'

const DIMS: Record<Area, { w: number; h: number }> = {
  EQUIPMENT: { w: 12, h: 1 },
  BAG: { w: 12, h: 1 },
}

export type PlacementOptions = {
  equipmentWidth?: number
}

function dimsFor(area: Area, options: PlacementOptions = {}) {
  if (area === 'EQUIPMENT' && options.equipmentWidth) return { ...DIMS.EQUIPMENT, w: options.equipmentWidth }
  return DIMS[area]
}

export function canPlace(items: GameItem[], moving: GameItem, area: Area, x: number, y: number, options: PlacementOptions = {}) {
  const def = itemDef(moving.defId)
  const dims = dimsFor(area, options)
  if (def.height !== 1) return false
  if (x < 0 || y < 0 || x + def.width > dims.w || y + 1 > dims.h) return false
  const occupied = new Set<string>()
  for (const item of items) {
    if (item.id === moving.id || item.area !== area) continue
    const other = itemDef(item.defId)
    for (let oy = item.y; oy < item.y + other.height; oy += 1) {
      for (let ox = item.x; ox < item.x + other.width; ox += 1) occupied.add(`${ox},${oy}`)
    }
  }
  for (let cy = y; cy < y + def.height; cy += 1) {
    for (let cx = x; cx < x + def.width; cx += 1) {
      if (occupied.has(`${cx},${cy}`)) return false
    }
  }
  return true
}

export function findSlot(items: GameItem[], defId: string, area: Area, options: PlacementOptions = {}) {
  const probe: GameItem = { id: '__new__', defId, quality: 'BRONZE', area, x: 0, y: 0 }
  const dims = dimsFor(area, options)
  for (let y = 0; y < dims.h; y += 1) {
    for (let x = 0; x < dims.w; x += 1) {
      if (canPlace(items, probe, area, x, y, options)) return { x, y }
    }
  }
  return null
}

export function triggerOrder(items: GameItem[]) {
  return [...items]
    .filter((item) => item.area === 'EQUIPMENT')
    .sort((a, b) => (a.x - b.x) || (a.y - b.y))
}
