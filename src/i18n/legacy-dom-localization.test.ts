import { describe, expect, it } from 'vitest'
import { translateLegacyText } from './legacy-dom-localization'

describe('legacy DOM localization fallback', () => {
  it('translates known static UI copy', () => {
    expect(translateLegacyText('登录')).toBe('Log in')
    expect(translateLegacyText('开始一局')).toBe('Start run')
    expect(translateLegacyText('装备栏')).toBe('Equipment')
  })

  it('translates common dynamic Chinese patterns', () => {
    expect(translateLegacyText('第 3 回合')).toBe('Round 3')
    expect(translateLegacyText('7胜 2败')).toBe('7W 2L')
    expect(translateLegacyText('遗物 2 个 · 背包物品 4 个')).toBe('Relics 2 · Bag items 4')
  })

  it('preserves unknown text', () => {
    expect(translateLegacyText('not localized')).toBe('not localized')
  })
})
