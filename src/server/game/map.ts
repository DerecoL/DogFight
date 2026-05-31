import { itemDef, shopPool } from './data'
import { buildOfflineFighter, offlineFighterName } from './offline-builder'
import { createRng, pick } from './rng'
import { createChoices } from './shop'
import type { DogType, GameItem, ItemQuality, ShopType } from './types'

export type ExplorationMapNodeKind =
  | 'PLAYER_BATTLE'
  | 'MONSTER_BATTLE'
  | 'SHOP_FIXED'
  | 'SHOP_UNKNOWN'
  | 'SHOP_EQUIPMENT'
  | 'REST'
  | 'EVENT'

export type ExplorationEventType =
  | 'GOLD_CACHE'
  | 'RESTORE_TOLERANCE'
  | 'FREE_EQUIPMENT'
  | 'FREE_UPGRADE'
  | 'RELIC_GIFT'
  | 'RISKY_COMMISSION'

export type ExplorationMapMonster = {
  name: string
  dogType: DogType
  seed: string
  round: number
  equipment: GameItem[]
  possibleRewards: Array<{ defId: string; quality: ItemQuality }>
}

export type ExplorationMapNode = {
  id: string
  layer: number
  column: number
  x?: number
  kind: ExplorationMapNodeKind
  nextNodeIds: string[]
  shopType?: ShopType
  monster?: ExplorationMapMonster
  event?: { type: ExplorationEventType; title: string; description: string }
}

export type ExplorationPendingReward = {
  nodeId: string
  defId: string
  quality: ItemQuality
}

export type ExplorationMapState = {
  version: 1
  mapIndex: number
  currentNodeId: string | null
  completedNodeIds: string[]
  nodes: ExplorationMapNode[]
  pendingReward?: ExplorationPendingReward | null
}

const MAP_LAYER_COUNT = 10
export const EQUIPMENT_SHOP_TYPES = ['GENERAL', 'LARGE', 'MEDIUM', 'SMALL', 'SMALL_DICE', 'BIG_DICE'] as const satisfies readonly ShopType[]
const FIXED_SHOP_TYPES = ['GENERAL', 'LARGE', 'MEDIUM', 'SMALL', 'SMALL_DICE', 'BIG_DICE', 'RELIC', 'UPGRADE_SILVER', 'UPGRADE_GOLD', 'POTION'] as const satisfies readonly ShopType[]
const DOG_TYPES = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR', 'FROG'] as const satisfies readonly DogType[]
const EVENT_TYPES = ['GOLD_CACHE', 'RESTORE_TOLERANCE', 'FREE_EQUIPMENT', 'FREE_UPGRADE', 'RELIC_GIFT', 'RISKY_COMMISSION'] as const satisfies readonly ExplorationEventType[]

export function createExplorationMapState(runId: string, mapIndex: number, wins: number, losses: number): ExplorationMapState {
  const seed = `${runId}-map-${mapIndex}-${wins}-${losses}`
  const nodes: ExplorationMapNode[] = []
  const playerBattleLayers = playerBattleLayerSet(seed)
  for (let layer = 0; layer < MAP_LAYER_COUNT; layer += 1) {
    const layerRng = createRng(`${seed}-layer-${layer}`)
    const nodeCount = layer === 0 ? 3 : 2 + Math.floor(layerRng() * 3)
    for (let column = 0; column < nodeCount; column += 1) {
      const id = mapNodeId(mapIndex, layer, column)
      const x = layerNodeX(column, nodeCount, createRng(`${seed}-x-${layer}-${column}`))
      const kind = playerBattleLayers.has(layer) ? 'PLAYER_BATTLE' : layerNodeKind(mapIndex, layer, column, nodeCount, seed)
      nodes.push(createMapNode({ id, layer, column, x, kind, seed, mapIndex, wins, losses }))
    }
  }

  return {
    version: 1,
    mapIndex,
    currentNodeId: null,
    completedNodeIds: [],
    nodes: connectMapLayers(nodes, mapIndex),
  }
}

