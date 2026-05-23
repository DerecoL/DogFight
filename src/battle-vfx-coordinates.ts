import type { FxAnchor, PresentationEvent } from './feedback'

export type BattleFxPoint = { x: number; y: number }
export type BattleFxPoints = { source: BattleFxPoint; target: BattleFxPoint }
export type BattleFxAnchorResolver = (anchor: FxAnchor) => HTMLElement | null

export function resolveBattleFxPoints(
  panel: HTMLElement,
  presentation: Pick<PresentationEvent, 'source' | 'target'>,
  resolveAnchor: BattleFxAnchorResolver,
): BattleFxPoints {
  const panelRect = panel.getBoundingClientRect()
  return {
    source: centerOfAnchor(resolveAnchor(presentation.source), panelRect) ?? fallbackPointForAnchor(presentation.source, panelRect),
    target: centerOfAnchor(resolveAnchor(presentation.target), panelRect) ?? fallbackPointForAnchor(presentation.target, panelRect),
  }
}

export function queryBattleFxAnchor(root: ParentNode, anchor: FxAnchor): HTMLElement | null {
  const itemSelector = anchor.id ? `[data-vfx-item-id="${cssEscape(anchor.id)}"]` : ''
  const selector = `[data-vfx-anchor="${anchor.anchor}"][data-vfx-side="${anchor.side}"]${itemSelector}`
  return root.querySelector<HTMLElement>(selector)
}

function centerOfAnchor(element: HTMLElement | null, panelRect: DOMRect): BattleFxPoint | null {
  if (!element) return null
  const rect = element.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2 - panelRect.left,
    y: rect.top + rect.height / 2 - panelRect.top,
  }
}

function fallbackPointForAnchor(anchor: FxAnchor, panelRect: DOMRect): BattleFxPoint {
  const x = anchor.side === 'player' ? panelRect.width * 0.75 : anchor.side === 'opponent' ? panelRect.width * 0.25 : panelRect.width * 0.5
  return { x, y: panelRect.height * 0.5 }
}

function cssEscape(value: string) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}
