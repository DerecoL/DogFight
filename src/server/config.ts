export type ServerConfig = {
  jwtSecret: string
  nodeEnv: string
  databaseUrl: string
  taptap?: {
    appId: string
    secret: string
    region: 'cn' | 'io'
  }
}

const DEVELOPMENT_JWT_SECRET = 'dog-dice-dev-secret'
const POSTGRESQL_URL_PATTERN = /^postgres(?:ql)?:\/\//
type DatabaseTestEnv = Partial<Pick<NodeJS.ProcessEnv, 'TEST_DATABASE_URL' | 'DATABASE_URL'>>

export function shouldRunDestructiveDatabaseTests(env: DatabaseTestEnv = process.env) {
  return POSTGRESQL_URL_PATTERN.test(env.TEST_DATABASE_URL || '')
}

export function resolveServerConfig(env = process.env): ServerConfig {
  const nodeEnv = env.NODE_ENV || 'development'
  const jwtSecret = env.JWT_SECRET || (nodeEnv === 'production' ? '' : DEVELOPMENT_JWT_SECRET)
  const databaseUrl = env.TEST_DATABASE_URL || env.DATABASE_URL || ''
  const tapTapAppId = env.TAPTAP_MINIAPP_ID?.trim()
  const tapTapSecret = env.TAPTAP_MINIAPP_SECRET?.trim()
  const tapTapRegion = env.TAPTAP_MINIAPP_REGION?.trim() || 'cn'

  if (nodeEnv === 'production' && !jwtSecret) {
    throw new Error('JWT_SECRET is required in production')
  }

  if (databaseUrl && !POSTGRESQL_URL_PATTERN.test(databaseUrl)) {
    throw new Error('DATABASE_URL must start with postgresql:// or postgres://')
  }

  if (tapTapRegion !== 'cn' && tapTapRegion !== 'io') {
    throw new Error('TAPTAP_MINIAPP_REGION must be cn or io')
  }

  const taptap = tapTapAppId && tapTapSecret
    ? { appId: tapTapAppId, secret: tapTapSecret, region: tapTapRegion as 'cn' | 'io' }
    : undefined

  return { jwtSecret, nodeEnv, databaseUrl, taptap }
}

export function cookieOptionsForEnv(nodeEnv: string) {
  return {
    httpOnly: true,
    sameSite: nodeEnv === 'production' ? 'none' as const : 'lax' as const,
    secure: nodeEnv === 'production',
    path: '/',
  }
}
