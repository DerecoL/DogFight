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

  it('keeps tall bottom-bar item tips fully usable within the viewport', () => {
    expect(cssRule('.floating-tip')).toContain('max-height: min(440px, calc(100dvh - 28px))')
    expect(cssRule('.floating-tip')).toContain('overflow-y: auto')
    expect(cssRule('.floating-tip.paper-card')).toContain('overflow: auto')
    expect(cssRule('.floating-tip.paper-card')).not.toContain('overflow: visible')
    expect(cssRule('.tip-actions')).toContain('position: sticky')
    expect(cssRule('.tip-actions')).toContain('bottom: 0')
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
    expect(cssRule('.tip-icon-frame')).toContain('position: relative')
    expect(cssRule('.tip-icon-frame')).toContain('isolation: isolate')
    expect(cssRule('.tip-art-preview')).toContain('grid-area: 1 / 1')
    expect(cssRule('.tip-art-preview')).toContain('max-width: none')
    expect(cssRule('.tip-icon')).toContain('grid-area: 1 / 1')
    expect(cssRule('.tip-icon')).toContain('z-index: 2')
  })

  it('shows the sell value next to the sell action for inspected items', () => {
    expect(app).toContain('function purchaseValueForItem(def: ItemDef, quality: ItemQuality = normalizeQuality(def.defaultQuality))')
    expect(app).toContain('function sellValueForItem(item: Item)')
    expect(app).toContain('Math.floor(purchaseValueForItem(item.def, item.quality) / 2) + (item.sellBonus ?? 0)')
    expect(app).toContain('const sellValue = item ? sellValueForItem(item) : null')
    expect(app).toContain('出售 +{sellValue}')
  })

  it('keeps tip copy readable when names, tags, or rule terms wrap', () => {
    expect(cssRule('.floating-tip')).toContain('min-width: 0')
    expect(cssRule('.floating-tip')).toContain('word-break: normal')
    expect(cssRule('.floating-tip')).toContain('overflow-wrap: break-word')
    expect(cssRule('.tip-tags')).toContain('min-width: 0')
    expect(cssRule('.tip-tag')).toContain('max-width: 100%')
    expect(cssRule('.tip-tag')).toContain('white-space: normal')
    expect(cssRule('.tip-tags .size-badge')).toContain('max-width: 100%')
    expect(cssRule('.tip-tags .size-badge')).toContain('white-space: normal')
    expect(cssRule('.tip-body')).toContain('min-width: 0')
    expect(cssRule('.tip-identity h3')).toContain('overflow-wrap: anywhere')
    expect(cssRule('.tip-description')).toContain('display: block')
    expect(cssRule('.tip-description')).toContain('word-break: normal')
    expect(cssRule('.tip-description')).toContain('line-height: 1.45')
    expect(cssRule('.tip-description')).toContain('overflow-wrap: break-word')
    expect(cssRule('.rule-term-wrap')).toContain('max-width: 100%')
    expect(cssRule('.rule-tip')).toContain('max-width: calc(100vw - 32px)')
    expect(cssRule('.rule-tip')).toContain('overflow-wrap: anywhere')
    expect(cssRule('.relic-tip-identity')).toContain('min-width: 0')
    expect(cssRule('.relic-tip-identity h3')).toContain('overflow-wrap: anywhere')
  })

  it('raises opened rule tips above neighboring panels', () => {
    expect(cssRule('.rule-tip')).toContain('z-index: 1301')
  })

  it('renders opened rule tips outside the parent text flow so the copy card keeps its size', () => {
    expect(app).toContain("import { createPortal } from 'react-dom'")
    expect(app).toContain('type RuleTermTipState')
    expect(app).toContain('function RuleTermFloatingTip')
    expect(app).toContain('createPortal(')
    expect(app).toMatch(/const position = getRuleTermTipPosition\(event\.currentTarget\)\s*setOpenTerm\(\(current\) => \{/)
    expect(app).toContain('className={`rule-tip paper-card rule-tip-floating ${tip.placement}`}')
    expect(cssRule('.rule-tip.rule-tip-floating')).toContain('position: fixed')
    expect(cssRule('.rule-tip.rule-tip-floating.above')).toContain('transform: translateY(-100%) rotate(-.35deg)')
    expect(cssRule('.rule-tip-floating')).toContain('left: var(--rule-tip-x)')
    expect(cssRule('.rule-tip-floating')).toContain('top: var(--rule-tip-y)')
    expect(cssRule('.rule-term-wrap')).toContain('display: contents')
    expect(css).not.toContain('.paper-card:has(.rule-tip)')
  })

  it('lets battle status chips open compact rule tips', () => {
    expect(app).toContain('type StatusTipState')
    expect(app).toContain('const statusTipDetails')
    expect(app).toContain('function StatusFloatingTip')
    expect(app).toMatch(/function StatusFloatingTip[\s\S]*createPortal\(/)
    expect(app).toMatch(/function StatusFloatingTip[\s\S]*document\.body/)
    expect(app).toContain('const [statusTip, setStatusTip] = useState<StatusTipState | null>(null)')
    expect(app).toContain('onStatusInspect')
    expect(app).toMatch(/onClick=\{\(event\) => \{\s*event\.stopPropagation\(\)\s*onStatusInspect/)
    expect(app).toContain('aria-label={`查看${status.label}说明`}')
    expect(app).toContain('className={`status-chip handdrawn-status-chip ${status.type}`}')
    expect(app).toContain('<StatusFloatingTip statusTip={statusTip} onClose={() => setStatusTip(null)} />')
    expect(app).toContain('useOutsideTipDismiss(Boolean(statusTip), onClose)')
    expect(app).toContain('statusTipId')
    expect(app).toContain('aria-describedby')
    expect(app).toContain('aria-expanded')
    expect(app).toContain('aria-controls')
    expect(app).toContain("event.key === 'Escape'")
    for (const statusType of ['shield', 'thorns', 'extraRoll', 'fury', 'poison', 'weak', 'freeze', 'disabled']) {
      expect(app).toContain(`${statusType}: {`)
    }
  })
})

function cssRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  return match?.[1] ?? ''
}
