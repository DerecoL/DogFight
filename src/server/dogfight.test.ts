import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { publicDogfightRoom } from './dogfight'

const dogfightSource = readFileSync(new URL('./dogfight.ts', import.meta.url), 'utf8')

function makeRun(overrides: Record<string, unknown>) {
  return {
    id: 'run',
    userId: 'user-a',
    mode: 'CASUAL',
    dogType: 'SHIBA',
    luckyNumber: null,
    wins: 0,
    losses: 0,
    round: 0,
    gold: 10,
    phase: 'SHOP',
    status: 'DOGFIGHT_ACTIVE',
    shopType: 'GENERAL',
    shopItems: '[]',
    choices: '[]',
    enchantChoices: '[]',
    classRewardChoices: '[]',
    relicChoices: '[]',
    relics: '[]',
    refreshCost: 1,
    matchedGhost: null,
    lastBattle: null,
    ladderSettlement: null,
    items: [],
    ...overrides,
  }
}

function makeParticipant(overrides: Record<string, unknown>) {
  return {
    id: 'participant',
    userId: 'user-a',
    roomId: 'room',
    runId: 'run',
    kind: 'PLAYER',
    nickname: 'Player',
    isHost: false,
    ready: false,
    eliminated: false,
    eliminatedRound: null,
    placement: null,
    createdAt: new Date('2026-05-22T00:00:00.000Z'),
    updatedAt: new Date('2026-05-22T00:00:00.000Z'),
    run: makeRun({}),
    ...overrides,
  }
}

describe('dogfight public room display state', () => {
  it('auto-resolves upgrade choice shops before locking a dogfight round', () => {
    expect(dogfightSource).toContain("run.phase === 'UPGRADE_CHOICE'")
    expect(dogfightSource).toContain("nextQuality(item.quality)")
    expect(dogfightSource).toContain("data: { phase: 'PREP' }")
  })

  it('auto-resolves potion choice shops before locking a dogfight round', () => {
    expect(dogfightSource).toContain("run.phase === 'POTION_CHOICE'")
    expect(dogfightSource).toContain('applyPotionToBaseDice')
    expect(dogfightSource).toContain('triggerDiceOverride: JSON.stringify')
    expect(dogfightSource).toContain("itemDef(item.defId).advancedEffect !== 'BOOM_COUNTER'")
  })

  it('hides the current round result while the battle replay is still showing', () => {
    const participantA = makeParticipant({
      id: 'participant-a',
      userId: 'user-a',
      runId: 'run-a',
      nickname: 'A',
      run: makeRun({ id: 'run-a', userId: 'user-a', wins: 3, losses: 1, round: 3, gold: 24 }),
    })
    const participantB = makeParticipant({
      id: 'participant-b',
      userId: 'user-b',
      runId: 'run-b',
      nickname: 'B',
      eliminated: true,
      eliminatedRound: 2,
      placement: 2,
      run: makeRun({ id: 'run-b', userId: 'user-b', wins: 1, losses: 3, round: 3, gold: 15, status: 'DOGFIGHT_ELIMINATED', phase: 'COMPLETE' }),
    })
    const room = {
      id: 'room',
      hostUserId: 'user-a',
      status: 'ACTIVE',
      phase: 'BATTLE',
      currentRound: 2,
      maxPlayers: 2,
      targetPlayerCount: 2,
      readyDeadline: null,
      phaseDeadline: new Date('2026-05-22T00:00:25.000Z'),
      winnerParticipantId: null,
      createdAt: new Date('2026-05-22T00:00:00.000Z'),
      updatedAt: new Date('2026-05-22T00:00:00.000Z'),
      participants: [participantA, participantB],
      battles: [{
        id: 'battle',
        roomId: 'room',
        round: 2,
        participantAId: 'participant-a',
        participantBId: 'participant-b',
        opponentKind: 'PLAYER',
        winnerSide: 'player',
        winnerParticipantId: 'participant-a',
        result: '{}',
        createdAt: new Date('2026-05-22T00:00:00.000Z'),
        updatedAt: new Date('2026-05-22T00:00:00.000Z'),
      }],
    }

    const publicRoom = publicDogfightRoom(room as never, 'user-b')
    const visibleA = publicRoom.members.find((member) => member.id === 'participant-a')
    const visibleB = publicRoom.members.find((member) => member.id === 'participant-b')
    const visibleBattle = publicRoom.battles[0]

    expect(visibleA).toMatchObject({
      wins: 2,
      round: 2,
      gold: 16,
    })
    expect(visibleB).toMatchObject({
      wins: 1,
      losses: 2,
      round: 2,
      gold: 10,
      eliminated: false,
      eliminatedRound: null,
      placement: null,
    })
    expect(publicRoom.currentRun).toMatchObject({
      wins: 1,
      losses: 2,
      round: 2,
      gold: 10,
      status: 'DOGFIGHT_ACTIVE',
      phase: 'BATTLE',
    })
    expect(visibleBattle.winnerSide).toBeNull()
    expect(visibleBattle.winnerParticipantId).toBeNull()
  })
})
