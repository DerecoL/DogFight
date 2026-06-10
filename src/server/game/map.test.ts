import { describe, expect, it } from 'vitest'
import { applyMapNodeCompletion, createExplorationMapState, currentMapNode, explorationMapPublicState, mapMonsterBattleRound, mapNodeSelection, mapShopChoices } from './map'

describe('exploration map generation', () => {
  it('creates a deterministic randomized ten-layer map with forward-only fair routes', () => {
    const first = createExplorationMapState('run-map-seed', 1, 0, 0)
    const second = createExplorationMapState('run-map-seed', 1, 0, 0)

    expect(first).toEqual(second)
    expect(new Set(first.nodes.map((node) => node.layer))).toEqual(new Set(Array.from({ length: 10 }, (_, index) => index)))
    for (let layer = 0; layer < 10; layer += 1) {
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
    expect(first.nodes.some((node) => node.kind === 'MONSTER_BATTLE' && node.monster?.equipment.length)).toBe(true)
    for (const monster of first.nodes.filter((node) => node.kind === 'MONSTER_BATTLE').map((node) => node.monster).filter((monster) => monster !== undefined)) {
      expect(monster.equipment.every((item) => item.area === 'EQUIPMENT')).toBe(true)
      expect(monster.equipment.every((item) => item.x >= 0 && item.x < 12)).toBe(true)
    }
    expect(first.nodes.some((node) => node.kind === 'SHOP_FIXED' && node.shopType)).toBe(true)
    expect(first.nodes.some((node) => node.kind === 'SHOP_UNKNOWN')).toBe(true)
    expect(first.nodes.some((node) => node.kind === 'SHOP_EQUIPMENT')).toBe(true)
    expect(first.nodes.some((node) => node.kind === 'REST')).toBe(true)
    expect(first.nodes.some((node) => node.kind === 'EVENT' && node.event)).toBe(true)

    for (const node of first.nodes.filter((entry) => entry.layer < 9)) {
      expect(node.nextNodeIds.length).toBeGreaterThan(0)
      expect(node.nextNodeIds.length).toBeLessThanOrEqual(2)
      for (const nextId of node.nextNodeIds) {
        const next = first.nodes.find((entry) => entry.id === nextId)
        expect(next?.layer).toBe(node.layer + 1)
      }
    }
    for (const node of first.nodes.filter((entry) => entry.layer === 9)) {
      expect(node.nextNodeIds).toEqual([])
    }

    const completePaths = enumerateMapPaths(first)
    expect(completePaths.length).toBeGreaterThan(0)
    for (const path of completePaths) {
      const playerBattles = path.filter((node) => node.kind === 'PLAYER_BATTLE').length
      expect(playerBattles).toBeGreaterThanOrEqual(3)
      expect(playerBattles).toBeLessThanOrEqual(5)
    }
  })

  it('makes four player battles the common route, with some three-battle maps and rare five-battle maps', () => {
    const counts = new Map<number, number>()

    for (let index = 0; index < 200; index += 1) {
      const map = createExplorationMapState(`run-battle-density-${index}`, 0, index % 7, index % 3)
      const path = enumerateMapPaths(map)[0]
      const playerBattles = path.filter((node) => node.kind === 'PLAYER_BATTLE').length
      counts.set(playerBattles, (counts.get(playerBattles) ?? 0) + 1)
    }

    expect([...counts.keys()].sort()).toEqual([3, 4, 5])
    expect(counts.get(4)).toBeGreaterThan(counts.get(3) ?? 0)
    expect(counts.get(3)).toBeGreaterThan(counts.get(5) ?? 0)
    expect(counts.get(5)).toBeLessThanOrEqual(20)
  })

  it('occasionally creates reward branches that skip one player battle and rejoin merged player battle routes', () => {
    let foundUnevenPlayerBattleRoutes = false
    let foundMergedPlayerBattleNode = false

    for (let index = 0; index < 400; index += 1) {
      const map = createExplorationMapState(`run-branch-merge-${index}`, index % 2, index % 7, index % 3)
      const paths = enumerateMapPaths(map)
      const battleCounts = paths.map((path) => path.filter((node) => node.kind === 'PLAYER_BATTLE').length)
      const uniqueBattleCounts = new Set(battleCounts)
      if (uniqueBattleCounts.size > 1) {
        foundUnevenPlayerBattleRoutes = true
        expect(Math.min(...battleCounts)).toBeGreaterThanOrEqual(3)
        expect(Math.max(...battleCounts)).toBeLessThanOrEqual(5)
      }

      const incomingCounts = new Map<string, number>()
      for (const node of map.nodes) {
        for (const nextId of node.nextNodeIds) {
          incomingCounts.set(nextId, (incomingCounts.get(nextId) ?? 0) + 1)
        }
      }
      if (map.nodes.some((node) => node.kind === 'PLAYER_BATTLE' && [2, 3].includes(incomingCounts.get(node.id) ?? 0))) {
        foundMergedPlayerBattleNode = true
      }
    }

    expect(foundUnevenPlayerBattleRoutes).toBe(true)
    expect(foundMergedPlayerBattleNode).toBe(true)
  })

  it('creates readable route convergence, including occasional full-route bottlenecks that split again', () => {
    let foundLocalMerge = false
    let foundFullConvergence = false
    let foundSplitAfterFullConvergence = false

    for (let index = 0; index < 500; index += 1) {
      const map = createExplorationMapState(`route-convergence-${index}`, index % 3, index % 7, index % 3)
      const incoming = incomingCounts(map)
      if (map.nodes.some((node) => (incoming.get(node.id) ?? 0) >= 2)) foundLocalMerge = true
      if (fullConvergenceLayers(map).length > 0) foundFullConvergence = true
      if (hasSplitAfterFullConvergence(map)) foundSplitAfterFullConvergence = true
    }

    expect(foundLocalMerge).toBe(true)
    expect(foundFullConvergence).toBe(true)
    expect(foundSplitAfterFullConvergence).toBe(true)
  })

  it('keeps generated route layers from accumulating heavy crossing pressure', () => {
    for (let index = 0; index < 160; index += 1) {
      const map = createExplorationMapState(`route-crossing-pressure-${index}`, index % 3, index % 7, index % 3)
      for (let layer = 0; layer < 9; layer += 1) {
        expect(countLayerCrossings(map, layer)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('keeps the first map rest-free with only one early shop and softer monsters', () => {
    for (let index = 0; index < 80; index += 1) {
      const map = createExplorationMapState(`first-map-pacing-${index}`, 0, index % 4, index % 2)
      const earlyNodes = map.nodes.filter((node) => node.layer <= 3)
      const earlyShops = earlyNodes.filter((node) => node.kind.startsWith('SHOP'))
      const laterShops = map.nodes.filter((node) => node.layer >= 4 && node.kind.startsWith('SHOP'))
      const monsters = map.nodes.filter((node) => node.kind === 'MONSTER_BATTLE')

      expect(map.nodes.some((node) => node.kind === 'REST')).toBe(false)
      expect(earlyShops).toHaveLength(1)
      expect(earlyShops[0]).toMatchObject({ layer: 0, kind: 'SHOP_FIXED' })
      expect(laterShops.length).toBeGreaterThan(0)
      expect(monsters.length).toBeGreaterThan(0)
      expect(monsters.every((node) => node.monster?.round === mapMonsterBattleRound(map.mapIndex, node.layer))).toBe(true)
      expect(monsters.every((node) => (node.monster?.round ?? 99) <= 3)).toBe(true)
    }
  })

  it('keeps later maps eligible for rest points and normal monster scaling', () => {
    const map = createExplorationMapState('later-map-pacing', 1, 4, 1)
    const monster = map.nodes.find((node) => node.kind === 'MONSTER_BATTLE' && node.layer >= 4)

    expect(map.nodes.some((node) => node.kind === 'REST')).toBe(true)
    expect(monster?.monster?.round).toBe(mapMonsterBattleRound(map.mapIndex, monster?.layer ?? 0))
    expect(monster?.monster?.round).toBe((monster?.layer ?? -1) + 1)
  })

  it('allows only entrance nodes first, then only nodes linked from the completed node', () => {
    const map = createExplorationMapState('run-route-seed', 0, 0, 0)
    const entranceIds = map.nodes.filter((node) => node.layer === 0).map((node) => node.id)
    expect(explorationMapPublicState(map).availableNodeIds).toEqual(entranceIds)

    const completed = applyMapNodeCompletion({ ...map, currentNodeId: entranceIds[0] })
    expect(explorationMapPublicState(completed).availableNodeIds).toEqual(currentMapNode(map, entranceIds[0])?.nextNodeIds)
  })

  it('keeps event details hidden until an event node has been opened', () => {
    const map = createExplorationMapState('run-hidden-event-seed', 0, 0, 0)
    const eventNode = map.nodes.find((node) => node.kind === 'EVENT')
    expect(eventNode?.event).toBeTruthy()

    const unexplored = explorationMapPublicState(map)
    expect(unexplored.nodes.filter((node) => node.kind === 'EVENT').every((node) => node.event === undefined)).toBe(true)

    const opened = explorationMapPublicState({ ...map, currentNodeId: eventNode!.id })
    expect(opened.nodes.find((node) => node.id === eventNode!.id)?.event).toEqual(eventNode!.event)

    const completed = explorationMapPublicState({ ...map, completedNodeIds: [eventNode!.id] })
    expect(completed.nodes.find((node) => node.id === eventNode!.id)?.event).toEqual(eventNode!.event)
  })
})

function enumerateMapPaths(map: ReturnType<typeof createExplorationMapState>) {
  const byId = new Map(map.nodes.map((node) => [node.id, node]))
  const starts = map.nodes.filter((node) => node.layer === 0)
  const paths: typeof starts[] = []
  const visit = (path: typeof starts) => {
    const tail = path[path.length - 1]
    if (!tail) return
    if (tail.layer === 9) {
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

function incomingCounts(map: ReturnType<typeof createExplorationMapState>) {
  const counts = new Map<string, number>()
  for (const node of map.nodes) {
    for (const nextId of node.nextNodeIds) counts.set(nextId, (counts.get(nextId) ?? 0) + 1)
  }
  return counts
}

function fullConvergenceLayers(map: ReturnType<typeof createExplorationMapState>) {
  const byLayer = Array.from({ length: 10 }, (_, layer) => map.nodes.filter((node) => node.layer === layer))
  const layers: Array<{ layer: number; targetId: string }> = []
  for (let layer = 1; layer < 8; layer += 1) {
    const currentLayer = byLayer[layer]
    if (currentLayer.length < 2) continue
    const targetIds = new Set(currentLayer.flatMap((node) => node.nextNodeIds))
    if (targetIds.size === 1) layers.push({ layer, targetId: [...targetIds][0] })
  }
  return layers
}

function hasSplitAfterFullConvergence(map: ReturnType<typeof createExplorationMapState>) {
  const byId = new Map(map.nodes.map((node) => [node.id, node]))
  return fullConvergenceLayers(map).some(({ targetId }) => {
    const target = byId.get(targetId)
    if (!target) return false
    if (target.nextNodeIds.length >= 2) return true
    const next = target.nextNodeIds
      .map((id) => byId.get(id))
      .filter((node): node is (typeof map.nodes)[number] => node !== undefined)
    return new Set(next.flatMap((node) => node.nextNodeIds)).size >= 2
  })
}

function countLayerCrossings(map: ReturnType<typeof createExplorationMapState>, layer: number) {
  const byId = new Map(map.nodes.map((node) => [node.id, node]))
  const edges = map.nodes
    .filter((node) => node.layer === layer)
    .flatMap((source) => source.nextNodeIds.map((nextId) => ({ source, target: byId.get(nextId) })))
    .filter((edge): edge is { source: (typeof map.nodes)[number]; target: (typeof map.nodes)[number] } => edge.target !== undefined)
  let crossings = 0
  for (let a = 0; a < edges.length; a += 1) {
    for (let b = a + 1; b < edges.length; b += 1) {
      const sourceDelta = (edges[a].source.x ?? 0.5) - (edges[b].source.x ?? 0.5)
      const targetDelta = (edges[a].target.x ?? 0.5) - (edges[b].target.x ?? 0.5)
      if (sourceDelta * targetDelta < 0) crossings += 1
    }
  }
  return crossings
}

describe('exploration map node selection', () => {
  it('resolves the three shop node families without mixing equipment-only shops with special shops', () => {
    const map = createExplorationMapState('run-shop-seed', 1, 0, 0)
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

  it('offers an equipment-only three-choice shop before player battle nodes', () => {
    const map = createExplorationMapState('run-player-shop-seed', 0, 0, 0)
    const playerBattle = map.nodes.find((node) => node.kind === 'PLAYER_BATTLE')!

    const choices = mapShopChoices(playerBattle, 'player-battle-pre-shop', 3)

    expect(choices).toHaveLength(3)
    expect(choices.every((choice) => ['GENERAL', 'LARGE', 'MEDIUM', 'SMALL', 'SMALL_DICE', 'BIG_DICE'].includes(choice))).toBe(true)
    expect(choices).not.toContain('RELIC')
    expect(choices).not.toContain('UPGRADE_SILVER')
    expect(choices).not.toContain('POTION')
  })

  it('returns node-specific actions for battle, rest, event, and reward nodes', () => {
    const map = createExplorationMapState('run-action-seed', 1, 0, 0)
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
