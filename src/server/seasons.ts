import type { ApexEntry, Prisma, PrismaClient, Season, SeasonPlayerSummary } from '@prisma/client'
import { prisma } from './db'
import { itemDefForQuality, relicDefForQuality } from './game/data'
import { ladderTierLabels, type LadderTier } from './game/ladder'
import { parseJson } from './state'

export const DEFAULT_SEASON_ID = 'season-1'

export type SeasonStore = PrismaClient | Prisma.TransactionClient

export type ArchivedApexSnapshot = {
  id: string
  name: string
  dogType: string
  luckyNumber: number | null
  wins: number
  losses: number
  round: number
  rank: number
  challengeWins: number
  items: unknown[]
  relics: unknown[]
  createdAt: string
}

export type EndSeasonOptions = {
  forceAbandonActiveLadder?: boolean
}

export function publicSeason(season: Season) {
  return {
    id: season.id,
    name: season.name,
    status: season.status,
    startedAt: season.startedAt.toISOString(),
    endedAt: season.endedAt?.toISOString() ?? null,
  }
}

export function archiveApexSnapshot(entry: ApexEntry | null): ArchivedApexSnapshot | null {
  if (!entry) return null
  const items = parseJson<Array<{ defId: string; quality?: string | null }>>(entry.items, [])
    .map((item) => ({ ...item, def: itemDefForQuality(item.defId, item.quality) }))
  const relics = parseJson<Array<{ relicId: string; quality?: string | null }>>(entry.relics, [])
    .map((relic) => ({ ...relic, def: relicDefForQuality(relic.relicId, relic.quality) }))
  return {
    id: entry.id,
    name: entry.name,
    dogType: entry.dogType,
    luckyNumber: entry.luckyNumber,
    wins: entry.wins,
    losses: entry.losses,
    round: entry.round,
    rank: entry.rank,
    challengeWins: entry.challengeWins,
    items,
    relics,
    createdAt: entry.createdAt.toISOString(),
  }
}

export function publicSeasonSummary(summary: SeasonPlayerSummary) {
  const snapshot = summary.apexSnapshot ? parseJson<ArchivedApexSnapshot | null>(summary.apexSnapshot, null) : null
  const ladderTier = summary.ladderTier as LadderTier | null
  const ladderHighestTier = summary.ladderHighestTier as LadderTier | null
  return {
    id: summary.id,
    seasonId: summary.seasonId,
    seasonName: summary.seasonName,
    ladderTier,
    ladderTierLabel: ladderTier ? ladderTierLabels[ladderTier] : null,
    ladderScore: summary.ladderScore,
    ladderHighestTier,
    ladderHighestTierLabel: ladderHighestTier ? ladderTierLabels[ladderHighestTier] : null,
    ladderGamesPlayed: summary.ladderGamesPlayed,
    ladderTotalWins: summary.ladderTotalWins,
    ladderTotalLosses: summary.ladderTotalLosses,
    dogKingRank: summary.dogKingRank,
    apexRank: summary.apexRank,
    apexDogType: summary.apexDogType,
    apexWins: summary.apexWins,
    apexLosses: summary.apexLosses,
    apexRound: summary.apexRound,
    apexChallengeWins: summary.apexChallengeWins,
    apexSnapshot: snapshot,
    createdAt: summary.createdAt.toISOString(),
  }
}

export async function getActiveSeason(store: SeasonStore = prisma) {
  const active = await store.season.findFirst({ where: { status: 'ACTIVE' }, orderBy: { startedAt: 'desc' } })
  if (active) return active
  return store.season.upsert({
    where: { id: DEFAULT_SEASON_ID },
    update: { status: 'ACTIVE' },
    create: { id: DEFAULT_SEASON_ID, name: '赛季 1', status: 'ACTIVE' },
  })
}

export function nextSeasonId(currentSeasonId: string) {
  const match = /^season-(\d+)$/.exec(currentSeasonId)
  return `season-${match ? Number(match[1]) + 1 : 2}`
}

export function seasonNameFromId(seasonId: string) {
  const match = /^season-(\d+)$/.exec(seasonId)
  return match ? `赛季 ${match[1]}` : seasonId
}

