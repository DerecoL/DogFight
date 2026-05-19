import bcrypt from 'bcryptjs'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import Fastify from 'fastify'
import { z } from 'zod'
import { cookieOptionsForEnv, resolveServerConfig } from './config'
import { prisma } from './db'
import { publicErrorMessage } from './errors'
import { itemDef, relicDef } from './game/data'
import { canPlace, findSlot } from './game/grid'
import { canUpgradePair, nextQuality, normalizeQuality } from './game/quality'
import { simulateBattle } from './game/battle'
import type { DogType, FighterSnapshot, ShopOffer, ShopType } from './game/types'
import { applyRelicChoice, classRewardChoices, initialItems, makeChoices, makeRelicChoices, makeShop, parseJson, publicRun, relicsFromRun, seedGhost, snapshotFromRun, toGameItems } from './state'

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

  const publicUser = (user: { id: string; email: string; nickname: string | null }) => ({
    id: user.id,
    email: user.email,
    nickname: user.nickname,
  })

  app.get('/api/health', async () => ({ ok: true }))

  app.post('/api/auth/register', async (request, reply) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(6) }).parse(request.body)
    const passwordHash = await bcrypt.hash(body.password, 10)
    const user = await prisma.user.create({ data: { email: body.email.toLowerCase(), passwordHash } })
    const token = app.jwt.sign({ userId: user.id })
    reply.setCookie('token', token, authCookieOptions)
    return { user: publicUser(user), needsNickname: true }
  })

  app.post('/api/auth/login', async (request, reply) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(6) }).parse(request.body)
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } })
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) return reply.code(401).send({ error: '邮箱或密码错误' })
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
        shopItems: JSON.stringify(shopItems),
        items: { create: initialItems().map(({ defId, area, x, y }) => ({ defId, area, x, y })) },
      },
      include: { items: true },
    })
    return { run: publicRun(run) }
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
    const slot = findSlot(items, offer.defId, body.area)
    if (!slot) return reply.code(400).send({ error: '目标区域空间不足' })
    const remaining = offers.filter((entry) => entry.offerId !== body.offerId)
    const updated = await prisma.run.update({
      where: { id: run.id },
      data: {
        gold: run.gold - offer.price,
        shopItems: JSON.stringify(remaining),
        items: { create: { defId: offer.defId, quality: normalizeQuality(offer.quality), area: body.area, x: slot.x, y: slot.y } },
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
    if (!canPlace(gameItems, { id: item.id, defId: item.defId, quality: normalizeQuality(item.quality), area: body.area, x: body.x, y: body.y }, body.area, body.x, body.y)) {
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
    const ghost = await prisma.ghostSnapshot.findFirst({
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
    const playerWon = result.winner === 'player' || result.winner === 'draw'
    const wins = run.wins + (playerWon ? 1 : 0)
    const losses = run.losses + (playerWon ? 0 : 1)
    const status = wins >= 12 || losses >= 3 ? 'COMPLETE' : 'ACTIVE'
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
      lastBattle: JSON.stringify(result),
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
    await prisma.battleLog.create({ data: { runId: run.id, ghostId: opponent.ghostId, result: result.winner, log: JSON.stringify(result) } })
    const updated = await prisma.run.update({ where: { id: run.id }, data: updateData, include: { items: true } })
    return { run: publicRun(updated), battle: result }
  })

  return app
}
