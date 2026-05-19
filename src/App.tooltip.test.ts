import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./App.css', import.meta.url), 'utf8')

describe('item detail tooltip interactions', () => {
  it('positions item detail tips around the clicked item instead of the viewport corner', () => {
    expect(app).toContain('type TipAnchor')
    expect(app).toContain('function getFloatingTipPosition')
    expect(app).toContain('onInspectOffer')
    expect(app).toContain('onInspectItem')
    expect(css).toContain('left: var(--tip-x)')
    expect(css).toContain('top: var(--tip-y)')
    expect(css).not.toContain('right: 22px;\n  bottom: 22px')
  })

  it('raises item detail tips back into view when the clicked item is near the viewport edge', () => {
    expect(app).toContain('const centeredY = rect.top + rect.height / 2 - tipHeight / 2')
    expect(app).toContain('Math.min(Math.max(edge, centeredY), Math.max(edge, window.innerHeight - tipHeight - edge))')
  })

  it('lets both battle equipment rows open the same detail tip surface', () => {
    expect(app).toContain('battleTip')
    expect(app).toContain('onInspect={(item, element)')
    expect(app).toContain('onClick={(event) => onInspect(item, event.currentTarget)}')
    expect(app).toContain('<FloatingTip')
    expect(app).toContain('onSell={null}')
  })

  it('uses the compact card layout and dismisses tips by clicking outside', () => {
    expect(app).toContain('function useOutsideTipDismiss')
    expect(app).toContain("document.addEventListener('pointerdown'")
    expect(app).toContain("document.removeEventListener('pointerdown'")
    expect(app).not.toContain('className="tip-close"')
    expect(app).not.toContain('<X')
    expect(css).toContain('.tip-tags')
    expect(css).toContain('.tip-body')
    expect(css).toContain('.tip-dice')
    expect(css).toContain('.tip-description')
  })
})
