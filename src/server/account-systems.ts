import { createHash } from 'node:crypto'
import type { DogType } from './game/types'

export type CosmeticType = 'TITLE' | 'AVATAR' | 'BACKGROUND' | 'DOG_SKIN' | 'BATTLE_EFFECT'
export type CosmeticRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
export type PurchaseType = 'SOFT_CURRENCY' | 'PAID_READY' | 'GRANT_ONLY'
export type CatalogSection = 'PERMANENT' | 'FEATURED'

export type AccountEvent =
  | { kind: 'RUN_CREATED'; dogType?: DogType | string | null }
  | { kind: 'SHOP_PURCHASED'; shopType?: string | null; itemDefId?: string | null }
  | { kind: 'BATTLE_FINISHED'; mode?: string | null; dogType?: DogType | string | null; winner: boolean; wins: number; losses: number; round: number; itemCount?: number; relicCount?: number }
  | { kind: 'LADDER_SETTLED'; wins: number; losses: number }
  | { kind: 'DOGFIGHT_ROUND_FINISHED'; winner: boolean }
  | { kind: 'COSMETIC_PURCHASED'; catalogItemId: string; cosmeticType: CosmeticType }
  | { kind: 'COSMETIC_EQUIPPED'; catalogItemId: string; cosmeticType: CosmeticType }

export type CurrencyWallet = { balance: number; dailyEarned: number }
export type AchievementCategory = '基础成长' | '职业特色' | '战斗构筑' | '收藏商城'
export type AchievementProgress = { achievementId: string; progress: number; completedAt: string | null; claimedAt: string | null }
export type AchievementDef = {
  id: string
  title: string
  description: string
  category: AchievementCategory
  target: number
  reward: number
  hidden?: boolean
  eventKinds: readonly AccountEvent['kind'][]
  progress: (event: AccountEvent) => number
}
export type DailyTaskSlot = 'PARTICIPATION' | 'BUILD' | 'BATTLE'
export type DailyTaskDef = { id: string; slot: DailyTaskSlot; title: string; description: string; target: number; reward: number; progress: (event: AccountEvent) => number }
export type DailyTaskProgress = { taskId: string; slot: DailyTaskSlot; progress: number; target: number; reward: number; claimedAt: string | null }
export type DailyTaskState = { dateKey: string; refreshUsed: boolean; tasks: DailyTaskProgress[] }
export type ShopCatalogItem = {
  id: string
  name: string
  description: string
  type: CosmeticType
  rarity: CosmeticRarity
  price: number
  section: CatalogSection
  assetKey: string
  sku?: string
  purchaseType: PurchaseType
  source: 'CODE' | 'DB_OVERRIDE'
}
export type CosmeticInventoryEntry = { catalogItemId: string; acquiredAt: string }
export type EquippedCosmetic = { slot: CosmeticType; catalogItemId: string }

export const DAILY_CURRENCY_LIMIT = 240

