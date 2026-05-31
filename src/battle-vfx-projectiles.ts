import type { PresentationKind } from './feedback'

export type BattleProjectileCue = {
  delay: number
  duration: number
  lane: number
  lift: number
  size: number
  alpha: number
  palette: string[]
}

const projectilePalettes: Record<PresentationKind, string[]> = {
  none: ['#8b735d', '#fff4e4', '#ffffff'],
  roll: ['#5a84f6', '#ffe08a', '#ffffff'],
  damage: ['#ff1744', '#ff7a18', '#ffd166'],
  heal: ['#00e676', '#69f0ae', '#d7ff73'],
  shield: ['#1e88ff', '#72d7ff', '#e3f2ff'],
  poison: ['#064e3b', '#047857', '#34d399'],
  weak: ['#b026ff', '#7c4dff', '#f0abfc'],
  freeze: ['#00d9ff', '#7dd3fc', '#ffffff'],
  thorns: ['#f59e0b', '#facc15', '#fff3b0'],
  miss: ['#8b735d', '#e7d7c4', '#ffffff'],
  utility: ['#38bdf8', '#818cf8', '#ffffff'],
}

export function battleProjectileCues(kind: PresentationKind, amount?: number | null): BattleProjectileCue[] {
  void amount
  if (kind === 'none' || kind === 'roll') return []
  return [{
    delay: 0,
    duration: 0.72,
    lane: 0,
    lift: 92,
    size: kind === 'damage' || kind === 'poison' ? 1.08 : 0.96,
    alpha: kind === 'miss' ? 0.72 : 0.94,
    palette: projectilePalettes[kind],
  }]
}
