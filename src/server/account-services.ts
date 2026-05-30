import { Prisma } from '@prisma/client'
import { prisma } from './db'
import {
  ACHIEVEMENTS,
  DAILY_TASK_DEFS,
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
  type DailyTaskProgress,
  type DailyTaskState,
  type EquippedCosmetic,
  type ShopCatalogItem,
} from './account-systems'
import { parseJson } from './state'

type Tx = Prisma.TransactionClient
type Db = typeof prisma | Tx

export function shanghaiDateKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

async function ensureWallet(db: Db, userId: string, dateKey = shanghaiDateKey()) {
  const wallet = await db.accountWallet.upsert({
    where: { userId },
    update: {},
    create: { userId, dailyKey: dateKey },
  })
  if (wallet.dailyKey === dateKey) return wallet
  return db.accountWallet.update({
    where: { userId },
    data: { dailyKey: dateKey, dailyEarned: 0 },
  })
}

async function writeLedger(db: Db, input: { userId: string; amount: number; balanceAfter: number; source: string; refId?: string; dailyKey?: string }) {
  if (input.amount === 0) return
  await db.currencyLedger.create({ data: input })
}

async function achievementProgress(db: Db, userId: string): Promise<AchievementProgress[]> {
  const rows = await db.achievementProgress.findMany({ where: { userId } })
  return rows.map((row) => ({
    achievementId: row.achievementId,
    progress: row.progress,
    completedAt: row.completedAt?.toISOString() ?? null,
    claimedAt: row.claimedAt?.toISOString() ?? null,
  }))
}

async function saveAchievementProgress(db: Db, userId: string, progress: AchievementProgress[]) {
  for (const entry of progress) {
    await db.achievementProgress.upsert({
      where: { userId_achievementId: { userId, achievementId: entry.achievementId } },
      update: {
        progress: entry.progress,
        completedAt: entry.completedAt ? new Date(entry.completedAt) : null,
        claimedAt: entry.claimedAt ? new Date(entry.claimedAt) : null,
      },
      create: {
        userId,
        achievementId: entry.achievementId,
        progress: entry.progress,
        completedAt: entry.completedAt ? new Date(entry.completedAt) : null,
        claimedAt: entry.claimedAt ? new Date(entry.claimedAt) : null,
      },
    })
  }
}

async function getOrCreateDailySet(db: Db, userId: string, dateKey = shanghaiDateKey()) {
  const existing = await db.dailyTaskSet.findUnique({ where: { userId_dateKey: { userId, dateKey } } })
  if (existing) return existing
  const state = createInitialDailyTasks(userId, dateKey)
  return db.dailyTaskSet.create({ data: { userId, dateKey, refreshUsed: state.refreshUsed, tasks: JSON.stringify(state.tasks) } })
}

function dailyStateFromRow(row: { dateKey: string; refreshUsed: boolean; tasks: string }): DailyTaskState {
  return { dateKey: row.dateKey, refreshUsed: row.refreshUsed, tasks: parseJson<DailyTaskProgress[]>(row.tasks, []) }
}

async function saveDailyState(db: Db, userId: string, state: DailyTaskState) {
  await db.dailyTaskSet.upsert({
    where: { userId_dateKey: { userId, dateKey: state.dateKey } },
    update: { refreshUsed: state.refreshUsed, tasks: JSON.stringify(state.tasks) },
    create: { userId, dateKey: state.dateKey, refreshUsed: state.refreshUsed, tasks: JSON.stringify(state.tasks) },
  })
}

async function catalogWithOverrides(db: Db): Promise<ShopCatalogItem[]> {
  const overrides = await db.shopCatalogOverride.findMany()
  const byId = new Map(overrides.map((override) => [override.catalogItemId, override]))
  return SHOP_CATALOG.flatMap((item) => {
    const override = byId.get(item.id)
    if (override?.listed === false) return []
    return [{
      ...item,
      price: override?.price ?? item.price,
      section: (override?.section as ShopCatalogItem['section'] | null) ?? item.section,
      sku: override?.sku ?? item.sku,
      purchaseType: (override?.purchaseType as ShopCatalogItem['purchaseType'] | null) ?? item.purchaseType,
      source: override ? 'DB_OVERRIDE' as const : item.source,
    }]
  })
}

