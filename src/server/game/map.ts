import { itemDef, shopPool } from './data'
import { buildOfflineFighter, offlineFighterName } from './offline-builder'
import { createRng, pick } from './rng'
import { createChoices } from './shop'
import type { DogType, ItemQuality, ShopType } from './types'

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
  possibleRewards: Array<{ defId: string; quality: ItemQuality }>
}

export type ExplorationMapNode = {
  id: string
  layer: number
  column: number
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

const MAP_LAYER_COUNT = 12
const MAP_COLUMNS = 3
export const EQUIPMENT_SHOP_TYPES = ['GENERAL', 'LARGE', 'MEDIUM', 'SMALL', 'SMALL_DICE', 'BIG_DICE'] as const satisfies readonly ShopType[]
const FIXED_SHOP_TYPES = ['GENERAL', 'LARGE', 'MEDIUM', 'SMALL', 'SMALL_DICE', 'BIG_DICE', 'RELIC', 'UPGRADE_SILVER', 'UPGRADE_GOLD', 'POTION'] as const satisfies readonly ShopType[]
const DOG_TYPES = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR', 'FROG'] as const satisfies readonly DogType[]
const EVENT_TYPES = ['GOLD_CACHE', 'RESTORE_TOLERANCE', 'FREE_EQUIPMENT', 'FREE_UPGRADE', 'RELIC_GIFT', 'RISKY_COMMISSION'] as const satisfies readonly ExplorationEventType[]

export function createExplorationMapState(runId: string, mapIndex: number, wins: number, losses: number): ExplorationMapState {
  const seed = `${runId}-map-${mapIndex}-${wins}-${losses}`
  const nodes: ExplorationMapNode[] = []
  const playerBattleLayers = new Set([1, 3, 5, 7, 9, 11])
  for (let layer = 0; layer < MAP_LAYER_COUNT; layer += 1) {
    const rng = createRng(`${seed}-layer-${layer}`)
    const playerColumn = playerBattleLayers.has(layer) ? Math.floor(rng() * MAP_COLUMNS) : -1
    const layerKinds = layerNodeKinds(layer)
    for (let column = 0; column < MAP_COLUMNS; column += 1) {
      const id = mapNodeId(mapIndex, layer, column)
      const kind = column === playerColumn ? 'PLAYER_BATTLE' : layerKinds[column]
      nodes.push(createMapNode({ id, layer, column, kind, seed, mapIndex, wins, losses }))
    }
  }

  return {
    version: 1,
    mapIndex,
    currentNodeId: null,
    completedNodeIds: [],
    nodes: nodes.map((node) => ({
      ...node,
      nextNodeIds: node.layer >= MAP_LAYER_COUNT - 1
        ? []
        : [node.column - 1, node.column, node.column + 1]
          .filter((column) => column >= 0 && column < MAP_COLUMNS)
          .map((column) => mapNodeId(mapIndex, node.layer + 1, column)),
    })),
  }
}

function layerNodeKinds(layer: number): ExplorationMapNodeKind[] {
  const patterns: ExplorationMapNodeKind[][] = [
    ['MONSTER_BATTLE', 'SHOP_FIXED', 'EVENT'],
    ['MONSTER_BATTLE', 'SHOP_EQUIPMENT', 'REST'],
    ['SHOP_UNKNOWN', 'MONSTER_BATTLE', 'EVENT'],
    ['SHOP_FIXED', 'REST', 'MONSTER_BATTLE'],
  ]
  return patterns[layer % patterns.length]
}

function createMapNode(input: { id: string; layer: number; column: number; kind: ExplorationMapNodeKind; seed: string; mapIndex: number; wins: number; losses: number }): ExplorationMapNode {
  const node: ExplorationMapNode = {
    id: input.id,
    layer: input.layer,
    column: input.column,
    kind: input.kind,
    nextNodeIds: [],
  }
  const rngSeed = `${input.seed}-${input.id}`
  if (input.kind === 'SHOP_FIXED') {
    node.shopType = pick(createRng(`${rngSeed}-shop`), [...FIXED_SHOP_TYPES])
  }
  if (input.kind === 'MONSTER_BATTLE') {
    node.monster = createMonsterPreview(input.layer, input.wins, input.losses, rngSeed)
  }
  if (input.kind === 'EVENT') {
    node.event = eventPreview(pick(createRng(`${rngSeed}-event`), [...EVENT_TYPES]))
  }
  return node
}

function createMonsterPreview(layer: number, wins: number, losses: number, seed: string): ExplorationMapMonster {
  const dogType = pick(createRng(`${seed}-dog`), [...DOG_TYPES])
  const fighter = buildOfflineFighter({
    dogType,
    round: Math.max(1, layer + 1),
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
  return {
    ...map,
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
