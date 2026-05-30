import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./App.css', import.meta.url), 'utf8')
const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')

describe('item quality upgrade UI', () => {
  it('models item quality across the client and database', () => {
    expect(schema).toContain('quality   String   @default("BRONZE")')
    expect(app).toContain("type ItemQuality = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'")
    expect(app).toContain('quality: ItemQuality')
    expect(app).toContain('type ShopOffer = { offerId: string; defId: string; price: number; discount: number; quality?: ItemQuality; def?: ItemDef }')
    expect(app).toContain('qualityClass(item.quality)')
    expect(app).toContain('qualityClass(offer.quality)')
    expect(app).toContain('qualityLabel')
  })

  it('surfaces click and drag upgrade controls for duplicate items', () => {
    expect(app).toContain('canUpgradeItem')
    expect(app).toContain('canUpgradeDrop')
    expect(app).toContain('upgradeItem')
    expect(app).toContain("api(`/runs/${run.id}/items/upgrade`")
    expect(app).toContain('targetItemId')
    expect(app).toContain('UPGRADE_ITEM:')
    expect(app).toContain('moveItem(itemId, targetItem.area, targetItem.x, targetItem.y)')
    expect(app).toContain('upgrade-indicator')
    expect(app).toContain('升级')
  })

  it('defines four visually distinct quality glows for paper shop cards', () => {
    expect(css).toContain('.quality-bronze')
    expect(css).toContain('.quality-silver')
    expect(css).toContain('.quality-gold')
    expect(css).toContain('.quality-diamond')
    expect(css).toContain('.paper-shop-card.quality-bronze')
    expect(css).toContain('.paper-shop-card.quality-silver')
    expect(css).toContain('.paper-shop-card.quality-gold')
    expect(css).toContain('.paper-shop-card.quality-diamond')
    expect(css).toContain('--shop-paper-edge-ink: rgba(61, 45, 37, .74)')
    expect(css).toContain('--shop-quality-glow: rgba(255, 207, 66, 1)')
    expect(css).toContain('--shop-quality-glow: rgba(102, 231, 255, 1)')
    expect(css).toContain('.upgrade-indicator')
    expect(css).toContain('filter: var(--shop-paper-filter)')
    expect(css).toContain('drop-shadow(0 0 36px color-mix(in srgb, var(--shop-quality-glow) 68%, transparent))')
    expect(css).not.toMatch(/\.shop-card\.quality-bronze\s*\{/)
  })

  it('keeps inventory and battle slot surfaces distinct from bronze quality borders', () => {
    expect(css).toContain('background: var(--wood-grain), var(--wood-frame);')
    expect(css).toContain('border: 2px solid #b8c0ca;')
    expect(css).toContain('linear-gradient(180deg, #f2d2a1, #c88b4b)')
    expect(css).toContain('background: #fff4e4;')
  })
})
