import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./App.css', import.meta.url), 'utf8')
const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')

function cssVariablePx(name: string) {
  const match = css.match(new RegExp(`${name}:\\s*(\\d+)px`))
  return match ? Number(match[1]) : null
}

function cssRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's'))
  return match?.[1] ?? ''
}

describe('equipment layout scale', () => {
  it('keeps equipment and bag slots large enough to be the core play surface', () => {
    expect(cssVariablePx('--slot-w')).toBeGreaterThanOrEqual(84)
    expect(cssVariablePx('--slot-h')).toBeGreaterThanOrEqual(102)
    expect(cssVariablePx('--board-slot-h')).toBeGreaterThanOrEqual(220)
    expect(app).toContain('inventory-board expanded')
    expect(css).toContain('overflow-x: visible')
    expect(app).toContain('repeat(${w}, minmax(0, 1fr))')
    expect(app).toContain('const BASE_EQUIPMENT_SLOT_COUNT = 12')
    expect(app).toContain('const EXTRA_EQUIPMENT_SLOT_COUNT = 13')
    expect(app).toContain('function equipmentSlotCount')
    expect(app).toContain('w={equipmentSlots} h={1}')
    expect(app).toContain('w={BASE_EQUIPMENT_SLOT_COUNT} h={1}')
    expect(app).toContain('格单行，战斗中默认不生效')
    expect(app).toContain('gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))`')
    expect(css).toContain('overflow-x: clip')
    expect(cssRule('.slot-grid')).toContain('gap: 8px')
    expect(cssRule('.slot-grid')).toContain('padding: 14px')
    expect(app).toContain('gridTemplateRows: `repeat(${h}, var(--board-slot-h))`')
  })

  it('lets the shop inventory work area use the wide screen while keeping shop offers readable', () => {
    expect(cssRule('.screen-content')).toContain('width: min(1920px, calc(100vw - 48px))')
    expect(css).toContain('width: min(1920px, 100%)')
    expect(css).toContain('grid-template-rows: auto 1fr')
    expect(cssRule('.shop-shelf')).toContain('width: 100%')
    expect(cssRule('.shop-shelf')).toContain('justify-self: stretch')
    expect(cssRule('.shop-shelf')).not.toContain('width: min(1280px, 100%)')
    expect(cssRule('.inventory-board')).toContain('width: 100%')
    expect(css).toContain('align-self: stretch')
    expect(cssRule('.inventory-board')).toContain('grid-template-rows: minmax(0, 1fr) minmax(0, 1fr)')
    expect(cssRule('.inventory-board.expanded .grid-panel:first-child')).toContain('align-content: start')
    expect(cssRule('.inventory-board.expanded .grid-panel:last-child')).toContain('align-content: end')
  })

  it('keeps the left relic rail narrow and the right bag grid wide', () => {
    expect(cssRule('.bag-relic-row')).toContain('grid-template-columns: 220px minmax(0, 1fr)')
  })

  it('keeps relic slots from resizing around text content', () => {
    expect(cssRule(':root')).toContain('--relic-slot-size: 86px')
    expect(cssRule('.relic-slot-grid')).toContain('grid-template-columns: repeat(2, var(--relic-slot-size))')
    expect(cssRule('.relic-slot-grid')).toContain('grid-template-rows: repeat(3, var(--relic-slot-size))')
    expect(cssRule('.relic-slot')).toContain('aspect-ratio: 1')
    expect(cssRule('.relic-slot')).toContain('width: var(--relic-slot-size)')
    expect(cssRule('.relic-slot')).toContain('height: var(--relic-slot-size)')
    expect(cssRule('.relic-slot')).toContain('padding: 6px')
    expect(cssRule('.relic-icon-button')).toContain('width: 100%')
    expect(cssRule('.relic-icon-button')).toContain('aspect-ratio: 1')
    expect(css).not.toMatch(/\.relic-slot-grid\s*\{[^}]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/s)
    expect(cssRule('.relic-floating-tip')).toContain('width: min(320px, calc(100vw - 28px))')
    expect(cssRule('.floating-tip.relic-floating-tip')).toContain('width: min(320px, calc(100vw - 28px))')
  })

  it('uses the provided hand-drawn cream UI structure', () => {
    expect(css).toContain('--page: #fff4e4')
    expect(css).toContain('--ink: #3d2d25')
    expect(css).toContain('border: 3px solid var(--ink)')
    expect(css).not.toContain('linear-gradient(135deg, #ffe2ae')
    expect(app).not.toContain('<PageNav')
    expect(app).not.toContain('<ChapterProgress')
  })

  it('defines a richer soft handdrawn visual system without changing style families', () => {
    expect(cssRule(':root')).toContain('--paper-fiber')
    expect(cssRule(':root')).toContain('--sketch-shadow')
    expect(cssRule(':root')).toContain('--paper-tilt-left')
    expect(cssRule(':root')).toContain('--sticker-blue')
    expect(cssRule('body')).toContain('var(--paper-fiber)')
    expect(cssRule('.app-shell')).toContain('radial-gradient')
    expect(cssRule('.paper-card')).toContain('position: relative')
    expect(cssRule('.paper-card::before')).toContain('transform: rotate')
    expect(cssRule('.paper-card::after')).toContain('background')
    expect(cssRule('.sticker-card::before')).toContain('content: ""')
    expect(cssRule('.sticker-card::before')).toContain('rotate')
    expect(css).not.toContain('#0b1020')
  })

  it('adds handdrawn feedback treatment for high-frequency shop and inventory actions', () => {
    expect(cssRule('.paper-inventory')).toContain('background')
    expect(cssRule('.paper-inventory .slot')).toContain('box-shadow')
    expect(cssRule('.slot.over')).toContain('outline')
    expect(cssRule('.sell-zone.over::after')).toContain('content')
    expect(cssRule('.drag-overlay-item')).toContain('rotate')
    expect(cssRule('.item-card.can-upgrade::after')).toContain('content')
    expect(cssRule('.upgrade-indicator')).toContain('animation')
    expect(cssRule('.paper-shop-card .price-tag')).toContain('rotate')
    expect(cssRule('.action-button:active, .primary:active, .secondary:active, .danger-button:active, .icon-button:active, .reroll-button:active')).toContain('translateY')
  })

  it('adds handdrawn battle staging and reduced motion support', () => {
    expect(cssRule('.handdrawn-stage')).toContain('background')
    expect(cssRule('.handdrawn-stage::before')).toContain('radial-gradient')
    expect(cssRule('.handdrawn-dice')).toContain('transform')
    expect(cssRule('.battle-dog.status-poison::before')).toContain('background')
    expect(cssRule('.battle-dog.status-shield::after')).toContain('border')
    expect(cssRule('.handdrawn-result')).toContain('animation')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(cssRule('@media (prefers-reduced-motion: reduce)')).toContain('animation-duration: .001ms')
  })

  it('adds second-pass handdrawn material detail across shell, cards, battle, and tips', () => {
    expect(cssRule(':root')).toContain('--ink-wash')
    expect(cssRule(':root')).toContain('--paper-edge-highlight')
    expect(cssRule(':root')).toContain('--pressed-sketch-shadow')
    expect(cssRule('.auth-panel.paper-card')).toContain('border: 3px solid var(--ink)')
    expect(cssRule('.topbar.paper-card')).toContain('transform: none')
    expect(cssRule('.paper-card:hover::before')).toContain('border-color')
    expect(cssRule('.paper-item-card::before')).toContain('linear-gradient')
    expect(cssRule('.paper-item-card::after')).toContain('border')
    expect(cssRule('.handdrawn-fx-canvas')).toContain('mix-blend-mode')
    expect(cssRule('.handdrawn-stage::after')).toContain('background')
    expect(cssRule('.handdrawn-dice.rolling')).toContain('animation')
    expect(cssRule('.handdrawn-status-chip')).toContain('border')
    expect(cssRule('.status-chip.poison.handdrawn-status-chip')).toContain('background')
    expect(cssRule('.rule-tip.paper-card')).toContain('border: 3px solid var(--ink)')
    expect(css).toContain('@keyframes diceSketchBounce')
    expect(css).toContain('@keyframes paperShimmer')
  })

  it('keeps the real battle playback view dense and readable on narrow screens', () => {
    expect(cssRule('.visual-battle')).toContain('padding')
    expect(cssRule('.battle-toolbar')).toContain('display: grid')
    expect(cssRule('.battle-toolbar')).toContain('grid-template-columns: minmax(0, 1fr) auto')
    expect(cssRule('.battle-toolbar .speed-row')).toContain('justify-self: end')
    expect(css).toContain('.visual-battle { gap: 6px; padding: 8px; }')
    expect(css).toContain('.battle-toolbar .speed-row { width: 100%; justify-content: center; }')
    expect(css).toContain('.battle-stage { grid-template-columns: 1fr; min-height: 440px; padding: 10px; }')
    expect(css).toContain('.battle-dog-img { width: 92px; height: 92px; }')
  })

  it('adds third-pass handdrawn detail to the shop, inventory, and dog selection surfaces', () => {
    expect(cssRule('.shop-shelf.sketch-panel::before')).toContain('content: ""')
    expect(cssRule('.shop-shelf.sketch-panel::after')).toContain('linear-gradient')
    expect(cssRule('.offer-row')).toContain('align-items: stretch')
    expect(cssRule('.paper-shop-card')).toContain('transform-origin')
    expect(cssRule('.paper-shop-card:hover .shop-item-icon')).toContain('rotate')
    expect(cssRule('.paper-inventory .slot-grid::before')).toContain('radial-gradient')
    expect(cssRule('.paper-inventory .grid-heading h3::after')).toContain('content: ""')
    expect(cssRule('.paper-dog-card .dog-art-frame')).toContain('position: relative')
    expect(cssRule('.paper-dog-card .dog-art-frame::after')).toContain('border')
    expect(cssRule('.paper-dog-card.selected')).toContain('var(--selection-wash)')
    expect(cssRule('.dog-card-grid')).toContain('align-items: stretch')
  })

  it('adds fourth-pass handdrawn detail to history, tips, relics, and reward choices', () => {
    expect(cssRule('.player-history-panel::before')).toContain('content: ""')
    expect(cssRule('.history-run-row::before')).toContain('linear-gradient')
    expect(cssRule('.history-open-action')).toContain('var(--pressed-sketch-shadow)')
    expect(cssRule('.floating-tip.paper-card::before')).toContain('content: ""')
    expect(cssRule('.tip-dice span')).toContain('box-shadow')
    expect(cssRule('.relic-slot-grid::before')).toContain('radial-gradient')
    expect(cssRule('.relic-slot::after')).toContain('border')
    expect(cssRule('.relic-icon-button[aria-pressed="true"]')).toContain('var(--selection-wash)')
    expect(cssRule('.reward-panel.paper-card::before')).toContain('content: ""')
    expect(cssRule('.reward-choice.selected')).toContain('var(--selection-wash)')
  })

  it('adds fifth-pass handdrawn feedback detail to controls, logs, and history overlays', () => {
    expect(css).toMatch(/\.action-button::after,[\s\S]*\.log-toggle::after\s*\{[\s\S]*content: ""/)
    expect(css).toMatch(/\.action-button:hover,[\s\S]*\.log-toggle:hover\s*\{[\s\S]*rotate/)
    expect(cssRule('.speed-row .active::after')).toContain('content: ""')
    expect(cssRule('.battle-log::before')).toContain('var(--paper-fiber)')
    expect(cssRule('.battle-log p::before')).toContain('content: ""')
    expect(cssRule('.battle-log p.system::before')).toContain('#ffe08a')
    expect(cssRule('.player-history-page::before')).toContain('radial-gradient')
    expect(cssRule('.history-detail-row.selected::before')).toContain('var(--selection-wash)')
    expect(cssRule('.history-empty-state::before')).toContain('border')
  })

  it('adds battle vfx causality styling for triggers, targets, and handwritten feedback', () => {
    expect(cssRule('.battle-item-trigger')).toContain('animation')
    expect(cssRule('.battle-item-trigger::after')).toContain('content: ""')
    expect(cssRule('.battle-dog.vfx-target-damage .battle-dog-img')).toContain('filter')
    expect(cssRule('.battle-dog.vfx-target-heal .battle-dog-img')).toContain('drop-shadow')
    expect(cssRule('.battle-dog.vfx-target-shield .hp::after')).toContain('content: ""')
    expect(cssRule('.battle-dog.vfx-target-poison .battle-dog-img')).toContain('saturate')
    expect(cssRule('.battle-dog.vfx-target-weak .battle-dog-img')).toContain('hue-rotate')
    expect(cssRule('.battle-dog.vfx-target-freeze .battle-dog-img')).toContain('drop-shadow')
    expect(css).toContain('@keyframes battleTriggerStamp')
    expect(css).toContain('@keyframes vfxDamageJolt')
  })

  it('keeps explanatory copy separated from nearby headings', () => {
    for (const selector of ['.auth-panel .brand-block > div', '.section-title > div', '.battle-toolbar > div']) {
      const rule = cssRule(selector)
      expect(rule).toContain('display: grid')
      expect(rule).toContain('gap: 6px')
    }
    expect(cssRule('.battle-toolbar p')).not.toContain('margin-top')
  })

  it('keeps game headings and hints readable when the system prefers dark mode', () => {
    expect(cssRule(':root')).toContain('color-scheme: light')
    expect(cssRule('h1, h2, h3')).toContain('color: var(--ink)')
    expect(cssRule('p, small')).toContain('color: var(--muted)')
    expect(cssRule('.screen-heading p')).toContain('color: var(--muted)')
    expect(cssRule('.battle-toolbar p')).toContain('color: var(--muted)')
  })

  it('styles the class reward awakening ceremony as a distinct special round surface', () => {
    expect(cssRule('.class-reward-ceremony')).toContain('min-height')
    expect(cssRule('.ceremony-stage')).toContain('animation')
    expect(cssRule('.ceremony-dog-avatar')).toContain('width')
    expect(cssRule('.ceremony-reward-preview')).toContain('grid-template-columns')
    expect(cssRule('.ceremony-skip-hint')).toContain('letter-spacing: 0')
  })

  it('keeps dogfight dog selection constrained inside the room action panel', () => {
    expect(css).not.toContain('.dogfight-picker .dog-select-layout')
    expect(cssRule('.dogfight-picker .dog-select')).toContain('grid-template-columns: 1fr')
    expect(cssRule('.dogfight-picker .dog-card-grid')).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(cssRule('.dogfight-picker .dog-detail-panel')).toContain('box-shadow: none')
    expect(cssRule('.dogfight-picker .dog-detail-art')).toContain('display: none')
  })

  it('stacks dogfight room columns on narrow screens', () => {
    expect(css).toContain('.dogfight-layout,')
    expect(css).toContain('.dogfight-room-columns {')
    expect(css).toContain('.dogfight-room-card {')
    expect(css).toContain('grid-template-columns: 1fr')
  })
})
