import type { FastifyInstance } from 'fastify'
import { type DogfightBattle, type DogfightParticipant, type DogfightRoom, type ItemInstance, type Prisma, type Run } from '@prisma/client'
import { z } from 'zod'
import { prisma } from './db'
import { itemDef } from './game/data'
import { findSlot } from './game/grid'
import { STARTING_GOLD } from './game/matchmaking'
import { normalizeQuality } from './game/quality'
import { simulateBattle } from './game/battle'
import type { BattleEvent, BattleResult, DogType, FighterSnapshot, ShopType } from './game/types'
import { applyRelicChoice, classRewardChoices, initialItems, makeChoices, makeRelicChoices, makeShop, parseJson, publicRun, relicsFromRun, seedGhost, snapshotFromRun, toGameItems } from './state'

const DOGFIGHT_MAX_PLAYERS = 8
const DOGFIGHT_READY_MS = 60_000
const DOGFIGHT_TRAINING_ROUNDS = 3
const DOGFIGHT_LOSS_LIMIT = 5

const dogChoiceSchema = z.object({
  dogType: z.enum(['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR']),
  luckyNumber: z.number().int().min(1).max(6).optional(),
})

const roomParamsSchema = z.object({ roomId: z.string() })
const battleParamsSchema = z.object({ battleId: z.string() })

type RequireUser = (userId?: string) => string
type DogfightParticipantWithRun = DogfightParticipant & { run: Run & { items: ItemInstance[] } }
type DogfightRoomWithDetails = DogfightRoom & {
  participants: DogfightParticipantWithRun[]
  battles: DogfightBattle[]
}
type Tx = Prisma.TransactionClient

const dogfightRoomInclude = {
  participants: {
    orderBy: { createdAt: 'asc' as const },
    include: { run: { include: { items: true } } },
  },
  battles: { orderBy: [{ round: 'asc' as const }, { createdAt: 'asc' as const }] },
}

function readyDeadlineFromNow() {
  return new Date(Date.now() + DOGFIGHT_READY_MS)
}

function playerName(user: { id: string; email: string; nickname: string | null }) {
  return user.nickname ?? user.email.split('@')[0] ?? `玩家${user.id.slice(0, 6)}`
}

function validateDogChoice(body: unknown) {
  const parsed = dogChoiceSchema.safeParse(body)
  if (!parsed.success) return null
  if (parsed.data.dogType === 'EMPEROR' && parsed.data.luckyNumber == null) return null
  return parsed.data
}

async function createDogfightRun(tx: Tx, userId: string, choice: z.infer<typeof dogChoiceSchema>) {
  const shopItems = makeShop('GENERAL', `${userId}-dogfight-${Date.now()}`)
  return tx.run.create({
    data: {
      userId,
      dogType: choice.dogType,
      luckyNumber: choice.dogType === 'EMPEROR' ? choice.luckyNumber : null,
      gold: STARTING_GOLD,
      status: 'DOGFIGHT_ACTIVE',
      phase: 'SHOP',
      shopItems: JSON.stringify(shopItems),
      items: { create: initialItems().map(({ defId, quality, area, x, y }) => ({ defId, quality, area, x, y })) },
    },
    include: { items: true },
  })
}

async function loadDogfightRoom(roomId: string) {
  return prisma.dogfightRoom.findUnique({ where: { id: roomId }, include: dogfightRoomInclude })
}

