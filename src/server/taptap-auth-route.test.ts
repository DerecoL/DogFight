import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { buildApp } from './app'
import { shouldRunDestructiveDatabaseTests } from './config'
import { prisma } from './db'

const describeWithDatabase = shouldRunDestructiveDatabaseTests() ? describe : describe.skip

describeWithDatabase('TapTap auth route', () => {
  const originalEnv = { ...process.env }
  const fetchFn = vi.fn()
  let app: ReturnType<typeof buildApp>

  beforeAll(async () => {
    process.env.TAPTAP_MINIAPP_ID = 'miniapp-id'
    process.env.TAPTAP_MINIAPP_SECRET = 'miniapp-secret'
    process.env.TAPTAP_MINIAPP_REGION = 'cn'
    vi.stubGlobal('fetch', fetchFn)
    app = buildApp()
    await app.ready()
  })

  beforeEach(async () => {
    fetchFn.mockReset()
    await prisma.userIdentity.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('creates a local user and identity for a TapTap openid', async () => {
    fetchFn.mockResolvedValueOnce(new Response(JSON.stringify({
      openid: 'tap-openid-1',
      unionid: 'tap-union-1',
      session_key: 'tap-session-1',
    }), { status: 200 }))

    const response = await request(app.server)
      .post('/api/auth/taptap')
      .send({ code: 'tap-code-1' })
      .expect(200)

    expect(response.body.user).toMatchObject({
      account: 'taptap:tap-openid-1',
      nickname: null,
    })
    expect(response.body.needsNickname).toBe(true)
    const setCookie = response.headers['set-cookie']
    expect(Array.isArray(setCookie) ? setCookie.join(';') : setCookie).toContain('token=')

    const identity = await prisma.userIdentity.findUniqueOrThrow({
      where: { provider_providerUserId: { provider: 'taptap', providerUserId: 'tap-openid-1' } },
    })
    expect(identity).toMatchObject({
      userId: response.body.user.id,
      unionId: 'tap-union-1',
      sessionKey: 'tap-session-1',
    })
  })

  it('reuses the same local user for repeated TapTap login', async () => {
    fetchFn
      .mockResolvedValueOnce(new Response(JSON.stringify({
        openid: 'tap-openid-2',
        session_key: 'tap-session-2',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        openid: 'tap-openid-2',
        session_key: 'tap-session-3',
      }), { status: 200 }))

    const first = await request(app.server).post('/api/auth/taptap').send({ code: 'tap-code-2a' }).expect(200)
    const second = await request(app.server).post('/api/auth/taptap').send({ code: 'tap-code-2b' }).expect(200)

    expect(second.body.user.id).toBe(first.body.user.id)
    await expect(prisma.user.count()).resolves.toBe(1)
    await expect(prisma.userIdentity.count()).resolves.toBe(1)
  })

  it('returns unauthorized when TapTap rejects the login code', async () => {
    fetchFn.mockResolvedValueOnce(new Response(JSON.stringify({
      errcode: 1040029,
      errmsg: 'invalid code',
    }), { status: 200 }))

    const response = await request(app.server)
      .post('/api/auth/taptap')
      .send({ code: 'bad-code' })
      .expect(401)

    expect(response.body.error).toBe('TapTap 登录失败，请重试')
    await expect(prisma.user.count()).resolves.toBe(0)
  })
})
