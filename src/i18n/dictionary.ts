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
  battleReviewTitle: { 'zh-CN': '战斗数据看板', 'en-US': 'Battle Review' },
  battleReviewPlayer: { 'zh-CN': '我方', 'en-US': 'You' },
  battleReviewOpponent: { 'zh-CN': '对手', 'en-US': 'Opponent' },
  battleReviewDamage: { 'zh-CN': '总伤害', 'en-US': 'Damage' },
  battleReviewHealing: { 'zh-CN': '治疗', 'en-US': 'Healing' },
  battleReviewShield: { 'zh-CN': '护盾', 'en-US': 'Shield' },
  battleReviewPoisonDamage: { 'zh-CN': '毒伤', 'en-US': 'Poison' },
  battleReviewStatuses: { 'zh-CN': '状态', 'en-US': 'Statuses' },
  battleReviewTopItem: { 'zh-CN': '最高贡献', 'en-US': 'Top gear' },
  battleReviewNoItem: { 'zh-CN': '暂无明确装备贡献', 'en-US': 'No clear gear contribution' },
  battleReviewSystemDamage: { 'zh-CN': '系统伤害', 'en-US': 'System damage' },
  battleLogFilterAll: { 'zh-CN': '全部', 'en-US': 'All' },
  battleLogFilterDamage: { 'zh-CN': '伤害', 'en-US': 'Damage' },
  battleLogFilterSustain: { 'zh-CN': '治疗/护盾', 'en-US': 'Heal/Shield' },
  battleLogFilterStatus: { 'zh-CN': '状态', 'en-US': 'Status' },
  battleLogFilterEquipment: { 'zh-CN': '装备联动', 'en-US': 'Gear links' },
  battleLogFilterEmpty: { 'zh-CN': '当前分类暂无事件', 'en-US': 'No events in this category' },
} satisfies Record<string, LocalizedText>

export function text(key: keyof typeof uiText, language: Language) {
  return uiText[key][language]
}