function publicDogfightRoom(room: DogfightRoomWithDetails, userId: string) {
  const currentParticipant = room.participants.find((participant) => participant.userId === userId) ?? null
  return {
    id: room.id,
    hostUserId: room.hostUserId,
    status: room.status,
    currentRound: room.currentRound,
    maxPlayers: room.maxPlayers,
    readyDeadline: room.readyDeadline?.toISOString() ?? null,
    winnerParticipantId: room.winnerParticipantId,
    isHost: Boolean(currentParticipant?.isHost),
    spectator: !currentParticipant,
    members: room.participants.map((participant) => ({
      id: participant.id,
      userId: participant.userId,
      runId: participant.runId,
      nickname: participant.nickname,
      isHost: participant.isHost,
      ready: participant.ready,
      eliminated: participant.eliminated,
      eliminatedRound: participant.eliminatedRound,
      placement: participant.placement,
      dogType: participant.run.dogType,
      wins: participant.run.wins,
      losses: participant.run.losses,
      round: participant.run.round,
      gold: participant.run.gold,
      phase: participant.run.phase,
      status: participant.run.status,
    })),
    currentRun: currentParticipant ? publicRun(currentParticipant.run) : null,
    battles: room.battles.map((battle) => ({
      id: battle.id,
      round: battle.round,
      participantAId: battle.participantAId,
      participantBId: battle.participantBId,
      opponentKind: battle.opponentKind,
      winnerSide: battle.winnerSide,
      winnerParticipantId: battle.winnerParticipantId,
      createdAt: battle.createdAt.toISOString(),
    })),
  }
}

function publicDogfightRoomSummary(room: DogfightRoomWithDetails, userId: string) {
  const member = room.participants.find((participant) => participant.userId === userId) ?? null
  return {
    id: room.id,
    status: room.status,
    currentRound: room.currentRound,
    maxPlayers: room.maxPlayers,
    memberCount: room.participants.length,
    aliveCount: room.participants.filter((participant) => !participant.eliminated).length,
    readyDeadline: room.readyDeadline?.toISOString() ?? null,
    winnerParticipantId: room.winnerParticipantId,
    isMember: Boolean(member),
    isHost: Boolean(member?.isHost),
    spectator: !member,
    hostName: room.participants.find((participant) => participant.isHost)?.nickname ?? '房主',
  }
}

function responseFor(room: DogfightRoomWithDetails, userId: string) {
  return { room: publicDogfightRoom(room, userId) }
}

function stableScore(seed: string) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return hash
}

function nextPhaseData(run: Run, nextRound: number) {
  const nextClassRewards = classRewardChoices(run.dogType as DogType, nextRound)
  if (nextClassRewards.length > 0) {
    return {
      phase: 'CLASS_REWARD',
      classRewardChoices: JSON.stringify(nextClassRewards),
      choices: '[]',
      shopItems: '[]',
    }
  }
  if (nextRound <= 2) {
    return {
      phase: 'SHOP',
      shopType: 'GENERAL',
      shopItems: JSON.stringify(makeShop('GENERAL', `${run.id}-dogfight-round-${nextRound}`)),
      choices: '[]',
      classRewardChoices: '[]',
    }
  }
  return {
    phase: 'CHOICE',
    choices: JSON.stringify(makeChoices(`${run.id}-dogfight-choices-${nextRound}`, nextRound)),
    shopItems: '[]',
    classRewardChoices: '[]',
  }
}

async function autoChoosePendingRunStep(tx: Tx, run: Run & { items: Prisma.ItemInstanceGetPayload<object>[] }) {
  if (run.phase === 'CHOICE') {
    const choices = parseJson<ShopType[]>(run.choices, [])
    const shopType = choices[0] ?? 'GENERAL'
    if (shopType === 'RELIC') {
      const relicChoices = makeRelicChoices(run, `${run.id}-dogfight-auto-relic-${run.round}`)
      return tx.run.update({
        where: { id: run.id },
        data: { phase: 'RELIC_CHOICE', shopType: 'RELIC', choices: '[]', shopItems: '[]', relicChoices: JSON.stringify(relicChoices) },
        include: { items: true },
      })
    }
    return tx.run.update({
      where: { id: run.id },
      data: { phase: 'SHOP', shopType, refreshCost: 1, choices: '[]', shopItems: JSON.stringify(makeShop(shopType, `${run.id}-dogfight-auto-${shopType}`)) },
      include: { items: true },
    })
  }

  if (run.phase === 'CLASS_REWARD') {
    const choices = parseJson<string[]>(run.classRewardChoices, [])
    const defId = choices[0]
    if (!defId) {
      return tx.run.update({ where: { id: run.id }, data: { phase: 'CHOICE', choices: JSON.stringify(makeChoices(`${run.id}-dogfight-empty-class-${run.round}`, run.round)) }, include: { items: true } })
    }
    const slot = findSlot(toGameItems(run.items), defId, 'BAG')
    const def = itemDef(defId)
    return tx.run.update({
      where: { id: run.id },
      data: {
        phase: 'CHOICE',
        classRewardChoices: '[]',
        choices: JSON.stringify(makeChoices(`${run.id}-dogfight-class-${run.round}`, run.round)),
        ...(slot ? { items: { create: { defId, quality: normalizeQuality(def.defaultQuality), area: 'BAG', x: slot.x, y: slot.y } } } : {}),
      },
      include: { items: true },
    })
  }

  if (run.phase === 'RELIC_CHOICE') {
    const choices = parseJson<string[]>(run.relicChoices, [])
    const relicId = choices[0]
    return tx.run.update({
      where: { id: run.id },
      data: {
        phase: 'PREP',
        relicChoices: '[]',
        relics: relicId ? JSON.stringify(applyRelicChoice(relicsFromRun(run), relicId)) : run.relics,
      },
      include: { items: true },
    })
  }

  return run
}

