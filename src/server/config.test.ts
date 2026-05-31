import { afterEach, describe, expect, it } from 'vitest'
import { cookieOptionsForEnv, resolveServerConfig, shouldRunDestructiveDatabaseTests } from './config'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('server config', () => {
  it('requires an explicit JWT secret in production', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.JWT_SECRET

    expect(() => resolveServerConfig()).toThrow('JWT_SECRET is required in production')
  })

  it('keeps the development JWT fallback outside production', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.JWT_SECRET

    expect(resolveServerConfig()).toMatchObject({
      jwtSecret: 'dog-dice-dev-secret',
      nodeEnv: 'development',
    })
  })

  it('rejects non-PostgreSQL database URLs when configured', () => {
    process.env.DATABASE_URL = 'file:./dev.db'

    expect(() => resolveServerConfig()).toThrow('DATABASE_URL must start with postgresql:// or postgres://')
  })

  it('does not run destructive database tests against the development database URL', () => {
    expect(shouldRunDestructiveDatabaseTests({
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres?schema=public',
    })).toBe(false)
  })

  it('runs destructive database tests only when TEST_DATABASE_URL is explicitly configured', () => {
    expect(shouldRunDestructiveDatabaseTests({
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres?schema=public',
      TEST_DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/dogfight_test?schema=public',
    })).toBe(true)
  })

  it('uses secure http-only cookies in production', () => {
    expect(cookieOptionsForEnv('production')).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    })
  })

  it('reads TapTap miniapp credentials from the environment', () => {
    process.env.TAPTAP_MINIAPP_ID = 'miniapp-id'
    process.env.TAPTAP_MINIAPP_SECRET = 'miniapp-secret'
    process.env.TAPTAP_MINIAPP_REGION = 'io'

    expect(resolveServerConfig().taptap).toEqual({
      appId: 'miniapp-id',
      secret: 'miniapp-secret',
      region: 'io',
    })
  })

  it('defaults TapTap miniapp region to cn when credentials are configured', () => {
    process.env.TAPTAP_MINIAPP_ID = 'miniapp-id'
    process.env.TAPTAP_MINIAPP_SECRET = 'miniapp-secret'
    delete process.env.TAPTAP_MINIAPP_REGION

    expect(resolveServerConfig().taptap?.region).toBe('cn')
  })

  it('rejects unsupported TapTap miniapp regions', () => {
    process.env.TAPTAP_MINIAPP_ID = 'miniapp-id'
    process.env.TAPTAP_MINIAPP_SECRET = 'miniapp-secret'
    process.env.TAPTAP_MINIAPP_REGION = 'us'

    expect(() => resolveServerConfig()).toThrow('TAPTAP_MINIAPP_REGION must be cn or io')
  })
})
