import { describe, expect, it } from 'vitest'
import { applyMapNodeCompletion, createExplorationMapState, currentMapNode, explorationMapPublicState, mapNodeSelection, mapShopChoices } from './map'

describe('exploration map generation', () => {
  it('creates a deterministic randomized twelve-layer map with forward-only fair routes', () => {
    const first = createExplorationMapState('run-map-seed', 0, 0, 0)
    const second = createExplorationMapState('run-map-seed', 0, 0, 0)

    expect(first).toEqual(second)
    expect(new Set(first.nodes.map((node) => node.layer))).toEqual(new Set(Array.from({ length: 12 }, (_, index) => index)))
    for (let layer = 0; layer < 12; layer += 1) {
      const layerNodes = first.nodes.filter((node) => node.layer === layer)
      expect(layerNodes.length).toBeGreaterThanOrEqual(2)
      expect(layerNodes.length).toBeLessThanOrEqual(4)
      for (const node of layerNodes) {
        expect(typeof node.x).toBe('number')
        expect(node.x).toBeGreaterThanOrEqual(0)
        expect(node.x).toBeLessThanOrEqual(1)
      }
    }

    expect(first.nodes.some((node) => node.kind === 'MONSTER_BATTLE' && node.monster?.possibleRewards.length)).toBe(true)
    expect(first.nodes.some((node) => node.kind === 'SHOP_FIXED' && node.shopType)).toBe(true)
    expect(first.nodes.some((node) => node.kind === 'SHOP_UNKNOWN')).toBe(true)
    expect(first.nodes.some((node) => node.kind === 'SHOP_EQUIPMENT')).toBe(true)
    expect(first.nodes.some((node) => node.kind === 'REST')).toBe(true)
    expect(first.nodes.some((node) => node.kind === 'EVENT' && node.event)).toBe(true)

    for (const node of first.nodes.filter((entry) => entry.layer < 11)) {
      expect(node.nextNodeIds.length).toBeGreaterThan(0)
      expect(node.nextNodeIds.length).toBeLessThanOrEqual(2)
      for (const nextId of node.nextNodeIds) {
        const next = first.nodes.find((entry) => entry.id === nextId)
        expect(next?.layer).toBe(node.layer + 1)
      }
    }
    for (const node of first.nodes.filter((entry) => entry.layer === 11)) {
      expect(node.nextNodeIds).toEqual([])
    }

    const completePaths = enumerateMapPaths(first)
    expect(completePaths.length).toBeGreaterThan(0)
    for (const path of completePaths) {
      const playerBattles = path.filter((node) => node.kind === 'PLAYER_BATTLE').length
      expect(playerBattles).toBeGreaterThanOrEqual(5)
      expect(playerBattles).toBeLessThanOrEqual(6)
    }
  })

  it('allows only entrance nodes first, then only nodes linked from the completed node', () => {
    const map = createExplorationMapState('run-route-seed', 0, 0, 0)
    const entranceIds = map.nodes.filter((node) => node.layer === 0).map((node) => node.id)
    expect(explorationMapPublicState(map).availableNodeIds).toEqual(entranceIds)

    const completed = applyMapNodeCompletion({ ...map, currentNodeId: entranceIds[0] })
    expect(explorationMapPublicState(completed).availableNodeIds).toEqual(currentMapNode(map, entranceIds[0])?.nextNodeIds)
  })
})

function enumerateMapPaths(map: ReturnType<typeof createExplorationMapState>) {
  const byId = new Map(map.nodes.map((node) => [node.id, node]))
  const starts = map.nodes.filter((node) => node.layer === 0)
  const paths: typeof starts[] = []
  const visit = (path: typeof starts) => {
    const tail = path[path.length - 1]
    if (!tail) return
    if (tail.layer === 11) {
      paths.push(path)
      return
    }
    for (const nextId of tail.nextNodeIds) {
      const next = byId.get(nextId)
      if (next) visit([...path, next])
    }
  }
  for (const start of starts) visit([start])
  return paths
}

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