async function normalizeRunForDogfightBattle(tx: Tx, run: Run & { items: Prisma.ItemInstanceGetPayload<object>[] }) {
  let current = run
  while (['CHOICE', 'CLASS_REWARD', 'RELIC_CHOICE'].includes(current.phase)) {
    current = await autoChoosePendingRunStep(tx, current)
  }
  return current
}

type PendingResult = {
  wins: number
  losses: number
  goldCompensation: number
}

function createPendingResults(participants: DogfightParticipantWithRun[]) {
  return new Map(participants.map((participant) => [participant.id, { wins: 0, losses: 0, goldCompensation: 0 } satisfies PendingResult]))
}

function recordWin(pending: Map<string, PendingResult>, participantId: string) {
  const result = pending.get(participantId)
  if (result) result.wins += 1
}

function recordLoss(pending: Map<string, PendingResult>, participantId: string) {
  const result = pending.get(participantId)
  if (result) {
    result.losses += 1
    result.goldCompensation += 5
  }
}

async function createDogfightBattle(tx: Tx, room: DogfightRoom, participantA: DogfightParticipantWithRun, participantB: DogfightParticipantWithRun | null, opponent: FighterSnapshot, pending: Map<string, PendingResult>) {
  const player = snapshotFromRun(participantA.run, participantA.nickname)
  const result = simulateBattle(player, opponent, `${room.id}-${room.currentRound}-${participantA.id}-${participantB?.id ?? 'offline'}`)
  const winnerParticipantId = result.winner === 'player' ? participantA.id : participantB?.id ?? null

  if (result.winner === 'player') {
    recordWin(pending, participantA.id)
    if (participantB) recordLoss(pending, participantB.id)
  } else {
    recordLoss(pending, participantA.id)
    if (participantB) recordWin(pending, participantB.id)
  }

  await tx.dogfightBattle.create({
    data: {
      roomId: room.id,
      round: room.currentRound,
      participantAId: participantA.id,
      participantBId: participantB?.id ?? null,
      opponentKind: participantB ? 'PLAYER' : 'OFFLINE',
      winnerSide: result.winner,
      winnerParticipantId,
      result: JSON.stringify(result),
    },
  })
}