function publicAchievement(entry: AchievementProgress | undefined, def: typeof ACHIEVEMENTS[number]) {
  const progress = entry?.progress ?? 0
  const completed = Boolean(entry?.completedAt)
  const claimed = Boolean(entry?.claimedAt)
  const hidden = Boolean(def.hidden && !completed)
  return {
    id: def.id,
    title: hidden ? '隐藏成就' : def.title,
    description: hidden ? '完成后显示详情。' : def.description,
    category: def.category,
    hidden,
    target: def.target,
    progress,
    reward: hidden ? 0 : def.reward,
    completed,
    claimable: completed && !claimed,
    claimed,
    completedAt: entry?.completedAt ?? null,
    claimedAt: entry?.claimedAt ?? null,
  }
}

export async function accountSummary(userId: string) {
  const [wallet, progress, daily] = await Promise.all([
    ensureWallet(prisma, userId),
    achievementProgress(prisma, userId),
    getOrCreateDailySet(prisma, userId),
  ])
  const dailyState = dailyStateFromRow(daily)
  return {
    wallet: { balance: wallet.balance, dailyEarned: wallet.dailyEarned, dailyKey: wallet.dailyKey },
    redDots: {
      achievements: progress.some((entry) => entry.completedAt && !entry.claimedAt),
      dailyTasks: dailyState.tasks.some((task) => task.progress >= task.target && !task.claimedAt),
    },
  }
}

export async function getAchievements(userId: string) {
  const [wallet, progress] = await Promise.all([ensureWallet(prisma, userId), achievementProgress(prisma, userId)])
  const byId = new Map(progress.map((entry) => [entry.achievementId, entry]))
  return {
    wallet: { balance: wallet.balance, dailyEarned: wallet.dailyEarned, dailyKey: wallet.dailyKey },
    achievements: ACHIEVEMENTS.map((def) => publicAchievement(byId.get(def.id), def)),
  }
}

export async function claimAchievement(userId: string, achievementId: string) {
  await prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, userId)
    const progress = await achievementProgress(tx, userId)
    const claimed = claimAchievementReward({ balance: wallet.balance, dailyEarned: wallet.dailyEarned }, progress, achievementId)
    const updated = await tx.accountWallet.update({ where: { userId }, data: { balance: claimed.wallet.balance } })
    await saveAchievementProgress(tx, userId, claimed.progress)
    await writeLedger(tx, { userId, amount: claimed.amount, balanceAfter: updated.balance, source: 'ACHIEVEMENT', refId: achievementId })
  })
  return getAchievements(userId)
}

export async function getDailyTasks(userId: string) {
  const [wallet, set] = await Promise.all([ensureWallet(prisma, userId), getOrCreateDailySet(prisma, userId)])
  const state = dailyStateFromRow(set)
  return {
    wallet: { balance: wallet.balance, dailyEarned: wallet.dailyEarned, dailyKey: wallet.dailyKey },
    dateKey: state.dateKey,
    refreshUsed: state.refreshUsed,
    tasks: state.tasks.map((task) => ({ ...task, def: DAILY_TASK_DEFS.find((entry) => entry.id === task.taskId) })),
  }
}

export async function refreshDaily(userId: string) {
  await prisma.$transaction(async (tx) => {
    const set = await getOrCreateDailySet(tx, userId)
    const next = refreshDailyTasks(dailyStateFromRow(set), userId)
    await saveDailyState(tx, userId, next)
  })
  return getDailyTasks(userId)
}

export async function claimDaily(userId: string, taskId: string) {
  await prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, userId)
    const set = await getOrCreateDailySet(tx, userId)
    const claimed = claimDailyTaskReward({ balance: wallet.balance, dailyEarned: wallet.dailyEarned }, dailyStateFromRow(set), taskId)
    const updated = await tx.accountWallet.update({ where: { userId }, data: { balance: claimed.wallet.balance } })
    await saveDailyState(tx, userId, claimed.state)
    await writeLedger(tx, { userId, amount: claimed.amount, balanceAfter: updated.balance, source: 'DAILY_TASK', refId: taskId, dailyKey: claimed.state.dateKey })
  })
  return getDailyTasks(userId)
}

export async function getShop(userId: string) {
  const [wallet, catalog, inventory, equipped] = await Promise.all([
    ensureWallet(prisma, userId),
    catalogWithOverrides(prisma),
    prisma.cosmeticInventory.findMany({ where: { userId } }),
    prisma.cosmeticEquip.findMany({ where: { userId } }),
  ])
  const owned = new Set(inventory.map((entry) => entry.catalogItemId))
  const equippedById = new Set(equipped.map((entry) => entry.catalogItemId))
  return {
    wallet: { balance: wallet.balance, dailyEarned: wallet.dailyEarned, dailyKey: wallet.dailyKey },
    sections: {
      permanent: catalog.filter((item) => item.section === 'PERMANENT').map((item) => ({ ...item, owned: owned.has(item.id), equipped: equippedById.has(item.id) })),
      featured: catalog.filter((item) => item.section === 'FEATURED').map((item) => ({ ...item, owned: owned.has(item.id), equipped: equippedById.has(item.id) })),
    },
  }
}

