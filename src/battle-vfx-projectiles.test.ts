import { describe, expect, it } from 'vitest'
import { battleProjectileCues } from './battle-vfx-projectiles'

describe('battle vfx projectile cues', () => {
  it('draws one projectile for one logical battle behavior regardless of stack amount', () => {
    expect(battleProjectileCues('poison', 5)).toHaveLength(1)
    expect(battleProjectileCues('poison', 17)).toHaveLength(1)
  })

  it('lets attached effects add one fixed projectile through their own event cue', () => {
    const attackProjectileCount = battleProjectileCues('damage', 4).length
    const attachedWeakProjectileCount = battleProjectileCues('weak', 1).length

    expect(attackProjectileCount + attachedWeakProjectileCount).toBe(2)
  })

  it('uses an ink green projectile palette for poison cues', () => {
    expect(battleProjectileCues('poison', 5)[0].palette).toEqual(['#064e3b', '#047857', '#34d399'])
  })
})
