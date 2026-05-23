import { describe, expect, it } from 'vitest'
import { itemDef } from './data'
import { canPlace } from './grid'
import { buildOfflineFighter } from './offline-builder'
import { seedGhost } from '../state'
import type { DogType, GameItem } from './types'

function assertLegalEquipment(items: GameItem[]) {
  const placed: GameItem[] = []
  const seenIds = new Set<string>()
  for (const item of items) {
    expect(item.area).toBe('EQUIPMENT')
    expect(seenIds.has(item.id)).toBe(false)
    seenIds.add(item.id)
    expect(
      canPlace(placed, { ...item, id: `__assert-${item.id}` }, item.area, item.x, item.y),
    ).toBe(true)
    placed.push(item)
  }
}

describe('offline dog builder', () => {
  it('builds deterministic high-round fighters with class equipment and relics', () => {
    const first = buildOfflineFighter({ round: 6, wins: 5, losses: 1 })
    const second = buildOfflineFighter({ round: 6, wins: 5, losses: 1 })

    expect(second).toEqual(first)
    expect(first.round).toBe(6)
    expect(first.name).toBeTruthy()
    expect(first.name).not.toMatch(/机器人|Bot|种子/)
    expect(first.items.some((item) => itemDef(item.defId).kind === 'CLASS_EQUIPMENT')).toBe(true)
    expect(first.items.some((item) => !itemDef(item.defId).tags.includes('starter'))).toBe(true)
    expect(first.relics?.length).toBeGreaterThan(0)
    assertLegalEquipment(first.items)
  })

  it('uses the seed to create a wider pool of offline dog identities', () => {
    const fighters = Array.from({ length: 12 }, (_, index) =>
      buildOfflineFighter({ round: 6, wins: 5, losses: 1, seed: `offline-pool-${index}` }),
    )

    expect(new Set(fighters.map((fighter) => fighter.name)).size).toBeGreaterThanOrEqual(8)
    expect(new Set(fighters.map((fighter) => fighter.dogType)).size).toBeGreaterThanOrEqual(3)
    expect(fighters.every((fighter) => !/机器人|Bot|种子/.test(fighter.name))).toBe(true)
  })

  it('creates dog-specific build identities instead of one fixed item sequence', () => {
    const builds = new Map<DogType, string[]>()
    for (const dogType of ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR'] as DogType[]) {
      const fighter = buildOfflineFighter({ dogType, round: 6, wins: 4, losses: 0 })
      builds.set(dogType, fighter.items.map((item) => item.defId))
      expect(
        fighter.items.some((item) => {
          const def = itemDef(item.defId)
          return def.kind === 'CLASS_EQUIPMENT' && def.classDog === dogType
        }),
      ).toBe(true)
    }

    expect(new Set([...builds.values()].map((items) => items.join(','))).size).toBeGreaterThan(1)
  })

  it('selects at most one class reward from each unlocked reward round', () => {
    for (const dogType of ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR'] as DogType[]) {
      const fighter = buildOfflineFighter({ dogType, round: 6, wins: 8, losses: 0 })
      const classRewards = fighter.items
        .map((item) => itemDef(item.defId))
        .filter((def) => def.kind === 'CLASS_EQUIPMENT')
      const unlockRounds = classRewards.map((def) => def.unlockRound)

      expect(classRewards).toHaveLength(2)
      expect(new Set(unlockRounds).size).toBe(classRewards.length)
      expect(unlockRounds).toContain(3)
      expect(unlockRounds).toContain(6)
    }
  })

  it('keeps class rewards at their default quality even for strong records', () => {
    const fighter = buildOfflineFighter({ dogType: 'SHIBA', round: 5, wins: 12, losses: 0 })
    const classItems = fighter.items.filter((item) => itemDef(item.defId).kind === 'CLASS_EQUIPMENT')

    expect(classItems.length).toBeGreaterThan(0)
    for (const item of classItems) {
      expect(item.quality).toBe(itemDef(item.defId).defaultQuality)
    }
  })

  it('upgrades repeated core equipment as the record gets stronger', () => {
    const fighter = buildOfflineFighter({ dogType: 'BULLY', round: 8, wins: 8, losses: 0 })

    expect(fighter.items.some((item) => item.quality === 'SILVER' || item.quality === 'GOLD' || item.quality === 'DIAMOND')).toBe(true)
    expect(fighter.items.some((item) => itemDef(item.defId).size === 4)).toBe(true)
    assertLegalEquipment(fighter.items)
  })

  it('keeps low-round offline fighters modest', () => {
    const fighter = buildOfflineFighter({ dogType: 'SHIBA', round: 1, wins: 0, losses: 0 })

    expect(fighter.items.every((item) => item.quality === 'BRONZE' || item.quality === 'SILVER')).toBe(true)
    expect(fighter.items.some((item) => itemDef(item.defId).kind === 'CLASS_EQUIPMENT')).toBe(false)
    expect(fighter.relics ?? []).toHaveLength(0)
    assertLegalEquipment(fighter.items)
  })

  it('keeps the first two rounds limited to bronze starter training gear', () => {
    for (const round of [0, 1]) {
      for (const dogType of ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR'] as DogType[]) {
        const fighter = buildOfflineFighter({ dogType, round, wins: 0, losses: 0 })

        expect(fighter.items).toHaveLength(3)
        expect(fighter.items.every((item) => item.defId.startsWith('starter-'))).toBe(true)
        expect(fighter.items.every((item) => item.quality === 'BRONZE')).toBe(true)
        expect(fighter.relics ?? []).toHaveLength(0)
        assertLegalEquipment(fighter.items)
      }
    }
  })

  it('routes seedGhost through the offline builder fallback', () => {
    const ghost = seedGhost(6, 5, 1, 'seed-ghost-route')

    expect(ghost.name).toBeTruthy()
    expect(ghost.name).not.toMatch(/机器人|Bot|种子/)
    expect(ghost.items.some((item) => itemDef(item.defId).kind === 'CLASS_EQUIPMENT')).toBe(true)
    expect(ghost.relics?.length).toBeGreaterThan(0)
    assertLegalEquipment(ghost.items)
  })
})
