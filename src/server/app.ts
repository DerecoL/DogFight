import bcrypt from 'bcryptjs'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import Fastify from 'fastify'
import { Prisma, type ApexEntry, type ItemInstance } from '@prisma/client'
import { z } from 'zod'
import { cookieOptionsForEnv, resolveServerConfig } from './config'
import { prisma } from './db'
import { registerDogfightRoutes } from './dogfight'
import { publicErrorMessage } from './errors'
import { exchangeTapTapCode } from './taptap-auth'
import { buildApexSeedEntries, dailyApexBoardKey, resolveApexChallenge, type ApexBoardType, type ApexChallengeReport, type ApexOpponent } from './game/apex'
import { itemDef, itemDefForQuality, relicDef, relicDefForQuality } from './game/data'
import { canPlace, findSlot, type PlacementOptions } from './game/grid'
import { applyMapNodeCompletion, availableMapNodeIds, createExplorationMapState, explorationMapFinished, mapMonsterBattleRound, mapNodeSelection, mapShopChoices, normalizeExplorationMapState, randomEquipmentReward, randomMonsterReward, type ExplorationMapNode, type ExplorationMapState } from './game/map'
import { buildOfflineFighter } from './game/offline-builder'
import { applyPotionToBaseDice } from './game/potion'
import { canUpgradePair, nextQuality, normalizeQuality, upgradeEnchant } from './game/quality'
import { canUseUpgradeShop, isUpgradeShopType, itemSellValue } from './game/shop'
import { simulateBattle } from './game/battle'
import { calculateLadderResult, ladderTierForScore, ladderTierLabels, ladderTiers, type LadderTier } from './game/ladder'
import { STARTING_GOLD, isTrainingMatchRound, selectCasualGhostSnapshot, selectLadderGhostSnapshot, targetLadderOpponentWinsRange, targetOpponentWins } from './game/matchmaking'
import type { BattleResult, DogType, EnchantmentChoice, FighterSnapshot, GameItem, PotionChoice, RelicInstance, ShopOffer, ShopType } from './game/types'
import { applyRelicChoice, createFinishedBattleRecord, initialItems, makeChoices, makePotionChoices, makeRelicChoices, makeShop, nextPhaseData, parseJson, playerBattleGoldIncome, postBattleLargeItemReward, postBattleSellBonusItemGrowths, publicLadderSettlement, publicRun, publicRunHistory, relicsFromRun, removeRelicByInstanceId, seedGhost, snapshotFromRun, toGameItems, upgradeChoiceSkipPhase } from './state'
import { accountSummary, claimAchievement, claimDaily, equipUserCosmetic, getAchievements, getCosmetics, getDailyTasks, getShop, purchaseShopItem, recordAccountEvent, refreshDaily, unequipUserCosmetic } from './account-services'
import { getActiveSeason, publicSeason, publicSeasonSummary } from './seasons'
import { RUN_LOSS_LIMIT } from '../shared/game-rules'

type PrismaTransaction = Prisma.TransactionClient
type ApexSourceRun = {
  id: string
  dogType: string
  luckyNumber: number | null
  round: number
  wins: number
  losses: number
  relics: string
  items: ItemInstance[]
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string
  }
}

