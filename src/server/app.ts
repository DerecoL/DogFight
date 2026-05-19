import bcrypt from 'bcryptjs'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import Fastify from 'fastify'
import { Prisma, type ApexEntry } from '@prisma/client'
import { z } from 'zod'
import { cookieOptionsForEnv, resolveServerConfig } from './config'
import { prisma } from './db'
import { registerDogfightRoutes } from './dogfight'
import { publicErrorMessage } from './errors'
import { buildApexSeedEntries, resolveApexChallenge, type ApexOpponent } from './game/apex'
import { itemDef, itemDefForQuality, relicDef, relicDefForQuality } from './game/data'
import { canPlace, findSlot, type PlacementOptions } from './game/grid'
import { canUpgradePair, nextQuality, normalizeQuality } from './game/quality'
import { simulateBattle } from './game/battle'
import { STARTING_GOLD, isTrainingMatchRound } from './game/matchmaking'
import type { BattleResult, DogType, FighterSnapshot, GameItem, RelicInstance, ShopOffer, ShopType } from './game/types'
import { applyRelicChoice, classRewardChoices, createFinishedBattleRecord, initialItems, makeChoices, makeRelicChoices, makeShop, parseJson, postBattleLargeItemReward, publicRun, publicRunHistory, relicsFromRun, seedGhost, snapshotFromRun, toGameItems } from './state'

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

  const publicApexEntry = (entry: ApexEntry) => ({
    id: entry.id,
    sourceRunId: entry.sourceRunId,
    name: entry.name,
    dogType: entry.dogType as DogType,
    luckyNumber: entry.luckyNumber,
    wins: entry.wins,
    losses: entry.losses,
    round: entry.round,
    rank: entry.rank,
    challengeWins: entry.challengeWins,
    isSeed: entry.isSeed,
    createdAt: entry.createdAt,
    items: parseJson<GameItem[]>(entry.items, []).map((item) => ({ ...item, def: itemDefForQuality(item.defId, item.quality) })),
    relics: parseJson<RelicInstance[]>(entry.relics, []).map((relic) => ({ ...relic, def: relicDefForQuality(relic.relicId, relic.quality) })),
  })

  const placementOptionsForRun = (run: { relics: string }): PlacementOptions => {
    const hasExtraEquipment = relicsFromRun(run).some((relic) => relicDef(relic.relicId).effect === 'EXTRA_EQUIPMENT_REDUCED_EFFECT')
    return hasExtraEquipment ? { equipmentWidth: 13 } : {}
  }

  const ensureApexSeeds = async () => {
    const count = await prisma.apexEntry.count()
    if (count > 0) return

    await prisma.apexEntry.createMany({
      data: buildApexSeedEntries().map((entry) => ({
        name: entry.fighter.name,
        dogType: entry.fighter.dogType,
        luckyNumber: entry.fighter.luckyNumber,
        round: entry.fighter.round,
        wins: entry.fighter.wins,
        losses: entry.fighter.losses,
        items: JSON.stringify(entry.fighter.items),
        relics: JSON.stringify(entry.fighter.relics ?? []),
        rank: entry.rank,
        challengeWins: 0,
        isSeed: true,
      })),
    })
  }

  const apexLeaderboard = async () => {
    await ensureApexSeeds()
    return prisma.apexEntry.findMany({ orderBy: { rank: 'asc' } })
  }

  registerDogfightRoutes(app, requireUser)

  app.get('/api/health', async () => ({ ok: true }))

  app.post('/api/auth/register', async (request, reply) => {
    const body = authBodySchema.parse(request.body)
    const passwordHash = await bcrypt.hash(body.password, 10)
    const account = authAccountFrom(body)
    const user = await prisma.user.create({ data: { account, passwordHash } }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null
      }
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
    const activeRun = await prisma.run.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, include: { items: true } })
    return { user: publicUser(user), activeRun: activeRun ? publicRun(activeRun) : null }
  })

  app.get('/api/runs/history', async (request) => {
    const userId = requireUser(request.userId)
    const runs = await prisma.run.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
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
    })
    return { history: publicRunHistory(runs) }
  })

  app.post('/api/runs', async (request, reply) => {
    const userId = requireUser(request.userId)
    const parsed = z.object({
      dogType: z.enum(['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR']),
      luckyNumber: z.number().int().min(1).max(6).optional(),
    }).safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: '无效狗狗选择' })
    const body = parsed.data
    if (body.dogType === 'EMPEROR' && body.luckyNumber == null) {
      return reply.code(400).send({ error: '狗皇帝需要选择 1-6 的幸运数字' })
    }
    await prisma.run.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'ABANDONED' } })
    const shopItems = makeShop('GENERAL', `${userId}-new-shop`)
    const run = await prisma.run.create({
      data: {
        userId,
        dogType: body.dogType,
        luckyNumber: body.dogType === 'EMPEROR' ? body.luckyNumber : null,
        gold: STARTING_GOLD,
        shopItems: JSON.stringify(shopItems),
        items: { create: initialItems().map(({ defId, area, x, y }) => ({ defId, area, x, y })) },
      },
      include: { items: true },
    })
    return { run: publicRun(run) }
  })

  app.get('/api/apex', async (request) => {
    const userId = requireUser(request.userId)
    const leaderboard = await apexLeaderboard()
    const submitted = await prisma.apexEntry.findMany({
      where: { userId, sourceRunId: { not: null } },
      select: { sourceRunId: true },
    })
    const submittedRunIds = submitted
      .map((entry) => entry.sourceRunId)
      .filter((runId): runId is string => Boolean(runId))
    const candidates = await prisma.run.findMany({
      where: {
        userId,
        status: 'COMPLETE',
        id: { notIn: submittedRunIds },
      },
      orderBy: { updatedAt: 'desc' },
      include: { items: true },
    })

    return {
      leaderboard: leaderboard.map(publicApexEntry),
      candidates: candidates.map(publicRun),
    }
  })

  app.post('/api/apex/submit', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.body)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const run = await prisma.run.findFirst({ where: { id: runId, userId }, include: { items: true } })
    if (!run) return reply.code(404).send({ error: 'Run not found' })
    if (run.status !== 'COMPLETE') return reply.code(400).send({ error: 'Only completed dogs can enter apex arena' })

    const existing = await prisma.apexEntry.findUnique({ where: { sourceRunId: run.id } })
    if (existing) return reply.code(409).send({ error: 'This dog has already entered apex arena' })

    const leaderboard = await apexLeaderboard()
    const challengerName = `${user.nickname ?? user.account}#${user.id.slice(0, 6)}`
    const challenger = snapshotFromRun(run, challengerName)
    const opponents: ApexOpponent[] = leaderboard.map((entry) => ({
      id: entry.id,
      rank: entry.rank,
      fighter: apexEntryToFighter(entry),
    }))
    const report = resolveApexChallenge(challenger, opponents, `${run.id}-apex`)
    const rankOffset = 1_000_000

    const entry = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "ApexEntry" SET "rank" = "rank" + ${rankOffset} WHERE "rank" >= ${report.placementRank}`
      const created = await tx.apexEntry.create({
        data: {
          userId,
          sourceRunId: run.id,
          name: challengerName,
          dogType: run.dogType,
          luckyNumber: run.luckyNumber,
          round: run.round,
          wins: run.wins,
          losses: run.losses,
          items: JSON.stringify(toGameItems(run.items)),
          relics: JSON.stringify(relicsFromRun(run)),
          rank: report.placementRank,
          challengeWins: report.challengeWins,
          isSeed: false,
        },
      })
      await tx.$executeRaw`UPDATE "ApexEntry" SET "rank" = "rank" - ${rankOffset - 1} WHERE "rank" >= ${report.placementRank + rankOffset}`
      return created
    })
    const updatedLeaderboard = await prisma.apexEntry.findMany({ orderBy: { rank: 'asc' } })

    return {
      entry: publicApexEntry(entry),
      report,
      leaderboard: updatedLeaderboard.map(publicApexEntry),
    }
  })

  app.get('/api/runs/:runId', async (request) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    return { run: publicRun(run) }
  })

  app.post('/api/runs/:runId/shop/reroll', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    if (run.phase !== 'SHOP' || run.shopType === 'RELIC') return reply.code(400).send({ error: '当前不在普通商店' })
    if (run.gold < run.refreshCost) return reply.code(400).send({ error: '金币不足' })
    const shopItems = makeShop(run.shopType as ShopType, `${run.id}-${Date.now()}-${run.refreshCost}`)
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
    if (run.phase !== 'SHOP' || run.shopType === 'RELIC') return reply.code(400).send({ error: '当前不在普通商店' })
    const offers = parseJson<ShopOffer[]>(run.shopItems, [])
    const offer = offers.find((entry) => entry.offerId === body.offerId)
    if (!offer) return reply.code(404).send({ error: '商品不存在' })
    if (run.gold < offer.price) return reply.code(400).send({ error: '金币不足' })
    const items = toGameItems(run.items)
    const offerQuality = normalizeQuality(offer.quality)
    const remaining = offers.filter((entry) => entry.offerId !== body.offerId)
    const upgradeTarget = items.find((entry) =>
      entry.defId === offer.defId
      && normalizeQuality(entry.quality) === offerQuality
      && nextQuality(entry.quality) !== null
    )
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
      return { run: publicRun(updated) }
    }

    const slot = findSlot(items, offer.defId, body.area, placementOptionsForRun(run))
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
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/shop/sell', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ itemId: z.string() }).parse(request.body)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    const item = run.items.find((entry) => entry.id === body.itemId)
    if (!item) return reply.code(404).send({ error: '道具不存在' })
    const def = itemDef(item.defId)
    const sellValue = def.tags.includes('starter') ? 1 : Math.floor(def.price / 2)
    await prisma.itemInstance.delete({ where: { id: item.id } })
    const updated = await prisma.run.update({ where: { id: run.id }, data: { gold: run.gold + sellValue }, include: { items: true } })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/items/move', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ itemId: z.string(), area: z.enum(['EQUIPMENT', 'BAG']), x: z.number().int(), y: z.number().int() }).parse(request.body)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    if (!['SHOP', 'MATCH', 'CLASS_REWARD', 'PREP'].includes(run.phase)) return reply.code(400).send({ error: '当前不能调整装备' })
    const item = run.items.find((entry) => entry.id === body.itemId)
    if (!item) return reply.code(404).send({ error: '道具不存在' })
    const gameItems = toGameItems(run.items)
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
    if (!['SHOP', 'MATCH', 'CLASS_REWARD', 'PREP'].includes(run.phase)) return reply.code(400).send({ error: '当前不能升级道具' })

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

    await prisma.$transaction([
      prisma.itemInstance.update({ where: { id: target.id }, data: { quality: upgradedQuality } }),
      prisma.itemInstance.delete({ where: { id: consumed.id } }),
    ])
    const updated = await prisma.run.findUniqueOrThrow({ where: { id: run.id }, include: { items: true } })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/choice/select', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ shopType: z.enum(['GENERAL', 'LARGE', 'MEDIUM', 'SMALL', 'SMALL_DICE', 'BIG_DICE', 'RELIC']) }).parse(request.body)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
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
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: { phase: 'SHOP', shopType: body.shopType, refreshCost: 1, choices: '[]', shopItems: JSON.stringify(makeShop(body.shopType, `${run.id}-choice-${body.shopType}`)) },
      include: { items: true },
    })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/class-reward/select', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ defId: z.string() }).parse(request.body)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    if (run.phase !== 'CLASS_REWARD') return reply.code(400).send({ error: '当前不在职业奖励' })
    const choices = parseJson<string[]>(run.classRewardChoices, [])
    if (!choices.includes(body.defId)) return reply.code(400).send({ error: '无效职业装备' })
    const def = itemDef(body.defId)
    const slot = findSlot(toGameItems(run.items), body.defId, 'BAG')
    if (!slot) return reply.code(400).send({ error: '背包空间不足，请先整理' })
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: {
        phase: 'CHOICE',
        classRewardChoices: '[]',
        choices: JSON.stringify(makeChoices(`${run.id}-choices-${run.round}`, run.round)),
        items: { create: { defId: body.defId, quality: normalizeQuality(def.defaultQuality), area: 'BAG', x: slot.x, y: slot.y } },
      },
      include: { items: true },
    })
    return { run: publicRun(updated) }
  })

  app.post('/api/runs/:runId/relic/select', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const body = z.object({ relicId: z.string() }).parse(request.body)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true } })
    if (run.phase !== 'RELIC_CHOICE') return reply.code(400).send({ error: '当前不在遗物选择' })
    const choices = parseJson<string[]>(run.relicChoices, [])
    if (!choices.includes(body.relicId)) return reply.code(400).send({ error: '无效遗物' })
    relicDef(body.relicId)
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: { phase: 'PREP', relicChoices: '[]', relics: JSON.stringify(applyRelicChoice(relicsFromRun(run), body.relicId)) },
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
    await prisma.ghostSnapshot.create({
      data: {
        runId: run.id,
        userId,
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
    const ghost = isTrainingMatchRound(run.round)
      ? null
      : await prisma.ghostSnapshot.findFirst({
        where: { round: run.round, NOT: { runId: run.id }, wins: { gte: Math.max(0, run.wins - 1), lte: run.wins + 1 }, losses: { gte: Math.max(0, run.losses - 1), lte: run.losses + 1 } },
        orderBy: { createdAt: 'desc' },
      })
    const opponent = ghost
      ? { name: ghost.name, dogType: ghost.dogType as DogType, luckyNumber: ghost.luckyNumber, wins: ghost.wins, losses: ghost.losses, round: ghost.round, items: parseJson(ghost.items, []), relics: parseJson(ghost.relics, []) }
      : seedGhost(run.round, run.wins, run.losses)
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
    const wins = run.wins + (playerWon ? 1 : 0)
    const losses = run.losses + (playerWon ? 0 : 1)
    const battleRecord = createFinishedBattleRecord(result, wins, losses)
    const status = wins >= 12 || losses >= 5 ? 'COMPLETE' : 'ACTIVE'
    const nextRound = run.round + 1
    const nextClassRewards = classRewardChoices(run.dogType as DogType, nextRound)
    const phase = status === 'COMPLETE'
      ? 'COMPLETE'
      : nextClassRewards.length > 0
        ? 'CLASS_REWARD'
        : nextRound <= 2
          ? 'SHOP'
          : 'CHOICE'
    const roundIncome = 5 + nextRound * 2
    const updateData = {
      wins,
      losses,
      round: nextRound,
      gold: run.gold + roundIncome,
      status,
      phase,
      lastBattle: JSON.stringify(battleRecord),
      matchedGhost: null,
      refreshCost: 1,
      classRewardChoices: phase === 'CLASS_REWARD' ? JSON.stringify(nextClassRewards) : '[]',
      relicChoices: '[]',
      ...(phase === 'SHOP'
        ? { shopType: 'GENERAL', shopItems: JSON.stringify(makeShop('GENERAL', `${run.id}-round-${nextRound}`)), choices: '[]' }
        : phase === 'CHOICE'
          ? { choices: JSON.stringify(makeChoices(`${run.id}-choices-${nextRound}`, nextRound)), shopItems: '[]' }
          : {}),
    }
    const postBattleReward = status === 'ACTIVE'
      ? postBattleLargeItemReward(toGameItems(run.items), `${run.id}-post-battle-${nextRound}-${wins}-${losses}`)
      : null
    if (postBattleReward) {
      Object.assign(updateData, { items: { create: postBattleReward } })
    }
    const updated = await prisma.run.update({ where: { id: run.id }, data: updateData, include: { items: true } })
    return { run: publicRun(updated) }
  })

  return app
}
