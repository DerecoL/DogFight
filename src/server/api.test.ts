import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { buildApp } from './app'
import { prisma } from './db'
import { nextQuality } from './game/quality'

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''
const describeWithDatabase = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://') ? describe : describe.skip
const app = buildApp()

beforeEach(async () => {
  await prisma.dogfightBattle.deleteMany()
  await prisma.dogfightParticipant.deleteMany()
  await prisma.dogfightRoom.deleteMany()
  await prisma.apexEntry.deleteMany()
  await prisma.battleLog.deleteMany()
  await prisma.ghostSnapshot.deleteMany()
  await prisma.itemInstance.deleteMany()
  await prisma.run.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describeWithDatabase('run API', () => {
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

  it('lists apex seeds and submits any completed run once', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `apex${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    await agent.post('/api/profile/nickname').send({ nickname: 'Apex Player' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id

    await prisma.run.update({
      where: { id: runId },
      data: { wins: 4, losses: 3, round: 7, phase: 'COMPLETE', status: 'COMPLETE' },
    })

    const overview = await agent.get('/api/apex').expect(200)
    expect(overview.body.leaderboard).toHaveLength(50)
    expect(overview.body.leaderboard[0]).toMatchObject({ rank: 1, isSeed: true })
    expect(overview.body.leaderboard[0].items.length).toBeGreaterThan(0)
    expect(overview.body.leaderboard[0].items[0].def).toMatchObject({ name: expect.any(String) })
    expect(overview.body.leaderboard[0].relics.length).toBeGreaterThan(0)
    expect(overview.body.leaderboard[0].relics[0].def).toMatchObject({ name: expect.any(String) })
    expect(overview.body.candidates.map((run: { id: string }) => run.id)).toContain(runId)

    const submitted = await agent.post('/api/apex/submit').send({ runId }).expect(200)
    expect(submitted.body.entry).toMatchObject({ sourceRunId: runId, isSeed: false, name: expect.stringContaining('Apex Player') })
    expect(submitted.body.entry.items.length).toBeGreaterThan(0)
    expect(submitted.body.entry.items[0].def).toMatchObject({ name: expect.any(String) })
    expect(submitted.body.report.battles.length).toBeGreaterThan(0)
    expect(submitted.body.leaderboard).toHaveLength(51)

    const afterSubmit = await agent.get('/api/apex').expect(200)
    expect(afterSubmit.body.candidates.map((run: { id: string }) => run.id)).not.toContain(runId)
    await agent.post('/api/apex/submit').send({ runId }).expect(409)
  })

  it('creates dogfight rooms with independent room runs without abandoning the casual run', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `dogfight-host${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const casual = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)

    const created = await agent.post('/api/dogfight/rooms').send({ dogType: 'MUTT' }).expect(200)
    expect(created.body.room).toMatchObject({
      status: 'WAITING',
      currentRound: 0,
      maxPlayers: 8,
      isHost: true,
      spectator: false,
    })
    expect(created.body.room.members).toHaveLength(1)
    expect(created.body.room.currentRun.id).not.toBe(casual.body.run.id)

    const me = await agent.get('/api/me').expect(200)
    expect(me.body.activeRun.id).toBe(casual.body.run.id)
  })

  it('lets players join waiting dogfight rooms, blocks late joins, and allows spectators to read active rooms', async () => {
    const host = request.agent(app.server)
    const guest = request.agent(app.server)
    const spectator = request.agent(app.server)
    await app.ready()

    await host.post('/api/auth/register').send({ email: `dogfight-room-host${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await host.post('/api/dogfight/rooms').send({ dogType: 'SHIBA' }).expect(200)
    const roomId = created.body.room.id

    await guest.post('/api/auth/register').send({ email: `dogfight-room-guest${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const joined = await guest.post(`/api/dogfight/rooms/${roomId}/join`).send({ dogType: 'SAMOYED' }).expect(200)
    expect(joined.body.room.members).toHaveLength(2)

    const nonHostStart = await guest.post(`/api/dogfight/rooms/${roomId}/start`).send({}).expect(403)
    expect(nonHostStart.body.error).toBeTruthy()

    const started = await host.post(`/api/dogfight/rooms/${roomId}/start`).send({}).expect(200)
    expect(started.body.room.status).toBe('ACTIVE')

    await spectator.post('/api/auth/register').send({ email: `dogfight-spectator${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    await spectator.post(`/api/dogfight/rooms/${roomId}/join`).send({ dogType: 'MUTT' }).expect(400)
    const watched = await spectator.get(`/api/dogfight/rooms/${roomId}`).expect(200)
    expect(watched.body.room).toMatchObject({ status: 'ACTIVE', spectator: true })
    expect(watched.body.room.currentRun).toBeNull()
  })

  it('random dogfight matching joins an open waiting room before creating a new one', async () => {
    const first = request.agent(app.server)
    const second = request.agent(app.server)
    const third = request.agent(app.server)
    await app.ready()

    await first.post('/api/auth/register').send({ email: `dogfight-random-a${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await first.post('/api/dogfight/match').send({ dogType: 'SHIBA' }).expect(200)

    await second.post('/api/auth/register').send({ email: `dogfight-random-b${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const joined = await second.post('/api/dogfight/match').send({ dogType: 'BULLY' }).expect(200)
    expect(joined.body.room.id).toBe(created.body.room.id)
    expect(joined.body.room.members).toHaveLength(2)

    await first.post(`/api/dogfight/rooms/${created.body.room.id}/start`).send({}).expect(200)

    await third.post('/api/auth/register').send({ email: `dogfight-random-c${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const nextRoom = await third.post('/api/dogfight/match').send({ dogType: 'MUTT' }).expect(200)
    expect(nextRoom.body.room.id).not.toBe(created.body.room.id)
    expect(nextRoom.body.room.status).toBe('WAITING')
  })

  it('settles dogfight rounds with offline training, player pairings, loss compensation, elimination, and final survivor', async () => {
    const agents = [request.agent(app.server), request.agent(app.server), request.agent(app.server)]
    await app.ready()

    for (const [index, agent] of agents.entries()) {
      await agent.post('/api/auth/register').send({ email: `dogfight-settle-${index}-${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    }

    const created = await agents[0].post('/api/dogfight/rooms').send({ dogType: 'SHIBA' }).expect(200)
    const roomId = created.body.room.id
    await agents[1].post(`/api/dogfight/rooms/${roomId}/join`).send({ dogType: 'SAMOYED' }).expect(200)
    await agents[2].post(`/api/dogfight/rooms/${roomId}/join`).send({ dogType: 'MUTT' }).expect(200)
    await agents[0].post(`/api/dogfight/rooms/${roomId}/start`).send({}).expect(200)

    const openingRoom = await prisma.dogfightRoom.findUniqueOrThrow({ where: { id: roomId }, include: { participants: true } })
    await prisma.itemInstance.deleteMany({ where: { runId: openingRoom.participants[0].runId } })

    await agents[0].post(`/api/dogfight/rooms/${roomId}/ready`).send({}).expect(200)
    await agents[1].post(`/api/dogfight/rooms/${roomId}/ready`).send({}).expect(200)
    const trainingRound = await agents[2].post(`/api/dogfight/rooms/${roomId}/ready`).send({}).expect(200)
    expect(trainingRound.body.room.currentRound).toBe(1)
    expect(trainingRound.body.room.battles.filter((battle: { round: number; opponentKind: string }) => battle.round === 0 && battle.opponentKind === 'OFFLINE')).toHaveLength(3)
    const compensated = trainingRound.body.room.members.find((member: { runId: string }) => member.runId === openingRoom.participants[0].runId)
    expect(compensated).toMatchObject({ losses: 1, gold: 22 })

    const room = await prisma.dogfightRoom.findUniqueOrThrow({ where: { id: roomId }, include: { participants: true } })
    await prisma.dogfightRoom.update({ where: { id: roomId }, data: { currentRound: 3, readyDeadline: new Date(Date.now() - 1_000) } })
    await prisma.dogfightParticipant.updateMany({ where: { roomId }, data: { ready: false, eliminated: false, eliminatedRound: null } })
    await prisma.run.updateMany({ where: { id: { in: room.participants.map((participant) => participant.runId) } }, data: { round: 3, phase: 'SHOP', losses: 4 } })
    await prisma.dogfightParticipant.update({ where: { id: room.participants[0].id }, data: { eliminated: true, eliminatedRound: 3 } })

    const settled = await agents[0].get(`/api/dogfight/rooms/${roomId}`).expect(200)
    expect(settled.body.room.status).toBe('COMPLETE')
    expect(settled.body.room.currentRound).toBe(4)
    expect(settled.body.room.winnerParticipantId).toBeTruthy()
    expect(settled.body.room.battles.some((battle: { round: number; opponentKind: string }) => battle.round === 3 && battle.opponentKind === 'PLAYER')).toBe(true)
  })
})