export function buildApp() {
  const config = resolveServerConfig()
  const authCookieOptions = cookieOptionsForEnv(config.nodeEnv)
  const app = Fastify({ logger: false })
  app.register(cors, { origin: true, credentials: true })
  app.register(cookie)
  app.register(jwt, { secret: config.jwtSecret })

  app.setErrorHandler((error, _, reply) => {
    const err = error as Error & { statusCode?: number }
    const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500
    reply.code(statusCode).send({ error: publicErrorMessage(err) })
  })

  app.addHook('preHandler', async (request) => {
    const token = request.cookies.token
    if (!token) return
    try {
      const payload = request.server.jwt.verify<{ userId: string }>(token)
      request.userId = payload.userId
    } catch {
      request.userId = undefined
    }
  })

  const requireUser = (userId?: string) => {
    if (!userId) {
      const error = new Error('未登录') as Error & { statusCode: number }
      error.statusCode = 401
      throw error
    }
    return userId
  }

  const normalizeAccount = (value: string) => value.trim().toLowerCase()
  const accountSchema = z.string()
    .trim()
    .min(3, '账号至少需要 3 个字符')
    .max(64, '账号最多 64 个字符')
    .refine((value) => !/\s/.test(value), '账号不能包含空白字符')
  const authBodySchema = z.object({
    account: accountSchema.optional(),
    email: accountSchema.optional(),
    password: z.string().min(6),
  }).refine((body) => body.account || body.email, { message: '账号不能为空' })

  const authAccountFrom = (body: z.infer<typeof authBodySchema>) => normalizeAccount(body.account ?? body.email ?? '')
  const isUniqueAccountError = (error: unknown) => {
    const message = error instanceof Error ? error.message : ''
    return (
      ((error instanceof Prisma.PrismaClientKnownRequestError || (typeof error === 'object' && error !== null && 'code' in error)) && (error as { code?: string }).code === 'P2002')
      || (message.includes('duplicate key value') && message.includes('User_account_key'))
    )
  }

  const publicUser = (user: { id: string; account: string; nickname: string | null }) => ({
    id: user.id,
    account: user.account,
    nickname: user.nickname,
  })

  const apexEntryToFighter = (entry: ApexEntry): FighterSnapshot => ({
    name: entry.name,
    dogType: entry.dogType as DogType,
    luckyNumber: entry.luckyNumber,
    wins: entry.wins,
    losses: entry.losses,
    round: entry.round,
    items: parseJson(entry.items, []),
    relics: parseJson(entry.relics, []),
  })

  const publicApexEntry = (entry: ApexEntry, currentUserId?: string) => ({
    id: entry.id,
    sourceRunId: entry.sourceRunId,
    boardType: entry.boardType as ApexBoardType,
    boardKey: entry.boardKey,
    name: entry.name,
    dogType: entry.dogType as DogType,
    luckyNumber: entry.luckyNumber,
    wins: entry.wins,
    losses: entry.losses,
    round: entry.round,
    rank: entry.rank,
    challengeWins: entry.challengeWins,
    isSeed: entry.isSeed,
    isMine: Boolean(currentUserId && entry.userId === currentUserId),
    createdAt: entry.createdAt,
    items: parseJson<GameItem[]>(entry.items, []).map((item) => ({ ...item, def: itemDefForQuality(item.defId, item.quality) })),
    relics: parseJson<RelicInstance[]>(entry.relics, []).map((relic) => ({ ...relic, def: relicDefForQuality(relic.relicId, relic.quality) })),
  })

  const sanitizeLadderTier = (tier: string): LadderTier => ladderTiers.includes(tier as LadderTier) ? tier as LadderTier : 'BRONZE'
  const normalizeLadderTier = (tier: string, score: number): LadderTier => {
    return ladderTierForScore(sanitizeLadderTier(tier), score)
  }

  const publicLadderProfile = (profile: {
    seasonId: string
    tier: string
    score: number
    highestTier: string
    gamesPlayed: number
    totalWins: number
    totalLosses: number
    updatedAt: Date
  }) => {
    const tier = normalizeLadderTier(profile.tier, profile.score)
    const highestTier = sanitizeLadderTier(profile.highestTier)
    return {
      seasonId: profile.seasonId,
      tier,
      tierLabel: ladderTierLabels[tier],
      score: profile.score,
      highestTier,
      highestTierLabel: ladderTierLabels[highestTier],
      gamesPlayed: profile.gamesPlayed,
      totalWins: profile.totalWins,
      totalLosses: profile.totalLosses,
      updatedAt: profile.updatedAt.toISOString(),
    }
  }

  const ensureLadderProfile = async (userId: string, seasonId: string) => prisma.ladderProfile.upsert({
    where: { userId_seasonId: { userId, seasonId } },
    update: {},
    create: { userId, seasonId },
  })

  const createLadderSettlement = async (tx: PrismaTransaction, userId: string, runId: string, wins: number, losses: number, seasonId: string) => {
    const profile = await tx.ladderProfile.upsert({
      where: { userId_seasonId: { userId, seasonId } },
      update: {},
      create: { userId, seasonId },
    })
    const calculation = calculateLadderResult({
      tier: normalizeLadderTier(profile.tier, profile.score),
      score: profile.score,
      gamesPlayed: profile.gamesPlayed,
    }, { wins, losses })
    const highestTier = ladderTiers.indexOf(calculation.after.tier) > ladderTiers.indexOf(sanitizeLadderTier(profile.highestTier))
      ? calculation.after.tier
      : sanitizeLadderTier(profile.highestTier)

    await tx.ladderProfile.update({
      where: { id: profile.id },
      data: {
        tier: calculation.after.tier,
        score: calculation.after.score,
        highestTier,
        gamesPlayed: { increment: 1 },
        totalWins: { increment: wins },
        totalLosses: { increment: losses },
      },
    })

    return tx.ladderSettlement.create({
      data: {
        userId,
        profileId: profile.id,
        runId,
        seasonId,
        beforeTier: calculation.before.tier,
        beforeScore: calculation.before.score,
        afterTier: calculation.after.tier,
        afterScore: calculation.after.score,
        delta: calculation.delta,
        rawDelta: calculation.rawDelta,
        baseScore: calculation.breakdown.baseScore,
        tierTax: calculation.breakdown.tierTax,
        lossPenalty: calculation.breakdown.lossPenalty,
        perfectBonus: calculation.breakdown.perfectBonus,
        newbieProtection: calculation.breakdown.newbieProtection,
        wins,
        losses,
      },
    })
  }

  const settleLadderRun = async (userId: string, runId: string, wins: number, losses: number, seasonId: string) => prisma.$transaction(async (tx) => createLadderSettlement(tx, userId, runId, wins, losses, seasonId))

  const placementOptionsForRun = (run: { relics: string }): PlacementOptions => {
    const hasExtraEquipment = relicsFromRun(run).some((relic) => relicDef(relic.relicId).effect === 'EXTRA_EQUIPMENT_REDUCED_EFFECT')
    return hasExtraEquipment ? { equipmentWidth: 13 } : {}
  }

  const isReadyDogfightRunLocked = async (runId: string) => {
    const participant = await prisma.dogfightParticipant.findUnique({ where: { runId }, include: { room: true } })
    return Boolean(participant?.ready && participant.room.status === 'ACTIVE' && participant.room.phase === 'SHOP')
  }

  const overlappingItems = (items: GameItem[], moving: GameItem, area: GameItem['area'], x: number, y: number) => {
    const movingDef = itemDef(moving.defId)
    return items
      .filter((item) => {
        if (item.id === moving.id || item.area !== area || item.y !== y) return false
        const otherDef = itemDef(item.defId)
        return x < item.x + otherDef.width && item.x < x + movingDef.width
      })
      .sort((a, b) => (a.x - b.x) || (a.y - b.y))
  }

  const replacementBagMoves = (items: GameItem[], moving: GameItem, covered: GameItem[]) => {
    const coveredIds = new Set(covered.map((item) => item.id))
    const staged = items.filter((item) => item.id !== moving.id && !coveredIds.has(item.id))
    const moves: { id: string; x: number; y: number }[] = []
    for (const item of covered) {
      const slot = findSlot(staged, item.defId, 'BAG')
      if (!slot) return null
      moves.push({ id: item.id, x: slot.x, y: slot.y })
      staged.push({ ...item, area: 'BAG', x: slot.x, y: slot.y })
    }
    return moves
  }

  const parseRunMapState = (run: { mapState?: string | null }): ExplorationMapState | null => normalizeExplorationMapState(parseJson(run.mapState ?? '{}', null))

  const completeMapNodeState = (run: { id: string; wins: number; losses: number; mapState?: string | null }) => {
    const map = parseRunMapState(run)
    if (!map?.currentNodeId) return null
    const completed = applyMapNodeCompletion(map)
    return explorationMapFinished(completed)
      ? createExplorationMapState(run.id, completed.mapIndex + 1, run.wins, run.losses)
      : completed
  }

  const mapCompletionUpdateData = (run: { id: string; wins: number; losses: number; mapState?: string | null }) => {
    const nextMap = completeMapNodeState(run)
    return nextMap ? { phase: 'MAP', mapState: JSON.stringify(nextMap), matchedGhost: null } : { phase: 'MAP', matchedGhost: null }
  }

  const postPlayerBattlePhaseData = (run: { id: string; dogType: string; wins: number; losses: number; enchantThirdLossGranted: boolean; mapState?: string | null }, nextRound: number, currentItems: GameItem[]) => {
    const map = parseRunMapState(run)
    if (!map?.currentNodeId) {
      return nextPhaseData({ id: run.id, dogType: run.dogType as DogType, losses: run.losses, enchantThirdLossGranted: run.enchantThirdLossGranted, items: currentItems }, nextRound, `${run.id}-finish-${nextRound}-${run.wins}-${run.losses}`)
    }
    const rewardPhase = nextPhaseData({ id: run.id, dogType: run.dogType as DogType, losses: run.losses, enchantThirdLossGranted: run.enchantThirdLossGranted, items: currentItems }, nextRound, `${run.id}-finish-${nextRound}-${run.wins}-${run.losses}`)
    if (rewardPhase.phase === 'CLASS_REWARD' || rewardPhase.phase === 'ENCHANT_CHOICE') return rewardPhase
    return { ...mapCompletionUpdateData(run), choices: '[]', shopItems: '[]', classRewardChoices: '[]', enchantChoices: '[]' }
  }

  const createItemRewardData = (run: { relics: string; items: ItemInstance[] }, reward: { defId: string; quality?: string | null }) => {
    const items = toGameItems(run.items)
    const quality = normalizeQuality(reward.quality)
    const slot = findSlot(items, reward.defId, 'BAG', placementOptionsForRun(run))
    const upgradeTarget = !slot ? items.find((entry) =>
      entry.defId === reward.defId
      && normalizeQuality(entry.quality) === quality
      && nextQuality(entry.quality) !== null
    ) : null
    const upgradedQuality = upgradeTarget ? nextQuality(upgradeTarget.quality) : null
    if (upgradeTarget && upgradedQuality) {
      return { kind: 'upgrade' as const, itemId: upgradeTarget.id, quality: upgradedQuality }
    }
    if (!slot) return { kind: 'blocked' as const }
    return { kind: 'create' as const, item: { defId: reward.defId, quality, area: 'BAG' as const, x: slot.x, y: slot.y } }
  }

  const mapNodeShopPhaseData = (run: { id: string; round: number; items: ItemInstance[]; relics: string }, node: ExplorationMapNode) => {
    const choices = mapShopChoices(node, `${run.id}-${node.id}-${Date.now()}`, run.round)
    const shopType = choices[0] ?? 'GENERAL'
    if (node.kind === 'SHOP_UNKNOWN' || node.kind === 'SHOP_EQUIPMENT') {
      return { phase: 'CHOICE', choices: JSON.stringify(choices), shopItems: '[]', relicChoices: '[]', potionChoices: '[]' }
    }
    if (shopType === 'RELIC') {
      return { phase: 'RELIC_CHOICE', shopType: 'RELIC', choices: '[]', shopItems: '[]', relicChoices: JSON.stringify(makeRelicChoices(run, `${run.id}-${node.id}-relic`)), potionChoices: '[]' }
    }
    if (isUpgradeShopType(shopType)) {
      return { phase: 'UPGRADE_CHOICE', shopType, choices: '[]', shopItems: '[]', relicChoices: '[]', potionChoices: '[]' }
    }
    if (shopType === 'POTION') {
      return { phase: 'POTION_CHOICE', shopType: 'POTION', choices: '[]', shopItems: '[]', relicChoices: '[]', potionChoices: JSON.stringify(makePotionChoices(`${run.id}-${node.id}-potion`)) }
    }
    return { phase: 'SHOP', shopType, refreshCost: 1, choices: '[]', shopItems: JSON.stringify(makeShop(shopType, `${run.id}-${node.id}-${shopType}`, run.round)), relicChoices: '[]', potionChoices: '[]' }
  }

  const ensureApexSeeds = async (seasonId: string, boardType: ApexBoardType, boardKey: string) => {
    const count = await prisma.apexEntry.count({ where: { seasonId, boardType, boardKey } })
    if (count > 0) return

    await prisma.apexEntry.createMany({
      data: buildApexSeedEntries().map((entry) => ({
        seasonId,
        boardType,
        boardKey,
        name: entry.fighter.name,
        dogType: entry.fighter.dogType,
        luckyNumber: entry.fighter.luckyNumber,
        round: entry.fighter.round,
        wins: entry.fighter.wins,
        losses: entry.fighter.losses,
        items: JSON.stringify(entry.fighter.items),
        relics: JSON.stringify(entry.fighter.relics ?? []),
        rank: entry.rank,
        challengeWins: 1,
        isSeed: true,
      })),
    })
  }

  const apexLeaderboard = async (seasonId: string, boardType: ApexBoardType, boardKey: string) => {
    await ensureApexSeeds(seasonId, boardType, boardKey)
    return prisma.apexEntry.findMany({ where: { seasonId, boardType, boardKey }, orderBy: { rank: 'asc' } })
  }

  const apexBoardSeed = (seasonId: string, boardType: ApexBoardType, boardKey: string, runId: string) => `${seasonId}-${runId}-apex-${boardType.toLowerCase()}-${boardKey}`

  const incrementApexDefenderStreaks = async (
    tx: PrismaTransaction,
    seasonId: string,
    boardType: ApexBoardType,
    boardKey: string,
    report: ApexChallengeReport,
  ) => {
    const defenderIds = report.battles
      .filter((battle) => battle.winner === 'opponent')
      .map((battle) => battle.opponentId)
    if (defenderIds.length === 0) return

    await tx.apexEntry.updateMany({
      where: { id: { in: defenderIds }, seasonId, boardType, boardKey },
      data: { challengeWins: { increment: 1 } },
    })
  }

  const insertApexEntry = async (
    tx: PrismaTransaction,
    seasonId: string,
    boardType: ApexBoardType,
    boardKey: string,
    userId: string,
    run: ApexSourceRun,
    challengerName: string,
    report: ApexChallengeReport,
  ) => {
    const rankOffset = 1_000_000
    await tx.$executeRaw`UPDATE "ApexEntry" SET "rank" = "rank" + ${rankOffset} WHERE "seasonId" = ${seasonId} AND "boardType" = ${boardType} AND "boardKey" = ${boardKey} AND "rank" >= ${report.placementRank}`
    const created = await tx.apexEntry.create({
      data: {
        userId,
        sourceRunId: run.id,
        seasonId,
        boardType,
        boardKey,
        name: challengerName,
        dogType: run.dogType,
        luckyNumber: run.luckyNumber,
        round: run.round,
        wins: run.wins,
        losses: run.losses,
        items: JSON.stringify(toGameItems(run.items)),
        relics: JSON.stringify(relicsFromRun(run)),
        rank: report.placementRank,
        challengeWins: 1,
        isSeed: false,
      },
    })
    await tx.$executeRaw`UPDATE "ApexEntry" SET "rank" = "rank" - ${rankOffset - 1} WHERE "seasonId" = ${seasonId} AND "boardType" = ${boardType} AND "boardKey" = ${boardKey} AND "rank" >= ${report.placementRank + rankOffset}`
    return created
  }

  registerDogfightRoutes(app, requireUser)

  app.get('/api/health', async (_, reply) => {
    const timestamp = new Date().toISOString()
    try {
      await prisma.$queryRaw`SELECT 1`
      return { ok: true, database: 'ok', timestamp }
    } catch {
      return reply.code(503).send({ ok: false, database: 'unavailable', timestamp })
    }
  })

  app.post('/api/auth/register', async (request, reply) => {
    const body = authBodySchema.parse(request.body)
    const passwordHash = await bcrypt.hash(body.password, 10)
    const account = authAccountFrom(body)
    const user = await prisma.user.create({ data: { account, passwordHash } }).catch((error: unknown) => {
      if (isUniqueAccountError(error)) return null
      throw error
    })
    if (!user) return reply.code(409).send({ error: '账号已注册，请直接登录' })
    const token = app.jwt.sign({ userId: user.id })
    reply.setCookie('token', token, authCookieOptions)
    return { user: publicUser(user), needsNickname: true }
  })

  app.post('/api/auth/login', async (request, reply) => {
    const body = authBodySchema.parse(request.body)
    const account = authAccountFrom(body)
    const user = await prisma.user.findUnique({ where: { account } })
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) return reply.code(401).send({ error: '账号或密码错误' })
    const token = app.jwt.sign({ userId: user.id })
    reply.setCookie('token', token, authCookieOptions)
    return { user: publicUser(user) }
  })

  app.post('/api/auth/taptap', async (request, reply) => {
    if (!config.taptap) return reply.code(503).send({ error: 'TapTap 登录未配置' })

    const body = z.object({ code: z.string().trim().min(1) }).parse(request.body)
    const session = await exchangeTapTapCode(config.taptap, body.code).catch(() => null)
    if (!session) return reply.code(401).send({ error: 'TapTap 登录失败，请重试' })

    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.userIdentity.findUnique({
        where: { provider_providerUserId: { provider: 'taptap', providerUserId: session.openid } },
        include: { user: true },
      })
      if (existing) {
        await tx.userIdentity.update({
          where: { id: existing.id },
          data: { unionId: session.unionid ?? null, sessionKey: session.sessionKey },
        })
        return existing.user
      }

      const createdUser = await tx.user.create({
        data: {
          account: `taptap:${session.openid}`,
          passwordHash: 'external-provider:taptap',
        },
      })
      await tx.userIdentity.create({
        data: {
          userId: createdUser.id,
          provider: 'taptap',
          providerUserId: session.openid,
          unionId: session.unionid ?? null,
          sessionKey: session.sessionKey,
        },
      })
      return createdUser
    })

    const token = app.jwt.sign({ userId: user.id })
    reply.setCookie('token', token, authCookieOptions)
    return { user: publicUser(user), needsNickname: !user.nickname }
  })

  app.post('/api/auth/logout', async (_, reply) => {
    reply.clearCookie('token', authCookieOptions)
    return { ok: true }
  })

  app.post('/api/profile/nickname', async (request, reply) => {
    const userId = requireUser(request.userId)
    const parsed = z.object({ nickname: z.string() }).safeParse(request.body)
    const nickname = parsed.success ? parsed.data.nickname.trim() : ''
    if (nickname.length < 2 || nickname.length > 16) {
      return reply.code(400).send({ error: '昵称需为 2-16 个字符' })
    }
    const user = await prisma.user.update({ where: { id: userId }, data: { nickname } })
    return { user: publicUser(user) }
  })

  app.get('/api/me', async (request) => {
    const userId = requireUser(request.userId)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const activeRun = await prisma.run.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, include: { items: true, ladderSettlement: true } })
    return { user: publicUser(user), activeRun: activeRun ? publicRun(activeRun) : null, account: await accountSummary(userId) }
  })

  app.get('/api/achievements', async (request) => getAchievements(requireUser(request.userId)))

  app.post('/api/achievements/:achievementId/claim', async (request) => {
    const userId = requireUser(request.userId)
    const { achievementId } = z.object({ achievementId: z.string() }).parse(request.params)
    return claimAchievement(userId, achievementId)
  })

  app.get('/api/daily-tasks', async (request) => getDailyTasks(requireUser(request.userId)))

  app.post('/api/daily-tasks/refresh', async (request) => refreshDaily(requireUser(request.userId)))

  app.post('/api/daily-tasks/:taskId/claim', async (request) => {
    const userId = requireUser(request.userId)
    const { taskId } = z.object({ taskId: z.string() }).parse(request.params)
    return claimDaily(userId, taskId)
  })

  app.get('/api/shop', async (request) => getShop(requireUser(request.userId)))

  app.post('/api/shop/purchase', async (request) => {
    const userId = requireUser(request.userId)
    const { catalogItemId } = z.object({ catalogItemId: z.string() }).parse(request.body)
    return purchaseShopItem(userId, catalogItemId)
  })

  app.get('/api/cosmetics/me', async (request) => getCosmetics(requireUser(request.userId)))

  app.post('/api/cosmetics/equip', async (request) => {
    const userId = requireUser(request.userId)
    const body = z.union([
      z.object({ catalogItemId: z.string(), cosmeticType: z.enum(['TITLE', 'AVATAR', 'BACKGROUND', 'DOG_SKIN', 'BATTLE_EFFECT']).optional() }),
      z.object({ catalogItemId: z.null(), cosmeticType: z.enum(['TITLE', 'AVATAR', 'BACKGROUND', 'DOG_SKIN', 'BATTLE_EFFECT']) }),
    ]).parse(request.body)
    if (body.catalogItemId !== null) return equipUserCosmetic(userId, body.catalogItemId)
    return unequipUserCosmetic(userId, body.cosmeticType)
  })

  app.get('/api/ladder/me', async (request) => {
    const userId = requireUser(request.userId)
    const season = await getActiveSeason()
    const profile = await ensureLadderProfile(userId, season.id)
    const recentSettlements = await prisma.ladderSettlement.findMany({
      where: { userId, seasonId: season.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    return {
      season: publicSeason(season),
      profile: publicLadderProfile(profile),
      recentSettlements: recentSettlements.map(publicLadderSettlement),
    }
  })

  app.get('/api/ladder/leaderboard', async (request) => {
    const userId = requireUser(request.userId)
    const season = await getActiveSeason()
    const topDogKings = await prisma.ladderProfile.findMany({
      where: { seasonId: season.id, tier: 'DOG_KING' },
      orderBy: [{ score: 'desc' }, { updatedAt: 'asc' }],
      take: 50,
      include: { user: true },
    })
    const playerProfile = await ensureLadderProfile(userId, season.id)
    const betterPlayers = playerProfile.tier === 'DOG_KING'
      ? await prisma.ladderProfile.count({
        where: {
          seasonId: season.id,
          tier: 'DOG_KING',
          OR: [
            { score: { gt: playerProfile.score } },
            { score: playerProfile.score, updatedAt: { lt: playerProfile.updatedAt } },
          ],
        },
      })
      : null

    return {
      season: publicSeason(season),
      leaderboard: topDogKings.map((entry, index) => ({
        rank: index + 1,
        title: `犬王第 ${index + 1} 名`,
        name: entry.user.nickname ?? entry.user.account,
        profile: publicLadderProfile(entry),
      })),
      playerRank: betterPlayers == null ? null : betterPlayers + 1,
      playerProfile: publicLadderProfile(playerProfile),
    }
  })

  app.get('/api/runs/history', async (request) => {
    const userId = requireUser(request.userId)
    const [runs, seasonSummaries] = await Promise.all([
      prisma.run.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        mode: true,
        dogType: true,
        luckyNumber: true,
        wins: true,
        losses: true,
        round: true,
        status: true,
        phase: true,
        relics: true,
        createdAt: true,
        updatedAt: true,
        items: true,
      },
      }),
      prisma.seasonPlayerSummary.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    return { history: publicRunHistory(runs), seasonSummaries: seasonSummaries.map(publicSeasonSummary) }
  })

  app.post('/api/runs', async (request, reply) => {
    const userId = requireUser(request.userId)
    const parsed = z.object({
      dogType: z.enum(['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR', 'FROG']),
      luckyNumber: z.number().int().min(1).max(6).optional(),
      mode: z.enum(['CASUAL', 'LADDER']).optional(),
    }).safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: '无效狗狗选择' })
    const body = parsed.data
    const mode = body.mode ?? 'CASUAL'
    const season = await getActiveSeason()
    if (body.dogType === 'EMPEROR' && body.luckyNumber == null) {
      return reply.code(400).send({ error: '狗皇帝需要选择 1-6 的幸运数字' })
    }
    if (mode === 'LADDER') await ensureLadderProfile(userId, season.id)
    await prisma.run.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'ABANDONED' } })
    const mapState = createExplorationMapState(`${userId}-${Date.now()}`, 0, 0, 0)
    const run = await prisma.run.create({
      data: {
        userId,
        seasonId: season.id,
        mode,
        dogType: body.dogType,
        luckyNumber: body.dogType === 'EMPEROR' ? body.luckyNumber : null,
        gold: STARTING_GOLD,
        phase: 'MAP',
        shopItems: '[]',
        mapState: JSON.stringify(mapState),
        items: { create: initialItems().map(({ defId, area, x, y }) => ({ defId, area, x, y })) },
      },
      include: { items: true },
    })
    await recordAccountEvent(userId, { kind: 'RUN_CREATED', dogType: body.dogType })
    return { run: publicRun(run) }
  })

  app.get('/api/apex', async (request) => {
    const userId = requireUser(request.userId)
    const season = await getActiveSeason()
    const dailyBoardKey = dailyApexBoardKey()
    const [overallLeaderboard, dailyLeaderboard] = await Promise.all([
      apexLeaderboard(season.id, 'OVERALL', 'default'),
      apexLeaderboard(season.id, 'DAILY', dailyBoardKey),
    ])
    const submitted = await prisma.apexEntry.findMany({
      where: { userId, seasonId: season.id, boardType: 'OVERALL', sourceRunId: { not: null } },
      select: { sourceRunId: true },
    })
    const submittedRunIds = submitted
      .map((entry) => entry.sourceRunId)
      .filter((runId): runId is string => Boolean(runId))
    const candidates = await prisma.run.findMany({
      where: {
        userId,
        seasonId: season.id,
        status: 'COMPLETE',
        id: { notIn: submittedRunIds },
      },
      orderBy: { updatedAt: 'desc' },
      include: { items: true },
    })

    return {
      season: publicSeason(season),
      dailyBoardKey,
      dailyResetHour: 5,
      leaderboards: {
        overall: overallLeaderboard.map((entry) => publicApexEntry(entry, userId)),
        daily: dailyLeaderboard.map((entry) => publicApexEntry(entry, userId)),
      },
      candidates: candidates.map(publicRun),
    }
  })

  app.post('/api/apex/submit', async (request, reply) => {
    const userId = requireUser(request.userId)
    const season = await getActiveSeason()
    const { runId } = z.object({ runId: z.string() }).parse(request.body)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const run = await prisma.run.findFirst({ where: { id: runId, userId, seasonId: season.id }, include: { items: true } })
    if (!run) return reply.code(404).send({ error: 'Run not found' })
    if (run.status !== 'COMPLETE') return reply.code(400).send({ error: 'Only completed dogs can enter apex arena' })

    const existing = await prisma.apexEntry.findFirst({ where: { sourceRunId: run.id, seasonId: season.id, boardType: 'OVERALL' } })
    if (existing) return reply.code(409).send({ error: 'This dog has already entered apex arena' })

    const dailyBoardKey = dailyApexBoardKey()
    const [overallLeaderboard, dailyLeaderboard] = await Promise.all([
      apexLeaderboard(season.id, 'OVERALL', 'default'),
      apexLeaderboard(season.id, 'DAILY', dailyBoardKey),
    ])
    const challengerName = `${user.nickname ?? user.account}#${user.id.slice(0, 6)}`
    const challenger = snapshotFromRun(run, challengerName)
    const overallOpponents: ApexOpponent[] = overallLeaderboard.map((entry) => ({
      id: entry.id,
      rank: entry.rank,
      fighter: apexEntryToFighter(entry),
    }))
    const dailyOpponents: ApexOpponent[] = dailyLeaderboard.map((entry) => ({
      id: entry.id,
      rank: entry.rank,
      fighter: apexEntryToFighter(entry),
    }))
    const overallReport = resolveApexChallenge(challenger, overallOpponents, apexBoardSeed(season.id, 'OVERALL', 'default', run.id))
    const dailyReport = resolveApexChallenge(challenger, dailyOpponents, apexBoardSeed(season.id, 'DAILY', dailyBoardKey, run.id))

    const entries = await prisma.$transaction(async (tx) => {
      await incrementApexDefenderStreaks(tx, season.id, 'OVERALL', 'default', overallReport)
      await incrementApexDefenderStreaks(tx, season.id, 'DAILY', dailyBoardKey, dailyReport)
      const overall = await insertApexEntry(tx, season.id, 'OVERALL', 'default', userId, run, challengerName, overallReport)
      const daily = await insertApexEntry(tx, season.id, 'DAILY', dailyBoardKey, userId, run, challengerName, dailyReport)
      return { overall, daily }
    })
    const [updatedOverallLeaderboard, updatedDailyLeaderboard] = await Promise.all([
      prisma.apexEntry.findMany({ where: { seasonId: season.id, boardType: 'OVERALL', boardKey: 'default' }, orderBy: { rank: 'asc' } }),
      prisma.apexEntry.findMany({ where: { seasonId: season.id, boardType: 'DAILY', boardKey: dailyBoardKey }, orderBy: { rank: 'asc' } }),
    ])

    return {
      season: publicSeason(season),
      entries: {
        overall: publicApexEntry(entries.overall, userId),
        daily: publicApexEntry(entries.daily, userId),
      },
      reports: {
        overall: overallReport,
        daily: dailyReport,
      },
      dailyBoardKey,
      dailyResetHour: 5,
      leaderboards: {
        overall: updatedOverallLeaderboard.map((entry) => publicApexEntry(entry, userId)),
        daily: updatedDailyLeaderboard.map((entry) => publicApexEntry(entry, userId)),
      },
    }
  })

  app.get('/api/runs/:runId', async (request) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    return { run: publicRun(run) }
  })

  app.post('/api/runs/:runId/map/select', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const { nodeId } = z.object({ nodeId: z.string() }).parse(request.body)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true, ladderSettlement: true } })
    if (run.status !== 'ACTIVE' || run.phase !== 'MAP') return reply.code(400).send({ error: '当前不在探索地图' })
    const map = parseRunMapState(run)
    if (!map) return reply.code(400).send({ error: '探索地图不存在' })
    if (!availableMapNodeIds(map).includes(nodeId)) return reply.code(400).send({ error: '该节点当前不可到达' })
    const node = map.nodes.find((entry) => entry.id === nodeId)
    if (!node) return reply.code(404).send({ error: '地图节点不存在' })
    const selectedMap = { ...map, currentNodeId: node.id }
    const selection = mapNodeSelection(node)

    if (selection.action === 'REST') {
      const restedRun = await prisma.run.update({
        where: { id: run.id },
        data: {
          losses: run.losses > 0 ? run.losses - 1 : run.losses,
          gold: run.losses > 0 ? run.gold : run.gold + 4,
          ...mapCompletionUpdateData({ ...run, mapState: JSON.stringify(selectedMap) }),
        },
        include: { items: true, ladderSettlement: true },
      })
      return { run: publicRun(restedRun) }
    }

    if (selection.action === 'EVENT') {
      const updated = await prisma.run.update({
        where: { id: run.id },
        data: { phase: 'MAP', mapState: JSON.stringify(selectedMap) },
        include: { items: true, ladderSettlement: true },
      })
      return { run: publicRun(updated) }
    }

    if (selection.action === 'SHOP') {
      const updated = await prisma.run.update({
        where: { id: run.id },
        data: { mapState: JSON.stringify(selectedMap), ...mapNodeShopPhaseData(run, node) },
        include: { items: true, ladderSettlement: true },
      })
      return { run: publicRun(updated) }
    }

    if (selection.action === 'MONSTER_BATTLE') {
      const monster = buildOfflineFighter({
        dogType: node.monster?.dogType,
        round: node.monster?.round ?? mapMonsterBattleRound(map.mapIndex, node.layer),
        wins: run.wins,
        losses: run.losses,
        seed: node.monster?.seed ?? `${run.id}-${node.id}-monster`,
      })
      const updated = await prisma.run.update({
        where: { id: run.id },
        data: { phase: 'MATCH', mapState: JSON.stringify(selectedMap), matchedGhost: JSON.stringify({ ...monster, name: node.monster?.name ?? monster.name, ghostId: null }) },
        include: { items: true, ladderSettlement: true },
      })
      return { run: publicRun(updated) }
    }

    const updated = await prisma.run.update({
      where: { id: run.id },
      data: { phase: 'PREP', mapState: JSON.stringify(selectedMap), matchedGhost: null },
      include: { items: true, ladderSettlement: true },
    })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/map/event', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true, ladderSettlement: true } })
    const map = parseRunMapState(run)
    const node = map?.nodes.find((entry) => entry.id === map.currentNodeId)
    if (run.phase !== 'MAP' || !map || node?.kind !== 'EVENT' || !node.event) return reply.code(400).send({ error: '当前没有可处理的事件' })
    const type = node.event.type

    if (type === 'RELIC_GIFT') {
      const relicChoices = makeRelicChoices(run, `${run.id}-${node.id}-event-relic`)
      const updated = await prisma.run.update({
        where: { id: run.id },
        data: { phase: 'RELIC_CHOICE', shopType: 'RELIC', relicChoices: JSON.stringify(relicChoices), choices: '[]', shopItems: '[]' },
        include: { items: true, ladderSettlement: true },
      })
      return { run: publicRun(updated) }
    }

    if (type === 'FREE_UPGRADE') {
      const item = toGameItems(run.items).find((entry) => nextQuality(entry.quality))
      if (item) await prisma.itemInstance.update({ where: { id: item.id }, data: { quality: nextQuality(item.quality)! } })
      const updated = await prisma.run.update({
        where: { id: run.id },
        data: mapCompletionUpdateData(run),
        include: { items: true, ladderSettlement: true },
      })
      return { run: publicRun(updated) }
    }

    const data: Prisma.RunUpdateInput = mapCompletionUpdateData(run)
    if (type === 'GOLD_CACHE') data.gold = { increment: 6 }
    if (type === 'RESTORE_TOLERANCE') {
      if (run.losses > 0) data.losses = { decrement: 1 }
      else data.gold = { increment: 4 }
    }
    if (type === 'RISKY_COMMISSION') {
      data.gold = { increment: 12 }
      data.losses = { increment: 1 }
      if (run.losses + 1 >= RUN_LOSS_LIMIT) {
        data.status = 'COMPLETE'
        data.phase = 'COMPLETE'
      }
    }
    if (type === 'FREE_EQUIPMENT') {
      const itemReward = randomEquipmentReward(`${run.id}-${node.id}-event-equipment`)
      const reward = createItemRewardData(run, itemReward)
      if (reward.kind === 'create') data.items = { create: reward.item }
      if (reward.kind === 'upgrade') {
        await prisma.itemInstance.update({ where: { id: reward.itemId }, data: { quality: reward.quality } })
      }
      if (reward.kind === 'blocked') {
        const nextMap = applyMapNodeCompletion(map)
        data.mapState = JSON.stringify({ ...nextMap, pendingReward: { nodeId: node.id, ...itemReward } })
      }
    }
    const updated = await prisma.run.update({ where: { id: run.id }, data, include: { items: true, ladderSettlement: true } })
    if (updated.status === 'COMPLETE' && run.mode === 'LADDER') {
      await settleLadderRun(userId, run.id, updated.wins, updated.losses, run.seasonId)
      await recordAccountEvent(userId, { kind: 'LADDER_SETTLED', wins: updated.wins, losses: updated.losses })
      const settledRun = await prisma.run.findUniqueOrThrow({ where: { id: run.id }, include: { items: true, ladderSettlement: true } })
      return { run: publicRun(settledRun) }
    }
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/map/complete-node', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true, ladderSettlement: true } })
    const map = parseRunMapState(run)
    if (!map?.currentNodeId) return reply.code(400).send({ error: '当前没有待完成的地图节点' })
    const node = map.nodes.find((entry) => entry.id === map.currentNodeId)
    if (node?.kind === 'PLAYER_BATTLE' || node?.kind === 'MONSTER_BATTLE' || node?.kind === 'EVENT') return reply.code(400).send({ error: '当前节点需要先完成对应内容' })
    if (run.phase !== 'SHOP') return reply.code(400).send({ error: '当前节点还不能完成' })
    if (run.status !== 'ACTIVE') return reply.code(400).send({ error: '当前节点还不能完成' })
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: mapCompletionUpdateData(run),
      include: { items: true, ladderSettlement: true },
    })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/map/monster-reward/claim', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true, ladderSettlement: true } })
    const map = parseRunMapState(run)
    if (!map?.pendingReward) return reply.code(400).send({ error: '当前没有待领取掉落' })
    const reward = createItemRewardData(run, map.pendingReward)
    if (reward.kind === 'blocked') return reply.code(400).send({ error: '背包空间不足，请先整理' })
    if (reward.kind === 'upgrade') await prisma.itemInstance.update({ where: { id: reward.itemId }, data: { quality: reward.quality } })
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: {
        phase: 'MAP',
        mapState: JSON.stringify({ ...map, pendingReward: null }),
        ...(reward.kind === 'create' ? { items: { create: reward.item } } : {}),
      },
      include: { items: true, ladderSettlement: true },
    })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/map/monster-reward/skip', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true, ladderSettlement: true } })
    const map = parseRunMapState(run)
    if (!map?.pendingReward) return reply.code(400).send({ error: '当前没有待领取掉落' })
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: { phase: 'MAP', mapState: JSON.stringify({ ...map, pendingReward: null }) },
      include: { items: true, ladderSettlement: true },
    })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/shop/reroll', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    if (await isReadyDogfightRunLocked(run.id)) return reply.code(400).send({ error: '本回合已完成，等待其他玩家' })
    if (run.phase !== 'SHOP' || run.shopType === 'RELIC') return reply.code(400).send({ error: '当前不在普通商店' })
    if (run.gold < run.refreshCost) return reply.code(400).send({ error: '金币不足' })
    const shopItems = makeShop(run.shopType as ShopType, `${run.id}-${Date.now()}-${run.refreshCost}`, run.round)
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: { gold: run.gold - run.refreshCost, refreshCost: run.refreshCost + 1, shopItems: JSON.stringify(shopItems) },
      include: { items: true },
    })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/shop/buy', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ offerId: z.string(), area: z.enum(['EQUIPMENT', 'BAG']).default('BAG') }).parse(request.body)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    if (await isReadyDogfightRunLocked(run.id)) return reply.code(400).send({ error: '本回合已完成，等待其他玩家' })
    if (run.phase !== 'SHOP' || run.shopType === 'RELIC') return reply.code(400).send({ error: '当前不在普通商店' })
    const offers = parseJson<ShopOffer[]>(run.shopItems, [])
    const offer = offers.find((entry) => entry.offerId === body.offerId)
    if (!offer) return reply.code(404).send({ error: '商品不存在' })
    if (run.gold < offer.price) return reply.code(400).send({ error: '金币不足' })
    const items = toGameItems(run.items)
    const offerQuality = normalizeQuality(offer.quality)
    const remaining = offers.filter((entry) => entry.offerId !== body.offerId)
    const slot = findSlot(items, offer.defId, body.area, placementOptionsForRun(run))
    const upgradeTarget = !slot && body.area === 'BAG' ? items.find((entry) =>
      entry.defId === offer.defId
      && normalizeQuality(entry.quality) === offerQuality
      && nextQuality(entry.quality) !== null
    ) : null
    const upgradedQuality = upgradeTarget ? nextQuality(upgradeTarget.quality) : null
    if (upgradeTarget && upgradedQuality) {
      const [, updated] = await prisma.$transaction([
        prisma.itemInstance.update({ where: { id: upgradeTarget.id }, data: { quality: upgradedQuality } }),
        prisma.run.update({
          where: { id: run.id },
          data: { gold: run.gold - offer.price, shopItems: JSON.stringify(remaining) },
          include: { items: true },
        }),
      ])
      await recordAccountEvent(userId, { kind: 'SHOP_PURCHASED', shopType: run.shopType, itemDefId: offer.defId })
      return { run: publicRun(updated) }
    }

    if (!slot) return reply.code(400).send({ error: '目标区域空间不足' })
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: {
        gold: run.gold - offer.price,
        shopItems: JSON.stringify(remaining),
        items: { create: { defId: offer.defId, quality: offerQuality, area: body.area, x: slot.x, y: slot.y } },
      },
      include: { items: true },
    })
    await recordAccountEvent(userId, { kind: 'SHOP_PURCHASED', shopType: run.shopType, itemDefId: offer.defId })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/shop/sell', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ itemId: z.string() }).parse(request.body)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    if (await isReadyDogfightRunLocked(run.id)) return reply.code(400).send({ error: '本回合已完成，等待其他玩家' })
    const item = run.items.find((entry) => entry.id === body.itemId)
    if (!item) return reply.code(404).send({ error: '道具不存在' })
    const def = itemDef(item.defId)
    const sellValue = itemSellValue(def, item.quality, item.sellBonus)
    await prisma.itemInstance.delete({ where: { id: item.id } })
    const updated = await prisma.run.update({ where: { id: run.id }, data: { gold: run.gold + sellValue }, include: { items: true } })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/items/move', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ itemId: z.string(), area: z.enum(['EQUIPMENT', 'BAG']), x: z.number().int(), y: z.number().int() }).parse(request.body)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    if (await isReadyDogfightRunLocked(run.id)) return reply.code(400).send({ error: '本回合已完成，等待其他玩家' })
    if (!['MAP', 'SHOP', 'MATCH', 'CLASS_REWARD', 'ENCHANT_CHOICE', 'PREP'].includes(run.phase)) return reply.code(400).send({ error: '当前不能调整装备' })
    const item = run.items.find((entry) => entry.id === body.itemId)
    if (!item) return reply.code(404).send({ error: '道具不存在' })
    const gameItems = toGameItems(run.items)
    const movingSource = gameItems.find((entry) => entry.id === item.id)
    const moving = { ...(movingSource ?? { id: item.id, defId: item.defId, quality: normalizeQuality(item.quality), area: item.area as GameItem['area'], x: item.x, y: item.y }), area: body.area, x: body.x, y: body.y }
    const placementOptions = placementOptionsForRun(run)
    const coveredForUpgrade = overlappingItems(gameItems, moving, body.area, body.x, body.y)
    const upgradeTarget = coveredForUpgrade.length === 1 ? coveredForUpgrade[0] : null
    const upgradedQuality = upgradeTarget && canUpgradePair(moving, upgradeTarget) ? nextQuality(upgradeTarget.quality) : null
    if (upgradeTarget && upgradedQuality) {
      const enchant = upgradeEnchant(upgradeTarget.enchant, moving.enchant)
      await prisma.$transaction([
        prisma.itemInstance.update({ where: { id: upgradeTarget.id }, data: { quality: upgradedQuality, enchant: enchant ? JSON.stringify(enchant) : null, sellBonus: (upgradeTarget.sellBonus ?? 0) + (movingSource?.sellBonus ?? 0) } }),
        prisma.itemInstance.delete({ where: { id: item.id } }),
      ])
      const updated = await prisma.run.findUniqueOrThrow({ where: { id: run.id }, include: { items: true } })
      return { run: publicRun(updated) }
    }
    if (!canPlace(gameItems, moving, body.area, body.x, body.y, placementOptions)) {
      const covered = body.area === 'EQUIPMENT' ? overlappingItems(gameItems, moving, body.area, body.x, body.y) : []
      const remainingItems = gameItems.filter((entry) => !covered.some((coveredItem) => coveredItem.id === entry.id))
      if (covered.length > 0 && canPlace(remainingItems, moving, body.area, body.x, body.y, placementOptions)) {
        const bagMoves = replacementBagMoves(gameItems, moving, covered)
        if (!bagMoves) return reply.code(400).send({ error: '背包空间不足，请先整理' })
        await prisma.$transaction([
          prisma.itemInstance.update({ where: { id: item.id }, data: { area: body.area, x: body.x, y: body.y } }),
          ...bagMoves.map((move) => prisma.itemInstance.update({ where: { id: move.id }, data: { area: 'BAG', x: move.x, y: move.y } })),
        ])
        const updated = await prisma.run.findUniqueOrThrow({ where: { id: run.id }, include: { items: true } })
        return { run: publicRun(updated) }
      }
    }
    if (!canPlace(gameItems, { id: item.id, defId: item.defId, quality: normalizeQuality(item.quality), area: body.area, x: body.x, y: body.y }, body.area, body.x, body.y, placementOptionsForRun(run))) {
      return reply.code(400).send({ error: '目标位置不可放置' })
    }
    await prisma.itemInstance.update({ where: { id: item.id }, data: { area: body.area, x: body.x, y: body.y } })
    const updated = await prisma.run.findUniqueOrThrow({ where: { id: run.id }, include: { items: true } })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/items/upgrade', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ itemId: z.string(), targetItemId: z.string().optional() }).parse(request.body)
    const run = await prisma.run.findFirst({ where: { id: runId, userId }, include: { items: true } })
    if (!run) return reply.code(404).send({ error: '跑局不存在' })
    if (await isReadyDogfightRunLocked(run.id)) return reply.code(400).send({ error: '本回合已完成，等待其他玩家' })
    if (!['MAP', 'SHOP', 'MATCH', 'CLASS_REWARD', 'ENCHANT_CHOICE', 'PREP'].includes(run.phase)) return reply.code(400).send({ error: '当前不能升级道具' })

    const gameItems = toGameItems(run.items)
    const source = gameItems.find((entry) => entry.id === body.itemId)
    if (!source) return reply.code(404).send({ error: '道具不存在' })
    const target = body.targetItemId
      ? gameItems.find((entry) => entry.id === body.targetItemId)
      : source
    if (!target) return reply.code(404).send({ error: '目标道具不存在' })
    const consumed = body.targetItemId
      ? source
      : gameItems.find((entry) => entry.id !== source.id && entry.defId === source.defId && normalizeQuality(entry.quality) === normalizeQuality(source.quality))
    if (!consumed) return reply.code(400).send({ error: '需要两个完全相同品质的道具' })
    if (!canUpgradePair(consumed, target)) return reply.code(400).send({ error: '只有完全相同且未满级的道具可以升级' })
    const upgradedQuality = nextQuality(target.quality)
    if (!upgradedQuality) return reply.code(400).send({ error: '钻石品质已满级' })

    const enchant = upgradeEnchant(target.enchant, consumed.enchant)

    await prisma.$transaction([
      prisma.itemInstance.update({ where: { id: target.id }, data: { quality: upgradedQuality, enchant: enchant ? JSON.stringify(enchant) : null, sellBonus: (target.sellBonus ?? 0) + (consumed.sellBonus ?? 0) } }),
      prisma.itemInstance.delete({ where: { id: consumed.id } }),
    ])
    const updated = await prisma.run.findUniqueOrThrow({ where: { id: run.id }, include: { items: true } })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/choice/select', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ shopType: z.enum(['GENERAL', 'LARGE', 'MEDIUM', 'SMALL', 'SMALL_DICE', 'BIG_DICE', 'RELIC', 'UPGRADE', 'UPGRADE_SILVER', 'UPGRADE_GOLD', 'UPGRADE_DIAMOND', 'POTION']) }).parse(request.body)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    if (await isReadyDogfightRunLocked(run.id)) return reply.code(400).send({ error: '本回合已完成，等待其他玩家' })
    if (run.phase !== 'CHOICE') return reply.code(400).send({ error: '当前不在三选一' })
    const choices = parseJson<ShopType[]>(run.choices, [])
    if (!choices.includes(body.shopType)) return reply.code(400).send({ error: '无效选择' })
    if (body.shopType === 'RELIC') {
      const relicChoices = makeRelicChoices(run, `${run.id}-relic-${run.round}-${Date.now()}`)
      if (relicChoices.length === 0) return reply.code(400).send({ error: '当前没有可选遗物' })
      const updated = await prisma.run.update({
        where: { id: run.id },
        data: { phase: 'RELIC_CHOICE', shopType: 'RELIC', choices: '[]', shopItems: '[]', relicChoices: JSON.stringify(relicChoices) },
        include: { items: true },
      })
      return { run: publicRun(updated) }
    }
    if (isUpgradeShopType(body.shopType)) {
      const hasUpgradeableItem = toGameItems(run.items).some((item) => canUseUpgradeShop(body.shopType, item))
      if (!hasUpgradeableItem) return reply.code(400).send({ error: '当前没有可升级装备' })
      const updated = await prisma.run.update({
        where: { id: run.id },
        data: { phase: 'UPGRADE_CHOICE', shopType: body.shopType, choices: '[]', shopItems: '[]', relicChoices: '[]', potionChoices: '[]' },
        include: { items: true },
      })
      return { run: publicRun(updated) }
    }
    if (body.shopType === 'POTION') {
      const potionChoices = makePotionChoices(`${run.id}-potion-${run.round}-${Date.now()}`)
      const updated = await prisma.run.update({
        where: { id: run.id },
        data: { phase: 'POTION_CHOICE', shopType: 'POTION', choices: '[]', shopItems: '[]', relicChoices: '[]', potionChoices: JSON.stringify(potionChoices) },
        include: { items: true },
      })
      return { run: publicRun(updated) }
    }
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: { phase: 'SHOP', shopType: body.shopType, refreshCost: 1, choices: '[]', shopItems: JSON.stringify(makeShop(body.shopType, `${run.id}-choice-${body.shopType}`, run.round)) },
      include: { items: true },
    })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/upgrade/select', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ itemId: z.string() }).parse(request.body)
    const run = await prisma.run.findFirst({ where: { id: runId, userId }, include: { items: true } })
    if (!run) return reply.code(404).send({ error: '跑局不存在' })
    if (await isReadyDogfightRunLocked(run.id)) return reply.code(400).send({ error: '本回合已完成，等待其他玩家' })
    if (run.phase !== 'UPGRADE_CHOICE') return reply.code(400).send({ error: '当前不在升级商店' })
    const item = run.items.find((entry) => entry.id === body.itemId)
    if (!item) return reply.code(404).send({ error: '装备不存在' })
    if (!canUseUpgradeShop(run.shopType as ShopType, item)) return reply.code(400).send({ error: '当前升级商店不能升级该品质装备' })
    const upgradedQuality = nextQuality(item.quality)
    if (!upgradedQuality) return reply.code(400).send({ error: '钻石品质已满级' })

    const [, updated] = await prisma.$transaction([
      prisma.itemInstance.update({ where: { id: item.id }, data: { quality: upgradedQuality } }),
      prisma.run.update({
        where: { id: run.id },
        data: { ...(parseRunMapState(run)?.currentNodeId ? mapCompletionUpdateData(run) : { phase: 'PREP' }), choices: '[]', shopItems: '[]', relicChoices: '[]' },
        include: { items: true },
      }),
    ])
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/upgrade/skip', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const run = await prisma.run.findFirst({ where: { id: runId, userId }, include: { items: true } })
    if (!run) return reply.code(404).send({ error: '跑局不存在' })
    if (await isReadyDogfightRunLocked(run.id)) return reply.code(400).send({ error: '本回合已完成，等待其他玩家' })
    if (run.phase !== 'UPGRADE_CHOICE') return reply.code(400).send({ error: '当前不在升级商店' })
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: {
        ...(upgradeChoiceSkipPhase(run) === 'MAP' ? mapCompletionUpdateData(run) : { phase: 'PREP' }),
        choices: '[]',
        shopItems: '[]',
        relicChoices: '[]',
        potionChoices: '[]',
      },
      include: { items: true },
    })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/potion/select', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ potionId: z.string(), itemId: z.string() }).parse(request.body)
    const run = await prisma.run.findFirst({ where: { id: runId, userId }, include: { items: true } })
    if (!run) return reply.code(404).send({ error: 'Run not found' })
    if (await isReadyDogfightRunLocked(run.id)) return reply.code(400).send({ error: 'Round is already ready and locked' })
    if (run.phase !== 'POTION_CHOICE') return reply.code(400).send({ error: 'Not in potion shop' })
    const choices = parseJson<PotionChoice[]>(run.potionChoices, [])
    const choice = choices.find((entry) => entry.id === body.potionId)
    if (!choice) return reply.code(400).send({ error: 'Invalid potion' })
    const gameItems = toGameItems(run.items)
    const item = gameItems.find((entry) => entry.id === body.itemId)
    if (!item) return reply.code(404).send({ error: 'Item not found' })
    const def = itemDef(item.defId)
    if (def.kind === 'CLASS_EQUIPMENT') return reply.code(400).send({ error: 'Class equipment cannot use potions' })
    if (def.advancedEffect === 'BOOM_COUNTER') return reply.code(400).send({ error: 'Boom counter can only trigger by count' })
    const baseDice = item.triggerDiceOverride ?? def.dice
    const triggerDiceOverride = applyPotionToBaseDice(baseDice, choice)

    const [, updated] = await prisma.$transaction([
      prisma.itemInstance.update({ where: { id: item.id }, data: { triggerDiceOverride: JSON.stringify(triggerDiceOverride) } }),
      prisma.run.update({
        where: { id: run.id },
        data: { ...(parseRunMapState(run)?.currentNodeId ? mapCompletionUpdateData(run) : { phase: 'PREP' }), choices: '[]', shopItems: '[]', relicChoices: '[]', potionChoices: '[]' },
        include: { items: true },
      }),
    ])
    return { run: publicRun(updated) }
  })
  app.post('/api/runs/:runId/class-reward/select', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ defId: z.string() }).parse(request.body)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    if (await isReadyDogfightRunLocked(run.id)) return reply.code(400).send({ error: '本回合已完成，等待其他玩家' })
    if (run.phase !== 'CLASS_REWARD') return reply.code(400).send({ error: '当前不在职业奖励' })
    const choices = parseJson<string[]>(run.classRewardChoices, [])
    if (!choices.includes(body.defId)) return reply.code(400).send({ error: '无效职业装备' })
    const def = itemDef(body.defId)
    const slot = findSlot(toGameItems(run.items), body.defId, 'BAG')
    if (!slot) return reply.code(400).send({ error: '背包空间不足，请先整理' })
    const pendingEnchantChoices = parseJson<EnchantmentChoice[]>(run.enchantChoices, [])
    const map = parseRunMapState(run)
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: {
        phase: pendingEnchantChoices.length > 0 ? 'ENCHANT_CHOICE' : map?.currentNodeId ? 'MAP' : 'CHOICE',
        ...(pendingEnchantChoices.length === 0 && map?.currentNodeId ? mapCompletionUpdateData(run) : {}),
        classRewardChoices: '[]',
        choices: pendingEnchantChoices.length > 0 || map?.currentNodeId ? '[]' : JSON.stringify(makeChoices(`${run.id}-choices-${run.round}`, run.round, [
          ...toGameItems(run.items),
          { id: 'class-reward-preview', defId: body.defId, quality: normalizeQuality(def.defaultQuality), area: 'BAG', x: slot.x, y: slot.y },
        ])),
        items: { create: { defId: body.defId, quality: normalizeQuality(def.defaultQuality), area: 'BAG', x: slot.x, y: slot.y } },
      },
      include: { items: true },
    })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/enchant/select', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ enchantId: z.string(), itemId: z.string() }).parse(request.body)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true, ladderSettlement: true } })
    if (await isReadyDogfightRunLocked(run.id)) return reply.code(400).send({ error: '本回合已完成，等待其他玩家' })
    if (run.phase !== 'ENCHANT_CHOICE') return reply.code(400).send({ error: '当前不在附魔商店' })
    const choices = parseJson<EnchantmentChoice[]>(run.enchantChoices, [])
    const choice = choices.find((entry) => entry.id === body.enchantId)
    if (!choice) return reply.code(400).send({ error: '无效附魔' })
    const item = run.items.find((entry) => entry.id === body.itemId)
    if (!item) return reply.code(404).send({ error: '道具不存在' })
    if (item.enchant) return reply.code(400).send({ error: '该装备已经拥有附魔' })

    const [, updated] = await prisma.$transaction([
      prisma.itemInstance.update({ where: { id: item.id }, data: { enchant: JSON.stringify(choice.enchant) } }),
      prisma.run.update({
        where: { id: run.id },
        data: parseRunMapState(run)?.currentNodeId ? { ...mapCompletionUpdateData(run), choices: '[]', shopItems: '[]', enchantChoices: '[]' } : {
          phase: run.round <= 2 ? 'SHOP' : 'CHOICE',
          ...(run.round <= 2
            ? { shopType: 'GENERAL', shopItems: JSON.stringify(makeShop('GENERAL', `${run.id}-post-enchant-${run.round}`, run.round)), choices: '[]' }
            : { choices: JSON.stringify(makeChoices(`${run.id}-post-enchant-${run.round}`, run.round, run.items)), shopItems: '[]' }),
          enchantChoices: '[]',
        },
        include: { items: true, ladderSettlement: true },
      }),
    ])
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/relic/select', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ relicId: z.string() }).parse(request.body)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    if (await isReadyDogfightRunLocked(run.id)) return reply.code(400).send({ error: '本回合已完成，等待其他玩家' })
    if (run.phase !== 'RELIC_CHOICE') return reply.code(400).send({ error: '当前不在遗物选择' })
    const choices = parseJson<string[]>(run.relicChoices, [])
    if (!choices.includes(body.relicId)) return reply.code(400).send({ error: '无效遗物' })
    relicDef(body.relicId)
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: { ...(parseRunMapState(run)?.currentNodeId ? mapCompletionUpdateData(run) : { phase: 'PREP' }), relicChoices: '[]', relics: JSON.stringify(applyRelicChoice(relicsFromRun(run), body.relicId)) },
      include: { items: true },
    })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/relic/sell', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ relicId: z.string() }).parse(request.body)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    if (await isReadyDogfightRunLocked(run.id)) return reply.code(400).send({ error: 'Round is already ready and locked' })
    if (!['MAP', 'SHOP', 'MATCH', 'CLASS_REWARD', 'ENCHANT_CHOICE', 'PREP'].includes(run.phase)) return reply.code(400).send({ error: 'Cannot sell relics in the current phase' })
    const remainingRelics = removeRelicByInstanceId(relicsFromRun(run), body.relicId)
    if (!remainingRelics) return reply.code(404).send({ error: 'Relic not found' })
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: { relics: JSON.stringify(remainingRelics) },
      include: { items: true },
    })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/battle/match', async (request) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const playerName = user.nickname ?? '玩家'
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    const previousOpponent = parseJson<(FighterSnapshot & { ghostId?: string | null }) | null>(run.matchedGhost || '', null)
    const previousGhostId = typeof previousOpponent?.ghostId === 'string' ? previousOpponent.ghostId : null
    const selectionSeed = `${run.id}-${run.round}-${run.wins}-${run.losses}-${Date.now()}`
    await prisma.ghostSnapshot.create({
      data: {
        runId: run.id,
        userId,
        seasonId: run.seasonId,
        mode: run.mode,
        name: playerName,
        dogType: run.dogType,
        luckyNumber: run.luckyNumber,
        round: run.round,
        wins: run.wins,
        losses: run.losses,
        gold: run.gold,
        items: JSON.stringify(toGameItems(run.items)),
        relics: JSON.stringify(relicsFromRun(run)),
        seed: `${run.id}-${run.round}-${run.wins}-${run.losses}`,
      },
    })
    const runMode = run.mode === 'LADDER' ? 'LADDER' : 'CASUAL'
    const ladderProfile = runMode === 'LADDER' ? await ensureLadderProfile(userId, run.seasonId) : null
    const ladderRange = ladderProfile
      ? targetLadderOpponentWinsRange({
        tier: normalizeLadderTier(ladderProfile.tier, ladderProfile.score),
        wins: run.wins,
        round: run.round,
      })
      : null
    const opponentWins = ladderRange?.preferred ?? targetOpponentWins(run.wins)
    const ghostCandidates = isTrainingMatchRound(run.round)
      ? null
      : await prisma.ghostSnapshot.findMany({
        where: {
          mode: runMode,
          seasonId: run.seasonId,
          round: run.round,
          NOT: [{ runId: run.id }, { userId }],
          wins: ladderRange ? { gte: ladderRange.min, lte: ladderRange.max } : { gte: opponentWins, lte: run.wins },
          losses: { gte: Math.max(0, run.losses - 1), lte: run.losses + 1 },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    const rematchCandidates = previousGhostId
      ? ghostCandidates?.filter((candidate) => candidate.id !== previousGhostId)
      : ghostCandidates
    const ghost = ghostCandidates
      ? runMode === 'LADDER'
        ? selectLadderGhostSnapshot(rematchCandidates ?? [], { preferredWins: opponentWins, seed: selectionSeed })
        : selectCasualGhostSnapshot(rematchCandidates ?? [], { wins: run.wins, seed: selectionSeed })
      : null
    const opponent = ghost
      ? { name: ghost.name, dogType: ghost.dogType as DogType, luckyNumber: ghost.luckyNumber, wins: ghost.wins, losses: ghost.losses, round: ghost.round, items: parseJson(ghost.items, []), relics: parseJson(ghost.relics, []) }
      : seedGhost(run.round, opponentWins, run.losses, `${selectionSeed}-offline`)
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: { phase: 'MATCH', matchedGhost: JSON.stringify({ ...opponent, ghostId: ghost?.id ?? null }) },
      include: { items: true },
    })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/battle/start', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const playerName = user.nickname ?? '玩家'
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    if (run.phase !== 'MATCH') return reply.code(400).send({ error: '请先匹配对手' })
    const opponent = parseJson<(FighterSnapshot & { ghostId?: string | null }) | null>(run.matchedGhost || '', null)
    if (!opponent) return reply.code(400).send({ error: '没有匹配对手' })
    const result = simulateBattle(snapshotFromRun(run, playerName), opponent, `${run.id}-${Date.now()}`)
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: { phase: 'BATTLE', lastBattle: JSON.stringify(result) },
      include: { items: true },
    })
    await prisma.battleLog.create({ data: { runId: run.id, ghostId: opponent.ghostId, result: result.winner, log: JSON.stringify(result) } })
    return { run: publicRun(updated), battle: result }
  })

  app.post('/api/runs/:runId/battle/finish', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    if (run.phase !== 'BATTLE') return reply.code(400).send({ error: '当前没有待结算战斗' })
    const result = parseJson<BattleResult | null>(run.lastBattle || '', null)
    if (!result) return reply.code(400).send({ error: '没有可结算的战斗结果' })
    const playerWon = result.winner === 'player'
    const map = parseRunMapState(run)
    const mapNode = map?.currentNodeId ? map.nodes.find((node) => node.id === map.currentNodeId) ?? null : null
    if (mapNode?.kind === 'MONSTER_BATTLE') {
      const battleRecord = createFinishedBattleRecord(result, run.wins, run.losses)
      const completion = mapCompletionUpdateData(run)
      let itemMutation: Prisma.RunUpdateInput['items'] | undefined
      let nextMap = completion.mapState ? parseRunMapState({ mapState: completion.mapState }) : null
      if (playerWon) {
        const reward = randomMonsterReward(mapNode.monster, `${run.id}-${mapNode.id}-reward-${run.round}`)
        const rewardData = createItemRewardData(run, reward)
        if (rewardData.kind === 'create') {
          itemMutation = { create: rewardData.item }
        } else if (rewardData.kind === 'upgrade') {
          itemMutation = { update: { where: { id: rewardData.itemId }, data: { quality: rewardData.quality } } }
        } else if (nextMap) {
          nextMap = { ...nextMap, pendingReward: { nodeId: mapNode.id, defId: reward.defId, quality: normalizeQuality(reward.quality) } }
        }
      }
      const updated = await prisma.run.update({
        where: { id: run.id },
        data: {
          ...completion,
          ...(nextMap ? { mapState: JSON.stringify(nextMap) } : {}),
          lastBattle: JSON.stringify(battleRecord),
          matchedGhost: null,
          ...(itemMutation ? { items: itemMutation } : {}),
        },
        include: { items: true, ladderSettlement: true },
      })
      return { run: publicRun(updated) }
    }
    const wins = run.wins + (playerWon ? 1 : 0)
    const losses = run.losses + (playerWon ? 0 : 1)
    const battleRecord = createFinishedBattleRecord(result, wins, losses)
    const status = wins >= 12 || losses >= RUN_LOSS_LIMIT ? 'COMPLETE' : 'ACTIVE'
    const nextRound = run.round + 1
    const roundIncome = playerBattleGoldIncome(nextRound)
    const currentItems = toGameItems(run.items)
    const sellBonusItemGrowths = postBattleSellBonusItemGrowths(currentItems)
    const postBattleReward = status === 'ACTIVE'
      ? postBattleLargeItemReward(currentItems, `${run.id}-post-battle-${nextRound}-${wins}-${losses}`)
      : null
    const phaseData = status === 'COMPLETE'
      ? { phase: 'COMPLETE', enchantChoices: '[]' }
      : postPlayerBattlePhaseData({ ...run, wins, losses }, nextRound, currentItems)
    const updateData = {
      wins,
      losses,
      round: nextRound,
      gold: run.gold + roundIncome,
      status,
      lastBattle: JSON.stringify(battleRecord),
      matchedGhost: null,
      refreshCost: 1,
      relicChoices: '[]',
      ...phaseData,
    }
    const itemUpdates = {
      ...(postBattleReward ? { create: postBattleReward } : {}),
      ...(sellBonusItemGrowths.length > 0
        ? { updateMany: sellBonusItemGrowths.map((growth) => ({ where: { id: growth.id }, data: { sellBonus: { increment: growth.increment } } })) }
        : {}),
    }
    if (Object.keys(itemUpdates).length > 0) {
      Object.assign(updateData, { items: itemUpdates })
    }
    const updated = await prisma.run.update({ where: { id: run.id }, data: updateData, include: { items: true, ladderSettlement: true } })
    await recordAccountEvent(userId, {
      kind: 'BATTLE_FINISHED',
      mode: run.mode,
      dogType: run.dogType,
      winner: playerWon,
      wins,
      losses,
      round: nextRound,
      itemCount: currentItems.length,
      relicCount: relicsFromRun(run).length,
    })
    if (status === 'COMPLETE' && run.mode === 'LADDER') {
      await settleLadderRun(userId, run.id, wins, losses, run.seasonId)
      await recordAccountEvent(userId, { kind: 'LADDER_SETTLED', wins, losses })
      const settledRun = await prisma.run.findUniqueOrThrow({ where: { id: run.id }, include: { items: true, ladderSettlement: true } })
      return { run: publicRun(settledRun) }
    }
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/settle', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const settlement = await prisma.$transaction(async (tx) => {
      const run = await tx.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true, ladderSettlement: true } })
      if (run.status !== 'ACTIVE') return { type: 'invalid' as const }
      if (run.phase === 'BATTLE') return { type: 'battle' as const }

      const transition = await tx.run.updateMany({
        where: { id: run.id, userId, status: 'ACTIVE', phase: { not: 'BATTLE' } },
        data: {
          status: 'COMPLETE',
          phase: 'COMPLETE',
          matchedGhost: null,
        },
      })
      if (transition.count === 0) return { type: 'invalid' as const }

      if (run.mode === 'LADDER') {
        await createLadderSettlement(tx, userId, run.id, run.wins, run.losses, run.seasonId)
      }

      return { type: 'settled' as const, run: await tx.run.findUniqueOrThrow({ where: { id: run.id }, include: { items: true, ladderSettlement: true } }) }
    })
    if (settlement.type === 'battle') {
      return reply.code(400).send({ error: '当前战斗已经生成结果，请先继续完成战斗结算' })
    }
    if (settlement.type === 'invalid') {
      return reply.code(400).send({ error: '当前跑局已经结算或不可放弃' })
    }
    if (settlement.run.mode === 'LADDER') {
      await recordAccountEvent(userId, { kind: 'LADDER_SETTLED', wins: settlement.run.wins, losses: settlement.run.losses })
    }

    if (settlement.run.mode === 'LADDER') {
      await recordAccountEvent(userId, { kind: 'LADDER_SETTLED', wins: settlement.run.wins, losses: settlement.run.losses })
    }
    return { run: publicRun(settlement.run) }
  })

  return app
}
