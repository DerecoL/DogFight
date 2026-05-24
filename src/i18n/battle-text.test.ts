import { describe, expect, it } from 'vitest'
import { localizeBattleEventText, localizeFeedbackText, localizeServerError } from './battle-text'

const disabledRightmost = '毒牙 使敌方最右侧装备【失效】一次'
const battleStarts = '战斗开始'
const classPotionError = '职业装备不可使用药水'

describe('battle, feedback, and error localization', () => {
  it('localizes known battle event text', () => {
    expect(localizeBattleEventText(disabledRightmost, 'en-US')).toContain('rightmost enemy item')
    expect(localizeBattleEventText(disabledRightmost, 'zh-CN')).toBe(disabledRightmost)
  })

  it('localizes feedback and server errors', () => {
    expect(localizeFeedbackText(battleStarts, 'en-US')).toBe('Battle starts')
    expect(localizeServerError(classPotionError, 'en-US')).toBe('Class equipment cannot use potions')
  })

  it('falls back to original text for unknown messages', () => {
    expect(localizeServerError('unexpected backend message', 'en-US')).toBe('unexpected backend message')
  })
})
