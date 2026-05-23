import { describe, expect, it } from 'vitest'
import { resolveSlotPlacement, type PlacementItem } from './placement'

const equipment = (id: string, x: number, width = 1): PlacementItem => ({
  id,
  area: 'EQUIPMENT',
  x,
  y: 0,
  def: { width, height: 1 },
})

const bag = (id: string, x: number, width = 1): PlacementItem => ({
  id,
  area: 'BAG',
  x,
  y: 0,
  def: { width, height: 1 },
})

describe('slot placement resolution', () => {
  it('keeps a direct slot target when the item can start there', () => {
    const items = [equipment('moving', 0, 2)]

    expect(resolveSlotPlacement(items, 'moving', 'EQUIPMENT', 5, 0, 12)).toEqual({ area: 'EQUIPMENT', x: 5, y: 0 })
  })

  it('keeps the equipment target start when replacement would cover existing items', () => {
    const items = [
      equipment('left-block', 0, 4),
      equipment('moving', 0, 4),
      equipment('right-block', 8, 4),
    ]

    expect(resolveSlotPlacement(items, 'moving', 'EQUIPMENT', 7, 0, 12)).toEqual({ area: 'EQUIPMENT', x: 7, y: 0 })
  })

  it('keeps an occupied equipment slot as the target start for a wide replacement', () => {
    const items = [
      equipment('covered-left', 0),
      equipment('covered-right', 1),
      equipment('moving', 4, 4),
    ]

    expect(resolveSlotPlacement(items, 'moving', 'EQUIPMENT', 0, 0, 12)).toEqual({ area: 'EQUIPMENT', x: 0, y: 0 })
  })

  it('does not replace occupied bag slots', () => {
    const items = [
      bag('covered-left', 0),
      bag('covered-right', 1),
      bag('moving', 4, 4),
    ]

    expect(resolveSlotPlacement(items, 'moving', 'BAG', 0, 0, 12)).toBeNull()
  })

  it('snaps to the final legal start when a wide item is dropped on the row end', () => {
    const items = [equipment('moving', 0, 4)]

    expect(resolveSlotPlacement(items, 'moving', 'EQUIPMENT', 11, 0, 12)).toEqual({ area: 'EQUIPMENT', x: 8, y: 0 })
  })

  it('returns null when no legal footprint can cover an out-of-bounds equipment target', () => {
    const items = [
      equipment('moving', 0, 4),
      equipment('right-block', 8, 4),
    ]

    expect(resolveSlotPlacement(items, 'moving', 'EQUIPMENT', 11, 0, 12)).toBeNull()
  })
})
