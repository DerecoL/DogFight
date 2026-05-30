import { Prisma } from '@prisma/client'
import { prisma } from './db'
import {
  ACHIEVEMENTS,
  SHOP_CATALOG,
  claimAchievementReward,
  claimDailyTaskReward,
  createInitialDailyTasks,
  equipCosmetic,
  grantMatchCurrency,
  progressAchievements,
  progressDailyTasks,
  purchaseCatalogItem,
  refreshDailyTasks,
  type AccountEvent,
  type AchievementProgress,
  type CosmeticInventoryEntry,
  type DailyTaskProgress,
  type DailyTaskState,
  type EquippedCosmetic,
  type ShopCatalogItem,
} from './account-systems'

type Tx = Prisma.TransactionClient
type Db = Tx | typeof prisma

export function shanghaiDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function toProgress(entry: { achievementId: string; progress: number; completedAt: Date | null; claimedAt: Date | null }): AchievementProgress {
  return {
    achievementId: entry.achievementId,
    progress: entry.progress,
    completedAt: entry.completedAt?.toISOString() ?? null,
    claimedAt: entry.claimedAt?.toISOString() ?? null,
  }
}

function progressDates(entry: AchievementProgress) {
  return {
    completedAt: entry.completedAt ? new Date(entry.completedAt) : null,
    claimedAt: entry.claimedAt ? new Date(entry.claimedAt) : null,
  }
}

function publicProgress(progress: AchievementProgress[]) {
  const byId = new Map(progress.map((entry) => [entry.achievementId, entry]))
  return ACHIEVEMENTS.map((def) => {
    const entry = byId.get(def.id) ?? { achievementId: def.id, progress: 0, completedAt: null, claimedAt: null }
    const lockedHidden = Boolean(def.hidden && !entry.completedAt)
    return {
      id: def.id,
      title: lockedHidden ? '???' : def.title,
      description: lockedHidden ? '隐藏成就，完成后揭晓。' : def.description,
      category: def.category,
      hidden: Boolean(def.hidden),
      target: def.target,
      reward: def.reward,
      progress: entry.progress,
      completedAt: entry.completedAt,
      claimedAt: entry.claimedAt,
      claimable: Boolean(entry.completedAt && !entry.claimedAt),
    }
  })
}

function publicWallet(wallet: { balance: number; dailyDate: string | null; dailyEarned: number }, dateKey: string) {
  return {
    balance: wallet.balance,
    dailyDate: wallet.dailyDate ?? dateKey,
    dailyEarned: wallet.dailyDate === dateKey ? wallet.dailyEarned : 0,
    dailyLimit: 240,
  }
}

async function ensureWallet(db: Db, userId: string, dateKey = shanghaiDateKey()) {
  const wallet = await db.accountWallet.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0, dailyDate: dateKey, dailyEarned: 0 },
  })
  if (wallet.dailyDate === dateKey) return wallet
  return db.accountWallet.update({
    where: { userId },
    data: { dailyDate: dateKey, dailyEarned: 0 },
  })
}

async function loadAchievementProgress(db: Db, userId: string) {
  const rows = await db.achievementProgress.findMany({ where: { userId } })
  return rows.map(toProgress)
}

async function saveAchievementProgress(db: Db, userId: string, progress: AchievementProgress[]) {
  await Promise.all(progress.map((entry) =>
    db.achievementProgress.upsert({
      where: { userId_achievementId: { userId, achievementId: entry.achievementId } },
      update: { progress: entry.progress, ...progressDates(entry) },
      create: { userId, achievementId: entry.achievementId, progress: entry.progress, ...progressDates(entry) },
    })
  ))
}

async function ensureDailyTaskState(db: Db, userId: string, dateKey = shanghaiDateKey()): Promise<DailyTaskState> {
  const created = createInitialDailyTasks(userId, dateKey)
  const row = await db.dailyTaskSet.upsert({
    where: { userId_dateKey: { userId, dateKey } },
    update: {},
    create: { userId, dateKey, refreshUsed: created.refreshUsed, tasks: JSON.stringify(created.tasks) },
  })
  return {
    dateKey: row.dateKey,
    refreshUsed: row.refreshUsed,
    tasks: parseJson<DailyTaskProgress[]>(row.tasks, created.tasks),
  }
}

async function saveDailyTaskState(db: Db, userId: string, state: DailyTaskState) {
  await db.dailyTaskSet.upsert({
    where: { userId_dateKey: { userId, dateKey: state.dateKey } },
    update: { refreshUsed: state.refreshUsed, tasks: JSON.stringify(state.tasks) },
    create: { userId, dateKey: state.dateKey, refreshUsed: state.refreshUsed, tasks: JSON.stringify(state.tasks) },
  })
}

