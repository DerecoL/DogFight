import { describe, expect, it } from 'vitest'
import { queryBattleFxAnchor, resolveBattleFxPoints } from './battle-vfx-coordinates'
import type { FxAnchor, PresentationEvent } from './feedback'

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

function elementWithRect(bounds: DOMRect): HTMLElement {
  return {
    getBoundingClientRect: () => bounds,
  } as HTMLElement
}

function presentation(source: FxAnchor, target: FxAnchor): PresentationEvent {
  return {
    kind: 'damage',
    source,
    target,
    amount: 4,
    statusChanged: [],
    logTone: 'damage',
    timeline: [],
  }
}

describe('battle vfx coordinate resolution', () => {
  it('resolves item source anchors from equipment row DOM cards by item id', () => {
    const item = { tag: 'item' } as unknown as HTMLElement
    const root = {
      querySelector: (selector: string) => {
        return selector === '[data-vfx-anchor="equipment-row"][data-vfx-side="player"][data-vfx-item-id="item-1"]'
          ? item
          : null
      },
    } as ParentNode

    expect(queryBattleFxAnchor(root, { anchor: 'item', side: 'player', id: 'item-1' })).toBe(item)
  })

  it('resolves source and target centers relative to the panel', () => {
    const panel = elementWithRect(rect(100, 50, 400, 300))
    const item = elementWithRect(rect(160, 90, 80, 40))
    const avatar = elementWithRect(rect(380, 200, 60, 60))

    const points = resolveBattleFxPoints(
      panel,
      presentation(
        { anchor: 'item', side: 'player', id: 'item-1' },
        { anchor: 'dog-avatar', side: 'opponent' },
      ),
      (anchor) => {
        if (anchor.anchor === 'item') return item
        if (anchor.anchor === 'dog-avatar') return avatar
        return null
      },
    )

    expect(points.source).toEqual({ x: 100, y: 60 })
    expect(points.target).toEqual({ x: 310, y: 180 })
  })

  it('falls back to side-aware panel points when an anchor is missing', () => {
    const panel = elementWithRect(rect(10, 20, 500, 200))

    const points = resolveBattleFxPoints(
      panel,
      presentation(
        { anchor: 'item', side: 'player', id: 'missing-item' },
        { anchor: 'status-negative', side: 'opponent' },
      ),
      () => null,
    )

    expect(points.source).toEqual({ x: 375, y: 100 })
    expect(points.target).toEqual({ x: 125, y: 100 })
  })
})
