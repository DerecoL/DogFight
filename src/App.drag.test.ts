import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./App.css', import.meta.url), 'utf8')

describe('drag overlay layering', () => {
  it('renders dragged inventory items in a top-level overlay', () => {
    expect(app).toContain('DragOverlay')
    expect(app).toContain('function DraggingItemOverlay')
    expect(app).toContain('<DraggingItemOverlay />')
    expect(css).toContain('.drag-overlay-item')
    expect(css).toContain('z-index: 1000')
    expect(css).toContain('pointer-events: none')
  })

  it('starts item drags with a low movement threshold and shows immediate press feedback', () => {
    expect(app).toContain('activationConstraint: { distance: 2 }')
    expect(app).not.toContain("event.currentTarget.classList.add('input-active')")
    expect(app).not.toContain("event.currentTarget.classList.remove('input-active')")
    expect(app).not.toContain("node?.classList.remove('input-active')")
    expect(app).toContain('event.preventDefault()')
    expect(app).toContain('onClick(source)')
    expect(app).toContain('if (targetItem?.id === itemId) return')
    expect(css).not.toContain('.item-card.input-active,')
    expect(css).not.toContain('.item-card:active')
  })

  it('uses pointer-first collision detection so drag hover feedback follows the cursor', () => {
    expect(app).toContain('pointerWithin,')
    expect(app).toContain('rectIntersection,')
    expect(app).toContain('const dragCollisionDetection: CollisionDetection')
    expect(app).toContain('prioritizeDragCollisions(pointerCollisions)')
    expect(app).toContain("String(collision.id).startsWith('UPGRADE_ITEM:')")
    expect(app).toContain('collisionDetection={dragCollisionDetection}')
  })

  it('pre-measures drop targets before dragging starts', () => {
    expect(app).toContain('MeasuringStrategy,')
    expect(app).toContain('const dndMeasuring = { droppable: { strategy: MeasuringStrategy.BeforeDragging } }')
    expect(app).toContain('measuring={dndMeasuring}')
  })

  it('clears source press and upgrade feedback once an item is actively dragged', () => {
    expect(app).toContain('useDroppable({ id: `UPGRADE_ITEM:${item.id}` })')
    expect(app).toContain("source.classList.add('fast-drag-suppress-click')")
    expect(app).not.toContain("source.classList.add('dragging', 'fast-drag-suppress-click')")
    expect(app).toContain("source.classList.remove('dragging', 'input-active')")
  })

  it('does not drive drag follow feedback through root React state', () => {
    expect(app).not.toContain('const [draggingItemId, setDraggingItemId]')
    expect(app).not.toContain('setDraggingItemId(')
    expect(app).not.toContain('useDraggable({ id: item.id')
    expect(app).toContain('function startFastItemDrag')
    expect(app).toContain('data-drop-id')
    expect(app).not.toContain("document.body.classList.add('drag-performance-mode')")
    expect(app).not.toContain("document.body.classList.remove('drag-performance-mode')")
  })

  it('does not force a full hover cleanup layout on every drag move', () => {
    expect(app).not.toContain("document.querySelectorAll('.fast-drag-over')")
    expect(app).not.toContain('const [dragging, setDragging] = useState(false)')
    expect(app).not.toContain('setDragging(isDragging)')
    expect(app).not.toContain('const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)')
    expect(app).not.toContain('document.elementFromPoint(upEvent.clientX, upEvent.clientY)')
    expect(app).not.toContain('readFastDropTargets')
    expect(app).not.toContain('rect: element.getBoundingClientRect()')
    expect(app).toContain('const overId = dropIdFromEventTarget(upEvent.target)')
    expect(app).toContain('moveGhost(moveEvent.clientX, moveEvent.clientY)')
  })

  it('uses a lightweight drag ghost without full card art content', () => {
    expect(app).toContain('function DraggingItemGhost')
    expect(app).toContain('createFastDragGhost(item)')
    expect(app).not.toContain('dragging ? <DragSourcePlaceholder item={item} /> : <ItemCardContent')
    expect(app).not.toContain('function DragSourcePlaceholder')
    const overlayStart = app.indexOf('function DraggingItemOverlay')
    const overlayEnd = app.indexOf('function FloatingTip')
    const overlaySource = app.slice(overlayStart, overlayEnd)
    expect(overlaySource).not.toContain('ItemCardContent')
    expect(overlaySource).not.toContain('ItemArt')
    expect(overlaySource).not.toContain('<img')
    expect(overlaySource).not.toContain('itemIcon(')
  })

  it('applies press feedback immediately without waiting for a React state render', () => {
    expect(app).not.toContain('const [pressed, setPressed] = useState(false)')
    expect(app).not.toContain("event.currentTarget.classList.add('input-active')")
    expect(app).not.toContain("event.currentTarget.classList.remove('input-active')")
    expect(app).not.toContain("node?.classList.remove('input-active')")
  })

  it('defers heavy floating tip layout until after immediate selection feedback', () => {
    expect(app).toContain('function useDeferredTipAnchor')
    expect(app).toContain('window.setTimeout(() => {')
    expect(app).toContain('scheduleTipAnchor(element)')
    expect(app).toContain('if (!def || !anchor) return null')
    expect(app).toContain('return createPortal(tip, document.body)')
    expect(app).not.toContain('setTipAnchor(getFloatingTipPosition(element))')
  })

  it('enters a drag performance mode that disables expensive visuals while dragging', () => {
    expect(app).not.toContain("document.body.classList.add('drag-performance-mode')")
    expect(app).not.toContain("document.body.classList.remove('drag-performance-mode')")
    expect(css).toContain('.drag-performance-mode .item-card::before,')
    expect(css).toContain('.drag-performance-mode .item-card-icon-art')
    expect(css).toContain('.drag-performance-mode .upgrade-indicator')
    expect(css).toContain('.drag-performance-mode .floating-tip')
  })
})