async function loadInventory(db: Db, userId: string): Promise<CosmeticInventoryEntry[]> {
  const rows = await db.cosmeticInventory.findMany({ where: { userId }, orderBy: { acquiredAt: 'asc' } })
  return rows.map((entry) => ({ catalogItemId: entry.catalogItemId, acquiredAt: entry.acquiredAt.toISOString() }))
}

async function loadEquipped(db: Db, userId: string): Promise<EquippedCosmetic[]> {
  const rows = await db.cosmeticEquip.findMany({ where: { userId } })
  return rows.map((entry) => ({ slot: entry.slot as EquippedCosmetic['slot'], catalogItemId: entry.catalogItemId }))
}

async function catalogWithOverrides(db: Db): Promise<ShopCatalogItem[]> {
  const overrides = await db.shopCatalogOverride.findMany()
  const byId = new Map(overrides.map((entry) => [entry.catalogItemId, entry]))
  return SHOP_CATALOG
    .map((item) => {
      const override = byId.get(item.id)
      if (!override) return item
      return {
        ...item,
        price: override.price ?? item.price,
        section: (override.section ?? item.section) as ShopCatalogItem['section'],
        purchaseType: (override.purchaseType ?? item.purchaseType) as ShopCatalogItem['purchaseType'],
        sku: override.sku ?? item.sku,
        source: 'DB_OVERRIDE' as const,
        disabled: !override.enabled,
      }
    })
    .filter((item) => !(item as ShopCatalogItem & { disabled?: boolean }).disabled)
}

export async function accountSummary(userId: string) {
  const dateKey = shanghaiDateKey()
  const wallet = await ensureWallet(prisma, userId, dateKey)
  const progress = await loadAchievementProgress(prisma, userId)
  const daily = await ensureDailyTaskState(prisma, userId, dateKey)
  return {
    wallet: publicWallet(wallet, dateKey),
    achievementClaimable: progress.some((entry) => entry.completedAt && !entry.claimedAt),
    dailyClaimable: daily.tasks.some((task) => task.progress >= task.target && !task.claimedAt),
  }
}

export async function getAchievements(userId: string) {
  const dateKey = shanghaiDateKey()
  const [wallet, progress] = await Promise.all([
    ensureWallet(prisma, userId, dateKey),
    loadAchievementProgress(prisma, userId),
  ])
  return { wallet: publicWallet(wallet, dateKey), achievements: publicProgress(progress) }
}

export async function claimAchievement(userId: string, achievementId: string) {
  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, userId)
    const progress = await loadAchievementProgress(tx, userId)
    const result = claimAchievementReward({ balance: wallet.balance, dailyEarned: wallet.dailyEarned }, progress, achievementId)
    await tx.accountWallet.update({ where: { userId }, data: { balance: result.wallet.balance } })
    await saveAchievementProgress(tx, userId, result.progress)
    await tx.currencyLedger.create({ data: { userId, amount: result.amount, reason: 'ACHIEVEMENT_CLAIM', source: achievementId } })
    return { amount: result.amount, wallet: publicWallet({ ...wallet, balance: result.wallet.balance }, shanghaiDateKey()), achievements: publicProgress(result.progress) }
  })
}

export async function getDailyTasks(userId: string) {
  const dateKey = shanghaiDateKey()
  const [wallet, state] = await Promise.all([
    ensureWallet(prisma, userId, dateKey),
    ensureDailyTaskState(prisma, userId, dateKey),
  ])
  return { wallet: publicWallet(wallet, dateKey), daily: state }
}

export async function refreshDaily(userId: string) {
  return prisma.$transaction(async (tx) => {
    const state = await ensureDailyTaskState(tx, userId)
    const refreshed = refreshDailyTasks(state, userId)
    await saveDailyTaskState(tx, userId, refreshed)
    return { daily: refreshed }
  })
}

export async function claimDaily(userId: string, taskId: string) {
  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, userId)
    const state = await ensureDailyTaskState(tx, userId, wallet.dailyDate ?? shanghaiDateKey())
    const result = claimDailyTaskReward({ balance: wallet.balance, dailyEarned: wallet.dailyEarned }, state, taskId)
    await tx.accountWallet.update({ where: { userId }, data: { balance: result.wallet.balance } })
    await saveDailyTaskState(tx, userId, result.state)
    await tx.currencyLedger.create({ data: { userId, amount: result.amount, reason: 'DAILY_TASK_CLAIM', source: taskId, dailyDate: state.dateKey } })
    return { amount: result.amount, wallet: publicWallet({ ...wallet, balance: result.wallet.balance }, state.dateKey), daily: result.state }
  })
}