const eventCount = (kind: AccountEvent['kind']) => (event: AccountEvent) => event.kind === kind ? 1 : 0
const battleWin = (event: AccountEvent) => event.kind === 'BATTLE_FINISHED' && event.winner ? 1 : 0
const battleMode = (mode: string) => (event: AccountEvent) => event.kind === 'BATTLE_FINISHED' && event.mode === mode ? 1 : 0
const dogRun = (dogType: DogType) => (event: AccountEvent) => event.kind === 'RUN_CREATED' && event.dogType === dogType ? 1 : 0
const dogWin = (dogType: DogType) => (event: AccountEvent) => event.kind === 'BATTLE_FINISHED' && event.winner && event.dogType === dogType ? 1 : 0
const highRun = (targetWins: number) => (event: AccountEvent) => event.kind === 'BATTLE_FINISHED' && event.wins >= targetWins ? 1 : 0

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-run', title: '第一次出门', description: '开始第一局游戏。', category: '基础成长', target: 1, reward: 80, eventKinds: ['RUN_CREATED'], progress: eventCount('RUN_CREATED') },
  { id: 'five-runs', title: '公园常客', description: '累计开始 5 局游戏。', category: '基础成长', target: 5, reward: 120, eventKinds: ['RUN_CREATED'], progress: eventCount('RUN_CREATED') },
  { id: 'first-win', title: '首胜爪印', description: '赢得第一场战斗。', category: '基础成长', target: 1, reward: 100, eventKinds: ['BATTLE_FINISHED'], progress: battleWin },
  { id: 'ten-wins', title: '十胜训练', description: '累计赢得 10 场战斗。', category: '基础成长', target: 10, reward: 180, eventKinds: ['BATTLE_FINISHED'], progress: battleWin },
  { id: 'first-ladder', title: '踏上天梯', description: '完成 1 次天梯结算。', category: '基础成长', target: 1, reward: 140, eventKinds: ['LADDER_SETTLED'], progress: eventCount('LADDER_SETTLED') },
  { id: 'first-dogfight', title: '狗斗入场', description: '完成 1 轮多人狗斗。', category: '基础成长', target: 1, reward: 120, eventKinds: ['DOGFIGHT_ROUND_FINISHED'], progress: eventCount('DOGFIGHT_ROUND_FINISHED') },
  { id: 'first-shop-buy', title: '会花钱的狗', description: '在局内商店购买 1 件商品。', category: '基础成长', target: 1, reward: 80, eventKinds: ['SHOP_PURCHASED'], progress: eventCount('SHOP_PURCHASED') },
  { id: 'finish-run', title: '有始有终', description: '完成 1 局游戏。', category: '基础成长', target: 1, reward: 160, eventKinds: ['BATTLE_FINISHED'], progress: (event) => event.kind === 'BATTLE_FINISHED' && (event.wins >= 12 || event.losses >= 5) ? 1 : 0 },
  ...(['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR', 'FROG'] as const).flatMap((dogType) => {
    const dogNames: Record<DogType, string> = { SHIBA: '柴犬', SAMOYED: '萨摩耶', MUTT: '土狗', BULLY: '恶霸', EMPEROR: '狗皇帝', FROG: '祖灵' }
    const prefix = dogType.toLowerCase()
    return [
      { id: `${prefix}-start`, title: `${dogNames[dogType]}出击`, description: `使用${dogNames[dogType]}开始 3 局。`, category: '职业特色' as const, target: 3, reward: 100, eventKinds: ['RUN_CREATED'] as const, progress: dogRun(dogType) },
      { id: `${prefix}-win`, title: `${dogNames[dogType]}训练`, description: `使用${dogNames[dogType]}赢得 5 场战斗。`, category: '职业特色' as const, target: 5, reward: 140, eventKinds: ['BATTLE_FINISHED'] as const, progress: dogWin(dogType) },
      { id: `${prefix}-high`, title: `${dogNames[dogType]}十二胜`, description: `使用${dogNames[dogType]}达到 12 胜。`, category: '职业特色' as const, target: 1, reward: 260, eventKinds: ['BATTLE_FINISHED'] as const, progress: (event: AccountEvent) => event.kind === 'BATTLE_FINISHED' && event.dogType === dogType && event.wins >= 12 ? 1 : 0 },
      { id: `${prefix}-hidden`, title: `${dogNames[dogType]}秘技`, description: `隐藏成就：使用${dogNames[dogType]}完成高胜局。`, category: '职业特色' as const, target: 1, reward: 300, hidden: true, eventKinds: ['BATTLE_FINISHED'] as const, progress: (event: AccountEvent) => event.kind === 'BATTLE_FINISHED' && event.dogType === dogType && event.wins >= 10 && event.losses <= 1 ? 1 : 0 },
    ]
  }),
  { id: 'casual-fighter', title: '休闲练手', description: '完成 10 场休闲战斗。', category: '战斗构筑', target: 10, reward: 140, eventKinds: ['BATTLE_FINISHED'], progress: battleMode('CASUAL') },
  { id: 'ladder-fighter', title: '天梯练习', description: '完成 5 场天梯战斗。', category: '战斗构筑', target: 5, reward: 160, eventKinds: ['BATTLE_FINISHED'], progress: battleMode('LADDER') },
  { id: 'three-win-run', title: '三连推进', description: '单局达到 3 胜。', category: '战斗构筑', target: 1, reward: 100, eventKinds: ['BATTLE_FINISHED'], progress: highRun(3) },
  { id: 'six-win-run', title: '六胜成型', description: '单局达到 6 胜。', category: '战斗构筑', target: 1, reward: 150, eventKinds: ['BATTLE_FINISHED'], progress: highRun(6) },
  { id: 'twelve-win-run', title: '十二胜传说', description: '单局达到 12 胜。', category: '战斗构筑', target: 1, reward: 320, eventKinds: ['BATTLE_FINISHED'], progress: highRun(12) },
  { id: 'wide-board', title: '背包满载', description: '战斗结束时拥有 10 件以上装备。', category: '战斗构筑', target: 1, reward: 120, eventKinds: ['BATTLE_FINISHED'], progress: (event) => event.kind === 'BATTLE_FINISHED' && (event.itemCount ?? 0) >= 10 ? 1 : 0 },
  { id: 'relic-builder', title: '遗物收藏家', description: '战斗结束时拥有 3 个以上遗物。', category: '战斗构筑', target: 1, reward: 160, eventKinds: ['BATTLE_FINISHED'], progress: (event) => event.kind === 'BATTLE_FINISHED' && (event.relicCount ?? 0) >= 3 ? 1 : 0 },
  { id: 'dogfight-winner', title: '乱斗胜爪', description: '赢得 3 轮多人狗斗。', category: '战斗构筑', target: 3, reward: 160, eventKinds: ['DOGFIGHT_ROUND_FINISHED'], progress: (event) => event.kind === 'DOGFIGHT_ROUND_FINISHED' && event.winner ? 1 : 0 },
  { id: 'first-cosmetic', title: '第一件装扮', description: '购买 1 件商城外观。', category: '收藏商城', target: 1, reward: 90, eventKinds: ['COSMETIC_PURCHASED'], progress: eventCount('COSMETIC_PURCHASED') },
  { id: 'first-equip', title: '换上新装', description: '装备 1 件外观。', category: '收藏商城', target: 1, reward: 90, eventKinds: ['COSMETIC_EQUIPPED'], progress: eventCount('COSMETIC_EQUIPPED') },
  { id: 'title-collector', title: '称号收藏', description: '购买 3 个称号。', category: '收藏商城', target: 3, reward: 160, eventKinds: ['COSMETIC_PURCHASED'], progress: (event) => event.kind === 'COSMETIC_PURCHASED' && event.cosmeticType === 'TITLE' ? 1 : 0 },
  { id: 'skin-collector', title: '皮肤收藏', description: '购买 2 个狗狗皮肤。', category: '收藏商城', target: 2, reward: 220, eventKinds: ['COSMETIC_PURCHASED'], progress: (event) => event.kind === 'COSMETIC_PURCHASED' && event.cosmeticType === 'DOG_SKIN' ? 1 : 0 },
]

