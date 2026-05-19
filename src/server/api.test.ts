import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { buildApp } from './app'
import { prisma } from './db'

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''
const describeWithDatabase = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://') ? describe : describe.skip
const app = buildApp()

beforeEach(async () => {
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
  it('requires newly registered players to set a valid nickname before first play', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await request(app.server).post('/api/profile/nickname').send({ nickname: '游客' }).expect(401)

    const email = `nickname${Date.now()}@dog.test`
    const registered = await agent.post('/api/auth/register').send({ email, password: 'dogdice' }).expect(200)
    expect(registered.body.needsNickname).toBe(true)
    expect(registered.body.user).toMatchObject({ email, nickname: null })

    await agent.post('/api/profile/nickname').send({ nickname: ' ' }).expect(400)

    const updated = await agent.post('/api/profile/nickname').send({ nickname: '  猛犬教练  ' }).expect(200)
    expect(updated.body.user).toMatchObject({ email, nickname: '猛犬教练' })

    const me = await agent.get('/api/me').expect(200)
    expect(me.body.user).toMatchObject({ email, nickname: '猛犬教练' })
  })

  it('returns a clear conflict when registering an existing email', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    const email = `duplicate${Date.now()}@dog.test`
    await agent.post('/api/auth/register').send({ email, password: 'dogdice' }).expect(200)

    const duplicate = await agent.post('/api/auth/register').send({ email, password: 'dogdice' }).expect(409)
    expect(duplicate.body.error).toContain('邮箱已注册')
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
    expect(created.body.run.shopItems.every((offer: { quality: string }) => offer.quality === 'BRONZE')).toBe(true)
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

    const firstRelic = relicChoice.body.run.relicChoices[0].relicId
    const selected = await agent.post(`/api/runs/${runId}/relic/select`).send({ relicId: firstRelic }).expect(200)
    expect(selected.body.run.phase).toBe('PREP')
    expect(selected.body.run.relics).toContainEqual(expect.objectContaining({ relicId: firstRelic, quality: 'SILVER' }))

    await prisma.run.update({ where: { id: runId }, data: { phase: 'RELIC_CHOICE', relicChoices: JSON.stringify([firstRelic]) } })
    const upgraded = await agent.post(`/api/runs/${runId}/relic/select`).send({ relicId: firstRelic }).expect(200)
    expect(upgraded.body.run.relics).toContainEqual(expect.objectContaining({ relicId: firstRelic, quality: 'GOLD' }))
  })
})