function layerNodeKinds(mapIndex: number, layer: number): ExplorationMapNodeKind[] {
  if (mapIndex === 0) {
    const firstMapPatterns: ExplorationMapNodeKind[][] = [
      ['MONSTER_BATTLE', 'SHOP_FIXED', 'EVENT'],
      ['MONSTER_BATTLE', 'MONSTER_BATTLE', 'EVENT'],
      ['EVENT', 'MONSTER_BATTLE', 'MONSTER_BATTLE'],
      ['MONSTER_BATTLE', 'EVENT', 'MONSTER_BATTLE'],
      ['MONSTER_BATTLE', 'SHOP_EQUIPMENT', 'EVENT'],
      ['SHOP_FIXED', 'MONSTER_BATTLE', 'EVENT'],
      ['SHOP_UNKNOWN', 'MONSTER_BATTLE', 'EVENT'],
      ['SHOP_FIXED', 'MONSTER_BATTLE', 'EVENT'],
      ['SHOP_EQUIPMENT', 'MONSTER_BATTLE', 'EVENT'],
      ['SHOP_FIXED', 'MONSTER_BATTLE', 'EVENT'],
    ]
    return firstMapPatterns[layer] ?? firstMapPatterns.at(-1)!
  }
  const patterns: ExplorationMapNodeKind[][] = [
    ['MONSTER_BATTLE', 'SHOP_FIXED', 'EVENT'],
    ['MONSTER_BATTLE', 'SHOP_EQUIPMENT', 'REST'],
    ['SHOP_UNKNOWN', 'MONSTER_BATTLE', 'EVENT'],
    ['SHOP_FIXED', 'REST', 'MONSTER_BATTLE'],
  ]
  return patterns[layer % patterns.length]
}

function playerBattleLayerSet(seed: string) {
  const rng = createRng(`${seed}-player-battle-layers`)
  const candidates = [4, 5, 6, 8, 9]
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    const value = candidates[index]
    candidates[index] = candidates[swapIndex]
    candidates[swapIndex] = value
  }
  const roll = rng()
  const count = roll < 0.25 ? 3 : roll < 0.95 ? 4 : 5
  return new Set(candidates.slice(0, count))
}

function layerNodeX(column: number, count: number, rng: () => number) {
  if (count <= 1) return 0.5
  const margin = 0.12
  const span = 1 - margin * 2
  const base = margin + (span * column) / (count - 1)
  const jitter = (rng() - 0.5) * 0.08
  return Math.max(0.08, Math.min(0.92, base + jitter))
}

function layerNodeKind(mapIndex: number, layer: number, column: number, count: number, seed: string): ExplorationMapNodeKind {
  const rng = createRng(`${seed}-kind-${layer}-${column}-${count}`)
  const pattern = layerNodeKinds(mapIndex, layer)
  const base = pattern[column % pattern.length]
  if (base === 'PLAYER_BATTLE') return rng() < 0.55 ? 'MONSTER_BATTLE' : 'EVENT'
  return base
}

function connectMapLayers(nodes: ExplorationMapNode[], mapIndex: number) {
  const byLayer = Array.from({ length: MAP_LAYER_COUNT }, (_, layer) =>
    nodes.filter((node) => node.layer === layer).sort((a, b) => (a.x ?? 0.5) - (b.x ?? 0.5)),
  )
  const nextIdsByNodeId = new Map<string, string[]>()

  for (let layer = 0; layer < MAP_LAYER_COUNT - 1; layer += 1) {
    const currentLayer = byLayer[layer]
    const nextLayer = byLayer[layer + 1]
    const incoming = new Map(nextLayer.map((node) => [node.id, 0]))

    for (const node of currentLayer) {
      const nearest = nearestNextNodes(node, nextLayer).slice(0, 1)
      nextIdsByNodeId.set(node.id, nearest.map((next) => next.id))
      for (const next of nearest) incoming.set(next.id, (incoming.get(next.id) ?? 0) + 1)
    }

    for (const next of nextLayer) {
      if ((incoming.get(next.id) ?? 0) > 0) continue
      const source = nearestNextSources(next, currentLayer)
        .find((node) => (nextIdsByNodeId.get(node.id)?.length ?? 0) < 2)
      if (!source) continue
      const nextIds = nextIdsByNodeId.get(source.id) ?? []
      if (!nextIds.includes(next.id)) nextIdsByNodeId.set(source.id, [...nextIds, next.id])
      incoming.set(next.id, (incoming.get(next.id) ?? 0) + 1)
    }
  }

  return nodes.map((node) => ({
    ...node,
    nextNodeIds: node.layer >= MAP_LAYER_COUNT - 1
      ? []
      : (nextIdsByNodeId.get(node.id) ?? [mapNodeId(mapIndex, node.layer + 1, 0)]),
  }))
}

