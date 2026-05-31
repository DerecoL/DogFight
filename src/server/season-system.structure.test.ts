import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const schema = readFileSync('prisma/schema.prisma', 'utf8')
const app = readFileSync('src/server/app.ts', 'utf8')
const seasons = readFileSync('src/server/seasons.ts', 'utf8')
const endSeason = readFileSync('scripts/end-season.ts', 'utf8')

describe('season system structure', () => {
  it('models active seasons and archived player summaries', () => {
    expect(schema).toContain('model Season')
    expect(schema).toContain('model SeasonPlayerSummary')
    expect(schema).toContain('seasonId    String')
    expect(schema).toContain('@@unique([userId, seasonId])')
    expect(schema).toContain('@@unique([seasonId, sourceRunId, boardType])')
    expect(schema).toContain('@@unique([seasonId, boardType, boardKey, rank])')
  })

  it('routes ladder and apex through the active shared season', () => {
    expect(app).toContain('getActiveSeason()')
    expect(app).toContain('ensureLadderProfile(userId, season.id)')
    expect(app).toContain("apexLeaderboard(season.id, 'OVERALL', 'default')")
    expect(app).toContain('season: publicSeason(season)')
    expect(app).toContain('seasonSummaries')
  })

  it('provides a manual season ending script with active ladder protection', () => {
    expect(seasons).toContain('export async function endActiveSeason')
    expect(seasons).toContain('forceAbandonActiveLadder')
    expect(seasons).toContain('archiveApexSnapshot')
    expect(endSeason).toContain('--force-abandon-active-ladder')
    expect(endSeason).toContain('endActiveSeason')
  })
})