async function settleDogfightRoundIfReady(roomId: string, force = false) {
  return prisma.$transaction(async (tx) => {
    const room = await tx.dogfightRoom.findUnique({ where: { id: roomId }, include: dogfightRoomInclude })
    if (!room || room.status !== 'ACTIVE') return
    if (room.battles.some((battle) => battle.round === room.currentRound)) return

    const alive = room.participants.filter((participant) => !participant.eliminated)
    if (alive.length <= 1) {
      await tx.dogfightRoom.update({ where: { id: room.id }, data: { status: 'COMPLETE', winnerParticipantId: alive[0]?.id ?? null } })
      return
    }

    const deadlinePassed = Boolean(room.readyDeadline && room.readyDeadline.getTime() <= Date.now())
    const allReady = alive.every((participant) => participant.ready)
    if (!force && !allReady && !deadlinePassed) return

    for (const participant of alive) {
      await normalizeRunForDogfightBattle(tx, participant.run)
    }

    const refreshed = await tx.dogfightRoom.findUniqueOrThrow({ where: { id: roomId }, include: dogfightRoomInclude })
    const activeParticipants = refreshed.participants.filter((participant) => !participant.eliminated)
    const pending = createPendingResults(activeParticipants)

    if (refreshed.currentRound < DOGFIGHT_TRAINING_ROUNDS) {
      for (const participant of activeParticipants) {
        const opponent = seedGhost(refreshed.currentRound, participant.run.wins, participant.run.losses)
        await createDogfightBattle(tx, refreshed, participant, null, opponent, pending)
      }
    } else {
      const shuffled = activeParticipants
        .slice()
        .sort((left, right) => stableScore(`${refreshed.id}-${refreshed.currentRound}-${left.id}`) - stableScore(`${refreshed.id}-${refreshed.currentRound}-${right.id}`))

      for (let index = 0; index < shuffled.length; index += 2) {
        const participantA = shuffled[index]
        const participantB = shuffled[index + 1] ?? null
        const opponent = participantB
          ? snapshotFromRun(participantB.run, participantB.nickname)
          : seedGhost(refreshed.currentRound, participantA.run.wins, participantA.run.losses)
        await createDogfightBattle(tx, refreshed, participantA, participantB, opponent, pending)
      }
    }

    const nextRound = refreshed.currentRound + 1
    const placementBase = activeParticipants.length
    const survivingIds: string[] = []

    for (const participant of activeParticipants) {
      const participantResult = pending.get(participant.id) ?? { wins: 0, losses: 0, goldCompensation: 0 }
      const wins = participant.run.wins + participantResult.wins
      const losses = participant.run.losses + participantResult.losses
      const eliminated = losses >= DOGFIGHT_LOSS_LIMIT
      const roundIncome = eliminated ? 0 : 5 + nextRound * 2
      const gold = participant.run.gold + participantResult.goldCompensation + roundIncome
      const phaseData = eliminated ? { phase: 'COMPLETE' } : nextPhaseData(participant.run, nextRound)

      if (!eliminated) survivingIds.push(participant.id)

      await tx.run.update({
        where: { id: participant.runId },
        data: {
          wins,
          losses,
          round: nextRound,
          gold,
          status: eliminated ? 'DOGFIGHT_ELIMINATED' : 'DOGFIGHT_ACTIVE',
          matchedGhost: null,
          lastBattle: null,
          refreshCost: 1,
          relicChoices: '[]',
          ...phaseData,
        },
      })
      await tx.dogfightParticipant.update({
        where: { id: participant.id },
        data: {
          ready: false,
          eliminated,
          eliminatedRound: eliminated ? refreshed.currentRound : null,
          placement: eliminated ? placementBase : null,
        },
      })
    }

    const complete = survivingIds.length <= 1
    const winnerParticipantId = complete ? survivingIds[0] ?? null : null
    await tx.dogfightRoom.update({
      where: { id: refreshed.id },
      data: {
        currentRound: nextRound,
        status: complete ? 'COMPLETE' : 'ACTIVE',
        readyDeadline: complete ? null : readyDeadlineFromNow(),
        winnerParticipantId,
      },
    })
    if (winnerParticipantId) {
      const winner = activeParticipants.find((participant) => participant.id === winnerParticipantId)
      if (winner) {
        await tx.run.update({ where: { id: winner.runId }, data: { status: 'DOGFIGHT_COMPLETE', phase: 'COMPLETE' } })
      }
    }
  })
}

async function createRoomForUser(userId: string, choice: z.infer<typeof dogChoiceSchema>) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const name = playerName(user)
  const room = await prisma.$transaction(async (tx) => {
    const run = await createDogfightRun(tx, userId, choice)
    const createdRoom = await tx.dogfightRoom.create({
      data: {
        hostUserId: userId,
        maxPlayers: DOGFIGHT_MAX_PLAYERS,
      },
    })
    await tx.dogfightParticipant.create({
      data: {
        roomId: createdRoom.id,
        userId,
        runId: run.id,
        nickname: name,
        isHost: true,
      },
    })
    return createdRoom
  })
  return loadDogfightRoom(room.id)
}

