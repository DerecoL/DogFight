import type { FastifyInstance } from 'fastify'
import { type DogfightBattle, type DogfightParticipant, type DogfightRoom, type ItemInstance, type Prisma, type Run } from '@prisma/client'
import { z } from 'zod'
import { prisma } from './db'
import { itemDef } from './game/data'
import { findSlot } from './game/grid'
import { STARTING_GOLD } from './game/matchmaking'
import { buildOfflineFighter, offlineFighterName } from './game/offline-builder'
import { normalizeQuality } from './game/quality'
import { simulateBattle } from './game/battle'
import type { BattleEvent, BattleResult, DogType, EnchantmentChoice, FighterSnapshot, GameItem, ShopType } from './game/types'
import { applyRelicChoice, initialItems, makeChoices, makeRelicChoices, makeShop, nextPhaseData as buildNextPhaseData, parseJson, phaseDataAfterEnchant, postBattleLargeItemReward, publicRun, relicsFromRun, seedGhost, snapshotFromRun, toGameItems } from './state'

const DOGFIGHT_TARGET_PLAYERS = 8
const DOGFIGHT_DOG_SELECT_MS = 15_000
const DOGFIGHT_SHOP_MS = 30_000
const DOGFIGHT_BATTLE_MS = 25_000
const DOGFIGHT_TRAINING_ROUNDS = 3
const DOGFIGHT_LOSS_LIMIT = 5
const DOG_TYPES: DogType[] = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR']

const dogChoiceSchema = z.object({
  dogType: z.enum(['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR']),
  luckyNumber: z.number().int().min(1).max(6).optional(),
})

const roomParamsSchema = z.object({ roomId: z.string() })
const battleParamsSchema = z.object({ battleId: z.string() })

type RequireUser = (userId?: string) => string
type DogfightPhase = 'LOBBY' | 'DOG_SELECT' | 'SHOP' | 'BATTLE' | 'COMPLETE'
type DogfightParticipantWithRun = DogfightParticipant & { run: (Run & { items: ItemInstance[] }) | null }
type ActiveDogfightParticipant = DogfightParticipant & { run: Run & { items: ItemInstance[] } }
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

function deadlineFromNow(ms: number) {
  return new Date(Date.now() + ms)
}

function playerName(user: { id: string; account: string; nickname: string | null }) {
  return user.nickname ?? user.account ?? `玩家${user.id.slice(0, 6)}`
}

function validateDogChoice(body: unknown) {
  const parsed = dogChoiceSchema.safeParse(body)
  if (!parsed.success) return null
  if (parsed.data.dogType === 'EMPEROR' && parsed.data.luckyNumber == null) return null
  return parsed.data
}

function stableScore(seed: string) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return hash
}

function seededDogChoice(seed: string) {
  const dogType = DOG_TYPES[stableScore(seed) % DOG_TYPES.length]
  return {
    dogType,
    luckyNumber: dogType === 'EMPEROR' ? (stableScore(`${seed}-lucky`) % 6) + 1 : undefined,
  }
}

function participantSeed(roomId: string, participant: Pick<DogfightParticipant, 'id' | 'userId' | 'kind'>) {
  return `${roomId}-${participant.kind}-${participant.userId ?? participant.id}`
}

