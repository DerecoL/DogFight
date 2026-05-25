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

  it('uses pointer-first collision detection so drag hover feedback follows the cursor', () => {
    expect(app).toContain('pointerWithin,')
    expect(app).toContain('rectIntersection,')
    expect(app).toContain('const dragCollisionDetection: CollisionDetection')
    expect(app).toContain('prioritizeDragCollisions(pointerCollisions)')
    expect(app).toContain("String(collision.id).startsWith('UPGRADE_ITEM:')")
    expect(app).toContain('collisionDetection={dragCollisionDetection}')
  })

  it('clears source press and upgrade feedback once an item is actively dragged', () => {
    expect(app).toContain('useDroppable({ id: `UPGRADE_ITEM:${item.id}`, disabled: dragging })')
    expect(app).toContain('if (dragging) setPressed(false)')
  })

  it('uses a lightweight drag ghost without full card art content', () => {
    expect(app).toContain('function DraggingItemGhost')
    expect(app).toContain('return <DraggingItemGhost item={item} />')
    expect(app).toContain('dragging ? <DraggingItemGhost item={item} source /> : <ItemCardContent')
    const overlayStart = app.indexOf('function DraggingItemOverlay')
    const overlayEnd = app.indexOf('function FloatingTip')
    const overlaySource = app.slice(overlayStart, overlayEnd)
    expect(overlaySource).not.toContain('ItemCardContent')
    expect(overlaySource).not.toContain('ItemArt')
  })
})