export async function getShop(userId: string) {
  const dateKey = shanghaiDateKey()
  const [wallet, catalog, inventory, equipped] = await Promise.all([
    ensureWallet(prisma, userId, dateKey),
    catalogWithOverrides(prisma),
    loadInventory(prisma, userId),
    loadEquipped(prisma, userId),
  ])
  const owned = new Set(inventory.map((entry) => entry.catalogItemId))
  const equippedIds = new Set(equipped.map((entry) => entry.catalogItemId))
  const decorate = (item: ShopCatalogItem) => ({ ...item, owned: owned.has(item.id), equipped: equippedIds.has(item.id) })
  return {
    wallet: publicWallet(wallet, dateKey),
    permanent: catalog.filter((item) => item.section === 'PERMANENT').map(decorate),
    featured: catalog.filter((item) => item.section === 'FEATURED').map(decorate),
  }
}

export async function purchaseShopItem(userId: string, catalogItemId: string) {
  await prisma.$transaction(async (tx) => {
    const dateKey = shanghaiDateKey()
    const wallet = await ensureWallet(tx, userId, dateKey)
    const inventory = await loadInventory(tx, userId)
    const result = purchaseCatalogItem({ balance: wallet.balance, dailyEarned: wallet.dailyEarned }, inventory, catalogItemId)
    const debit = await tx.accountWallet.updateMany({
      where: { userId, balance: { gte: result.item.price } },
      data: { balance: { decrement: result.item.price } },
    })
    if (debit.count !== 1) throw new Error('Insufficient currency')
    await tx.cosmeticInventory.create({ data: { userId, catalogItemId } })
    await tx.currencyLedger.create({ data: { userId, amount: -result.item.price, reason: 'SHOP_PURCHASE', source: catalogItemId } })
    await recordAccountEvent(userId, { kind: 'COSMETIC_PURCHASED', catalogItemId, cosmeticType: result.item.type }, tx)
  })
  return getShop(userId)
}

export async function getCosmetics(userId: string) {
  const [inventory, equipped] = await Promise.all([
    loadInventory(prisma, userId),
    loadEquipped(prisma, userId),
  ])
  return { inventory, equipped }
}

export async function equipUserCosmetic(userId: string, catalogItemId: string) {
  return prisma.$transaction(async (tx) => {
    const inventory = await loadInventory(tx, userId)
    const current = await loadEquipped(tx, userId)
    const next = equipCosmetic(inventory, current, catalogItemId)
    const equipped = next.find((entry) => entry.catalogItemId === catalogItemId)
    if (!equipped) throw new Error('Cosmetic could not be equipped')
    await tx.cosmeticEquip.upsert({
      where: { userId_slot: { userId, slot: equipped.slot } },
      update: { catalogItemId },
      create: { userId, slot: equipped.slot, catalogItemId },
    })
    await recordAccountEvent(userId, { kind: 'COSMETIC_EQUIPPED', catalogItemId, cosmeticType: equipped.slot }, tx)
    return { inventory, equipped: next }
  })
}

export async function recordAccountEvent(userId: string | null | undefined, event: AccountEvent, db: Db = prisma) {
  if (!userId) return
  const dateKey = shanghaiDateKey()
  const progress = await loadAchievementProgress(db, userId)
  const nextProgress = progressAchievements(progress, event)
  await saveAchievementProgress(db, userId, nextProgress)

  const daily = await ensureDailyTaskState(db, userId, dateKey)
  const nextDaily = progressDailyTasks(daily, event)
  await saveDailyTaskState(db, userId, nextDaily)

  if (event.kind === 'BATTLE_FINISHED' || event.kind === 'DOGFIGHT_ROUND_FINISHED') {
    const wallet = await ensureWallet(db, userId, dateKey)
    const result = grantMatchCurrency(
      { balance: wallet.balance, dailyEarned: wallet.dailyEarned },
      { mode: event.kind === 'DOGFIGHT_ROUND_FINISHED' ? 'DOGFIGHT' : event.mode ?? 'CASUAL', winner: event.winner },
    )
    if (result.amount > 0) {
      await db.accountWallet.update({
        where: { userId },
        data: { balance: result.wallet.balance, dailyEarned: result.wallet.dailyEarned, dailyDate: dateKey },
      })
      await db.currencyLedger.create({ data: { userId, amount: result.amount, reason: 'MATCH_REWARD', source: event.kind, dailyDate: dateKey } })
    }
  }
}
