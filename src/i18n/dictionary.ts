import type { Language } from './types'

export type LocalizedText = Record<Language, string>

export const uiText = {
  appTitle: { 'zh-CN': '狗骰对战', 'en-US': 'Dog Dice Duel' },
  appSubtitle: {
    'zh-CN': '摆好装备，掷骰触发，挑战异步狗狗对手。',
    'en-US': 'Arrange gear, roll dice, and challenge async dog opponents.',
  },
  language: { 'zh-CN': '语言', 'en-US': 'Language' },
  chinese: { 'zh-CN': '中文', 'en-US': '中文' },
  english: { 'zh-CN': 'English', 'en-US': 'English' },
} satisfies Record<string, LocalizedText>

export function text(key: keyof typeof uiText, language: Language) {
  return uiText[key][language]
}
