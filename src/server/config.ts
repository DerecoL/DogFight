export type ServerConfig = {
  jwtSecret: string
  nodeEnv: string
  databaseUrl: string
}

const DEVELOPMENT_JWT_SECRET = 'dog-dice-dev-secret'
const POSTGRESQL_URL_PATTERN = /^postgres(?:ql)?:\/\//

export function shouldRunDestructiveDatabaseTests(env: Pick<NodeJS.ProcessEnv, 'TEST_DATABASE_URL'> = process.env) {
  return POSTGRESQL_URL_PATTERN.test(env.TEST_DATABASE_URL || '')
}

export function resolveServerConfig(env = process.env): ServerConfig {
  const nodeEnv = env.NODE_ENV || 'development'
  const jwtSecret = env.JWT_SECRET || (nodeEnv === 'production' ? '' : DEVELOPMENT_JWT_SECRET)
  const databaseUrl = env.TEST_DATABASE_URL || env.DATABASE_URL || ''

  if (nodeEnv === 'production' && !jwtSecret) {
    throw new Error('JWT_SECRET is required in production')
  }

  if (databaseUrl && !POSTGRESQL_URL_PATTERN.test(databaseUrl)) {
    throw new Error('DATABASE_URL must start with postgresql:// or postgres://')
  }

  return { jwtSecret, nodeEnv, databaseUrl }
}

export function cookieOptionsForEnv(nodeEnv: string) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: nodeEnv === 'production',
    path: '/',
  }
}