function nearestNextNodes(node: ExplorationMapNode, nextLayer: ExplorationMapNode[]) {
  return [...nextLayer].sort((a, b) => Math.abs((a.x ?? 0.5) - (node.x ?? 0.5)) - Math.abs((b.x ?? 0.5) - (node.x ?? 0.5)))
}

function nearestNextSources(next: ExplorationMapNode, currentLayer: ExplorationMapNode[]) {
  return [...currentLayer].sort((a, b) => Math.abs((a.x ?? 0.5) - (next.x ?? 0.5)) - Math.abs((b.x ?? 0.5) - (next.x ?? 0.5)))
}

function createMapNode(input: { id: string; layer: number; column: number; x: number; kind: ExplorationMapNodeKind; seed: string; mapIndex: number; wins: number; losses: number }): ExplorationMapNode {
  const node: ExplorationMapNode = {
    id: input.id,
    layer: input.layer,
    column: input.column,
    x: input.x,
    kind: input.kind,
    nextNodeIds: [],
  }
  const rngSeed = `${input.seed}-${input.id}`
  if (input.kind === 'SHOP_FIXED') {
    node.shopType = pick(createRng(`${rngSeed}-shop`), [...FIXED_SHOP_TYPES])
  }
  if (input.kind === 'MONSTER_BATTLE') {
    node.monster = createMonsterPreview(input.mapIndex, input.layer, input.wins, input.losses, rngSeed)
  }
  if (input.kind === 'EVENT') {
    node.event = eventPreview(pick(createRng(`${rngSeed}-event`), [...EVENT_TYPES]))
  }
  return node
}

export function mapMonsterBattleRound(mapIndex: number, layer: number) {
  if (mapIndex === 0) return Math.max(1, Math.min(3, Math.floor(layer / 2) + 1))
  return Math.max(1, layer + 1)
}

function createMonsterPreview(mapIndex: number, layer: number, wins: number, losses: number, seed: string): ExplorationMapMonster {
  const dogType = pick(createRng(`${seed}-dog`), [...DOG_TYPES])
  const round = mapMonsterBattleRound(mapIndex, layer)
  const fighter = buildOfflineFighter({
    dogType,
    round,
    wins,
    losses,
    seed,
  })
  const possibleRewards = fighter.items
    .filter((item) => itemDef(item.defId).kind !== 'CLASS_EQUIPMENT')
    .slice(0, 4)
    .map((item) => ({ defId: item.defId, quality: item.quality }))
  return {
    name: offlineFighterName(seed),
    dogType,
    seed,
    round,
    equipment: fighter.items,
    possibleRewards,
  }
}

function eventPreview(type: ExplorationEventType) {
  const copy: Record<ExplorationEventType, { title: string; description: string }> = {
    GOLD_CACHE: { title: '金币缓存', description: '获得 6 金币。' },
    RESTORE_TOLERANCE: { title: '急救补给', description: '恢复 1 次容错，满容错时获得 4 金币。' },
    FREE_EQUIPMENT: { title: '流浪装备', description: '获得一件普通装备。' },
    FREE_UPGRADE: { title: '修理台', description: '免费升级一件未满级装备。' },
    RELIC_GIFT: { title: '神秘遗物', description: '进入遗物三选一。' },
    RISKY_COMMISSION: { title: '危险委托', description: '获得 12 金币，并消耗 1 次容错。' },
  }
  return { type, ...copy[type] }
}

export function mapNodeId(mapIndex: number, layer: number, column: number) {
  return `map-${mapIndex}-${layer}-${column}`
}

export function currentMapNode(map: ExplorationMapState, nodeId: string | null | undefined) {
  if (!nodeId) return null
  return map.nodes.find((node) => node.id === nodeId) ?? null
}

