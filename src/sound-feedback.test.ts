import { describe, expect, it, vi } from 'vitest'
import {
  playFeedbackSound,
  soundCueForBattlePresentation,
  soundCueForUiFeedback,
  type FeedbackSoundCue,
} from './sound-feedback'

function fakeAudioContext() {
  const frequency = { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }
  const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }
  const oscillator = { type: 'sine' as const, frequency, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
  return {
    context: {
      currentTime: 1,
      state: 'running',
      destination: {},
      createOscillator: vi.fn(() => oscillator),
      createGain: vi.fn(() => gain),
      resume: vi.fn(() => Promise.resolve()),
    },
    oscillator,
    gain,
  }
}

describe('feedback sound cues', () => {
  it('maps battle presentation kinds to short sound cues', () => {
    expect(soundCueForBattlePresentation('none')).toBeNull()
    expect(soundCueForBattlePresentation('roll')).toMatchObject({ id: 'battle-roll', durationMs: 130 })
    expect(soundCueForBattlePresentation('damage')).toMatchObject({ id: 'battle-damage', wave: 'square' })
    expect(soundCueForBattlePresentation('heal')).toMatchObject({ id: 'battle-heal', frequencyHz: 520 })
    expect(soundCueForBattlePresentation('shield')).toMatchObject({ id: 'battle-shield' })
    expect(soundCueForBattlePresentation('poison')).toMatchObject({ id: 'battle-poison' })
    expect(soundCueForBattlePresentation('miss')).toMatchObject({ id: 'battle-miss' })
  })

  it('maps UI feedback kinds to success, info, reward, and failure cues', () => {
    expect(soundCueForUiFeedback('buy-success')).toMatchObject({ id: 'ui-success' })
    expect(soundCueForUiFeedback('place-success')).toMatchObject({ id: 'ui-success' })
    expect(soundCueForUiFeedback('reroll-success')).toMatchObject({ id: 'ui-info' })
    expect(soundCueForUiFeedback('battle-start')).toMatchObject({ id: 'ui-battle-start' })
    expect(soundCueForUiFeedback('reward-picked')).toMatchObject({ id: 'ui-reward' })
    expect(soundCueForUiFeedback('gold-shortage')).toMatchObject({ id: 'ui-failure' })
    expect(soundCueForUiFeedback('action-failed')).toMatchObject({ id: 'ui-failure' })
  })

  it('plays a cue through a provided audio context without throwing', () => {
    const { context, oscillator, gain } = fakeAudioContext()
    const cue: FeedbackSoundCue = {
      id: 'test-cue',
      wave: 'sine',
      frequencyHz: 440,
      endFrequencyHz: 660,
      durationMs: 100,
      volume: 0.1,
    }

    expect(playFeedbackSound(cue, { enabled: true, getAudioContext: () => context })).toBe(true)
    expect(context.createOscillator).toHaveBeenCalledTimes(1)
    expect(context.createGain).toHaveBeenCalledTimes(1)
    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(440, 1)
    expect(oscillator.frequency.linearRampToValueAtTime).toHaveBeenCalledWith(660, 1.1)
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 1)
    expect(oscillator.start).toHaveBeenCalledWith(1)
    expect(oscillator.stop).toHaveBeenCalledWith(1.1)
  })

  it('returns false instead of throwing when sound is disabled or unavailable', () => {
    expect(playFeedbackSound(soundCueForBattlePresentation('damage'), { enabled: false })).toBe(false)
    expect(playFeedbackSound(soundCueForBattlePresentation('damage'), { enabled: true, getAudioContext: () => null })).toBe(false)
    expect(() => playFeedbackSound(soundCueForBattlePresentation('damage'), { enabled: true, getAudioContext: () => { throw new Error('blocked') } })).not.toThrow()
  })
})