export const DAILY_TASK_DEFS: DailyTaskDef[] = [
  { id: 'daily-play-1', slot: 'PARTICIPATION', title: '今日开局', description: '开始 1 局游戏。', target: 1, reward: 45, progress: eventCount('RUN_CREATED') },
  { id: 'daily-fight-3', slot: 'PARTICIPATION', title: '热身三战', description: '完成 3 场战斗。', target: 3, reward: 60, progress: eventCount('BATTLE_FINISHED') },
  { id: 'daily-dogfight-1', slot: 'PARTICIPATION', title: '乱斗露脸', description: '完成 1 轮多人狗斗。', target: 1, reward: 55, progress: eventCount('DOGFIGHT_ROUND_FINISHED') },
  { id: 'daily-buy-1', slot: 'BUILD', title: '逛逛商店', description: '局内购买 1 件商品。', target: 1, reward: 50, progress: eventCount('SHOP_PURCHASED') },
  { id: 'daily-win-2', slot: 'BATTLE', title: '今日两胜', description: '赢得 2 场战斗。', target: 2, reward: 70, progress: battleWin },
  { id: 'daily-ladder-1', slot: 'BATTLE', title: '天梯试爪', description: '完成 1 场天梯战斗。', target: 1, reward: 65, progress: battleMode('LADDER') },
]

