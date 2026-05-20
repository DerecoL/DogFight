export const LADDER_SEASON_ID = 'season-1'

export const ladderTiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'DOG_KING'] as const
export type LadderTier = typeof ladderTiers[number]

export type LadderProfileState = {
  tier: LadderTier
  score: number
  gamesPlayed: number
}

export type LadderRunResult = {
  wins: number
  losses: number
}

export type LadderScoreBreakdown = {
  baseScore: number
  tierTax: number
  lossPenalty: number
  perfectBonus: number
  newbieProtection: number
}

export type LadderCalculationResult = {
  before: { tier: LadderTier; score: number }
  after: { tier: LadderTier; score: number }
  delta: number
  rawDelta: number
  breakdown: LadderScoreBreakdown
  promoted: boolean
  demoted: boolean
}

const fixedScoreTiers: LadderTier[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']
const baseScores = [
  { maxWins: 2, score: -18 },
  { maxWins: 5, score: -8 },
  { maxWins: 6, score: 0 },
  { maxWins: 7, score: 8 },
  { maxWins: 8, score: 16 },
  { maxWins: 9, score: 26 },
  { maxWins: 10, score: 38 },
  { maxWins: 11, score: 50 },
  { maxWins: 12, score: 65 },
]

export const ladderTierLabels: Record<LadderTier, string> = {
  BRONZE: '青铜',
  SILVER: '白银',
  GOLD: '黄金',
  PLATINUM: '白金',
  DIAMOND: '钻石',
  MASTER: '大师',
  DOG_KING: '犬王',
}

export function ladderTierForScore(tier: LadderTier, score: number): LadderTier {
  if (tier === 'MASTER' || tier === 'DOG_KING') return score >= 500 ? 'DOG_KING' : 'MASTER'
  return tier
}

export function ladderBaseScore(wins: number) {
  const normalizedWins = Math.max(0, Math.min(12, Math.floor(wins)))
  return baseScores.find((entry) => normalizedWins <= entry.maxWins)?.score ?? 65
}

export function ladderTierTax(tier: LadderTier) {
  switch (tier) {
    case 'BRONZE':
    case 'SILVER':
      return 0
    case 'GOLD':
      return 8
    case 'PLATINUM':
      return 16
    case 'DIAMOND':
      return 26
    case 'MASTER':
      return 30
    case 'DOG_KING':
      return 38
  }
}

function fixedTierIndex(tier: LadderTier) {
  return fixedScoreTiers.indexOf(tier)
}

function isFixedTier(tier: LadderTier) {
  return fixedTierIndex(tier) >= 0
}

function applyFixedTierScore(tier: LadderTier, score: number) {
  const index = fixedTierIndex(tier)
  if (index < 0) return { tier, score }
  if (score >= 100) {
    const nextTier = ladderTiers[index + 1] ?? 'MASTER'
    return { tier: nextTier, score: 20 }
  }
  if (score < 0 && index > 0) {
    return { tier: ladderTiers[index - 1], score: Math.max(0, 80 + score) }
  }
  return { tier, score: Math.max(0, score) }
}

function applyOpenTierScore(tier: LadderTier, score: number) {
  if (score < 0) return { tier: 'DIAMOND' as const, score: Math.max(0, 80 + score) }
  return { tier: ladderTierForScore(tier, score), score }
}

export function calculateLadderResult(profile: LadderProfileState, run: LadderRunResult): LadderCalculationResult {
  const before = {
    tier: ladderTierForScore(profile.tier, profile.score),
    score: Math.max(0, Math.floor(profile.score)),
  }
  const baseScore = ladderBaseScore(run.wins)
  const tierTax = ladderTierTax(before.tier)
  const lossPenalty = Math.max(0, Math.floor(run.losses) - 1) * 2
  const perfectBonus = run.wins >= 12 && run.losses <= 0 ? 8 : 0
  const rawDelta = baseScore - tierTax - lossPenalty + perfectBonus
  const protectedDelta = profile.gamesPlayed < 5 && (before.tier === 'BRONZE' || before.tier === 'SILVER') && rawDelta < 0
    ? 0
    : rawDelta
  const after = isFixedTier(before.tier)
    ? applyFixedTierScore(before.tier, before.score + protectedDelta)
    : applyOpenTierScore(before.tier, before.score + protectedDelta)
  const beforeIndex = ladderTiers.indexOf(before.tier)
  const afterIndex = ladderTiers.indexOf(after.tier)

  return {
    before,
    after,
    delta: protectedDelta,
    rawDelta,
    breakdown: {
      baseScore,
      tierTax,
      lossPenalty,
      perfectBonus,
      newbieProtection: protectedDelta - rawDelta,
    },
    promoted: afterIndex > beforeIndex,
    demoted: afterIndex < beforeIndex,
  }
}