async function joinRoomForUser(roomId: string, userId: string, choice: z.infer<typeof dogChoiceSchema>) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const name = playerName(user)
  const room = await prisma.$transaction(async (tx) => {
    const currentRoom = await tx.dogfightRoom.findUnique({ where: { id: roomId }, include: { participants: true } })
    if (!currentRoom) {
      const error = new Error('Dogfight room not found') as Error & { statusCode: number }
      error.statusCode = 404
      throw error
    }
    if (currentRoom.status !== 'WAITING') {
      const error = new Error('Dogfight room has already started') as Error & { statusCode: number }
      error.statusCode = 400
      throw error
    }
    if (currentRoom.participants.length >= currentRoom.maxPlayers) {
      const error = new Error('Dogfight room is full') as Error & { statusCode: number }
      error.statusCode = 400
      throw error
    }
    if (currentRoom.participants.some((participant) => participant.userId === userId)) return currentRoom

    const run = await createDogfightRun(tx, userId, choice)
    await tx.dogfightParticipant.create({
      data: {
        roomId,
        userId,
        runId: run.id,
        nickname: name,
        isHost: false,
      },
    })
    return currentRoom
  })
  return loadDogfightRoom(room.id)
}

function swapSide(side: 'player' | 'opponent' | 'system') {
  if (side === 'player') return 'opponent'
  if (side === 'opponent') return 'player'
  return 'system'
}

function swapTarget(target?: BattleEvent['target']) {
  if (target === 'player') return 'opponent'
  if (target === 'opponent') return 'player'
  return target
}

function battleForParticipant(result: BattleResult, side: 'A' | 'B') {
  if (side === 'A') return result
  return {
    ...result,
    winner: result.winner === 'player' ? 'opponent' : 'player',
    playerHp: result.opponentHp,
    opponentHp: result.playerHp,
    playerMaxHp: result.opponentMaxHp,
    opponentMaxHp: result.playerMaxHp,
    playerSnapshot: result.opponentSnapshot,
    opponentSnapshot: result.playerSnapshot,
    events: result.events.map((event) => ({
      ...event,
      actor: swapSide(event.actor),
      target: swapTarget(event.target),
      playerHp: event.opponentHp,
      opponentHp: event.playerHp,
      playerMaxHp: event.opponentMaxHp,
      opponentMaxHp: event.playerMaxHp,
      playerShield: event.opponentShield,
      opponentShield: event.playerShield,
    })),
  } satisfies BattleResult
}

