import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./App.css', import.meta.url), 'utf8')

describe('drag overlay layering', () => {
  it('renders dragged inventory items in a top-level overlay', () => {
    expect(app).toContain('DragOverlay')
    expect(app).toContain('function DraggingItemOverlay')
    expect(app).toContain('<DraggingItemOverlay item={draggingItem} relics={run.relics} />')
    expect(css).toContain('.drag-overlay-item')
    expect(css).toContain('z-index: 1000')
    expect(css).toContain('pointer-events: none')
  })

  it('starts item drags with a low movement threshold and shows immediate press feedback', () => {
    expect(app).toContain('activationConstraint: { distance: 2 }')
    expect(app).toContain('const [pressed, setPressed] = useState(false)')
    expect(app).toContain('setPressed(true)')
    expect(app).toContain('setPressed(false)')
    expect(app).toContain("pressed ? 'input-active' : ''")
    expect(app).toContain('if (targetItem?.id === itemId) return')
    expect(css).toContain('.item-card.input-active,')
    expect(css).toContain('.item-card:active')
  })

  it('uses a lightweight drag ghost without full card art content', () => {
    expect(app).toContain('function DraggingItemGhost')
    expect(app).toContain('return <DraggingItemGhost item={item} />')
    const overlayStart = app.indexOf('function DraggingItemOverlay')
    const overlayEnd = app.indexOf('function FloatingTip')
    const overlaySource = app.slice(overlayStart, overlayEnd)
    expect(overlaySource).not.toContain('ItemCardContent')
    expect(overlaySource).not.toContain('ItemArt')
  })
})
