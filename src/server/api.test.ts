import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { buildApp } from './app'
import { shouldRunDestructiveDatabaseTests } from './config'
import { prisma } from './db'
import { nextQuality } from './game/quality'
import { endActiveSeason } from './seasons'

const describeWithDatabase = shouldRunDestructiveDatabaseTests() ? describe : describe.skip
const app = buildApp()

beforeEach(async () => {
  await prisma.dogfightBattle.deleteMany()
  await prisma.dogfightParticipant.deleteMany()
  await prisma.dogfightRoom.deleteMany()
  await prisma.seasonPlayerSummary.deleteMany()
  await prisma.ladderSettlement.deleteMany()
  await prisma.ladderProfile.deleteMany()
  await prisma.apexEntry.deleteMany()
  await prisma.battleLog.deleteMany()
  await prisma.ghostSnapshot.deleteMany()
  await prisma.itemInstance.deleteMany()
  await prisma.run.deleteMany()
  await prisma.userIdentity.deleteMany()
  await prisma.user.deleteMany()
  await prisma.season.deleteMany()
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describeWithDatabase('run API', () => {
  async function createAuthenticatedRun(dogType = 'SHIBA') {
    const agent = request.agent(app.server)
    await app.ready()
    await agent.post('/api/auth/register').send({ account: `map-${Date.now()}-${Math.random()}`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType }).expect(200)
    return { agent, run: created.body.run }
  }

  it('starts new casual runs on the exploration map', async () => {
    const { run } = await createAuthenticatedRun()
    expect(run.phase).toBe('MAP')
    expect(run.mapState.nodes.length).toBeGreaterThanOrEqual(20)
    expect(run.mapState.nodes.length).toBeLessThanOrEqual(40)
    expect(run.mapState.availableNodeIds.length).toBeGreaterThanOrEqual(2)
    expect(run.mapState.availableNodeIds.length).toBeLessThanOrEqual(3)
  })

  it('routes equipment shop map nodes into equipment-only shop choices', async () => {
    const { agent, run } = await createAuthenticatedRun()
    const map = run.mapState
    const equipmentNode = map.nodes.find((node: { kind: string; layer: number }) => node.kind === 'SHOP_EQUIPMENT' && node.layer > 0)
    expect(equipmentNode).toBeTruthy()
    const previous = map.nodes.find((node: { nextNodeIds: string[] }) => node.nextNodeIds.includes(equipmentNode.id))
    expect(previous).toBeTruthy()
    await prisma.run.update({ where: { id: run.id }, data: { mapState: JSON.stringify({ ...map, completedNodeIds: [previous.id], currentNodeId: null }) } })

    const selected = await agent.post(`/api/runs/${run.id}/map/select`).send({ nodeId: equipmentNode.id }).expect(200)
    expect(selected.body.run.phase).toBe('CHOICE')
    expect(selected.body.run.choices).toHaveLength(3)
    expect(selected.body.run.choices.every((choice: string) => ['GENERAL', 'LARGE', 'MEDIUM', 'SMALL', 'SMALL_DICE', 'BIG_DICE'].includes(choice))).toBe(true)
  })

  it('rest map nodes restore one consumed tolerance', async () => {
    const { agent, run } = await createAuthenticatedRun()
    const map = run.mapState
    const restNode = map.nodes.find((node: { kind: string; layer: number }) => node.kind === 'REST' && node.layer > 0)
    expect(restNode).toBeTruthy()
    const previous = map.nodes.find((node: { nextNodeIds: string[] }) => node.nextNodeIds.includes(restNode.id))
    await prisma.run.update({ where: { id: run.id }, data: { losses: 2, mapState: JSON.stringify({ ...map, completedNodeIds: [previous.id], currentNodeId: null }) } })

    const selected = await agent.post(`/api/runs/${run.id}/map/select`).send({ nodeId: restNode.id }).expect(200)
    expect(selected.body.run.phase).toBe('MAP')
    expect(selected.body.run.losses).toBe(1)
  })

  it('monster map battles do not change wins or losses after finish', async () => {
    const { agent, run } = await createAuthenticatedRun()
    const map = run.mapState
    const monsterNode = map.nodes.find((node: { kind: string; layer: number }) => node.kind === 'MONSTER_BATTLE' && node.layer === 0)
    const matched = await agent.post(`/api/runs/${run.id}/map/select`).send({ nodeId: monsterNode.id }).expect(200)
    expect(matched.body.run.phase).toBe('MATCH')
    await agent.post(`/api/runs/${run.id}/battle/start`).send({}).expect(200)
    const finished = await agent.post(`/api/runs/${run.id}/battle/finish`).send({}).expect(200)
    expect(finished.body.run.wins).toBe(run.wins)
    expect(finished.body.run.losses).toBe(run.losses)
    expect(finished.body.run.phase).toBe('MAP')
  })

  it('registers and logs in with an account instead of requiring an email address', async () => {
    const registering = request.agent(app.server)
    const loggingIn = request.agent(app.server)
    await app.ready()

    const account = `player-${Date.now()}`
    const registered = await registering.post('/api/auth/register').send({ account, password: 'dogdice' }).expect(200)
    expect(registered.body.user).toMatchObject({ account, nickname: null })
    expect(registered.body.user).not.toHaveProperty('email')

    const loggedIn = await loggingIn.post('/api/auth/login').send({ account, password: 'dogdice' }).expect(200)
    expect(loggedIn.body.user).toMatchObject({ account, nickname: null })

    const duplicate = await request(app.server).post('/api/auth/register').send({ account, password: 'dogdice' }).expect(409)
    expect(duplicate.body.error).toContain('账号已注册')
  })

  it('requires newly registered players to set a valid nickname before first play', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await request(app.server).post('/api/profile/nickname').send({ nickname: '游客' }).expect(401)

    const account = `nickname-${Date.now()}`
    const registered = await agent.post('/api/auth/register').send({ account, password: 'dogdice' }).expect(200)
    expect(registered.body.needsNickname).toBe(true)
    expect(registered.body.user).toMatchObject({ account, nickname: null })

    await agent.post('/api/profile/nickname').send({ nickname: ' ' }).expect(400)

    const updated = await agent.post('/api/profile/nickname').send({ nickname: '  猛犬教练  ' }).expect(200)
    expect(updated.body.user).toMatchObject({ account, nickname: '猛犬教练' })

    const me = await agent.get('/api/me').expect(200)
    expect(me.body.user).toMatchObject({ account, nickname: '猛犬教练' })
  })

  it('returns a clear conflict when registering an existing account', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    const account = `duplicate-${Date.now()}`
    await agent.post('/api/auth/register').send({ account, password: 'dogdice' }).expect(200)

    const duplicate = await agent.post('/api/auth/register').send({ account, password: 'dogdice' }).expect(409)
    expect(duplicate.body.error).toContain('账号已注册')
  })

  it('uses saved nicknames for player ghosts and battle snapshots', async () => {
    const first = request.agent(app.server)
    const second = request.agent(app.server)
    await app.ready()

    await first.post('/api/auth/register').send({ email: `ghost${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    await first.post('/api/profile/nickname').send({ nickname: '猛犬教练' }).expect(200)
    const firstRun = await first.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    await prisma.run.update({ where: { id: firstRun.body.run.id }, data: { round: 2 } })
    await first.post(`/api/runs/${firstRun.body.run.id}/battle/match`).send({}).expect(200)

    await second.post('/api/auth/register').send({ email: `challenger${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    await second.post('/api/profile/nickname').send({ nickname: '挑战者' }).expect(200)
    const secondRun = await second.post('/api/runs').send({ dogType: 'MUTT' }).expect(200)
    await prisma.run.update({ where: { id: secondRun.body.run.id }, data: { round: 2 } })

    const matched = await second.post(`/api/runs/${secondRun.body.run.id}/battle/match`).send({}).expect(200)
    expect(matched.body.run.matchedGhost.name).toBe('猛犬教练')

    const battled = await second.post(`/api/runs/${secondRun.body.run.id}/battle/start`).send({}).expect(200)
    expect(battled.body.battle.playerSnapshot.name).toBe('挑战者')
    expect(battled.body.battle.opponentSnapshot.name).toBe('猛犬教练')
  })

  it('prefers weaker non-self ghosts for casual matchmaking', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    const account = `match-relief-${Date.now()}`
    const registered = await agent.post('/api/auth/register').send({ account, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    await prisma.run.update({
      where: { id: runId },
      data: { round: 6, wins: 5, losses: 1 },
    })

    await prisma.ghostSnapshot.createMany({
      data: [
        {
          runId: 'self-old-run',
          userId: registered.body.user.id,
          name: 'Self Old Ghost',
          dogType: 'BULLY',
          round: 6,
          wins: 4,
          losses: 1,
          gold: 0,
          items: '[]',
          relics: '[]',
          seed: 'self-old',
        },
        {
          runId: 'same-win-run',
          userId: 'other-user-same',
          name: 'Same Wins Ghost',
          dogType: 'SAMOYED',
          round: 6,
          wins: 5,
          losses: 1,
          gold: 0,
          items: '[]',
          relics: '[]',
          seed: 'same-win',
        },
        {
          runId: 'lower-win-run',
          userId: 'other-user-lower',
          name: 'Lower Wins Ghost',
          dogType: 'MUTT',
          round: 6,
          wins: 4,
          losses: 1,
          gold: 0,
          items: '[]',
          relics: '[]',
          seed: 'lower-win',
        },
      ],
    })

    const matched = await agent.post(`/api/runs/${runId}/battle/match`).send({}).expect(200)

    expect(matched.body.run.matchedGhost).toMatchObject({
      ghostId: expect.any(String),
      name: 'Lower Wins Ghost',
      wins: 4,
    })
  })

  it('avoids immediately rematching the same ghost when another close ghost exists', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    const account = `rematch-relief-${Date.now()}`
    await agent.post('/api/auth/register').send({ account, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    await prisma.run.update({
      where: { id: runId },
      data: { round: 6, wins: 5, losses: 1 },
    })

    await prisma.ghostSnapshot.createMany({
      data: [
        {
          runId: 'near-run-a',
          userId: 'other-user-a',
          name: '风衣阿麦',
          dogType: 'MUTT',
          round: 6,
          wins: 4,
          losses: 1,
          gold: 0,
          items: '[]',
          relics: '[]',
          seed: 'near-a',
        },
        {
          runId: 'near-run-b',
          userId: 'other-user-b',
          name: '夜市阿航',
          dogType: 'BULLY',
          round: 6,
          wins: 4,
          losses: 1,
          gold: 0,
          items: '[]',
          relics: '[]',
          seed: 'near-b',
        },
      ],
    })

    const first = await agent.post(`/api/runs/${runId}/battle/match`).send({}).expect(200)
    const second = await agent.post(`/api/runs/${runId}/battle/match`).send({}).expect(200)

    expect(second.body.run.matchedGhost.ghostId).toBeTruthy()
    expect(second.body.run.matchedGhost.ghostId).not.toBe(first.body.run.matchedGhost.ghostId)
  })

  it('uses offline training opponents for the first two rounds even when real ghosts exist', async () => {
    const first = request.agent(app.server)
    const second = request.agent(app.server)
    await app.ready()

    await first.post('/api/auth/register').send({ email: `earlyghost${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const firstRun = await first.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    await first.post(`/api/runs/${firstRun.body.run.id}/battle/match`).send({}).expect(200)

    await second.post('/api/auth/register').send({ email: `earlychallenger${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const secondRun = await second.post('/api/runs').send({ dogType: 'MUTT' }).expect(200)

    const matched = await second.post(`/api/runs/${secondRun.body.run.id}/battle/match`).send({}).expect(200)
    expect(matched.body.run.matchedGhost.ghostId).toBeNull()
    expect(matched.body.run.matchedGhost.items).toHaveLength(3)
    expect(matched.body.run.matchedGhost.items.every((item: { defId: string; quality: string }) =>
      item.defId.startsWith('starter-') && item.quality === 'BRONZE',
    )).toBe(true)
  })

  it('supports register, create run, buy, match, and battle', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    const email = `p${Date.now()}@dog.test`
    await agent.post('/api/auth/register').send({ email, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    expect(created.body.run.gold).toBe(10)
    expect(created.body.run.items).toHaveLength(6)
    expect(created.body.run.items.every((item: { quality: string }) => item.quality === 'BRONZE')).toBe(true)
    expect(created.body.run.shopItems.every((offer: { quality: string }) => ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'].includes(offer.quality))).toBe(true)
    expect(created.body.run.phase).toBe('SHOP')

    const affordable = created.body.run.shopItems.find((offer: { price: number }) => offer.price <= created.body.run.gold)
    expect(affordable).toBeTruthy()
    const offerId = affordable.offerId
    const bought = await agent.post(`/api/runs/${created.body.run.id}/shop/buy`).send({ offerId, area: 'BAG' }).expect(200)
    expect(bought.body.run.items.length).toBe(7)
    expect(bought.body.run.items.at(-1).quality).toBe('BRONZE')

    const matched = await agent.post(`/api/runs/${created.body.run.id}/battle/match`).send({}).expect(200)
    expect(matched.body.run.phase).toBe('MATCH')
    expect(matched.body.run.matchedGhost.name).toBeTruthy()

    const battled = await agent.post(`/api/runs/${created.body.run.id}/battle/start`).send({}).expect(200)
    expect(battled.body.battle.events.length).toBeGreaterThan(0)
    expect(battled.body.run).toMatchObject({
      phase: 'BATTLE',
      round: 0,
      wins: matched.body.run.wins,
      losses: matched.body.run.losses,
      gold: bought.body.run.gold,
    })

    const finished = await agent.post(`/api/runs/${created.body.run.id}/battle/finish`).send({}).expect(200)
    expect(['SHOP', 'CHOICE', 'COMPLETE']).toContain(finished.body.run.phase)
    expect(finished.body.run.round).toBe(1)
    expect(finished.body.run.gold).toBe(bought.body.run.gold + 7)
  })

  it('keeps casual runs active until the fifth loss', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `loss-limit${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    const losingBattle = {
      winner: 'opponent',
      duration: 1,
      playerHp: 0,
      opponentHp: 1,
      playerMaxHp: 10,
      opponentMaxHp: 10,
      events: [],
      playerSnapshot: { name: 'P', dogType: 'SHIBA', wins: 0, losses: 3, round: 4, items: [] },
      opponentSnapshot: { name: 'O', dogType: 'MUTT', wins: 0, losses: 0, round: 4, items: [] },
    }

    await prisma.run.update({
      where: { id: runId },
      data: { losses: 3, round: 4, phase: 'BATTLE', lastBattle: JSON.stringify(losingBattle) },
    })

    const fourthLoss = await agent.post(`/api/runs/${runId}/battle/finish`).send({}).expect(200)
    expect(fourthLoss.body.run).toMatchObject({ losses: 4, status: 'ACTIVE' })

    await prisma.run.update({
      where: { id: runId },
      data: { phase: 'BATTLE', lastBattle: JSON.stringify({ ...losingBattle, playerSnapshot: { ...losingBattle.playerSnapshot, losses: 4, round: 5 } }) },
    })

    const fifthLoss = await agent.post(`/api/runs/${runId}/battle/finish`).send({}).expect(200)
    expect(fifthLoss.body.run).toMatchObject({ losses: 5, status: 'COMPLETE', phase: 'COMPLETE' })
  })

  it('settles a casual active run at the current record without adding a loss', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ account: `forfeit-casual-${Date.now()}`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'MUTT' }).expect(200)
    const runId = created.body.run.id

    await prisma.run.update({
      where: { id: runId },
      data: {
        wins: 4,
        losses: 2,
        round: 6,
        gold: 23,
        phase: 'CHOICE',
        status: 'ACTIVE',
        matchedGhost: JSON.stringify({ name: 'Pending Opponent' }),
      },
    })

    const settled = await agent.post(`/api/runs/${runId}/settle`).send({}).expect(200)

    expect(settled.body.run).toMatchObject({
      id: runId,
      mode: 'CASUAL',
      wins: 4,
      losses: 2,
      round: 6,
      gold: 23,
      status: 'COMPLETE',
      phase: 'COMPLETE',
      matchedGhost: null,
      ladderSettlement: null,
    })

    const history = await agent.get('/api/runs/history').expect(200)
    expect(history.body.history).toMatchObject({
      completedRuns: 1,
      abandonedRuns: 0,
      totalWins: 4,
      totalLosses: 2,
    })
  })

  it('settles a ladder active run at the current record and updates the ladder profile', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ account: `forfeit-ladder-${Date.now()}`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA', mode: 'LADDER' }).expect(200)
    const runId = created.body.run.id

    await prisma.run.update({
      where: { id: runId },
      data: {
        wins: 7,
        losses: 2,
        round: 9,
        phase: 'PREP',
        status: 'ACTIVE',
      },
    })

    const settled = await agent.post(`/api/runs/${runId}/settle`).send({}).expect(200)

    expect(settled.body.run).toMatchObject({
      id: runId,
      mode: 'LADDER',
      wins: 7,
      losses: 2,
      round: 9,
      status: 'COMPLETE',
      phase: 'COMPLETE',
      ladderSettlement: {
        beforeTier: 'BRONZE',
        beforeScore: 0,
        afterTier: 'BRONZE',
        afterScore: 6,
        delta: 6,
        rawDelta: 6,
        baseScore: 8,
        tierTax: 0,
        lossPenalty: 2,
        perfectBonus: 0,
        wins: 7,
        losses: 2,
      },
    })

    const ladder = await agent.get('/api/ladder/me').expect(200)
    expect(ladder.body.profile).toMatchObject({
      tier: 'BRONZE',
      score: 6,
      gamesPlayed: 1,
      totalWins: 7,
      totalLosses: 2,
    })
    expect(ladder.body.recentSettlements[0]).toMatchObject({
      afterTier: 'BRONZE',
      afterScore: 6,
      delta: 6,
      rawDelta: 6,
      baseScore: 8,
      tierTax: 0,
      lossPenalty: 2,
      perfectBonus: 0,
      wins: 7,
      losses: 2,
    })
  })

  it('rejects settling a run while battle playback is waiting to finish', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ account: `forfeit-battle-${Date.now()}`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    const battle = {
      winner: 'opponent',
      duration: 1,
      playerHp: 0,
      opponentHp: 1,
      playerMaxHp: 10,
      opponentMaxHp: 10,
      events: [],
      playerSnapshot: { name: 'P', dogType: 'SHIBA', wins: 2, losses: 1, round: 3, items: [] },
      opponentSnapshot: { name: 'O', dogType: 'MUTT', wins: 2, losses: 1, round: 3, items: [] },
    }

    await prisma.run.update({
      where: { id: runId },
      data: { wins: 2, losses: 1, round: 3, phase: 'BATTLE', status: 'ACTIVE', lastBattle: JSON.stringify(battle) },
    })

    const rejected = await agent.post(`/api/runs/${runId}/settle`).send({}).expect(400)
    expect(rejected.body.error).toContain('当前战斗已经生成结果，请先继续完成战斗结算')

    const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } })
    expect(run).toMatchObject({ status: 'ACTIVE', phase: 'BATTLE', wins: 2, losses: 1, round: 3 })
  })

  it('rolls back ladder forfeit completion when settlement creation fails', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    const registered = await agent.post('/api/auth/register').send({ account: `forfeit-rollback-${Date.now()}`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA', mode: 'LADDER' }).expect(200)
    const runId = created.body.run.id
    const profile = await prisma.ladderProfile.findUniqueOrThrow({
      where: { userId_seasonId: { userId: registered.body.user.id, seasonId: 'season-1' } },
    })
    await prisma.ladderSettlement.create({
      data: {
        userId: registered.body.user.id,
        profileId: profile.id,
        runId,
        seasonId: 'season-1',
        beforeTier: 'BRONZE',
        beforeScore: 0,
        afterTier: 'BRONZE',
        afterScore: 0,
        delta: 0,
        rawDelta: 0,
        baseScore: 0,
        tierTax: 0,
        lossPenalty: 0,
        perfectBonus: 0,
        newbieProtection: 0,
        wins: 0,
        losses: 0,
      },
    })

    await agent.post(`/api/runs/${runId}/settle`).send({}).expect(500)

    const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } })
    expect(run).toMatchObject({
      status: 'ACTIVE',
      phase: 'SHOP',
    })
  })

  it('rejects settling a run that is already complete', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ account: `forfeit-complete-${Date.now()}`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SAMOYED' }).expect(200)
    const runId = created.body.run.id

    await prisma.run.update({
      where: { id: runId },
      data: {
        wins: 3,
        losses: 1,
        phase: 'COMPLETE',
        status: 'COMPLETE',
      },
    })

    const rejected = await agent.post(`/api/runs/${runId}/settle`).send({}).expect(400)

    expect(rejected.body.error).toContain('当前跑局已经结算或不可放弃')
  })

  it('creates ladder runs and settles ladder score when the run completes', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ account: `ladder-${Date.now()}`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA', mode: 'LADDER' }).expect(200)
    expect(created.body.run.mode).toBe('LADDER')

    const winningBattle = {
      winner: 'player',
      duration: 1,
      playerHp: 10,
      opponentHp: 0,
      playerMaxHp: 10,
      opponentMaxHp: 10,
      events: [],
      playerSnapshot: { name: 'P', dogType: 'SHIBA', wins: 11, losses: 0, round: 11, items: [] },
      opponentSnapshot: { name: 'O', dogType: 'MUTT', wins: 11, losses: 0, round: 11, items: [] },
    }

    await prisma.run.update({
      where: { id: created.body.run.id },
      data: { wins: 11, losses: 0, round: 11, phase: 'BATTLE', lastBattle: JSON.stringify(winningBattle) },
    })

    const finished = await agent.post(`/api/runs/${created.body.run.id}/battle/finish`).send({}).expect(200)

    expect(finished.body.run).toMatchObject({
      mode: 'LADDER',
      status: 'COMPLETE',
      ladderSettlement: {
        beforeTier: 'BRONZE',
        beforeScore: 0,
        afterTier: 'BRONZE',
        afterScore: 73,
        delta: 73,
        baseScore: 65,
        perfectBonus: 8,
      },
    })

    const ladder = await agent.get('/api/ladder/me').expect(200)
    expect(ladder.body.season).toMatchObject({ id: 'season-1', name: '赛季 1', status: 'ACTIVE' })
    expect(ladder.body.profile).toMatchObject({
      seasonId: 'season-1',
      tier: 'BRONZE',
      score: 73,
      gamesPlayed: 1,
      totalWins: 12,
      totalLosses: 0,
    })
  })

  it('keeps ladder matchmaking separate from casual ghosts', async () => {
    const casual = request.agent(app.server)
    const ladder = request.agent(app.server)
    await app.ready()

    await casual.post('/api/auth/register').send({ account: `casual-ghost-${Date.now()}`, password: 'dogdice' }).expect(200)
    const casualRun = await casual.post('/api/runs').send({ dogType: 'SAMOYED' }).expect(200)
    await prisma.run.update({ where: { id: casualRun.body.run.id }, data: { round: 4, wins: 3, mode: 'CASUAL' } })
    await casual.post(`/api/runs/${casualRun.body.run.id}/battle/match`).send({}).expect(200)

    await ladder.post('/api/auth/register').send({ account: `ladder-match-${Date.now()}`, password: 'dogdice' }).expect(200)
    const ladderRun = await ladder.post('/api/runs').send({ dogType: 'MUTT', mode: 'LADDER' }).expect(200)
    await prisma.run.update({ where: { id: ladderRun.body.run.id }, data: { round: 4, wins: 3, mode: 'LADDER' } })

    const matched = await ladder.post(`/api/runs/${ladderRun.body.run.id}/battle/match`).send({}).expect(200)

    expect(matched.body.run.mode).toBe('LADDER')
    expect(matched.body.run.matchedGhost.ghostId).toBeNull()
    expect(matched.body.run.matchedGhost.name).not.toBe('玩家')
  })

  it('returns the current player history across multiple runs', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    const email = `history${Date.now()}@dog.test`
    await agent.post('/api/auth/register').send({ email, password: 'dogdice' }).expect(200)

    const first = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    await prisma.run.update({
      where: { id: first.body.run.id },
      data: {
        wins: 8,
        losses: 2,
        round: 10,
        phase: 'CHOICE',
        status: 'COMPLETE',
        relics: JSON.stringify([{ id: 'history-relic', relicId: 'midas-left', quality: 'BRONZE', slot: 0 }]),
      },
    })

    const second = await agent.post('/api/runs').send({ dogType: 'MUTT' }).expect(200)
    await prisma.run.update({
      where: { id: second.body.run.id },
      data: { wins: 3, losses: 1, round: 4, phase: 'SHOP', status: 'ACTIVE' },
    })

    const history = await agent.get('/api/runs/history').expect(200)

    expect(history.body.history).toMatchObject({
      totalRuns: 2,
      activeRuns: 1,
      completedRuns: 1,
      totalWins: 11,
      totalLosses: 3,
      bestRun: {
        id: first.body.run.id,
        wins: 8,
        losses: 2,
        status: 'COMPLETE',
      },
    })
    expect(history.body.history.recentRuns.map((run: { id: string }) => run.id)).toContain(first.body.run.id)
    expect(history.body.history.recentRuns.map((run: { id: string }) => run.id)).toContain(second.body.run.id)
    const firstHistoryRun = history.body.history.recentRuns.find((run: { id: string }) => run.id === first.body.run.id)
    expect(firstHistoryRun).toMatchObject({
      mode: 'CASUAL',
      items: expect.arrayContaining([expect.objectContaining({ defId: 'starter-1', def: expect.objectContaining({ name: expect.any(String) }) })]),
      relics: [expect.objectContaining({ relicId: 'midas-left', def: expect.objectContaining({ name: expect.any(String) }) })],
    })
  })

  it('creates dog emperor runs with a saved lucky number', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    const email = `emperor${Date.now()}@dog.test`
    await agent.post('/api/auth/register').send({ email, password: 'dogdice' }).expect(200)

    await agent.post('/api/runs').send({ dogType: 'EMPEROR' }).expect(400)
    await agent.post('/api/runs').send({ dogType: 'EMPEROR', luckyNumber: 7 }).expect(400)

    const created = await agent.post('/api/runs').send({ dogType: 'EMPEROR', luckyNumber: 5 }).expect(200)
    expect(created.body.run).toMatchObject({ dogType: 'EMPEROR', luckyNumber: 5 })

    const matched = await agent.post(`/api/runs/${created.body.run.id}/battle/match`).send({}).expect(200)
    expect(matched.body.run.matchedGhost).toBeTruthy()

    const battled = await agent.post(`/api/runs/${created.body.run.id}/battle/start`).send({}).expect(200)
    expect(battled.body.battle.playerSnapshot).toMatchObject({ dogType: 'EMPEROR', luckyNumber: 5 })
  })

  it('uses strategic offline dogs when no real ghost is available', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `offline${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id

    await prisma.run.update({
      where: { id: runId },
      data: { round: 6, wins: 5, losses: 1, phase: 'SHOP' },
    })

    const matched = await agent.post(`/api/runs/${runId}/battle/match`).send({}).expect(200)
    expect(matched.body.run.matchedGhost.ghostId).toBeNull()
    expect(matched.body.run.matchedGhost.relics.length).toBeGreaterThan(0)
    expect(matched.body.run.matchedGhost.items.some((item: { defId: string }) =>
      ['shiba-', 'samoyed-', 'mutt-', 'bully-', 'emperor-'].some((prefix) => item.defId.startsWith(prefix)),
    )).toBe(true)

    const battled = await agent.post(`/api/runs/${runId}/battle/start`).send({}).expect(200)
    expect(battled.body.battle.opponentSnapshot.items.length).toBeGreaterThan(0)
    expect(battled.body.battle.opponentSnapshot.relics.length).toBeGreaterThan(0)
  })

  it('upgrades matching item copies by click or drag target', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    const email = `u${Date.now()}@dog.test`
    await agent.post('/api/auth/register').send({ email, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'MUTT' }).expect(200)
    const runId = created.body.run.id
    const target = created.body.run.items.find((item: { defId: string }) => item.defId === 'starter-1')
    expect(target).toBeTruthy()

    await prisma.itemInstance.create({ data: { runId, defId: 'starter-1', area: 'BAG', x: 0, y: 0 } })
    const clicked = await agent.post(`/api/runs/${runId}/items/upgrade`).send({ itemId: target.id }).expect(200)
    expect(clicked.body.run.items).toHaveLength(6)
    expect(clicked.body.run.items.find((item: { id: string }) => item.id === target.id)).toMatchObject({ quality: 'SILVER' })

    await prisma.itemInstance.create({ data: { runId, defId: 'starter-1', quality: 'SILVER', area: 'BAG', x: 0, y: 0 } })
    const draggedCopy = await prisma.itemInstance.findFirstOrThrow({ where: { runId, defId: 'starter-1', quality: 'SILVER', NOT: { id: target.id } } })
    const dragged = await agent.post(`/api/runs/${runId}/items/upgrade`).send({ itemId: draggedCopy.id, targetItemId: target.id }).expect(200)
    expect(dragged.body.run.items).toHaveLength(6)
    expect(dragged.body.run.items.find((item: { id: string }) => item.id === target.id)).toMatchObject({ quality: 'GOLD' })
    expect(dragged.body.run.items.some((item: { id: string }) => item.id === draggedCopy.id)).toBe(false)
  })

  it('buys a matching shop item as an immediate upgrade when the bag is full', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `fullbag${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    const offer = { offerId: 'upgrade-small-bite', defId: 'small-bite', price: 3, discount: 1, quality: 'BRONZE' }

    const owned = await prisma.itemInstance.create({
      data: { runId, defId: 'small-bite', quality: 'BRONZE', area: 'EQUIPMENT', x: 6, y: 0 },
    })
    await prisma.itemInstance.createMany({
      data: Array.from({ length: 12 }, (_, x) => ({ runId, defId: 'starter-1', area: 'BAG', x, y: 0 })),
    })
    await prisma.run.update({
      where: { id: runId },
      data: { gold: 10, shopItems: JSON.stringify([offer]) },
    })

    const bought = await agent.post(`/api/runs/${runId}/shop/buy`).send({ offerId: offer.offerId, area: 'BAG' }).expect(200)

    expect(bought.body.run.gold).toBe(7)
    expect(bought.body.run.shopItems).toEqual([])
    expect(bought.body.run.items).toHaveLength(created.body.run.items.length + 13)
    expect(bought.body.run.items.find((item: { id: string }) => item.id === owned.id)).toMatchObject({ quality: 'SILVER' })
    expect(bought.body.run.items.filter((item: { defId: string }) => item.defId === 'small-bite')).toHaveLength(1)
  })

  it('buys a matching shop item into the bag when the bag has room', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `openbag${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    const offer = { offerId: 'buy-small-bite-copy', defId: 'small-bite', price: 3, discount: 1, quality: 'BRONZE' }

    const owned = await prisma.itemInstance.create({
      data: { runId, defId: 'small-bite', quality: 'BRONZE', area: 'EQUIPMENT', x: 6, y: 0 },
    })
    await prisma.run.update({
      where: { id: runId },
      data: { gold: 10, shopItems: JSON.stringify([offer]) },
    })

    const bought = await agent.post(`/api/runs/${runId}/shop/buy`).send({ offerId: offer.offerId, area: 'BAG' }).expect(200)

    expect(bought.body.run.gold).toBe(7)
    expect(bought.body.run.shopItems).toEqual([])
    expect(bought.body.run.items).toHaveLength(created.body.run.items.length + 2)
    expect(bought.body.run.items.find((item: { id: string }) => item.id === owned.id)).toMatchObject({ quality: 'BRONZE' })
    expect(bought.body.run.items).toContainEqual(expect.objectContaining({ defId: 'small-bite', quality: 'BRONZE', area: 'BAG', x: 0, y: 0 }))
    expect(bought.body.run.items.filter((item: { defId: string }) => item.defId === 'small-bite')).toHaveLength(2)
  })

  it('lets fourth-dimensional kennel place one item in the thirteenth equipment slot', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `space${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    const extra = await prisma.itemInstance.create({
      data: { runId, defId: 'starter-1', quality: 'BRONZE', area: 'BAG', x: 0, y: 0 },
    })
    await prisma.itemInstance.createMany({
      data: Array.from({ length: 6 }, (_, index) => ({
        runId,
        defId: 'starter-1',
        quality: 'BRONZE',
        area: 'EQUIPMENT',
        x: index + 6,
        y: 0,
      })),
    })

    await agent.post(`/api/runs/${runId}/items/move`).send({ itemId: extra.id, area: 'EQUIPMENT', x: 12, y: 0 }).expect(400)

    await prisma.run.update({
      where: { id: runId },
      data: { relics: JSON.stringify([{ id: 'space-relic', relicId: 'v3-fourth-dimensional-kennel', quality: 'DIAMOND', slot: 0 }]) },
    })
    const moved = await agent.post(`/api/runs/${runId}/items/move`).send({ itemId: extra.id, area: 'EQUIPMENT', x: 12, y: 0 }).expect(200)

    expect(moved.body.run.items.find((item: { id: string }) => item.id === extra.id)).toMatchObject({
      area: 'EQUIPMENT',
      x: 12,
      y: 0,
    })
  })

  it('replaces covered equipment and moves it into the bag', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `replace${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    const left = created.body.run.items.find((item: { x: number }) => item.x === 0)
    const right = created.body.run.items.find((item: { x: number }) => item.x === 1)
    const moving = await prisma.itemInstance.create({
      data: { runId, defId: 'spiked-collar', quality: 'BRONZE', area: 'BAG', x: 0, y: 0 },
    })

    const moved = await agent.post(`/api/runs/${runId}/items/move`).send({ itemId: moving.id, area: 'EQUIPMENT', x: 0, y: 0 }).expect(200)

    expect(moved.body.run.items.find((item: { id: string }) => item.id === moving.id)).toMatchObject({ area: 'EQUIPMENT', x: 0, y: 0 })
    expect(moved.body.run.items.find((item: { id: string }) => item.id === left.id)).toMatchObject({ area: 'BAG', x: 0, y: 0 })
    expect(moved.body.run.items.find((item: { id: string }) => item.id === right.id)).toMatchObject({ area: 'BAG', x: 1, y: 0 })
  })

  it('replaces every equipment item covered by a large item from left to right', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `replace-large${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    const covered = [0, 1, 2, 3].map((x) => created.body.run.items.find((item: { x: number }) => item.x === x))
    const moving = await prisma.itemInstance.create({
      data: { runId, defId: 'giant-bone', quality: 'BRONZE', area: 'BAG', x: 0, y: 0 },
    })

    const moved = await agent.post(`/api/runs/${runId}/items/move`).send({ itemId: moving.id, area: 'EQUIPMENT', x: 0, y: 0 }).expect(200)

    expect(moved.body.run.items.find((item: { id: string }) => item.id === moving.id)).toMatchObject({ area: 'EQUIPMENT', x: 0, y: 0 })
    for (const [index, item] of covered.entries()) {
      expect(moved.body.run.items.find((entry: { id: string }) => entry.id === item.id)).toMatchObject({ area: 'BAG', x: index, y: 0 })
    }
  })

  it('rejects equipment replacement when the bag cannot hold every covered item', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `replace-full-bag${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    const left = created.body.run.items.find((item: { x: number }) => item.x === 0)
    const right = created.body.run.items.find((item: { x: number }) => item.x === 1)
    await prisma.itemInstance.createMany({
      data: Array.from({ length: 11 }, (_, index) => ({
        runId,
        defId: 'small-bite',
        quality: 'BRONZE',
        area: 'BAG',
        x: index,
        y: 0,
      })),
    })
    const moving = await prisma.itemInstance.create({
      data: { runId, defId: 'spiked-collar', quality: 'BRONZE', area: 'BAG', x: 0, y: 0 },
    })

    const rejected = await agent.post(`/api/runs/${runId}/items/move`).send({ itemId: moving.id, area: 'EQUIPMENT', x: 0, y: 0 }).expect(400)
    const unchanged = await prisma.itemInstance.findMany({ where: { id: { in: [moving.id, left.id, right.id] } } })

    expect(rejected.body.error).toContain('背包空间不足')
    expect(unchanged.find((item) => item.id === moving.id)).toMatchObject({ area: 'BAG', x: 0, y: 0 })
    expect(unchanged.find((item) => item.id === left.id)).toMatchObject({ area: 'EQUIPMENT', x: 0, y: 0 })
    expect(unchanged.find((item) => item.id === right.id)).toMatchObject({ area: 'EQUIPMENT', x: 1, y: 0 })
  })

  it('upgrades matching items when a move lands on an identical item', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `move-upgrade${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    const target = await prisma.itemInstance.create({
      data: { runId, defId: 'small-bite', quality: 'BRONZE', area: 'EQUIPMENT', x: 6, y: 0 },
    })
    const moving = await prisma.itemInstance.create({
      data: { runId, defId: 'small-bite', quality: 'BRONZE', area: 'BAG', x: 0, y: 0 },
    })

    const moved = await agent.post(`/api/runs/${runId}/items/move`).send({ itemId: moving.id, area: 'EQUIPMENT', x: 6, y: 0 }).expect(200)

    expect(moved.body.run.items.find((item: { id: string }) => item.id === target.id)).toMatchObject({ quality: 'SILVER', area: 'EQUIPMENT', x: 6, y: 0 })
    expect(moved.body.run.items.some((item: { id: string }) => item.id === moving.id)).toBe(false)
    expect(moved.body.run.items.filter((item: { defId: string }) => item.defId === 'small-bite')).toHaveLength(1)
  })

  it('inherits the moving item enchantment when drag-upgrading into an unenchanted target', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `move-enchant${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    const target = await prisma.itemInstance.create({
      data: { runId, defId: 'small-bite', quality: 'BRONZE', area: 'EQUIPMENT', x: 6, y: 0 },
    })
    const moving = await prisma.itemInstance.create({
      data: {
        runId,
        defId: 'small-bite',
        quality: 'BRONZE',
        area: 'BAG',
        x: 0,
        y: 0,
        enchant: JSON.stringify({ kind: 'BASE_EFFECT', effect: 'SHIELD', amount: 11, label: 'moving enchant' }),
      },
    })

    const moved = await agent.post(`/api/runs/${runId}/items/move`).send({ itemId: moving.id, area: 'EQUIPMENT', x: 6, y: 0 }).expect(200)

    expect(moved.body.run.items.find((item: { id: string }) => item.id === target.id)).toMatchObject({
      quality: 'SILVER',
      enchant: { effect: 'SHIELD', amount: 11 },
    })
    expect(moved.body.run.items.some((item: { id: string }) => item.id === moving.id)).toBe(false)
  })

  it('rejects upgrades for mismatched, max-quality, or cross-user items', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    const email = `r${Date.now()}@dog.test`
    await agent.post('/api/auth/register').send({ email, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    const first = created.body.run.items[0]
    const second = created.body.run.items[1]

    await agent.post(`/api/runs/${runId}/items/upgrade`).send({ itemId: first.id, targetItemId: second.id }).expect(400)

    const diamond = await prisma.itemInstance.update({ where: { id: first.id }, data: { quality: 'DIAMOND' } })
    await prisma.itemInstance.create({ data: { runId, defId: diamond.defId, quality: 'DIAMOND', area: 'BAG', x: 0, y: 0 } })
    await agent.post(`/api/runs/${runId}/items/upgrade`).send({ itemId: diamond.id }).expect(400)

    const other = request.agent(app.server)
    await other.post('/api/auth/register').send({ email: `other${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    await other.post(`/api/runs/${runId}/items/upgrade`).send({ itemId: second.id }).expect(404)
  })

  it('runs class reward before round 3 shop choice and places the selected item in the bag', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `class${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    await prisma.run.update({
      where: { id: runId },
      data: { round: 2, phase: 'MATCH', matchedGhost: JSON.stringify({ name: 'O', dogType: 'MUTT', wins: 0, losses: 0, round: 2, items: [] }) },
    })

    const battled = await agent.post(`/api/runs/${runId}/battle/start`).send({}).expect(200)
    expect(battled.body.run).toMatchObject({ round: 2, phase: 'BATTLE' })

    const finished = await agent.post(`/api/runs/${runId}/battle/finish`).send({}).expect(200)
    expect(finished.body.run).toMatchObject({ round: 3, phase: 'CLASS_REWARD' })
    expect(finished.body.run.classRewardChoices.map((choice: { defId: string }) => choice.defId)).toEqual([
      'shiba-speed-katana',
      'shiba-great-katana',
      'shiba-swallow-katana',
    ])

    const selected = await agent.post(`/api/runs/${runId}/class-reward/select`).send({ defId: 'shiba-speed-katana' }).expect(200)
    expect(selected.body.run.phase).toBe('CHOICE')
    expect(selected.body.run.items.find((item: { defId: string }) => item.defId === 'shiba-speed-katana')).toMatchObject({
      area: 'BAG',
      quality: 'GOLD',
    })
  })

  it('selects a free enchantment and applies it to a chosen item', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `enchant${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'MUTT' }).expect(200)
    const runId = created.body.run.id
    const targetItem = created.body.run.items[0]
    const choices = [
      {
        id: 'choice-shield',
        description: '触发时获得 11 点护盾。',
        enchant: { kind: 'BASE_EFFECT', effect: 'SHIELD', amount: 11, label: '触发时获得11护盾' },
      },
    ]
    await prisma.run.update({ where: { id: runId }, data: { round: 4, phase: 'ENCHANT_CHOICE', enchantChoices: JSON.stringify(choices) } })

    const selected = await agent.post(`/api/runs/${runId}/enchant/select`).send({ enchantId: 'choice-shield', itemId: targetItem.id }).expect(200)

    expect(selected.body.run.phase).toBe('CHOICE')
    expect(selected.body.run.enchantChoices).toEqual([])
    expect(selected.body.run.items.find((item: { id: string }) => item.id === targetItem.id).enchant).toMatchObject({
      kind: 'BASE_EFFECT',
      effect: 'SHIELD',
      amount: 11,
    })
  })

  it('keeps the target item enchantment when upgrading and discards the consumed enchantment', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `enchant-upgrade${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    const target = created.body.run.items[0]
    await prisma.itemInstance.update({
      where: { id: target.id },
      data: { enchant: JSON.stringify({ kind: 'BASE_EFFECT', effect: 'DAMAGE', amount: 10, label: 'target enchant' }) },
    })
    const consumed = await prisma.itemInstance.create({
      data: {
        runId,
        defId: target.defId,
        quality: target.quality,
        area: 'BAG',
        x: 0,
        y: 0,
        enchant: JSON.stringify({ kind: 'BASE_EFFECT', effect: 'HEAL', amount: 12, label: 'consumed enchant' }),
      },
    })

    const upgraded = await agent.post(`/api/runs/${runId}/items/upgrade`).send({ itemId: consumed.id, targetItemId: target.id }).expect(200)

    const item = upgraded.body.run.items.find((entry: { id: string }) => entry.id === target.id)
    expect(item).toMatchObject({ quality: 'SILVER', enchant: { effect: 'DAMAGE', amount: 10 } })
    expect(upgraded.body.run.items.some((entry: { id: string }) => entry.id === consumed.id)).toBe(false)
  })

  it('inherits the consumed item enchantment when the upgrade target has none', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `consumed-enchant${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    const target = created.body.run.items[0]
    const consumed = await prisma.itemInstance.create({
      data: {
        runId,
        defId: target.defId,
        quality: target.quality,
        area: 'BAG',
        x: 0,
        y: 0,
        enchant: JSON.stringify({ kind: 'BASE_EFFECT', effect: 'HEAL', amount: 12, label: 'consumed enchant' }),
      },
    })

    const upgraded = await agent.post(`/api/runs/${runId}/items/upgrade`).send({ itemId: consumed.id, targetItemId: target.id }).expect(200)

    const item = upgraded.body.run.items.find((entry: { id: string }) => entry.id === target.id)
    expect(item).toMatchObject({ quality: 'SILVER', enchant: { effect: 'HEAL', amount: 12 } })
    expect(upgraded.body.run.items.some((entry: { id: string }) => entry.id === consumed.id)).toBe(false)
  })

  it('supports relic shop choice, free relic selection, direct PREP, and duplicate relic upgrades', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `relic${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'MUTT' }).expect(200)
    const runId = created.body.run.id
    await prisma.run.update({ where: { id: runId }, data: { round: 4, phase: 'CHOICE', choices: JSON.stringify(['RELIC']) } })

    const relicChoice = await agent.post(`/api/runs/${runId}/choice/select`).send({ shopType: 'RELIC' }).expect(200)
    expect(relicChoice.body.run).toMatchObject({ phase: 'RELIC_CHOICE', shopType: 'RELIC' })
    expect(relicChoice.body.run.relicChoices).toHaveLength(3)

    const firstRelicChoice = relicChoice.body.run.relicChoices.find((choice: { quality: string }) => choice.quality !== 'DIAMOND')
      ?? { relicId: 'midas-left', quality: 'SILVER' }
    const firstRelic = firstRelicChoice.relicId
    await prisma.run.update({ where: { id: runId }, data: { relicChoices: JSON.stringify([firstRelic]) } })
    const selected = await agent.post(`/api/runs/${runId}/relic/select`).send({ relicId: firstRelic }).expect(200)
    expect(selected.body.run.phase).toBe('PREP')
    expect(selected.body.run.relics).toContainEqual(expect.objectContaining({ relicId: firstRelic, quality: firstRelicChoice.quality }))

    await prisma.run.update({ where: { id: runId }, data: { phase: 'RELIC_CHOICE', relicChoices: JSON.stringify([firstRelic]) } })
    const upgraded = await agent.post(`/api/runs/${runId}/relic/select`).send({ relicId: firstRelic }).expect(200)
    expect(upgraded.body.run.relics).toContainEqual(expect.objectContaining({ relicId: firstRelic, quality: nextQuality(firstRelicChoice.quality) }))
  })

  it('supports tiered upgrade shop choice and upgrades one eligible item for free', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `upgrade-shop${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'MUTT' }).expect(200)
    const runId = created.body.run.id
    const target = created.body.run.items[0]
    await prisma.run.update({ where: { id: runId }, data: { round: 4, phase: 'CHOICE', choices: JSON.stringify(['UPGRADE_SILVER']), gold: 13 } })

    const upgradeChoice = await agent.post(`/api/runs/${runId}/choice/select`).send({ shopType: 'UPGRADE_SILVER' }).expect(200)
    expect(upgradeChoice.body.run).toMatchObject({ phase: 'UPGRADE_CHOICE', shopType: 'UPGRADE_SILVER', gold: 13 })

    const upgraded = await agent.post(`/api/runs/${runId}/upgrade/select`).send({ itemId: target.id }).expect(200)
    expect(upgraded.body.run.phase).toBe('PREP')
    expect(upgraded.body.run.gold).toBe(13)
    expect(upgraded.body.run.items).toHaveLength(created.body.run.items.length)
    expect(upgraded.body.run.items.find((item: { id: string }) => item.id === target.id)).toMatchObject({
      quality: 'SILVER',
    })
  })

  it('rejects items at or above the selected upgrade shop tier', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `upgrade-tier-reject${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'MUTT' }).expect(200)
    const runId = created.body.run.id
    const target = created.body.run.items[0]
    await prisma.itemInstance.update({ where: { id: target.id }, data: { quality: 'GOLD' } })
    await prisma.run.update({ where: { id: runId }, data: { phase: 'UPGRADE_CHOICE', shopType: 'UPGRADE_GOLD' } })

    const rejected = await agent.post(`/api/runs/${runId}/upgrade/select`).send({ itemId: target.id }).expect(400)

    expect(rejected.body.error).toBe('当前升级商店不能升级该品质装备')
  })

  it('skips an upgrade shop with no eligible items and completes the current map node', async () => {
    const { agent, run } = await createAuthenticatedRun()
    const map = run.mapState
    const node = map.nodes.find((entry: { kind: string }) => entry.kind === 'SHOP_FIXED') ?? map.nodes[0]
    await prisma.run.update({
      where: { id: run.id },
      data: {
        phase: 'UPGRADE_CHOICE',
        shopType: 'UPGRADE_SILVER',
        mapState: JSON.stringify({ ...map, currentNodeId: node.id }),
      },
    })
    await prisma.itemInstance.updateMany({ where: { runId: run.id }, data: { quality: 'SILVER' } })

    const skipped = await agent.post(`/api/runs/${run.id}/upgrade/skip`).send({}).expect(200)

    expect(skipped.body.run.phase).toBe('MAP')
    expect(skipped.body.run.mapState.currentNodeId).toBeNull()
    expect(skipped.body.run.mapState.completedNodeIds).toContain(node.id)
    expect(skipped.body.run.items.every((item: { quality: string }) => item.quality === 'SILVER')).toBe(true)
  })

  it('supports potion shop choice and applies a concrete potion to a non-class item', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `potion-shop${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'MUTT' }).expect(200)
    const runId = created.body.run.id
    const target = created.body.run.items[0]
    await prisma.run.update({ where: { id: runId }, data: { round: 4, phase: 'CHOICE', choices: JSON.stringify(['POTION']) } })

    const potionChoice = await agent.post(`/api/runs/${runId}/choice/select`).send({ shopType: 'POTION' }).expect(200)
    expect(potionChoice.body.run).toMatchObject({ phase: 'POTION_CHOICE', shopType: 'POTION' })
    expect(potionChoice.body.run.potionChoices).toHaveLength(3)

    const selectedPotion = potionChoice.body.run.potionChoices[0]
    const selected = await agent.post(`/api/runs/${runId}/potion/select`).send({ potionId: selectedPotion.id, itemId: target.id }).expect(200)

    expect(selected.body.run.phase).toBe('PREP')
    expect(selected.body.run.items.find((item: { id: string }) => item.id === target.id).triggerDiceOverride).toEqual(expect.arrayContaining(selectedPotion.dice))
  })

  it('rejects applying potions to boom counter because it only triggers by count', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `potion-boom${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'MUTT' }).expect(200)
    const runId = created.body.run.id
    const target = created.body.run.items[0]
    await prisma.itemInstance.update({ where: { id: target.id }, data: { defId: 'v4-boom-counter' } })
    await prisma.run.update({ where: { id: runId }, data: { round: 4, phase: 'CHOICE', choices: JSON.stringify(['POTION']) } })

    const potionChoice = await agent.post(`/api/runs/${runId}/choice/select`).send({ shopType: 'POTION' }).expect(200)
    const selectedPotion = potionChoice.body.run.potionChoices[0]
    const selected = await agent.post(`/api/runs/${runId}/potion/select`).send({ potionId: selectedPotion.id, itemId: target.id }).expect(400)

    expect(selected.body.error).toBe('Boom counter can only trigger by count')
  })

  it('rejects upgrade shop selection for diamond, cross-user, or wrong-phase items', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `upgrade-reject${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    const target = created.body.run.items[0]

    await agent.post(`/api/runs/${runId}/upgrade/select`).send({ itemId: target.id }).expect(400)

    await prisma.run.update({ where: { id: runId }, data: { phase: 'UPGRADE_CHOICE' } })
    await prisma.itemInstance.update({ where: { id: target.id }, data: { quality: 'DIAMOND' } })
    await agent.post(`/api/runs/${runId}/upgrade/select`).send({ itemId: target.id }).expect(400)

    const other = request.agent(app.server)
    await other.post('/api/auth/register').send({ email: `upgrade-other${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    await other.post(`/api/runs/${runId}/upgrade/select`).send({ itemId: target.id }).expect(404)
  })

  it('sells owned relics for zero gold and compacts the remaining relic slots', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ account: `sell-relic-${Date.now()}`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'MUTT' }).expect(200)
    const runId = created.body.run.id
    await prisma.run.update({
      where: { id: runId },
      data: {
        gold: 7,
        phase: 'PREP',
        relics: JSON.stringify([
          { id: 'keep-left', relicId: 'midas-left', quality: 'BRONZE', slot: 0 },
          { id: 'sell-middle', relicId: 'half-die-left', quality: 'SILVER', slot: 1 },
          { id: 'keep-right', relicId: 'midas-right', quality: 'GOLD', slot: 2 },
        ]),
      },
    })

    const sold = await agent.post(`/api/runs/${runId}/relic/sell`).send({ relicId: 'sell-middle' }).expect(200)

    expect(sold.body.run.gold).toBe(7)
    expect(sold.body.run.relics.map((relic: { id: string }) => relic.id)).toEqual(['keep-left', 'keep-right'])
    expect(sold.body.run.relics.map((relic: { slot: number }) => relic.slot)).toEqual([0, 1])
  })

  it('lists apex seeds and submits any completed run to overall and daily boards once', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `apex${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    await agent.post('/api/profile/nickname').send({ nickname: 'Apex Player' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id

    await prisma.run.update({
      where: { id: runId },
      data: { wins: 0, losses: 5, round: 1, phase: 'COMPLETE', status: 'COMPLETE' },
    })

    const overview = await agent.get('/api/apex').expect(200)
    expect(overview.body.season).toMatchObject({ id: 'season-1', name: '赛季 1', status: 'ACTIVE' })
    expect(overview.body.dailyBoardKey).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(overview.body.dailyResetHour).toBe(5)
    expect(overview.body.leaderboards.overall).toHaveLength(50)
    expect(overview.body.leaderboards.daily).toHaveLength(50)
    expect(overview.body.leaderboards.overall[0]).toMatchObject({ rank: 1, isSeed: true, boardType: 'OVERALL', boardKey: 'default', challengeWins: 1 })
    expect(overview.body.leaderboards.daily[0]).toMatchObject({ rank: 1, isSeed: true, boardType: 'DAILY', boardKey: overview.body.dailyBoardKey, challengeWins: 1 })
    expect(overview.body.leaderboards.overall[0].items.length).toBeGreaterThan(0)
    expect(overview.body.leaderboards.overall[0].items[0].def).toMatchObject({ name: expect.any(String) })
    expect(overview.body.leaderboards.overall[0].relics.length).toBeGreaterThan(0)
    expect(overview.body.leaderboards.overall[0].relics[0].def).toMatchObject({ name: expect.any(String) })
    expect(overview.body.candidates.map((run: { id: string }) => run.id)).toContain(runId)

    const submitted = await agent.post('/api/apex/submit').send({ runId }).expect(200)
    expect(submitted.body.season).toMatchObject({ id: 'season-1' })
    expect(submitted.body.entries.overall).toMatchObject({ sourceRunId: runId, isSeed: false, boardType: 'OVERALL', boardKey: 'default', name: expect.stringContaining('Apex Player'), challengeWins: 1 })
    expect(submitted.body.entries.daily).toMatchObject({ sourceRunId: runId, isSeed: false, boardType: 'DAILY', boardKey: overview.body.dailyBoardKey, name: expect.stringContaining('Apex Player'), challengeWins: 1 })
    expect(submitted.body.entries.overall.items.length).toBeGreaterThan(0)
    expect(submitted.body.entries.overall.items[0].def).toMatchObject({ name: expect.any(String) })
    expect(submitted.body.reports.overall.battles.length).toBeGreaterThan(0)
    expect(submitted.body.reports.daily.battles.length).toBeGreaterThan(0)
    expect(submitted.body.leaderboards.overall).toHaveLength(51)
    expect(submitted.body.leaderboards.daily).toHaveLength(51)
    expect(submitted.body.leaderboards.overall[0]).toMatchObject({ isSeed: true, challengeWins: 2 })
    expect(submitted.body.leaderboards.daily[0]).toMatchObject({ isSeed: true, challengeWins: 2 })
    expect(submitted.body.leaderboards.overall.find((entry: { sourceRunId: string }) => entry.sourceRunId === runId)).toMatchObject({ isMine: true })
    expect(submitted.body.leaderboards.daily.find((entry: { sourceRunId: string }) => entry.sourceRunId === runId)).toMatchObject({ isMine: true })

    const afterSubmit = await agent.get('/api/apex').expect(200)
    expect(afterSubmit.body.candidates.map((run: { id: string }) => run.id)).not.toContain(runId)
    expect(afterSubmit.body.leaderboards.overall.find((entry: { sourceRunId: string }) => entry.sourceRunId === runId)).toMatchObject({ isMine: true })
    expect(afterSubmit.body.leaderboards.overall.find((entry: { isSeed: boolean }) => entry.isSeed)).toMatchObject({ isMine: false })
    await agent.post('/api/apex/submit').send({ runId }).expect(409)
  })

  it('lists completed ladder runs as apex candidates and removes them after submission', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ account: `apex-ladder-${Date.now()}`, password: 'dogdice' }).expect(200)
    const casual = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const ladder = await agent.post('/api/runs').send({ dogType: 'MUTT', mode: 'LADDER' }).expect(200)
    const casualRunId = casual.body.run.id
    const ladderRunId = ladder.body.run.id

    await prisma.run.updateMany({
      where: { id: { in: [casualRunId, ladderRunId] } },
      data: { wins: 6, losses: 2, round: 8, phase: 'COMPLETE', status: 'COMPLETE' },
    })

    const overview = await agent.get('/api/apex').expect(200)
    const candidateIds = overview.body.candidates.map((run: { id: string }) => run.id)
    expect(candidateIds).toContain(casualRunId)
    expect(candidateIds).toContain(ladderRunId)
    expect(overview.body.candidates.find((run: { id: string }) => run.id === ladderRunId)).toMatchObject({
      mode: 'LADDER',
      status: 'COMPLETE',
    })

    await agent.post('/api/apex/submit').send({ runId: ladderRunId }).expect(200)

    const afterSubmit = await agent.get('/api/apex').expect(200)
    expect(afterSubmit.body.candidates.map((run: { id: string }) => run.id)).not.toContain(ladderRunId)
  })

  it('archives season ladder and apex results before opening a reset season', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    const registered = await agent.post('/api/auth/register').send({ account: `season-${Date.now()}`, password: 'dogdice' }).expect(200)
    await agent.post('/api/profile/nickname').send({ nickname: '赛季玩家' }).expect(200)
    await agent.get('/api/ladder/me').expect(200)
    await prisma.ladderProfile.update({
      where: { userId_seasonId: { userId: registered.body.user.id, seasonId: 'season-1' } },
      data: { tier: 'DOG_KING', score: 540, highestTier: 'DOG_KING', gamesPlayed: 3, totalWins: 30, totalLosses: 4 },
    })

    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id
    await prisma.run.update({
      where: { id: runId },
      data: { wins: 12, losses: 0, round: 12, phase: 'COMPLETE', status: 'COMPLETE' },
    })
    await agent.post('/api/apex/submit').send({ runId }).expect(200)

    const ended = await endActiveSeason()
    expect(ended).toMatchObject({
      endedSeason: { id: 'season-1', status: 'ENDED' },
      newSeason: { id: 'season-2', name: '赛季 2', status: 'ACTIVE' },
      archivedPlayers: 1,
    })

    const history = await agent.get('/api/runs/history').expect(200)
    expect(history.body.seasonSummaries[0]).toMatchObject({
      seasonId: 'season-1',
      seasonName: '赛季 1',
      ladderTier: 'DOG_KING',
      ladderScore: 540,
      dogKingRank: 1,
      apexRank: expect.any(Number),
      apexDogType: 'SHIBA',
      apexWins: 12,
      apexSnapshot: { dogType: 'SHIBA', wins: 12, losses: 0 },
    })

    const nextLadder = await agent.get('/api/ladder/me').expect(200)
    expect(nextLadder.body).toMatchObject({
      season: { id: 'season-2', status: 'ACTIVE' },
      profile: { seasonId: 'season-2', tier: 'BRONZE', score: 0, gamesPlayed: 0 },
    })

    const nextApex = await agent.get('/api/apex').expect(200)
    expect(nextApex.body.season).toMatchObject({ id: 'season-2' })
    expect(nextApex.body.candidates.map((run: { id: string }) => run.id)).not.toContain(runId)
  })

  it('refuses to end a season while ladder runs are active unless forced', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ account: `season-active-${Date.now()}`, password: 'dogdice' }).expect(200)
    await agent.post('/api/runs').send({ dogType: 'SHIBA', mode: 'LADDER' }).expect(200)

    await expect(endActiveSeason()).rejects.toThrow('进行中的天梯跑局')
    const forced = await endActiveSeason({ forceAbandonActiveLadder: true })
    expect(forced).toMatchObject({ abandonedActiveLadderRuns: 1, newSeason: { id: 'season-2' } })
  })

  it('creates dogfight rooms as empty seats without abandoning the casual run', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `dogfight-host${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const casual = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)

    const created = await agent.post('/api/dogfight/rooms').send({}).expect(200)
    expect(created.body.room).toMatchObject({
      status: 'WAITING',
      phase: 'LOBBY',
      currentRound: 0,
      maxPlayers: 8,
      targetPlayerCount: 8,
      isHost: true,
      spectator: false,
    })
    expect(created.body.room.members).toHaveLength(1)
    expect(created.body.room.members[0]).toMatchObject({ kind: 'PLAYER', runId: null, dogType: null })
    expect(created.body.room.currentRun).toBeNull()

    const me = await agent.get('/api/me').expect(200)
    expect(me.body.activeRun.id).toBe(casual.body.run.id)
  })

  it('starts dogfight rooms by filling bots to eight and entering synchronized dog selection', async () => {
    const host = request.agent(app.server)
    const guest = request.agent(app.server)
    const spectator = request.agent(app.server)
    await app.ready()

    await host.post('/api/auth/register').send({ email: `dogfight-room-host${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await host.post('/api/dogfight/rooms').send({}).expect(200)
    const roomId = created.body.room.id

    await guest.post('/api/auth/register').send({ email: `dogfight-room-guest${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const joined = await guest.post(`/api/dogfight/rooms/${roomId}/join`).send({}).expect(200)
    expect(joined.body.room.members).toHaveLength(2)

    const nonHostStart = await guest.post(`/api/dogfight/rooms/${roomId}/start`).send({}).expect(403)
    expect(nonHostStart.body.error).toBeTruthy()

    const started = await host.post(`/api/dogfight/rooms/${roomId}/start`).send({}).expect(200)
    expect(started.body.room).toMatchObject({ status: 'ACTIVE', phase: 'DOG_SELECT', targetPlayerCount: 8 })
    expect(started.body.room.members).toHaveLength(8)
    expect(started.body.room.members.filter((member: { kind: string }) => member.kind === 'BOT')).toHaveLength(6)
    expect(started.body.room.members.filter((member: { kind: string; runId: string | null }) => member.kind === 'PLAYER' && member.runId === null)).toHaveLength(2)
    expect(Date.parse(started.body.room.phaseDeadline)).toBeGreaterThan(Date.now())

    await spectator.post('/api/auth/register').send({ email: `dogfight-spectator${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    await spectator.post(`/api/dogfight/rooms/${roomId}/join`).send({}).expect(400)
    const watched = await spectator.get(`/api/dogfight/rooms/${roomId}`).expect(200)
    expect(watched.body.room).toMatchObject({ status: 'ACTIVE', phase: 'DOG_SELECT', spectator: true })
    expect(watched.body.room.currentRun).toBeNull()
  })

  it('random dogfight matching joins an open waiting room before creating a new one', async () => {
    const first = request.agent(app.server)
    const second = request.agent(app.server)
    const third = request.agent(app.server)
    await app.ready()

    await first.post('/api/auth/register').send({ email: `dogfight-random-a${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await first.post('/api/dogfight/match').send({}).expect(200)

    await second.post('/api/auth/register').send({ email: `dogfight-random-b${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const joined = await second.post('/api/dogfight/match').send({}).expect(200)
    expect(joined.body.room.id).toBe(created.body.room.id)
    expect(joined.body.room.members).toHaveLength(2)

    await first.post(`/api/dogfight/rooms/${created.body.room.id}/start`).send({}).expect(200)

    await third.post('/api/auth/register').send({ email: `dogfight-random-c${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const nextRoom = await third.post('/api/dogfight/match').send({}).expect(200)
    expect(nextRoom.body.room.id).not.toBe(created.body.room.id)
    expect(nextRoom.body.room.status).toBe('WAITING')
  })

  it('starts expired waiting dogfight rooms automatically before listing rooms', async () => {
    const host = request.agent(app.server)
    const viewer = request.agent(app.server)
    await app.ready()

    await host.post('/api/auth/register').send({ email: `dogfight-auto-start-host${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await host.post('/api/dogfight/rooms').send({}).expect(200)
    const roomId = created.body.room.id
    await prisma.dogfightRoom.update({
      where: { id: roomId },
      data: { phaseDeadline: new Date(Date.now() - 1_000) },
    })

    await viewer.post('/api/auth/register').send({ email: `dogfight-auto-start-viewer${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const listed = await viewer.get('/api/dogfight/rooms').expect(200)

    const room = listed.body.rooms.find((entry: { id: string }) => entry.id === roomId)
    expect(room).toMatchObject({ status: 'ACTIVE', phase: 'DOG_SELECT', memberCount: 1, aliveCount: 8 })
    await expect(prisma.dogfightRoom.findUniqueOrThrow({ where: { id: roomId }, include: { participants: true } }))
      .resolves.toMatchObject({ status: 'ACTIVE', phase: 'DOG_SELECT', participants: expect.arrayContaining([expect.objectContaining({ kind: 'BOT' })]) })
  })

  it('cleans duplicate waiting dogfight rooms for the same player before listing rooms', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `dogfight-stale-room${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const firstRoom = await agent.post('/api/dogfight/rooms').send({}).expect(200)
    const secondRoom = await agent.post('/api/dogfight/rooms').send({}).expect(200)

    const listed = await agent.get('/api/dogfight/rooms').expect(200)

    expect(listed.body.rooms.map((room: { id: string }) => room.id)).toContain(secondRoom.body.room.id)
    expect(listed.body.rooms.map((room: { id: string }) => room.id)).not.toContain(firstRoom.body.room.id)
    expect(await prisma.dogfightRoom.findUnique({ where: { id: firstRoom.body.room.id } })).toBeNull()
  })

  it('cleans duplicate waiting dogfight rooms for other players before listing rooms', async () => {
    const viewer = request.agent(app.server)
    await app.ready()

    const owner = await prisma.user.create({
      data: { account: `dogfight-other-stale-${Date.now()}`, passwordHash: 'test' },
    })
    const firstRoom = await prisma.dogfightRoom.create({
      data: {
        hostUserId: owner.id,
        status: 'WAITING',
        phase: 'LOBBY',
        participants: { create: { userId: owner.id, nickname: '福字敏', kind: 'PLAYER', isHost: true } },
      },
    })
    const secondRoom = await prisma.dogfightRoom.create({
      data: {
        hostUserId: owner.id,
        status: 'WAITING',
        phase: 'LOBBY',
        participants: { create: { userId: owner.id, nickname: '福字敏', kind: 'PLAYER', isHost: true } },
      },
    })

    await viewer.post('/api/auth/register').send({ email: `dogfight-viewer${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const listed = await viewer.get('/api/dogfight/rooms').expect(200)

    expect(listed.body.rooms.map((room: { id: string }) => room.id)).toContain(secondRoom.id)
    expect(listed.body.rooms.map((room: { id: string }) => room.id)).not.toContain(firstRoom.id)
    expect(await prisma.dogfightRoom.findUnique({ where: { id: firstRoom.id } })).toBeNull()
  })

  it('deletes stale waiting dogfight rooms before listing rooms', async () => {
    const viewer = request.agent(app.server)
    await app.ready()

    const owner = await prisma.user.create({
      data: { account: `dogfight-stale-waiting-${Date.now()}`, passwordHash: 'test' },
    })
    const oldDate = new Date(Date.now() - 20 * 60_000)
    const room = await prisma.dogfightRoom.create({
      data: {
        hostUserId: owner.id,
        status: 'WAITING',
        phase: 'LOBBY',
        createdAt: oldDate,
        updatedAt: oldDate,
        participants: { create: { userId: owner.id, nickname: 'stale-host', kind: 'PLAYER', isHost: true } },
      },
    })

    await viewer.post('/api/auth/register').send({ email: `dogfight-stale-viewer${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const listed = await viewer.get('/api/dogfight/rooms').expect(200)

    expect(listed.body.rooms.map((entry: { id: string }) => entry.id)).not.toContain(room.id)
    expect(await prisma.dogfightRoom.findUnique({ where: { id: room.id } })).toBeNull()
  })

  it('forces very old active dogfight rooms to finish before listing rooms', async () => {
    const viewer = request.agent(app.server)
    const host = request.agent(app.server)
    const guest = request.agent(app.server)
    await app.ready()

    await host.post('/api/auth/register').send({ email: `dogfight-old-active-host${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await host.post('/api/dogfight/rooms').send({}).expect(200)
    const roomId = created.body.room.id
    await guest.post('/api/auth/register').send({ email: `dogfight-old-active-guest${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    await guest.post(`/api/dogfight/rooms/${roomId}/join`).send({}).expect(200)
    await host.post(`/api/dogfight/rooms/${roomId}/start`).send({}).expect(200)

    const oldDate = new Date(Date.now() - 45 * 60_000)
    await prisma.dogfightRoom.update({
      where: { id: roomId },
      data: {
        createdAt: oldDate,
        updatedAt: oldDate,
        phaseDeadline: new Date(Date.now() - 1_000),
      },
    })

    await viewer.post('/api/auth/register').send({ email: `dogfight-old-active-viewer${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const listed = await viewer.get('/api/dogfight/rooms').expect(200)

    expect(listed.body.rooms.map((entry: { id: string }) => entry.id)).not.toContain(roomId)
    await expect(prisma.dogfightRoom.findUniqueOrThrow({ where: { id: roomId } }))
      .resolves.toMatchObject({ status: 'COMPLETE', phase: 'COMPLETE' })
  })

  it('advances expired active dogfight rooms before listing rooms', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    const registered = await agent.post('/api/auth/register').send({ email: `dogfight-expired-room${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const room = await prisma.dogfightRoom.create({
      data: {
        hostUserId: registered.body.user.id,
        status: 'ACTIVE',
        phase: 'BATTLE',
        currentRound: 1,
        phaseDeadline: new Date(Date.now() - 1_000),
        participants: {
          create: {
            userId: registered.body.user.id,
            nickname: '过期房主',
            kind: 'PLAYER',
            isHost: true,
          },
        },
      },
    })

    const listed = await agent.get('/api/dogfight/rooms').expect(200)

    expect(listed.body.rooms.map((entry: { id: string }) => entry.id)).not.toContain(room.id)
    await expect(prisma.dogfightRoom.findUniqueOrThrow({ where: { id: room.id } }))
      .resolves.toMatchObject({ status: 'COMPLETE', phase: 'COMPLETE' })
  })

  it('removes players from dogfight rooms when they leave and deletes empty rooms', async () => {
    const host = request.agent(app.server)
    const guest = request.agent(app.server)
    await app.ready()

    await host.post('/api/auth/register').send({ email: `dogfight-leave-host${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await host.post('/api/dogfight/rooms').send({}).expect(200)
    const roomId = created.body.room.id

    await guest.post('/api/auth/register').send({ email: `dogfight-leave-guest${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    await guest.post(`/api/dogfight/rooms/${roomId}/join`).send({}).expect(200)

    const hostLeft = await host.post(`/api/dogfight/rooms/${roomId}/leave`).send({}).expect(200)
    expect(hostLeft.body.room).toBeNull()

    const guestView = await guest.get(`/api/dogfight/rooms/${roomId}`).expect(200)
    expect(guestView.body.room).toMatchObject({ isHost: true, hostUserId: guestView.body.room.members[0].userId })
    expect(guestView.body.room.members).toHaveLength(1)

    await guest.post(`/api/dogfight/rooms/${roomId}/leave`).send({}).expect(200)
    await guest.get(`/api/dogfight/rooms/${roomId}`).expect(404)
    expect(await prisma.dogfightRoom.findUnique({ where: { id: roomId } })).toBeNull()
  })

  it('abandons an active dogfight run and removes bot data when the last player leaves', async () => {
    const host = request.agent(app.server)
    const guest = request.agent(app.server)
    await app.ready()

    await host.post('/api/auth/register').send({ email: `dogfight-active-leave-host${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await host.post('/api/dogfight/rooms').send({}).expect(200)
    const roomId = created.body.room.id

    await guest.post('/api/auth/register').send({ email: `dogfight-active-leave-guest${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    await guest.post(`/api/dogfight/rooms/${roomId}/join`).send({}).expect(200)
    await host.post(`/api/dogfight/rooms/${roomId}/start`).send({}).expect(200)
    const selected = await host.post(`/api/dogfight/rooms/${roomId}/dog-choice`).send({ dogType: 'SHIBA' }).expect(200)
    const hostRunId = selected.body.room.currentRun.id
    const botRunIds = selected.body.room.members
      .filter((member: { kind: string; runId: string | null }) => member.kind === 'BOT' && member.runId)
      .map((member: { runId: string }) => member.runId)

    await host.post(`/api/dogfight/rooms/${roomId}/leave`).send({}).expect(200)
    const abandoned = await prisma.run.findUniqueOrThrow({ where: { id: hostRunId } })
    expect(abandoned).toMatchObject({ status: 'DOGFIGHT_ABANDONED', phase: 'COMPLETE' })

    await guest.post(`/api/dogfight/rooms/${roomId}/leave`).send({}).expect(200)
    expect(await prisma.dogfightRoom.findUnique({ where: { id: roomId } })).toBeNull()
    expect(await prisma.run.findMany({ where: { id: { in: botRunIds } } })).toEqual([])
  })

  it('starts the next shop timer only after all active players finish the battle round', async () => {
    const agents = [request.agent(app.server), request.agent(app.server), request.agent(app.server)]
    await app.ready()

    for (const [index, agent] of agents.entries()) {
      await agent.post('/api/auth/register').send({ email: `dogfight-shop-timer-${index}-${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    }

    const created = await agents[0].post('/api/dogfight/rooms').send({}).expect(200)
    const roomId = created.body.room.id
    await agents[1].post(`/api/dogfight/rooms/${roomId}/join`).send({}).expect(200)
    await agents[2].post(`/api/dogfight/rooms/${roomId}/join`).send({}).expect(200)
    await agents[0].post(`/api/dogfight/rooms/${roomId}/start`).send({}).expect(200)

    await agents[0].post(`/api/dogfight/rooms/${roomId}/dog-choice`).send({ dogType: 'SHIBA' }).expect(200)
    await agents[1].post(`/api/dogfight/rooms/${roomId}/dog-choice`).send({ dogType: 'SAMOYED' }).expect(200)
    await agents[2].post(`/api/dogfight/rooms/${roomId}/dog-choice`).send({ dogType: 'MUTT' }).expect(200)

    await agents[0].post(`/api/dogfight/rooms/${roomId}/ready`).send({}).expect(200)
    await agents[1].post(`/api/dogfight/rooms/${roomId}/ready`).send({}).expect(200)
    const battleRound = await agents[2].post(`/api/dogfight/rooms/${roomId}/ready`).send({}).expect(200)
    expect(battleRound.body.room).toMatchObject({ phase: 'BATTLE', currentRound: 0, phaseDeadline: null })

    const firstFinished = await agents[0].post(`/api/dogfight/rooms/${roomId}/ready`).send({}).expect(200)
    expect(firstFinished.body.room).toMatchObject({ phase: 'BATTLE', currentRound: 0, phaseDeadline: null })

    const secondFinished = await agents[1].post(`/api/dogfight/rooms/${roomId}/ready`).send({}).expect(200)
    expect(secondFinished.body.room).toMatchObject({ phase: 'BATTLE', currentRound: 0, phaseDeadline: null })

    const nextShop = await agents[2].post(`/api/dogfight/rooms/${roomId}/ready`).send({}).expect(200)
    expect(nextShop.body.room).toMatchObject({ phase: 'SHOP', currentRound: 1 })
    expect(Date.parse(nextShop.body.room.phaseDeadline)).toBeGreaterThan(Date.now())
  })

  it('advances synchronized dogfight phases with dog choices, shop ready, battle viewing, and player-ranked members', async () => {
    const agents = [request.agent(app.server), request.agent(app.server), request.agent(app.server)]
    await app.ready()

    for (const [index, agent] of agents.entries()) {
      await agent.post('/api/auth/register').send({ email: `dogfight-settle-${index}-${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    }

    const created = await agents[0].post('/api/dogfight/rooms').send({}).expect(200)
    const roomId = created.body.room.id
    await agents[1].post(`/api/dogfight/rooms/${roomId}/join`).send({}).expect(200)
    await agents[2].post(`/api/dogfight/rooms/${roomId}/join`).send({}).expect(200)
    await agents[0].post(`/api/dogfight/rooms/${roomId}/start`).send({}).expect(200)

    await agents[0].post(`/api/dogfight/rooms/${roomId}/dog-choice`).send({ dogType: 'SHIBA' }).expect(200)
    await agents[1].post(`/api/dogfight/rooms/${roomId}/dog-choice`).send({ dogType: 'SAMOYED' }).expect(200)
    const selected = await agents[2].post(`/api/dogfight/rooms/${roomId}/dog-choice`).send({ dogType: 'EMPEROR', luckyNumber: 5 }).expect(200)
    expect(selected.body.room.phase).toBe('SHOP')
    expect(selected.body.room.members).toHaveLength(8)
    expect(selected.body.room.members.every((member: { runId: string | null; dogType: string | null }) => member.runId && member.dogType)).toBe(true)
    expect(selected.body.room.currentRun.dogType).toBe('EMPEROR')

    const hostReady = await agents[0].post(`/api/dogfight/rooms/${roomId}/ready`).send({}).expect(200)
    await agents[0].post(`/api/runs/${hostReady.body.room.currentRun.id}/shop/reroll`).send({}).expect(400)
    await agents[1].post(`/api/dogfight/rooms/${roomId}/ready`).send({}).expect(200)
    const battleRound = await agents[2].post(`/api/dogfight/rooms/${roomId}/ready`).send({}).expect(200)
    expect(battleRound.body.room).toMatchObject({ phase: 'BATTLE', currentRound: 0 })
    expect(battleRound.body.room.battles.filter((battle: { round: number; opponentKind: string }) => battle.round === 0 && battle.opponentKind === 'OFFLINE')).toHaveLength(8)
    expect(battleRound.body.room.members.map((member: { losses: number }) => 5 - member.losses)).toEqual([...battleRound.body.room.members.map((member: { losses: number }) => 5 - member.losses)].sort((a, b) => b - a))
    expect(battleRound.body.room.members.find((member: { kind: string; currentBattleId: string | null }) => member.kind === 'BOT' && member.currentBattleId)).toBeTruthy()

    const ownBattleId = battleRound.body.room.currentRunMember.currentBattleId
    const ownBattle = await agents[2].get(`/api/dogfight/battles/${ownBattleId}`).expect(200)
    expect(ownBattle.body.battle.result.playerSnapshot.dogType).toBe('EMPEROR')

    await agents[0].post(`/api/dogfight/rooms/${roomId}/ready`).send({}).expect(200)
    await agents[1].post(`/api/dogfight/rooms/${roomId}/ready`).send({}).expect(200)
    const nextShop = await agents[2].post(`/api/dogfight/rooms/${roomId}/ready`).send({}).expect(200)
    expect(nextShop.body.room).toMatchObject({ phase: 'SHOP', currentRound: 1 })

    await prisma.dogfightRoom.update({ where: { id: roomId }, data: { currentRound: 3, phase: 'SHOP', phaseDeadline: new Date(Date.now() - 1_000) } })
    await prisma.dogfightParticipant.updateMany({ where: { roomId }, data: { ready: false, eliminated: false, eliminatedRound: null } })
    await prisma.run.updateMany({ where: { dogfightParticipant: { roomId } }, data: { round: 3, phase: 'SHOP' } })
    const playerRound = await agents[0].get(`/api/dogfight/rooms/${roomId}`).expect(200)
    expect(playerRound.body.room.phase).toBe('BATTLE')
    expect(playerRound.body.room.battles.some((battle: { round: number; opponentKind: string }) => battle.round === 3 && battle.opponentKind === 'PLAYER')).toBe(true)
  })
})
