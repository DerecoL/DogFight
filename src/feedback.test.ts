import { describe, expect, it } from 'vitest'
import {
  buildFxTimeline,
  createBattlePresentation,
  createUiFeedbackEvent,
  uiFeedbackDurationMs,
} from './feedback'

const baseEvent = {
  time: 1.2,
  actor: 'player',
  kind: 'ITEM',
  text: '测试事件',
  playerHp: 20,
  opponentHp: 18,
  playerMaxHp: 24,
  opponentMaxHp: 24,
  itemId: 'item-1',
  target: 'opponent',
  amount: 4,
}

describe('feedback presentation mapping', () => {
  it('maps battle events into a source to target presentation cue', () => {
    const presentation = createBattlePresentation({
      ...baseEvent,
      effectType: 'DAMAGE',
      targetHpDelta: -4,
    })

    expect(presentation.kind).toBe('damage')
    expect(presentation.source).toEqual({ anchor: 'item', side: 'player', id: 'item-1' })
    expect(presentation.target).toEqual({ anchor: 'dog-avatar', side: 'opponent' })
    expect(presentation.amount).toBe(4)
    expect(presentation.statusChanged).toEqual([])
    expect(presentation.logTone).toBe('damage')
    expect(presentation.timeline.map((step) => step.phase)).toEqual(['source', 'trail', 'impact', 'result', 'log'])
  })

  it('normalizes battle result types without changing server event shape', () => {
    const cases = [
      [{ effectType: 'DAMAGE', targetHpDelta: -3, target: 'opponent' }, 'damage'],
      [{ effectType: 'DAMAGE', targetHpDelta: 0, target: 'opponent' }, 'miss'],
      [{ effectType: 'HEAL', target: 'player' }, 'heal'],
      [{ effectType: 'POISON', target: 'opponent' }, 'poison'],
      [{ kind: 'POISON', target: 'player' }, 'poison'],
      [{ effectType: 'UTILITY', statusChanged: ['shield'], opponentStatuses: { positive: [{ type: 'shield', label: '护盾', tone: 'positive' }], negative: [] } }, 'shield'],
      [{ effectType: 'UTILITY', statusChanged: ['weak'], opponentStatuses: { positive: [], negative: [{ type: 'weak', label: '虚弱', tone: 'negative' }] } }, 'weak'],
      [{ effectType: 'UTILITY', statusChanged: ['freeze'], opponentStatuses: { positive: [], negative: [{ type: 'freeze', label: '冻结', tone: 'negative' }] } }, 'freeze'],
      [{ effectType: 'UTILITY', statusChanged: ['thorns'], playerStatuses: { positive: [{ type: 'thorns', label: '荆棘', tone: 'positive' }], negative: [] }, target: 'player' }, 'thorns'],
      [{ kind: 'ROLL', itemId: undefined, target: undefined }, 'roll'],
    ] as const

    for (const [patch, expected] of cases) {
      expect(createBattlePresentation({ ...baseEvent, ...patch }).kind).toBe(expected)
    }
  })

  it('maps battle effect types to precise visual target anchors', () => {
    const cases = [
      [{ effectType: 'DAMAGE', targetHpDelta: -3, target: 'opponent' }, { anchor: 'dog-avatar', side: 'opponent' }],
      [{ effectType: 'DAMAGE', targetHpDelta: 0, target: 'opponent' }, { anchor: 'dog-avatar', side: 'opponent' }],
      [{ effectType: 'HEAL', target: 'player' }, { anchor: 'hp', side: 'player' }],
      [{ effectType: 'UTILITY', statusChanged: ['shield'], playerStatuses: { positive: [{ type: 'shield', label: '护盾', tone: 'positive' }] }, target: 'player' }, { anchor: 'hp', side: 'player' }],
      [{ effectType: 'POISON', target: 'opponent' }, { anchor: 'status-negative', side: 'opponent' }],
      [{ effectType: 'UTILITY', statusChanged: ['weak'], opponentStatuses: { positive: [], negative: [{ type: 'weak', label: '虚弱', tone: 'negative' }] }, target: 'opponent' }, { anchor: 'status-negative', side: 'opponent' }],
      [{ effectType: 'UTILITY', statusChanged: ['thorns'], playerStatuses: { positive: [{ type: 'thorns', label: '荆棘', tone: 'positive' }], negative: [] }, target: 'player' }, { anchor: 'status-positive', side: 'player' }],
      [{ effectType: 'UTILITY', statusChanged: ['fury'], target: 'player' }, { anchor: 'status-positive', side: 'player' }],
    ] as const

    for (const [patch, expectedTarget] of cases) {
      expect(createBattlePresentation({ ...baseEvent, ...patch }).target).toEqual(expectedTarget)
    }
  })

  it('classifies utility events by current event text before status snapshots', () => {
    const weakPresentation = createBattlePresentation({
      ...baseEvent,
      effectType: 'UTILITY',
      target: 'opponent',
      text: '施加 1 层【虚弱】',
      opponentShield: 8,
      opponentStatuses: {
        positive: [{ type: 'shield' }],
        negative: [{ type: 'weak' }],
      },
    })

    expect(weakPresentation.kind).toBe('weak')
    expect(weakPresentation.target).toEqual({ anchor: 'status-negative', side: 'opponent' })

    const shieldPresentation = createBattlePresentation({
      ...baseEvent,
      effectType: 'UTILITY',
      target: 'player',
      text: '获得 5 点【护盾】',
      playerShield: 5,
      playerStatuses: {
        positive: [{ type: 'shield' }],
        negative: [{ type: 'weak' }],
      },
    })

    expect(shieldPresentation.kind).toBe('shield')
    expect(shieldPresentation.target).toEqual({ anchor: 'hp', side: 'player' })
  })

  it('does not classify utility events from stale status snapshots alone', () => {
    const presentation = createBattlePresentation({
      ...baseEvent,
      effectType: 'UTILITY',
      target: 'opponent',
      text: '测试事件',
      opponentShield: 8,
      opponentStatuses: {
        positive: [{ type: 'shield' }],
        negative: [{ type: 'weak' }],
      },
    })

    expect(presentation.kind).toBe('utility')
    expect(presentation.target).toEqual({ anchor: 'dog-avatar', side: 'opponent' })
  })

  it('targets disabled utility events at negative status anchors', () => {
    const presentation = createBattlePresentation({
      ...baseEvent,
      effectType: 'UTILITY',
      target: 'opponent',
      text: '触发控制失效',
      statusChanged: ['disabled'],
    })

    expect(presentation.kind).not.toBe('miss')
    expect(presentation.target).toEqual({ anchor: 'status-negative', side: 'opponent' })
  })

  it('targets self positive utility statuses at the actor status anchors', () => {
    const presentation = createBattlePresentation({
      ...baseEvent,
      effectType: 'UTILITY',
      target: undefined,
      statusChanged: ['fury'],
    })

    expect(presentation.kind).toBe('utility')
    expect(presentation.target).toEqual({ anchor: 'status-positive', side: 'player' })
  })

  it('collapses motion-heavy timeline steps when reduced motion is requested', () => {
    const presentation = createBattlePresentation({
      ...baseEvent,
      effectType: 'DAMAGE',
      targetHpDelta: -4,
    })

    expect(buildFxTimeline(presentation, false).map((step) => step.phase)).toContain('trail')
    expect(buildFxTimeline(presentation, true).map((step) => step.phase)).toEqual(['source', 'impact', 'result', 'log'])
  })

  it('creates short lived UI feedback events for global player actions', () => {
    const success = createUiFeedbackEvent('buy-success', '购买成功')
    const failure = createUiFeedbackEvent('gold-shortage', '金币不足')

    expect(success.tone).toBe('success')
    expect(failure.tone).toBe('danger')
    expect(success.durationMs).toBeGreaterThanOrEqual(300)
    expect(success.durationMs).toBeLessThanOrEqual(700)
    expect(failure.durationMs).toBe(uiFeedbackDurationMs)
    expect(success.id).not.toBe(failure.id)
  })
})