export function availableMapNodeIds(map: ExplorationMapState) {
  if (map.currentNodeId || map.pendingReward) return []
  if (map.completedNodeIds.length === 0) return map.nodes.filter((node) => node.layer === 0).map((node) => node.id)
  const completed = new Set(map.completedNodeIds)
  const latestLayer = Math.max(...map.completedNodeIds.map((id) => currentMapNode(map, id)?.layer ?? -1))
  const latestCompleted = map.completedNodeIds
    .map((id) => currentMapNode(map, id))
    .filter((node): node is ExplorationMapNode => node !== null && node.layer === latestLayer)
  const linked = latestCompleted.flatMap((node) => node.nextNodeIds)
  return linked.filter((id) => !completed.has(id))
}

export function explorationMapPublicState(map: ExplorationMapState) {
  const revealedEventNodeIds = new Set([map.currentNodeId, ...map.completedNodeIds].filter((id): id is string => typeof id === 'string'))
  const nodes: ExplorationMapNode[] = map.nodes.map((node): ExplorationMapNode => {
    if (node.kind !== 'EVENT' || revealedEventNodeIds.has(node.id)) return node
    const { event: _event, ...hiddenNode } = node
    return hiddenNode
  })
  return {
    ...map,
    nodes,
    availableNodeIds: availableMapNodeIds(map),
  }
}

export function applyMapNodeCompletion(map: ExplorationMapState, nodeId = map.currentNodeId): ExplorationMapState {
  if (!nodeId) return map
  return {
    ...map,
    currentNodeId: null,
    completedNodeIds: map.completedNodeIds.includes(nodeId) ? map.completedNodeIds : [...map.completedNodeIds, nodeId],
    pendingReward: null,
  }
}

export function mapShopChoices(node: ExplorationMapNode, seed: string, round: number): ShopType[] {
  if (node.kind === 'SHOP_FIXED') return [node.shopType ?? 'GENERAL']
  if (node.kind === 'SHOP_EQUIPMENT') return uniqueChoices(createRng(seed), [...EQUIPMENT_SHOP_TYPES], 3)
  if (node.kind === 'PLAYER_BATTLE') return uniqueChoices(createRng(seed), [...EQUIPMENT_SHOP_TYPES], 3)
  if (node.kind === 'SHOP_UNKNOWN') return createChoices(createRng(seed), round)
  return []
}

function uniqueChoices<T>(rng: () => number, pool: readonly T[], count: number) {
  const choices: T[] = []
  while (choices.length < count && choices.length < pool.length) {
    const next = pick(rng, [...pool])
    if (!choices.includes(next)) choices.push(next)
  }
  return choices
}

export function mapNodeSelection(node: ExplorationMapNode): { action: 'PLAYER_BATTLE' | 'MONSTER_BATTLE' | 'SHOP' | 'REST' | 'EVENT' } {
  if (node.kind === 'PLAYER_BATTLE') return { action: 'PLAYER_BATTLE' }
  if (node.kind === 'MONSTER_BATTLE') return { action: 'MONSTER_BATTLE' }
  if (node.kind === 'REST') return { action: 'REST' }
  if (node.kind === 'EVENT') return { action: 'EVENT' }
  return { action: 'SHOP' }
}

export function explorationMapFinished(map: ExplorationMapState) {
  const completed = new Set(map.completedNodeIds)
  return map.nodes.some((node) => node.layer === MAP_LAYER_COUNT - 1 && completed.has(node.id))
}

export function normalizeExplorationMapState(value: unknown): ExplorationMapState | null {
  if (!value || typeof value !== 'object') return null
  const map = value as ExplorationMapState
  if (map.version !== 1 || !Array.isArray(map.nodes) || !Array.isArray(map.completedNodeIds)) return null
  return {
    version: 1,
    mapIndex: Number.isInteger(map.mapIndex) ? map.mapIndex : 0,
    currentNodeId: typeof map.currentNodeId === 'string' ? map.currentNodeId : null,
    completedNodeIds: map.completedNodeIds.filter((id): id is string => typeof id === 'string'),
    nodes: map.nodes,
    pendingReward: map.pendingReward ?? null,
  }
}

export function randomEquipmentReward(seed: string) {
  const def = pick(createRng(seed), shopPool('GENERAL'))
  return { defId: def.id, quality: (def.defaultQuality ?? 'BRONZE') as ItemQuality }
}

export function randomMonsterReward(monster: ExplorationMapMonster | undefined, seed: string) {
  if (!monster || monster.possibleRewards.length === 0) return randomEquipmentReward(seed)
  return pick(createRng(seed), monster.possibleRewards)
}
