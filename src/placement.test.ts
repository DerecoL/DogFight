import { describe, expect, it } from 'vitest'
import { resolveSlotPlacement, type PlacementItem } from './placement'

const equipment = (id: string, x: number, width = 1): PlacementItem => ({
  id,
  area: 'EQUIPMENT',
  x,
  y: 0,
  def: { width, height: 1 },
})

describe('slot placement resolution', () => {
  it('keeps a direct slot target when the item can start there', () => {
    const items = [equipment('moving', 0, 2)]

    expect(resolveSlotPlacement(items, 'moving', 'EQUIPMENT', 5, 0, 12)).toEqual({ area: 'EQUIPMENT', x: 5, y: 0 })
  })

  it('snaps a wide item to the legal start when the covered slot was dropped on', () => {
    const items = [
      equipment('left-block', 0, 4),
      equipment('moving', 0, 4),
      equipment('right-block', 8, 4),
    ]

    expect(resolveSlotPlacement(items, 'moving', 'EQUIPMENT', 7, 0, 12)).toEqual({ area: 'EQUIPMENT', x: 4, y: 0 })
  })

  it('snaps to the final legal start when a wide item is dropped on the row end', () => {
    const items = [equipment('moving', 0, 4)]

    expect(resolveSlotPlacement(items, 'moving', 'EQUIPMENT', 11, 0, 12)).toEqual({ area: 'EQUIPMENT', x: 8, y: 0 })
  })

  it('returns null when no legal footprint can cover the target slot', () => {
    const items = [
      equipment('block-a', 0, 4),
      equipment('moving', 0, 4),
      equipment('block-b', 5, 7),
    ]

    expect(resolveSlotPlacement(items, 'moving', 'EQUIPMENT', 4, 0, 12)).toBeNull()
  })
})
