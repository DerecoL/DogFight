import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')

describe('production deployment assets', () => {
  it('defines Docker Compose services for the app, PostgreSQL, and Caddy', () => {
    const compose = read('compose.yml')

    expect(compose).toContain('postgres:')
    expect(compose).toContain('api:')
    expect(compose).toContain('caddy:')
    expect(compose).toContain('postgres_data:')
  })

  it('routes HTTPS traffic and same-origin API requests through Caddy', () => {
    const caddyfile = read('Caddyfile')

    expect(caddyfile).toContain('reverse_proxy api:4000')
    expect(caddyfile).toContain('root * /srv')
    expect(caddyfile).toContain('handle /assets/*')
    expect(caddyfile).toContain('Cache-Control "public, max-age=604800"')
    expect(caddyfile).toContain('try_files {path} /index.html')
  })

  it('documents production secrets without committing real values', () => {
    const example = read('.env.example')

    expect(example).toContain('DATABASE_URL=postgresql://')
    expect(example).toContain('JWT_SECRET=')
    expect(example).toContain('DOMAIN=')
  })

  it('uses PostgreSQL as the Prisma datasource provider', () => {
    const schema = read('prisma/schema.prisma')

    expect(schema).toContain('provider = "postgresql"')
  })

  it('adds GitHub Actions deployment and server backup scripts', () => {
    const workflow = read('.github/workflows/deploy.yml')
    const backup = read('deploy/backup-postgres.sh')

    expect(workflow).toContain('concurrency:')
    expect(workflow).toContain('group: production-deploy')
    expect(workflow).toContain('cancel-in-progress: false')
    expect(workflow).toContain('tar -czf "$RUNNER_TEMP/dogfight-source.tar.gz"')
    expect(workflow).toContain("--exclude='node_modules'")
    expect(workflow).toContain("--exclude='dist'")
    expect(workflow).toContain("--exclude='dist-click'")
    expect(workflow).toContain("--exclude='.pglite'")
    expect(workflow).toContain('"$RUNNER_TEMP/dogfight-source.tar.gz"')
    expect(workflow).toContain('-o BatchMode=yes')
    expect(workflow).toContain('-o ConnectTimeout=20')
    expect(workflow).toContain('timeout-minutes:')
    expect(workflow).not.toContain('tar -czf dogfight-source.tar.gz')
    expect(workflow).toContain('docker compose up -d --build')
    expect(workflow).toContain('DATABASE_URL')
    expect(backup).toContain('pg_dump')
    expect(backup).toContain('-mtime +7')
  })
})