export async function purchaseShopItem(userId: string, catalogItemId: string) {
  await prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, userId)
    const inventory = await tx.cosmeticInventory.findMany({ where: { userId } })
    const purchased = purchaseCatalogItem({ balance: wallet.balance, dailyEarned: wallet.dailyEarned }, inventory.map((entry) => ({ catalogItemId: entry.catalogItemId, acquiredAt: entry.acquiredAt.toISOString() })), catalogItemId)
    const updated = await tx.accountWallet.update({ where: { userId }, data: { balance: purchased.wallet.balance } })
    await tx.cosmeticInventory.create({ data: { userId, catalogItemId } })
    await writeLedger(tx, { userId, amount: -purchased.item.price, balanceAfter: updated.balance, source: 'SHOP_PURCHASE', refId: catalogItemId })
    await recordAccountEvent(userId, { kind: 'COSMETIC_PURCHASED', catalogItemId, cosmeticType: purchased.item.type }, tx)
  })
  return getShop(userId)
}

export async function getCosmetics(userId: string) {
  const [inventory, equipped] = await Promise.all([
    prisma.cosmeticInventory.findMany({ where: { userId } }),
    prisma.cosmeticEquip.findMany({ where: { userId } }),
  ])
  return {
    inventory: inventory.map((entry) => ({ catalogItemId: entry.catalogItemId, acquiredAt: entry.acquiredAt.toISOString(), item: SHOP_CATALOG.find((item) => item.id === entry.catalogItemId) })),
    equipped: equipped.map((entry) => ({ slot: entry.slot, catalogItemId: entry.catalogItemId, item: SHOP_CATALOG.find((item) => item.id === entry.catalogItemId) })),
  }
}

export async function equipUserCosmetic(userId: string, catalogItemId: string) {
  await prisma.$transaction(async (tx) => {
    const inventory = await tx.cosmeticInventory.findMany({ where: { userId } })
    const equipped = await tx.cosmeticEquip.findMany({ where: { userId } })
    const next = equipCosmetic(
      inventory.map((entry) => ({ catalogItemId: entry.catalogItemId, acquiredAt: entry.acquiredAt.toISOString() })),
      equipped.map((entry) => ({ slot: entry.slot as EquippedCosmetic['slot'], catalogItemId: entry.catalogItemId })),
      catalogItemId,
    )
    const item = SHOP_CATALOG.find((entry) => entry.id === catalogItemId)!
    const target = next.find((entry) => entry.slot === item.type)!
    await tx.cosmeticEquip.upsert({
      where: { userId_slot: { userId, slot: target.slot } },
      update: { catalogItemId },
      create: { userId, slot: target.slot, catalogItemId },
    })
    await recordAccountEvent(userId, { kind: 'COSMETIC_EQUIPPED', catalogItemId, cosmeticType: item.type }, tx)
  })
  return getCosmetics(userId)
}

export async function recordAccountEvent(userId: string, event: AccountEvent, db: Db = prisma) {
  const now = new Date()
  const nowText = now.toISOString()
  const dateKey = shanghaiDateKey(now)
  const [wallet, currentProgress, dailySet] = await Promise.all([
    ensureWallet(db, userId, dateKey),
    achievementProgress(db, userId),
    getOrCreateDailySet(db, userId, dateKey),
  ])
  await saveAchievementProgress(db, userId, progressAchievements(currentProgress, event, nowText))
  await saveDailyState(db, userId, progressDailyTasks(dailyStateFromRow(dailySet), event))

  if (event.kind === 'BATTLE_FINISHED' || event.kind === 'DOGFIGHT_ROUND_FINISHED') {
    const mode = event.kind === 'DOGFIGHT_ROUND_FINISHED' ? 'DOGFIGHT' : event.mode ?? 'CASUAL'
    const winner = event.kind === 'DOGFIGHT_ROUND_FINISHED' ? event.winner : event.winner
    const granted = grantMatchCurrency({ balance: wallet.balance, dailyEarned: wallet.dailyEarned }, { mode, winner })
    if (granted.amount > 0) {
      const updated = await db.accountWallet.update({ where: { userId }, data: { balance: granted.wallet.balance, dailyEarned: granted.wallet.dailyEarned, dailyKey: dateKey } })
      await writeLedger(db, { userId, amount: granted.amount, balanceAfter: updated.balance, source: 'MATCH_SETTLEMENT', dailyKey: dateKey })
    }
  }
}
