import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  scripts: Record<string, string>
  devDependencies: Record<string, string>
}
const localDevScriptUrl = new URL('../scripts/start-local-dev.mjs', import.meta.url)
const localDevScript = existsSync(localDevScriptUrl) ? readFileSync(localDevScriptUrl, 'utf8') : ''

describe('local development database', () => {
  it('wraps the dev server with PGlite so local testing works without Docker or system Postgres', () => {
    expect(pkg.devDependencies).toHaveProperty('@electric-sql/pglite-socket')
    expect(pkg.scripts.dev).toContain('pglite-server')
    expect(pkg.scripts.dev).toContain('--include-database-url')
    expect(pkg.scripts.dev).toContain('node scripts/start-local-dev.mjs')
    expect(localDevScript).toContain('sslmode=disable')
    expect(localDevScript).toContain("runNpmScript('db:push')")
    expect(localDevScript).toContain("runNpmScript('dev:app')")
    expect(pkg.scripts['dev:app']).toContain('npm:dev:server')
    expect(pkg.scripts['dev:app']).toContain('npm:dev:client')
  })
})