export async function endActiveSeason(options: EndSeasonOptions = {}, store: PrismaClient = prisma) {
  return store.$transaction(async (tx) => {
    const season = await getActiveSeason(tx)
    const activeLadderRuns = await tx.run.count({
      where: { seasonId: season.id, mode: 'LADDER', status: 'ACTIVE' },
    })
    if (activeLadderRuns > 0 && !options.forceAbandonActiveLadder) {
      throw new Error(`当前赛季还有 ${activeLadderRuns} 个进行中的天梯跑局，请先结算或使用 --force-abandon-active-ladder`)
    }
    if (activeLadderRuns > 0) {
      await tx.run.updateMany({
        where: { seasonId: season.id, mode: 'LADDER', status: 'ACTIVE' },
        data: { status: 'ABANDONED' },
      })
    }

    const [users, dogKingProfiles, apexEntries] = await Promise.all([
      tx.user.findMany({ select: { id: true } }),
      tx.ladderProfile.findMany({
        where: { seasonId: season.id, tier: 'DOG_KING' },
        orderBy: [{ score: 'desc' }, { updatedAt: 'asc' }],
      }),
      tx.apexEntry.findMany({
        where: { seasonId: season.id, boardType: 'OVERALL', boardKey: 'default', isSeed: false, userId: { not: null } },
        orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
      }),
    ])
    const dogKingRankByUser = new Map(dogKingProfiles.map((profile, index) => [profile.userId, index + 1]))
    const bestApexByUser = new Map<string, ApexEntry>()
    for (const entry of apexEntries) {
      if (entry.userId && !bestApexByUser.has(entry.userId)) bestApexByUser.set(entry.userId, entry)
    }

    let archivedPlayers = 0
    for (const user of users) {
      const [ladderProfile, bestApex] = await Promise.all([
        tx.ladderProfile.findUnique({ where: { userId_seasonId: { userId: user.id, seasonId: season.id } } }),
        Promise.resolve(bestApexByUser.get(user.id) ?? null),
      ])
      if (!ladderProfile && !bestApex) continue
      const snapshot = archiveApexSnapshot(bestApex)
      await tx.seasonPlayerSummary.upsert({
        where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
        update: {
          seasonName: season.name,
          ladderTier: ladderProfile?.tier ?? null,
          ladderScore: ladderProfile?.score ?? null,
          ladderHighestTier: ladderProfile?.highestTier ?? null,
          ladderGamesPlayed: ladderProfile?.gamesPlayed ?? 0,
          ladderTotalWins: ladderProfile?.totalWins ?? 0,
          ladderTotalLosses: ladderProfile?.totalLosses ?? 0,
          dogKingRank: dogKingRankByUser.get(user.id) ?? null,
          apexRank: bestApex?.rank ?? null,
          apexDogType: bestApex?.dogType ?? null,
          apexWins: bestApex?.wins ?? null,
          apexLosses: bestApex?.losses ?? null,
          apexRound: bestApex?.round ?? null,
          apexChallengeWins: bestApex?.challengeWins ?? null,
          apexSnapshot: snapshot ? JSON.stringify(snapshot) : null,
        },
        create: {
          userId: user.id,
          seasonId: season.id,
          seasonName: season.name,
          ladderTier: ladderProfile?.tier ?? null,
          ladderScore: ladderProfile?.score ?? null,
          ladderHighestTier: ladderProfile?.highestTier ?? null,
          ladderGamesPlayed: ladderProfile?.gamesPlayed ?? 0,
          ladderTotalWins: ladderProfile?.totalWins ?? 0,
          ladderTotalLosses: ladderProfile?.totalLosses ?? 0,
          dogKingRank: dogKingRankByUser.get(user.id) ?? null,
          apexRank: bestApex?.rank ?? null,
          apexDogType: bestApex?.dogType ?? null,
          apexWins: bestApex?.wins ?? null,
          apexLosses: bestApex?.losses ?? null,
          apexRound: bestApex?.round ?? null,
          apexChallengeWins: bestApex?.challengeWins ?? null,
          apexSnapshot: snapshot ? JSON.stringify(snapshot) : null,
        },
      })
      archivedPlayers += 1
    }

    const endedAt = new Date()
    await tx.season.update({ where: { id: season.id }, data: { status: 'ENDED', endedAt } })
    const newSeasonId = nextSeasonId(season.id)
    const nextSeason = await tx.season.create({
      data: { id: newSeasonId, name: seasonNameFromId(newSeasonId), status: 'ACTIVE' },
    })

    return {
      endedSeason: publicSeason({ ...season, status: 'ENDED', endedAt }),
      newSeason: publicSeason(nextSeason),
      archivedPlayers,
      abandonedActiveLadderRuns: options.forceAbandonActiveLadder ? activeLadderRuns : 0,
    }
  })
}