export const SHOP_CATALOG: ShopCatalogItem[] = [
  { id: 'title-park-rookie', name: '公园新星', description: '昵称旁显示的新手称号。', type: 'TITLE', rarity: 'COMMON', price: 80, section: 'PERMANENT', assetKey: 'title.park-rookie', purchaseType: 'SOFT_CURRENCY', source: 'CODE' },
  { id: 'title-dice-master', name: '骰子训练师', description: '给稳定构筑玩家的称号。', type: 'TITLE', rarity: 'RARE', price: 180, section: 'FEATURED', assetKey: 'title.dice-master', purchaseType: 'SOFT_CURRENCY', source: 'CODE' },
  { id: 'title-dog-king-shadow', name: '犬王之影', description: '传说称号。', type: 'TITLE', rarity: 'LEGENDARY', price: 680, section: 'FEATURED', assetKey: 'title.dog-king-shadow', sku: 'future.title.dog_king_shadow', purchaseType: 'PAID_READY', source: 'CODE' },
  { id: 'avatar-bone', name: '骨头头像', description: '经典骨头头像。', type: 'AVATAR', rarity: 'COMMON', price: 90, section: 'PERMANENT', assetKey: 'avatar.bone', purchaseType: 'SOFT_CURRENCY', source: 'CODE' },
  { id: 'avatar-crown', name: '皇冠头像', description: '金色皇冠头像。', type: 'AVATAR', rarity: 'EPIC', price: 360, section: 'FEATURED', assetKey: 'avatar.crown', purchaseType: 'SOFT_CURRENCY', source: 'CODE' },
  { id: 'bg-dog-park-night', name: '夜晚狗公园', description: '大厅背景。', type: 'BACKGROUND', rarity: 'RARE', price: 220, section: 'PERMANENT', assetKey: 'background.dog-park-night', purchaseType: 'SOFT_CURRENCY', source: 'CODE' },
  { id: 'bg-royal-kennel', name: '皇家犬舍', description: '大厅背景。', type: 'BACKGROUND', rarity: 'EPIC', price: 420, section: 'FEATURED', assetKey: 'background.royal-kennel', purchaseType: 'SOFT_CURRENCY', source: 'CODE' },
  { id: 'skin-shiba-scarf', name: '柴犬围巾', description: '柴犬选择和战斗展示皮肤。', type: 'DOG_SKIN', rarity: 'RARE', price: 260, section: 'PERMANENT', assetKey: 'dogSkin.shiba-scarf', purchaseType: 'SOFT_CURRENCY', source: 'CODE' },
  { id: 'skin-samoyed-snow', name: '雪原萨摩耶', description: '萨摩耶选择和战斗展示皮肤。', type: 'DOG_SKIN', rarity: 'EPIC', price: 460, section: 'FEATURED', assetKey: 'dogSkin.samoyed-snow', purchaseType: 'SOFT_CURRENCY', source: 'CODE' },
  { id: 'fx-gold-dice', name: '金色骰光', description: '战斗投掷特效。', type: 'BATTLE_EFFECT', rarity: 'RARE', price: 240, section: 'PERMANENT', assetKey: 'battleFx.gold-dice', purchaseType: 'SOFT_CURRENCY', source: 'CODE' },
  { id: 'fx-aurora-roll', name: '极光投掷', description: '战斗投掷特效。', type: 'BATTLE_EFFECT', rarity: 'LEGENDARY', price: 720, section: 'FEATURED', assetKey: 'battleFx.aurora-roll', sku: 'future.fx.aurora_roll', purchaseType: 'PAID_READY', source: 'CODE' },
]

export const nowIso = (now = new Date()) => now.toISOString()
const clampProgress = (value: number, target: number) => Math.min(target, Math.max(0, Math.floor(value)))

export function progressAchievements(progress: AchievementProgress[], event: AccountEvent, now = nowIso()): AchievementProgress[] {
  const byId = new Map(progress.map((entry) => [entry.achievementId, entry]))
  for (const def of ACHIEVEMENTS) {
    if (!def.eventKinds.includes(event.kind)) continue
    const increment = def.progress(event)
    if (increment <= 0) continue
    const current = byId.get(def.id) ?? { achievementId: def.id, progress: 0, completedAt: null, claimedAt: null }
    if (current.completedAt) continue
    const nextProgress = clampProgress(current.progress + increment, def.target)
    byId.set(def.id, { ...current, progress: nextProgress, completedAt: nextProgress >= def.target ? now : null })
  }
  return [...byId.values()]
}

export function claimAchievementReward(wallet: CurrencyWallet, progress: AchievementProgress[], achievementId: string, now = nowIso()) {
  const def = ACHIEVEMENTS.find((entry) => entry.id === achievementId)
  if (!def) throw new Error('Achievement not found')
  const entry = progress.find((item) => item.achievementId === achievementId)
  if (!entry?.completedAt) throw new Error('Achievement not completed')
  if (entry.claimedAt) throw new Error('Achievement already claimed')
  return { wallet: { ...wallet, balance: wallet.balance + def.reward }, progress: progress.map((item) => item.achievementId === achievementId ? { ...item, claimedAt: now } : item), amount: def.reward }
}