export function registerDogfightRoutes(app: FastifyInstance, requireUser: RequireUser) {
  app.get('/api/dogfight/rooms', async (request) => {
    const userId = requireUser(request.userId)
    const rooms = await prisma.dogfightRoom.findMany({
      where: { status: { in: ['WAITING', 'ACTIVE', 'COMPLETE'] } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 30,
      include: dogfightRoomInclude,
    })
    return { rooms: rooms.map((room) => publicDogfightRoomSummary(room, userId)) }
  })

  app.post('/api/dogfight/rooms', async (request, reply) => {
    const userId = requireUser(request.userId)
    const choice = validateDogChoice(request.body)
    if (!choice) return reply.code(400).send({ error: 'Invalid dogfight dog choice' })
    const room = await createRoomForUser(userId, choice)
    if (!room) return reply.code(500).send({ error: 'Failed to create dogfight room' })
    return responseFor(room, userId)
  })

  app.post('/api/dogfight/rooms/:roomId/join', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { roomId } = roomParamsSchema.parse(request.params)
    const choice = validateDogChoice(request.body)
    if (!choice) return reply.code(400).send({ error: 'Invalid dogfight dog choice' })
    const room = await joinRoomForUser(roomId, userId, choice)
    if (!room) return reply.code(404).send({ error: 'Dogfight room not found' })
    return responseFor(room, userId)
  })

  app.post('/api/dogfight/match', async (request, reply) => {
    const userId = requireUser(request.userId)
    const choice = validateDogChoice(request.body)
    if (!choice) return reply.code(400).send({ error: 'Invalid dogfight dog choice' })
    const rooms = await prisma.dogfightRoom.findMany({
      where: { status: 'WAITING' },
      orderBy: { createdAt: 'asc' },
      include: dogfightRoomInclude,
    })
    const openRoom = rooms.find((room) => room.participants.length < room.maxPlayers && !room.participants.some((participant) => participant.userId === userId))
    const room = openRoom ? await joinRoomForUser(openRoom.id, userId, choice) : await createRoomForUser(userId, choice)
    if (!room) return reply.code(500).send({ error: 'Failed to match dogfight room' })
    return responseFor(room, userId)
  })

  app.post('/api/dogfight/rooms/:roomId/start', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { roomId } = roomParamsSchema.parse(request.params)
    const room = await prisma.dogfightRoom.findUnique({ where: { id: roomId }, include: dogfightRoomInclude })
    if (!room) return reply.code(404).send({ error: 'Dogfight room not found' })
    const participant = room.participants.find((entry) => entry.userId === userId)
    if (!participant?.isHost) return reply.code(403).send({ error: 'Only the host can start this dogfight room' })
    if (room.status !== 'WAITING') return reply.code(400).send({ error: 'Dogfight room has already started' })
    if (room.participants.length < 2) return reply.code(400).send({ error: 'Dogfight room needs at least 2 players' })
    await prisma.dogfightRoom.update({ where: { id: room.id }, data: { status: 'ACTIVE', currentRound: 0, readyDeadline: readyDeadlineFromNow() } })
    const updated = await loadDogfightRoom(room.id)
    if (!updated) return reply.code(404).send({ error: 'Dogfight room not found' })
    return responseFor(updated, userId)
  })

  app.get('/api/dogfight/rooms/:roomId', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { roomId } = roomParamsSchema.parse(request.params)
    await settleDogfightRoundIfReady(roomId)
    const room = await loadDogfightRoom(roomId)
    if (!room) return reply.code(404).send({ error: 'Dogfight room not found' })
    return responseFor(room, userId)
  })

  app.post('/api/dogfight/rooms/:roomId/ready', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { roomId } = roomParamsSchema.parse(request.params)
    const room = await prisma.dogfightRoom.findUnique({ where: { id: roomId }, include: dogfightRoomInclude })
    if (!room) return reply.code(404).send({ error: 'Dogfight room not found' })
    if (room.status !== 'ACTIVE') return reply.code(400).send({ error: 'Dogfight room is not active' })
    const participant = room.participants.find((entry) => entry.userId === userId)
    if (!participant) return reply.code(403).send({ error: 'Spectators cannot ready up' })
    if (participant.eliminated) return reply.code(400).send({ error: 'Eliminated players cannot ready up' })
    await prisma.dogfightParticipant.update({ where: { id: participant.id }, data: { ready: true } })
    await settleDogfightRoundIfReady(roomId)
    const updated = await loadDogfightRoom(roomId)
    if (!updated) return reply.code(404).send({ error: 'Dogfight room not found' })
    return responseFor(updated, userId)
  })

  app.get('/api/dogfight/battles/:battleId', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { battleId } = battleParamsSchema.parse(request.params)
    const battle = await prisma.dogfightBattle.findUnique({
      where: { id: battleId },
      include: { room: { include: { participants: true } } },
    })
    if (!battle) return reply.code(404).send({ error: 'Dogfight battle not found' })
    const participant = battle.room.participants.find((entry) => entry.userId === userId)
    const side = participant?.id === battle.participantBId ? 'B' : 'A'
    const result = parseJson<BattleResult | null>(battle.result, null)
    if (!result) return reply.code(500).send({ error: 'Dogfight battle result is invalid' })
    return {
      battle: {
        id: battle.id,
        roomId: battle.roomId,
        round: battle.round,
        opponentKind: battle.opponentKind,
        participantAId: battle.participantAId,
        participantBId: battle.participantBId,
        winnerParticipantId: battle.winnerParticipantId,
        result: participant ? battleForParticipant(result, side) : result,
      },
    }
  })
}
