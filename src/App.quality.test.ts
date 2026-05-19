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
    expect(app).toContain('upgradeItem')
    expect(app).toContain("api(`/runs/${run.id}/items/upgrade`")
    expect(app).toContain('targetItemId')
    expect(app).toContain('UPGRADE_ITEM:')
    expect(app).toContain('upgrade-indicator')
    expect(app).toContain('升级')
  })

  it('defines four visually distinct mixed quality borders', () => {
    expect(css).toContain('.quality-bronze')
    expect(css).toContain('.quality-silver')
    expect(css).toContain('.quality-gold')
    expect(css).toContain('.quality-diamond')
    expect(css).toContain('.shop-card.quality-bronze')
    expect(css).toContain('.shop-card.quality-silver')
    expect(css).toContain('.shop-card.quality-gold')
    expect(css).toContain('.shop-card.quality-diamond')
    expect(css).toContain('.upgrade-indicator')
    expect(css).toContain('linear-gradient(135deg')
    expect(css).toContain('0 0 18px')
  })

  it('keeps inventory and bag slot colors neutral against bronze quality borders', () => {
    expect(css).toContain('background: linear-gradient(180deg, #eef0f2, #dfe3e7);')
    expect(css).toContain('border: 2px solid #b8c0ca;')
    expect(css).toContain('background: linear-gradient(180deg, #4b5158, #363b42);')
  })
})