function seededIndex(seed: string, length: number, salt: string) {
  return createHash('sha256').update(`${seed}:${salt}`).digest().readUInt32BE(0) % length
}

function dailyTasksFromSeed(dateKey: string, userId: string, salt = 'initial'): DailyTaskProgress[] {
  const seed = `${dateKey}:${userId}:${salt}`
  return (['PARTICIPATION', 'BUILD', 'BATTLE'] as const).map((slot) => {
    const pool = DAILY_TASK_DEFS.filter((task) => task.slot === slot)
    const task = pool[seededIndex(seed, pool.length, slot)]
    return { taskId: task.id, slot, progress: 0, target: task.target, reward: task.reward, claimedAt: null }
  })
}

export const createInitialDailyTasks = (userId: string, dateKey: string): DailyTaskState => ({ dateKey, refreshUsed: false, tasks: dailyTasksFromSeed(dateKey, userId) })

export function refreshDailyTasks(state: DailyTaskState, userId: string): DailyTaskState {
  if (state.refreshUsed) throw new Error('Daily refresh already used')
  const refreshed = dailyTasksFromSeed(state.dateKey, userId, 'refresh')
  return { ...state, refreshUsed: true, tasks: state.tasks.map((task, index) => task.claimedAt || task.progress >= task.target ? task : refreshed[index]) }
}

export function progressDailyTasks(state: DailyTaskState, event: AccountEvent): DailyTaskState {
  return { ...state, tasks: state.tasks.map((task) => {
    if (task.claimedAt || task.progress >= task.target) return task
    const def = DAILY_TASK_DEFS.find((entry) => entry.id === task.taskId)
    return def ? { ...task, progress: clampProgress(task.progress + def.progress(event), task.target) } : task
  }) }
}

export function claimDailyTaskReward(wallet: CurrencyWallet, state: DailyTaskState, taskId: string, now = nowIso()) {
  const task = state.tasks.find((entry) => entry.taskId === taskId)
  if (!task) throw new Error('Daily task not found')
  if (task.claimedAt) throw new Error('Daily task already claimed')
  if (task.progress < task.target) throw new Error('Daily task not completed')
  return { wallet: { ...wallet, balance: wallet.balance + task.reward }, state: { ...state, tasks: state.tasks.map((entry) => entry.taskId === taskId ? { ...entry, claimedAt: now } : entry) }, amount: task.reward }
}

export function grantMatchCurrency(wallet: CurrencyWallet, result: { mode: 'CASUAL' | 'LADDER' | 'DOGFIGHT' | string; winner: boolean }) {
  const modeBonus = result.mode === 'LADDER' ? 4 : result.mode === 'DOGFIGHT' ? 3 : 0
  const amount = result.winner ? 18 + modeBonus : 10 + Math.floor(modeBonus / 2)
  const grant = Math.min(amount, Math.max(0, DAILY_CURRENCY_LIMIT - wallet.dailyEarned))
  return { wallet: { balance: wallet.balance + grant, dailyEarned: wallet.dailyEarned + grant }, amount: grant }
}

export function purchaseCatalogItem(wallet: CurrencyWallet, inventory: CosmeticInventoryEntry[], catalogItemId: string, now = nowIso()) {
  const item = SHOP_CATALOG.find((entry) => entry.id === catalogItemId)
  if (!item) throw new Error('Catalog item not found')
  if (inventory.some((entry) => entry.catalogItemId === catalogItemId)) throw new Error('Catalog item already owned')
  if (wallet.balance < item.price) throw new Error('Insufficient currency')
  return { wallet: { ...wallet, balance: wallet.balance - item.price }, inventory: [...inventory, { catalogItemId, acquiredAt: now }], item }
}

export function equipCosmetic(inventory: CosmeticInventoryEntry[], equipped: EquippedCosmetic[], catalogItemId: string) {
  const item = SHOP_CATALOG.find((entry) => entry.id === catalogItemId)
  if (!item) throw new Error('Catalog item not found')
  if (!inventory.some((entry) => entry.catalogItemId === catalogItemId)) throw new Error('Catalog item not owned')
  return [...equipped.filter((entry) => entry.slot !== item.type), { slot: item.type, catalogItemId }]
}
