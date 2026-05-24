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
    expect(app).toContain('const [pressedItemId, setPressedItemId] = useState<string | null>(null)')
    expect(app).toContain('onPressStart={() => setPressedItemId(item.id)}')
    expect(app).toContain('onPressEnd={() => setPressedItemId(null)}')
    expect(app).toContain("pressed ? 'input-active' : ''")
    expect(app).toContain('if (targetItem?.id === itemId) return')
    expect(css).toContain('.item-card.input-active,')
    expect(css).toContain('.item-card:active')
  })
})
