import type { Language } from './types'

const feedbackText: Record<string, string> = {
  '遗物已出售': 'Relic sold',
  '遗物已获得': 'Relic gained',
  '战斗开始': 'Battle starts',
  '购买成功': 'Purchased',
  '出售成功': 'Sold',
  '放置失败': 'Cannot place there',
  '升级失败': 'Cannot upgrade there',
}

const serverErrors: Record<string, string> = {
  '无效狗狗选择': 'Invalid dog selection',
  '狗皇帝需要选择 1-6 的幸运数字': 'Dog Emperor must choose a lucky number from 1 to 6',
  '当前不能调整装备': 'Equipment cannot be changed right now',
  '当前没有可选遗物': 'No relic choices are available',
  '当前没有可升级装备': 'No equipment can be upgraded right now',
  '装备不存在': 'Equipment does not exist',
  '无效职业装备': 'Invalid class equipment',
  '该装备已经拥有附魔': 'This item already has an enchantment',
  '当前不在遗物选择': 'You are not choosing a relic right now',
  '无效遗物': 'Invalid relic',
  '当前没有待结算战斗': 'There is no battle waiting to be settled',
  '没有可结算的战斗结果': 'There is no battle result to settle',
  '当前战斗已经生成结果，请先继续完成战斗结算': 'This battle already has a result. Continue and settle it first',
  '职业装备不可使用药水': 'Class equipment cannot use potions',
  '爆鸣计数器只能通过计数触发': 'Boom Counter can only trigger by counting',
  '斗狗房间加载失败': 'Failed to load dogfight rooms',
  '斗狗房间进入失败': 'Failed to enter dogfight room',
  '斗狗房间操作失败': 'Dogfight room action failed',
  '斗狗操作失败': 'Dogfight action failed',
  '战报读取失败': 'Failed to load battle report',
  '巅峰竞技场加载失败': 'Failed to load peak arena',
  '提交巅峰竞技场失败': 'Failed to submit to peak arena',
  '操作失败': 'Action failed',
}

const battleText: Record<string, string> = {
  '准备播放战斗结果': 'Preparing battle playback',
}

export function localizeFeedbackText(text: string, language: Language) {
  if (language === 'zh-CN') return text
  return feedbackText[text] ?? text
}

export function localizeServerError(text: string, language: Language) {
  if (language === 'zh-CN') return text
  return serverErrors[text] ?? text
}

export function localizeBattleEventText(text: string, language: Language) {
  if (language === 'zh-CN') return text
  return battleText[text] ?? translateBattlePattern(text) ?? text
}

function translateBattlePattern(text: string) {
  if (text.includes('使敌方最右侧装备') && text.includes('失效')) {
    const source = text.split('使敌方最右侧装备')[0]?.trim() || 'Item'
    return `${source} disables the rightmost enemy item once`
  }
  if (text.includes('光环使') && text.includes('装备获得') && text.includes('吸血')) {
    return text.includes('左右') ? 'Aura grants Lifesteal to both adjacent items' : 'Aura grants Lifesteal to the left adjacent item'
  }
  if (text.includes('狗皇帝幸运翻倍')) return 'Dog Emperor lucky double'
  if (text.includes('造成') && text.includes('伤害')) return text.replace('造成', 'deals ').replace('点伤害', ' damage')
  return null
}
