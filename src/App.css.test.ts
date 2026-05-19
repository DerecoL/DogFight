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
    expect(app).toContain('className="inventory-board expanded"')
    expect(css).toContain('overflow-x: visible')
    expect(app).toContain('repeat(${w}, minmax(0, 1fr))')
    expect(app.match(/w=\{12\} h=\{1\}/g)).toHaveLength(2)
    expect(app).toContain('12 格单行，战斗中默认不生效')
    expect(app).toContain("gridTemplateColumns: 'repeat(12, minmax(0, 1fr))'")
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

  it('uses the provided hand-drawn cream UI structure', () => {
    expect(css).toContain('--page: #fff4e4')
    expect(css).toContain('--ink: #3d2d25')
    expect(css).toContain('border: 3px solid var(--ink)')
    expect(css).not.toContain('linear-gradient(135deg, #ffe2ae')
    expect(app).not.toContain('<PageNav')
    expect(app).not.toContain('<ChapterProgress')
  })

  it('keeps explanatory copy separated from nearby headings', () => {
    for (const selector of ['.auth-panel .brand-block > div', '.section-title > div', '.battle-toolbar > div']) {
      const rule = cssRule(selector)
      expect(rule).toContain('display: grid')
      expect(rule).toContain('gap: 6px')
    }
    expect(cssRule('.battle-toolbar p')).not.toContain('margin-top')
  })
})