async function createDogfightRun(tx: Tx, userId: string, choice: z.infer<typeof dogChoiceSchema>, seed: string) {
  const shopItems = makeShop('GENERAL', `${seed}-shop`, 0)
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

function roomPhase(room: Pick<DogfightRoom, 'phase' | 'status'>): DogfightPhase {
  if (room.status === 'COMPLETE') return 'COMPLETE'
  if (['LOBBY', 'DOG_SELECT', 'SHOP', 'BATTLE', 'COMPLETE'].includes(room.phase)) return room.phase as DogfightPhase
  return room.status === 'WAITING' ? 'LOBBY' : 'SHOP'
}

function currentBattleIdFor(room: DogfightRoomWithDetails, participantId: string) {
  const battle = room.battles.find((entry) =>
    entry.round === room.currentRound
    && (entry.participantAId === participantId || entry.participantBId === participantId)
  )
  return battle?.id ?? null
}

function memberRunValues(participant: DogfightParticipantWithRun) {
  return {
    dogType: participant.run?.dogType as DogType | undefined ?? null,
    wins: participant.run?.wins ?? 0,
    losses: participant.run?.losses ?? 0,
    round: participant.run?.round ?? 0,
    gold: participant.run?.gold ?? 0,
    phase: participant.run?.phase ?? 'SHOP',
    status: participant.run?.status ?? 'DOGFIGHT_PENDING',
  }
}

function sortedParticipants(room: DogfightRoomWithDetails) {
  return room.participants.slice().sort((left, right) => {
    const leftValues = memberRunValues(left)
    const rightValues = memberRunValues(right)
    const leftLives = left.eliminated ? 0 : Math.max(0, DOGFIGHT_LOSS_LIMIT - leftValues.losses)
    const rightLives = right.eliminated ? 0 : Math.max(0, DOGFIGHT_LOSS_LIMIT - rightValues.losses)
    return rightLives - leftLives
      || rightValues.wins - leftValues.wins
      || (left.kind === right.kind ? 0 : left.kind === 'PLAYER' ? -1 : 1)
      || left.createdAt.getTime() - right.createdAt.getTime()
  })
}

function publicDogfightRoom(room: DogfightRoomWithDetails, userId: string) {
  const currentParticipant = room.participants.find((participant) => participant.userId === userId) ?? null
  const members = sortedParticipants(room).map((participant) => {
    const runValues = memberRunValues(participant)
    return {
      id: participant.id,
      userId: participant.userId,
      runId: participant.runId,
      kind: participant.kind === 'BOT' ? 'BOT' : 'PLAYER',
      nickname: participant.nickname,
      isHost: participant.isHost,
      ready: participant.ready,
      eliminated: participant.eliminated,
      eliminatedRound: participant.eliminatedRound,
      placement: participant.placement,
      currentBattleId: currentBattleIdFor(room, participant.id),
      ...runValues,
    }
  })
  const currentRunMember = currentParticipant
    ? members.find((member) => member.id === currentParticipant.id) ?? null
    : null

  return {
    id: room.id,
    hostUserId: room.hostUserId,
    status: room.status,
    phase: roomPhase(room),
    currentRound: room.currentRound,
    maxPlayers: room.maxPlayers,
    targetPlayerCount: room.targetPlayerCount,
    readyDeadline: room.readyDeadline?.toISOString() ?? null,
    phaseDeadline: room.phaseDeadline?.toISOString() ?? null,
    winnerParticipantId: room.winnerParticipantId,
    isHost: Boolean(currentParticipant?.isHost),
    spectator: !currentParticipant,
    members,
    currentRunMember,
    currentRun: currentParticipant?.run ? publicRun(currentParticipant.run) : null,
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
    phase: roomPhase(room),
    currentRound: room.currentRound,
    maxPlayers: room.maxPlayers,
    targetPlayerCount: room.targetPlayerCount,
    memberCount: room.participants.filter((participant) => participant.kind !== 'BOT').length,
    aliveCount: room.participants.filter((participant) => !participant.eliminated).length,
    readyDeadline: room.readyDeadline?.toISOString() ?? null,
    phaseDeadline: room.phaseDeadline?.toISOString() ?? null,
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

function nextDogfightPhaseData(run: Run, nextRound: number) {
  return buildNextPhaseData(run, nextRound, `${run.id}-dogfight-round-${nextRound}-${run.wins}-${run.losses}`)
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
      data: { phase: 'SHOP', shopType, refreshCost: 1, choices: '[]', shopItems: JSON.stringify(makeShop(shopType, `${run.id}-dogfight-auto-${shopType}`, run.round)) },
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
    const pendingEnchantChoices = parseJson<EnchantmentChoice[]>(run.enchantChoices, [])
    return tx.run.update({
      where: { id: run.id },
      data: {
        phase: pendingEnchantChoices.length > 0 ? 'ENCHANT_CHOICE' : 'CHOICE',
        classRewardChoices: '[]',
        choices: pendingEnchantChoices.length > 0 ? '[]' : JSON.stringify(makeChoices(`${run.id}-dogfight-class-${run.round}`, run.round)),
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

  if (run.phase === 'ENCHANT_CHOICE') {
    const choices = parseJson<EnchantmentChoice[]>(run.enchantChoices, [])
    const choice = choices[0]
    const target = toGameItems(run.items).find((item) => !item.enchant)
    if (!choice || !target) {
      return tx.run.update({
        where: { id: run.id },
        data: phaseDataAfterEnchant(run),
        include: { items: true },
      })
    }
    await tx.itemInstance.update({ where: { id: target.id }, data: { enchant: JSON.stringify(choice.enchant) } })
    return tx.run.update({
      where: { id: run.id },
      data: phaseDataAfterEnchant(run),
      include: { items: true },
    })
  }

  return run
}

async function normalizeRunForDogfightBattle(tx: Tx, run: Run & { items: Prisma.ItemInstanceGetPayload<object>[] }) {
  let current = run
  while (['CHOICE', 'CLASS_REWARD', 'ENCHANT_CHOICE', 'RELIC_CHOICE'].includes(current.phase)) {
    current = await autoChoosePendingRunStep(tx, current)
  }
  return current
}

async function syncBotRunForBattle(tx: Tx, participant: ActiveDogfightParticipant) {
  if (participant.kind !== 'BOT') return participant.run
  const fighter = buildOfflineFighter({
    dogType: participant.run.dogType as DogType,
    round: participant.run.round,
    wins: participant.run.wins,
    losses: participant.run.losses,
    seed: `${participant.roomId}-${participant.id}-${participant.run.round}-${participant.run.wins}-${participant.run.losses}`,
  })
  await tx.itemInstance.deleteMany({ where: { runId: participant.runId! } })
  return tx.run.update({
    where: { id: participant.runId! },
    data: {
      luckyNumber: fighter.luckyNumber,
      relics: JSON.stringify(fighter.relics ?? []),
      items: {
        create: fighter.items.map((item: GameItem) => ({
          defId: item.defId,
          quality: item.quality,
          area: item.area,
          x: item.x,
          y: item.y,
        })),
      },
    },
    include: { items: true },
  })
}

type PendingResult = {
  wins: number
  losses: number
  goldCompensation: number
}

function createPendingResults(participants: ActiveDogfightParticipant[]) {
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

async function createDogfightBattle(tx: Tx, room: DogfightRoom, participantA: ActiveDogfightParticipant, participantB: ActiveDogfightParticipant | null, opponent: FighterSnapshot, pending: Map<string, PendingResult>) {
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

function hasRun(participant: DogfightParticipantWithRun): participant is ActiveDogfightParticipant {
  return Boolean(participant.run && participant.runId)
}

async function ensureParticipantRun(tx: Tx, room: DogfightRoom, participant: DogfightParticipantWithRun, choice = seededDogChoice(participantSeed(room.id, participant))) {
  if (participant.runId) return participant.run
  const ownerId = participant.userId ?? room.hostUserId
  const run = await createDogfightRun(tx, ownerId, choice, participantSeed(room.id, participant))
  await tx.dogfightParticipant.update({
    where: { id: participant.id },
    data: { runId: run.id },
  })
  return run
}

async function enterShopIfDogSelectionComplete(tx: Tx, roomId: string, force = false) {
  const room = await tx.dogfightRoom.findUnique({ where: { id: roomId }, include: dogfightRoomInclude })
  if (!room || room.status !== 'ACTIVE' || roomPhase(room) !== 'DOG_SELECT') return
  const deadlinePassed = Boolean(room.phaseDeadline && room.phaseDeadline.getTime() <= Date.now())
  const playerSeats = room.participants.filter((participant) => participant.kind !== 'BOT')
  const allPlayersSelected = playerSeats.every((participant) => participant.runId)
  if (!force && !deadlinePassed && !allPlayersSelected) return

  for (const participant of room.participants) {
    await ensureParticipantRun(tx, room, participant)
  }
  await tx.dogfightParticipant.updateMany({ where: { roomId }, data: { ready: false } })
  await tx.dogfightRoom.update({
    where: { id: roomId },
    data: {
      phase: 'SHOP',
      phaseDeadline: deadlineFromNow(DOGFIGHT_SHOP_MS),
      readyDeadline: deadlineFromNow(DOGFIGHT_SHOP_MS),
    },
  })
}

async function settleShopToBattle(tx: Tx, roomId: string, force = false) {
  const room = await tx.dogfightRoom.findUnique({ where: { id: roomId }, include: dogfightRoomInclude })
  if (!room || room.status !== 'ACTIVE' || roomPhase(room) !== 'SHOP') return
  if (room.battles.some((battle) => battle.round === room.currentRound)) return

  const alive = room.participants.filter((participant) => !participant.eliminated)
  if (alive.length <= 1) {
    await tx.dogfightRoom.update({ where: { id: room.id }, data: { status: 'COMPLETE', phase: 'COMPLETE', phaseDeadline: null, readyDeadline: null, winnerParticipantId: alive[0]?.id ?? null } })
    return
  }

  const deadlinePassed = Boolean(room.phaseDeadline && room.phaseDeadline.getTime() <= Date.now())
  const activePlayers = alive.filter((participant) => participant.kind !== 'BOT')
  const allPlayersReady = activePlayers.every((participant) => participant.ready)
  if (!force && !deadlinePassed && !allPlayersReady) return

  for (const participant of alive) {
    if (!hasRun(participant)) {
      await ensureParticipantRun(tx, room, participant)
    }
  }

  let refreshed = await tx.dogfightRoom.findUniqueOrThrow({ where: { id: roomId }, include: dogfightRoomInclude })
  const normalizedIds = refreshed.participants.filter(hasRun).filter((participant) => !participant.eliminated)
  for (const participant of normalizedIds) {
    const botSynced = await syncBotRunForBattle(tx, participant)
    const run = participant.kind === 'BOT' ? botSynced : participant.run
    await normalizeRunForDogfightBattle(tx, run)
  }

  refreshed = await tx.dogfightRoom.findUniqueOrThrow({ where: { id: roomId }, include: dogfightRoomInclude })
  const activeParticipants = refreshed.participants.filter(hasRun).filter((participant) => !participant.eliminated)
  const pending = createPendingResults(activeParticipants)

  if (refreshed.currentRound < DOGFIGHT_TRAINING_ROUNDS) {
    for (const participant of activeParticipants) {
      const opponent = seedGhost(refreshed.currentRound, participant.run.wins, participant.run.losses, `${refreshed.id}-${refreshed.currentRound}-${participant.id}-training`)
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
        : seedGhost(refreshed.currentRound, participantA.run.wins, participantA.run.losses, `${refreshed.id}-${refreshed.currentRound}-${participantA.id}-bye`)
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
    const phaseData = eliminated ? { phase: 'COMPLETE' } : nextDogfightPhaseData({ ...participant.run, losses }, nextRound)
    const postBattleReward = eliminated
      ? null
      : postBattleLargeItemReward(toGameItems(participant.run.items), `${participant.runId}-dogfight-post-battle-${nextRound}-${wins}-${losses}`)

    if (!eliminated) survivingIds.push(participant.id)

    await tx.run.update({
      where: { id: participant.runId! },
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
        ...(postBattleReward ? { items: { create: postBattleReward } } : {}),
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
      status: complete ? 'COMPLETE' : 'ACTIVE',
      phase: complete ? 'COMPLETE' : 'BATTLE',
      phaseDeadline: complete ? null : deadlineFromNow(DOGFIGHT_BATTLE_MS),
      readyDeadline: null,
      winnerParticipantId,
    },
  })
  if (winnerParticipantId) {
    const winner = activeParticipants.find((participant) => participant.id === winnerParticipantId)
    if (winner) {
      await tx.run.update({ where: { id: winner.runId! }, data: { status: 'DOGFIGHT_COMPLETE', phase: 'COMPLETE' } })
    }
  }
}

async function enterNextShopAfterBattle(tx: Tx, roomId: string, force = false) {
  const room = await tx.dogfightRoom.findUnique({ where: { id: roomId }, include: dogfightRoomInclude })
  if (!room || room.status !== 'ACTIVE' || roomPhase(room) !== 'BATTLE') return
  const deadlinePassed = Boolean(room.phaseDeadline && room.phaseDeadline.getTime() <= Date.now())
  if (!force && !deadlinePassed) return

  const alive = room.participants.filter((participant) => !participant.eliminated)
  if (alive.length <= 1) {
    await tx.dogfightRoom.update({ where: { id: room.id }, data: { status: 'COMPLETE', phase: 'COMPLETE', phaseDeadline: null, readyDeadline: null, winnerParticipantId: alive[0]?.id ?? null } })
    return
  }
  await tx.dogfightRoom.update({
    where: { id: room.id },
    data: {
      currentRound: room.currentRound + 1,
      phase: 'SHOP',
      phaseDeadline: deadlineFromNow(DOGFIGHT_SHOP_MS),
      readyDeadline: deadlineFromNow(DOGFIGHT_SHOP_MS),
    },
  })
}

async function advanceDogfightRoomIfNeeded(roomId: string) {
  await prisma.$transaction(async (tx) => {
    await enterShopIfDogSelectionComplete(tx, roomId)
    await settleShopToBattle(tx, roomId)
    await enterNextShopAfterBattle(tx, roomId)
  })
}

async function advanceExpiredDogfightRoomsForLobby() {
  const expiredRooms = await prisma.dogfightRoom.findMany({
    where: {
      status: 'ACTIVE',
      phaseDeadline: { lte: new Date() },
    },
    select: { id: true },
    take: 50,
  })
  for (const room of expiredRooms) {
    await advanceDogfightRoomIfNeeded(room.id)
  }
}

async function createRoomForUser(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const name = playerName(user)
  const room = await prisma.$transaction(async (tx) => {
    const createdRoom = await tx.dogfightRoom.create({
      data: {
        hostUserId: userId,
        maxPlayers: DOGFIGHT_TARGET_PLAYERS,
        targetPlayerCount: DOGFIGHT_TARGET_PLAYERS,
        phase: 'LOBBY',
      },
    })
    await tx.dogfightParticipant.create({
      data: {
        roomId: createdRoom.id,
        userId,
        runId: null,
        nickname: name,
        kind: 'PLAYER',
        isHost: true,
      },
    })
    await cleanupDuplicateWaitingRoomsForUser(tx, userId, createdRoom.id)
    return createdRoom
  })
  return loadDogfightRoom(room.id)
}

async function joinRoomForUser(roomId: string, userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const name = playerName(user)
  const room = await prisma.$transaction(async (tx) => {
    const currentRoom = await tx.dogfightRoom.findUnique({ where: { id: roomId }, include: { participants: true } })
    if (!currentRoom) {
      const error = new Error('Dogfight room not found') as Error & { statusCode: number }
      error.statusCode = 404
      throw error
    }
    if (currentRoom.status !== 'WAITING' || roomPhase(currentRoom) !== 'LOBBY') {
      const error = new Error('Dogfight room has already started') as Error & { statusCode: number }
      error.statusCode = 400
      throw error
    }
    const playerCount = currentRoom.participants.filter((participant) => participant.kind !== 'BOT').length
    if (playerCount >= currentRoom.maxPlayers) {
      const error = new Error('Dogfight room is full') as Error & { statusCode: number }
      error.statusCode = 400
      throw error
    }
    if (currentRoom.participants.some((participant) => participant.userId === userId)) return currentRoom

    await tx.dogfightParticipant.create({
      data: {
        roomId,
        userId,
        runId: null,
        nickname: name,
        kind: 'PLAYER',
        isHost: false,
      },
    })
    return currentRoom
  })
  return loadDogfightRoom(room.id)
}

async function deleteRoomIfNoHumanPlayers(tx: Tx, roomId: string) {
  const remaining = await tx.dogfightParticipant.findMany({ where: { roomId }, orderBy: { createdAt: 'asc' } })
  const humanPlayers = remaining.filter((participant) => participant.kind !== 'BOT' && participant.userId)
  if (humanPlayers.length > 0) {
    const host = humanPlayers.find((participant) => participant.isHost) ?? humanPlayers[0]
    await tx.dogfightParticipant.updateMany({ where: { roomId, kind: { not: 'BOT' } }, data: { isHost: false } })
    await tx.dogfightParticipant.update({ where: { id: host.id }, data: { isHost: true } })
    await tx.dogfightRoom.update({ where: { id: roomId }, data: { hostUserId: host.userId! } })
    return false
  }

  const botRunIds = remaining
    .filter((participant) => participant.kind === 'BOT' && participant.runId)
    .map((participant) => participant.runId!)
  if (botRunIds.length > 0) {
    await tx.run.deleteMany({ where: { id: { in: botRunIds } } })
  }
  await tx.dogfightRoom.delete({ where: { id: roomId } })
  return true
}

async function cleanupDuplicateWaitingRoomsForUser(tx: Tx, userId: string, keepRoomId?: string) {
  const memberships = await tx.dogfightParticipant.findMany({
    where: {
      userId,
      room: { is: { status: 'WAITING', phase: 'LOBBY' } },
    },
    include: { room: true },
  })
  const ordered = memberships
    .slice()
    .sort((left, right) =>
      right.room.updatedAt.getTime() - left.room.updatedAt.getTime()
      || right.createdAt.getTime() - left.createdAt.getTime()
    )
  const retainedRoomId = keepRoomId ?? ordered[0]?.roomId ?? null

  for (const participant of ordered) {
    if (participant.roomId === retainedRoomId) continue
    await tx.dogfightParticipant.delete({ where: { id: participant.id } })
    await deleteRoomIfNoHumanPlayers(tx, participant.roomId)
  }
}

async function leaveRoomForUser(roomId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const room = await tx.dogfightRoom.findUnique({ where: { id: roomId }, include: { participants: true } })
    if (!room) return { found: false, deleted: false }
    const participant = room.participants.find((entry) => entry.userId === userId)
    if (!participant) return { found: true, deleted: false }

    if (room.status === 'ACTIVE' && participant.runId) {
      await tx.run.update({
        where: { id: participant.runId },
        data: { status: 'DOGFIGHT_ABANDONED', phase: 'COMPLETE', matchedGhost: null, lastBattle: null },
      })
    }
    await tx.dogfightParticipant.delete({ where: { id: participant.id } })
    const deleted = await deleteRoomIfNoHumanPlayers(tx, roomId)
    return { found: true, deleted }
  })
}

async function fillBotsAndStart(room: DogfightRoomWithDetails) {
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.dogfightRoom.findUniqueOrThrow({ where: { id: room.id }, include: dogfightRoomInclude })
    const botSlots = Math.max(0, fresh.targetPlayerCount - fresh.participants.length)
    const usedNames = new Set(fresh.participants.map((participant) => participant.nickname))
    for (let index = 0; index < botSlots; index += 1) {
      let nickname = offlineFighterName(`${fresh.id}-bot-${index}`)
      let attempt = 1
      while (usedNames.has(nickname)) {
        nickname = offlineFighterName(`${fresh.id}-bot-${index}-${attempt}`)
        attempt += 1
      }
      usedNames.add(nickname)
      const participant = await tx.dogfightParticipant.create({
        data: {
          roomId: fresh.id,
          userId: null,
          runId: null,
          nickname,
          kind: 'BOT',
          isHost: false,
        },
      })
      const choice = seededDogChoice(participantSeed(fresh.id, participant))
      const run = await createDogfightRun(tx, fresh.hostUserId, choice, participantSeed(fresh.id, participant))
      await tx.dogfightParticipant.update({ where: { id: participant.id }, data: { runId: run.id } })
    }
    await tx.dogfightRoom.update({
      where: { id: fresh.id },
      data: {
        status: 'ACTIVE',
        phase: 'DOG_SELECT',
        currentRound: 0,
        phaseDeadline: deadlineFromNow(DOGFIGHT_DOG_SELECT_MS),
        readyDeadline: null,
      },
    })
  })
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
    await advanceExpiredDogfightRoomsForLobby()
    await prisma.$transaction((tx) => cleanupDuplicateWaitingRoomsForUser(tx, userId))
    const rooms = await prisma.dogfightRoom.findMany({
      where: { status: { in: ['WAITING', 'ACTIVE'] } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 30,
      include: dogfightRoomInclude,
    })
    return { rooms: rooms.map((room) => publicDogfightRoomSummary(room, userId)) }
  })

  app.post('/api/dogfight/rooms', async (request, reply) => {
    const userId = requireUser(request.userId)
    const room = await createRoomForUser(userId)
    if (!room) return reply.code(500).send({ error: 'Failed to create dogfight room' })
    return responseFor(room, userId)
  })

  app.post('/api/dogfight/rooms/:roomId/leave', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { roomId } = roomParamsSchema.parse(request.params)
    const result = await leaveRoomForUser(roomId, userId)
    if (!result.found) return reply.code(404).send({ error: 'Dogfight room not found' })
    return { room: null }
  })

  app.post('/api/dogfight/rooms/:roomId/join', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { roomId } = roomParamsSchema.parse(request.params)
    const room = await joinRoomForUser(roomId, userId)
    if (!room) return reply.code(404).send({ error: 'Dogfight room not found' })
    return responseFor(room, userId)
  })

  app.post('/api/dogfight/match', async (request, reply) => {
    const userId = requireUser(request.userId)
    await prisma.$transaction((tx) => cleanupDuplicateWaitingRoomsForUser(tx, userId))
    const rooms = await prisma.dogfightRoom.findMany({
      where: { status: 'WAITING', phase: 'LOBBY' },
      orderBy: { createdAt: 'asc' },
      include: dogfightRoomInclude,
    })
    const openRoom = rooms.find((room) => room.participants.filter((participant) => participant.kind !== 'BOT').length < room.maxPlayers && !room.participants.some((participant) => participant.userId === userId))
    const room = openRoom ? await joinRoomForUser(openRoom.id, userId) : await createRoomForUser(userId)
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
    if (room.status !== 'WAITING' || roomPhase(room) !== 'LOBBY') return reply.code(400).send({ error: 'Dogfight room has already started' })
    if (room.participants.filter((entry) => entry.kind !== 'BOT').length < 2) return reply.code(400).send({ error: 'Dogfight room needs at least 2 players' })
    await fillBotsAndStart(room)
    const updated = await loadDogfightRoom(room.id)
    if (!updated) return reply.code(404).send({ error: 'Dogfight room not found' })
    return responseFor(updated, userId)
  })

  app.post('/api/dogfight/rooms/:roomId/dog-choice', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { roomId } = roomParamsSchema.parse(request.params)
    const choice = validateDogChoice(request.body)
    if (!choice) return reply.code(400).send({ error: 'Invalid dogfight dog choice' })
    await prisma.$transaction(async (tx) => {
      const room = await tx.dogfightRoom.findUnique({ where: { id: roomId }, include: dogfightRoomInclude })
      if (!room) {
        const error = new Error('Dogfight room not found') as Error & { statusCode: number }
        error.statusCode = 404
        throw error
      }
      if (room.status !== 'ACTIVE' || roomPhase(room) !== 'DOG_SELECT') {
        const error = new Error('Dogfight room is not in dog selection') as Error & { statusCode: number }
        error.statusCode = 400
        throw error
      }
      const participant = room.participants.find((entry) => entry.userId === userId)
      if (!participant) {
        const error = new Error('Spectators cannot choose dogs') as Error & { statusCode: number }
        error.statusCode = 403
        throw error
      }
      if (!participant.runId) {
        const run = await createDogfightRun(tx, userId, choice, participantSeed(room.id, participant))
        await tx.dogfightParticipant.update({ where: { id: participant.id }, data: { runId: run.id } })
      }
      await enterShopIfDogSelectionComplete(tx, roomId)
    })
    const updated = await loadDogfightRoom(roomId)
    if (!updated) return reply.code(404).send({ error: 'Dogfight room not found' })
    return responseFor(updated, userId)
  })

  app.get('/api/dogfight/rooms/:roomId', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { roomId } = roomParamsSchema.parse(request.params)
    await advanceDogfightRoomIfNeeded(roomId)
    const room = await loadDogfightRoom(roomId)
    if (!room) return reply.code(404).send({ error: 'Dogfight room not found' })
    return responseFor(room, userId)
  })

  app.post('/api/dogfight/rooms/:roomId/ready', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { roomId } = roomParamsSchema.parse(request.params)
    const room = await prisma.dogfightRoom.findUnique({ where: { id: roomId }, include: dogfightRoomInclude })
    if (!room) return reply.code(404).send({ error: 'Dogfight room not found' })
    if (room.status !== 'ACTIVE' || roomPhase(room) !== 'SHOP') return reply.code(400).send({ error: 'Dogfight room is not in shop phase' })
    const participant = room.participants.find((entry) => entry.userId === userId)
    if (!participant) return reply.code(403).send({ error: 'Spectators cannot ready up' })
    if (participant.eliminated) return reply.code(400).send({ error: 'Eliminated players cannot ready up' })
    if (!participant.runId) return reply.code(400).send({ error: 'Please choose a dog first' })
    await prisma.dogfightParticipant.update({ where: { id: participant.id }, data: { ready: true } })
    await advanceDogfightRoomIfNeeded(roomId)
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
