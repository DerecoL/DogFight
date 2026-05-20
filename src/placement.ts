export type PlacementArea = 'EQUIPMENT' | 'BAG'

export type PlacementItem = {
  id: string
  area: PlacementArea
  x: number
  y: number
  def: { width: number; height: number }
}

export function resolveSlotPlacement(
  items: PlacementItem[],
  movingItemId: string,
  area: PlacementArea,
  targetX: number,
  targetY: number,
  gridWidth: number,
  gridHeight = 1,
): { area: PlacementArea; x: number; y: number } | null {
  const moving = items.find((item) => item.id === movingItemId)
  if (!moving) return null

  const canPlaceAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x + moving.def.width > gridWidth || y + moving.def.height > gridHeight) return false
    const occupied = new Set<string>()
    for (const item of items) {
      if (item.id === moving.id || item.area !== area) continue
      for (let oy = item.y; oy < item.y + item.def.height; oy += 1) {
        for (let ox = item.x; ox < item.x + item.def.width; ox += 1) occupied.add(`${ox},${oy}`)
      }
    }
    for (let cy = y; cy < y + moving.def.height; cy += 1) {
      for (let cx = x; cx < x + moving.def.width; cx += 1) {
        if (occupied.has(`${cx},${cy}`)) return false
      }
    }
    return true
  }

  if (canPlaceAt(targetX, targetY)) return { area, x: targetX, y: targetY }

  const firstCandidateX = Math.max(0, targetX - moving.def.width + 1)
  const lastCandidateX = Math.min(targetX, gridWidth - moving.def.width)
  for (let x = lastCandidateX; x >= firstCandidateX; x -= 1) {
    if (canPlaceAt(x, targetY)) return { area, x, y: targetY }
  }

  return null
}
