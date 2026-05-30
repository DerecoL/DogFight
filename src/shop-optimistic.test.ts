import { describe, expect, it } from 'vitest'
import { mergeDogfightRunPreview, previewShopPurchase, previewShopReroll } from './shop-optimistic'

const baseRun = {
  id: 'run-1',
  gold: 10,
  refreshCost: 2,
  shopItems: [
    { offerId: 'offer-1', price: 3 },
    { offerId: 'offer-2', price: 5 },
  ],
}

describe('optimistic shop previews', () => {
  it('removes the bought offer and spends gold without mutating the source run', () => {
    const preview = previewShopPurchase(baseRun, 'offer-1')

    expect(preview).toMatchObject({
      gold: 7,
      shopItems: [{ offerId: 'offer-2', price: 5 }],
    })
    expect(baseRun.gold).toBe(10)
    expect(baseRun.shopItems).toHaveLength(2)
  })

  it('does not preview a missing or unaffordable purchase', () => {
    expect(previewShopPurchase(baseRun, 'missing')).toBeNull()
    expect(previewShopPurchase({ ...baseRun, gold: 2 }, 'offer-1')).toBeNull()
  })

  it('spends the current refresh cost immediately while waiting for new offers', () => {
    const preview = previewShopReroll(baseRun)

    expect(preview).toMatchObject({
      gold: 8,
      refreshCost: 3,
      shopItems: baseRun.shopItems,
    })
    expect(baseRun.refreshCost).toBe(2)
  })

  it('does not preview a refresh the player cannot afford', () => {
    expect(previewShopReroll({ ...baseRun, gold: 1 })).toBeNull()
  })

  it('merges a returned dogfight run into the visible room before a full refresh', () => {
    const room = {
      id: 'room-1',
      currentRun: { id: 'run-1', gold: 10, phase: 'SHOP', status: 'ACTIVE', wins: 0, losses: 0, round: 1 },
      currentRunMember: { id: 'member-1', runId: 'run-1', gold: 10, phase: 'SHOP', status: 'ACTIVE', wins: 0, losses: 0, round: 1 },
      members: [
        { id: 'member-1', runId: 'run-1', gold: 10, phase: 'SHOP', status: 'ACTIVE', wins: 0, losses: 0, round: 1 },
        { id: 'member-2', runId: 'run-2', gold: 4, phase: 'SHOP', status: 'ACTIVE', wins: 0, losses: 0, round: 1 },
      ],
    }
    const nextRun = { id: 'run-1', gold: 7, phase: 'SHOP', status: 'ACTIVE', wins: 0, losses: 0, round: 1 }

    const preview = mergeDogfightRunPreview(room, nextRun)

    expect(preview.currentRun).toBe(nextRun)
    expect(preview.currentRunMember).toMatchObject({ runId: 'run-1', gold: 7 })
    expect(preview.members[0]).toMatchObject({ runId: 'run-1', gold: 7 })
    expect(preview.members[1]).toBe(room.members[1])
    expect(room.currentRunMember.gold).toBe(10)
  })
})
