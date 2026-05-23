import type { PresentationKind, UiFeedbackKind } from './feedback'

export type FeedbackWave = 'sine' | 'square' | 'sawtooth' | 'triangle'

export type FeedbackSoundCue = {
  id: string
  wave: FeedbackWave
  frequencyHz: number
  endFrequencyHz: number
  durationMs: number
  volume: number
}

type AudioParamLike = {
  setValueAtTime: (value: number, startTime: number) => void
  linearRampToValueAtTime?: (value: number, endTime: number) => void
  exponentialRampToValueAtTime?: (value: number, endTime: number) => void
}

type OscillatorLike = {
  type: FeedbackWave
  frequency: AudioParamLike
  connect: (destination: unknown) => void
  start: (when?: number) => void
  stop: (when?: number) => void
}

type GainLike = {
  gain: AudioParamLike
  connect: (destination: unknown) => void
}

type AudioContextLike = {
  currentTime: number
  state?: string
  destination: unknown
  createOscillator: () => OscillatorLike
  createGain: () => GainLike
  resume?: () => Promise<void>
}

type PlayFeedbackSoundOptions = {
  enabled?: boolean
  getAudioContext?: () => AudioContextLike | null
}

type FeedbackAudioGlobal = typeof globalThis & {
  AudioContext?: new () => AudioContextLike
  webkitAudioContext?: new () => AudioContextLike
}

const battleSoundCues: Record<Exclude<PresentationKind, 'none'>, FeedbackSoundCue> = {
  roll: { id: 'battle-roll', wave: 'triangle', frequencyHz: 280, endFrequencyHz: 520, durationMs: 130, volume: 0.06 },
  damage: { id: 'battle-damage', wave: 'square', frequencyHz: 170, endFrequencyHz: 90, durationMs: 120, volume: 0.07 },
  heal: { id: 'battle-heal', wave: 'sine', frequencyHz: 520, endFrequencyHz: 760, durationMs: 180, volume: 0.055 },
  shield: { id: 'battle-shield', wave: 'triangle', frequencyHz: 420, endFrequencyHz: 620, durationMs: 160, volume: 0.055 },
  poison: { id: 'battle-poison', wave: 'sawtooth', frequencyHz: 190, endFrequencyHz: 150, durationMs: 170, volume: 0.045 },
  weak: { id: 'battle-weak', wave: 'sawtooth', frequencyHz: 230, endFrequencyHz: 140, durationMs: 150, volume: 0.045 },
  freeze: { id: 'battle-freeze', wave: 'sine', frequencyHz: 700, endFrequencyHz: 460, durationMs: 180, volume: 0.05 },
  thorns: { id: 'battle-thorns', wave: 'square', frequencyHz: 360, endFrequencyHz: 210, durationMs: 110, volume: 0.055 },
  miss: { id: 'battle-miss', wave: 'triangle', frequencyHz: 120, endFrequencyHz: 80, durationMs: 120, volume: 0.045 },
  utility: { id: 'battle-utility', wave: 'triangle', frequencyHz: 340, endFrequencyHz: 440, durationMs: 120, volume: 0.045 },
}

const uiSoundCues = {
  success: { id: 'ui-success', wave: 'sine', frequencyHz: 500, endFrequencyHz: 680, durationMs: 90, volume: 0.045 },
  info: { id: 'ui-info', wave: 'triangle', frequencyHz: 360, endFrequencyHz: 520, durationMs: 80, volume: 0.04 },
  reward: { id: 'ui-reward', wave: 'sine', frequencyHz: 620, endFrequencyHz: 880, durationMs: 150, volume: 0.055 },
  failure: { id: 'ui-failure', wave: 'square', frequencyHz: 180, endFrequencyHz: 120, durationMs: 120, volume: 0.05 },
  battleStart: { id: 'ui-battle-start', wave: 'triangle', frequencyHz: 260, endFrequencyHz: 540, durationMs: 170, volume: 0.055 },
} satisfies Record<string, FeedbackSoundCue>

const uiSuccessKinds: UiFeedbackKind[] = ['buy-success', 'place-success', 'sell-success', 'relic-sold']
const uiRewardKinds: UiFeedbackKind[] = ['upgrade-success', 'reward-picked', 'relic-picked', 'enchant-applied']
const uiFailureKinds: UiFeedbackKind[] = ['gold-shortage', 'place-failed', 'upgrade-failed', 'action-failed']

let sharedAudioContext: AudioContextLike | null = null

export function soundCueForBattlePresentation(kind: PresentationKind): FeedbackSoundCue | null {
  return kind === 'none' ? null : battleSoundCues[kind]
}

export function soundCueForUiFeedback(kind: UiFeedbackKind): FeedbackSoundCue {
  if (kind === 'battle-start') return uiSoundCues.battleStart
  if (uiRewardKinds.includes(kind)) return uiSoundCues.reward
  if (uiFailureKinds.includes(kind)) return uiSoundCues.failure
  if (uiSuccessKinds.includes(kind)) return uiSoundCues.success
  return uiSoundCues.info
}

export function playFeedbackSound(cue: FeedbackSoundCue | null | undefined, options: PlayFeedbackSoundOptions = {}): boolean {
  if (!cue || options.enabled === false) return false

  try {
    const context = options.getAudioContext ? options.getAudioContext() : getSharedAudioContext()
    if (!context) return false

    if (context.state === 'suspended') {
      void context.resume?.().catch(() => undefined)
    }

    const startTime = context.currentTime
    const endTime = startTime + cue.durationMs / 1000
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = cue.wave
    oscillator.frequency.setValueAtTime(cue.frequencyHz, startTime)
    oscillator.frequency.linearRampToValueAtTime?.(cue.endFrequencyHz, endTime)

    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime?.(Math.max(0.0001, cue.volume), startTime + 0.01)
    gain.gain.exponentialRampToValueAtTime?.(0.0001, endTime)

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(startTime)
    oscillator.stop(endTime)
    return true
  } catch {
    return false
  }
}

function getSharedAudioContext(): AudioContextLike | null {
  if (sharedAudioContext) return sharedAudioContext

  const audioGlobal = globalThis as FeedbackAudioGlobal
  const AudioContextConstructor = (audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext) as (new () => AudioContextLike) | undefined
  if (!AudioContextConstructor) return null

  sharedAudioContext = new AudioContextConstructor()
  return sharedAudioContext
}
