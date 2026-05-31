import { describe, expect, it } from 'vitest'
import { applyMapNodeCompletion, createExplorationMapState, currentMapNode, explorationMapPublicState, mapNodeSelection, mapShopChoices } from './map'

describe('exploration map generation', () => {
  it('creates a deterministic twelve-layer map with reachable adjacent routes and visible node previews', () => {
    const first = createExplorationMapState('run-map-seed', 0, 0, 0)
    const second = createExplorationMapState('run-map-seed', 0, 0, 0)

    expect(first).toEqual(second)
    expect(first.nodes).toHaveLength(36)
    expect(new Set(first.nodes.map((node) => node.layer))).toEqual(new Set(Array.from({ length: 12 }, (_, index) => index)))
    expect(first.nodes.filter((node) => node.kind === 'PLAYER_BATTLE')).toHaveLength(6)
    expect(first.nodes.some((node) => node.kind === 'MONSTER_BATTLE' && node.monster?.possibleRewards.length)).toBe(true)
    expect(first.nodes.some((node) => node.kind === 'SHOP_FIXED' && node.shopType)).toBe(true)
    expect(first.nodes.some((node) => node.kind === 'SHOP_UNKNOWN')).toBe(true)
    expect(first.nodes.some((node) => node.kind === 'SHOP_EQUIPMENT')).toBe(true)
    expect(first.nodes.some((node) => node.kind === 'REST')).toBe(true)
    expect(first.nodes.some((node) => node.kind === 'EVENT' && node.event)).toBe(true)

    for (const node of first.nodes.filter((entry) => entry.layer < 11)) {
      expect(node.nextNodeIds.length).toBeGreaterThan(0)
      for (const nextId of node.nextNodeIds) {
        const next = first.nodes.find((entry) => entry.id === nextId)
        expect(next?.layer).toBe(node.layer + 1)
        expect(Math.abs((next?.column ?? 0) - node.column)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('allows only first-layer nodes first, then nodes linked from completed nodes', () => {
    const map = createExplorationMapState('run-route-seed', 0, 0, 0)
    const firstLayerIds = map.nodes.filter((node) => node.layer === 0).map((node) => node.id)
    expect(explorationMapPublicState(map).availableNodeIds).toEqual(firstLayerIds)

    const completed = applyMapNodeCompletion({ ...map, currentNodeId: firstLayerIds[0] })
    expect(explorationMapPublicState(completed).availableNodeIds).toEqual(currentMapNode(map, firstLayerIds[0])?.nextNodeIds)
  })
})

describe('exploration map node selection', () => {
  it('resolves the three shop node families without mixing equipment-only shops with special shops', () => {
    const map = createExplorationMapState('run-shop-seed', 0, 0, 0)
    const fixed = map.nodes.find((node) => node.kind === 'SHOP_FIXED' && node.shopType)!
    const unknown = map.nodes.find((node) => node.kind === 'SHOP_UNKNOWN')!
    const equipment = map.nodes.find((node) => node.kind === 'SHOP_EQUIPMENT')!

    expect(mapShopChoices(fixed, 'fixed-seed', 4)).toEqual([fixed.shopType])
    expect(mapShopChoices(unknown, 'unknown-seed', 4)).toHaveLength(3)
    const equipmentChoices = mapShopChoices(equipment, 'equipment-seed', 4)
    expect(equipmentChoices).toHaveLength(3)
    expect(equipmentChoices.every((choice) => ['GENERAL', 'LARGE', 'MEDIUM', 'SMALL', 'SMALL_DICE', 'BIG_DICE'].includes(choice))).toBe(true)
    expect(equipmentChoices).not.toContain('RELIC')
    expect(equipmentChoices).not.toContain('UPGRADE_SILVER')
    expect(equipmentChoices).not.toContain('POTION')
  })

  it('returns node-specific actions for battle, rest, event, and reward nodes', () => {
    const map = createExplorationMapState('run-action-seed', 0, 0, 0)
    const player = map.nodes.find((node) => node.kind === 'PLAYER_BATTLE')!
    const monster = map.nodes.find((node) => node.kind === 'MONSTER_BATTLE')!
    const rest = map.nodes.find((node) => node.kind === 'REST')!
    const event = map.nodes.find((node) => node.kind === 'EVENT')!

    expect(mapNodeSelection(player).action).toBe('PLAYER_BATTLE')
    expect(mapNodeSelection(monster).action).toBe('MONSTER_BATTLE')
    expect(mapNodeSelection(rest).action).toBe('REST')
    expect(mapNodeSelection(event).action).toBe('EVENT')
  })
})
