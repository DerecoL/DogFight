import type { Language } from './types'

const originalText = new WeakMap<Text, string>()
const originalAttributes = new WeakMap<Element, Map<string, string>>()

const staticText: Record<string, string> = {
  '账号': 'Account',
  '密码': 'Password',
  '登录': 'Log in',
  '注册': 'Register',
  '当前狗狗': 'Current dog',
  '胜场': 'Wins',
  '容错': 'Lives',
  '金币': 'Gold',
  '回合': 'Round',
  '模式大厅': 'Mode lobby',
  '退出登录': 'Log out',
  '开始一局': 'Start run',
  '开始天梯': 'Start ladder',
  '开始休闲模式': 'Start casual',
  '继续休闲模式': 'Continue casual',
  '进入斗狗模式': 'Enter dogfight',
  '进入巅峰模式': 'Enter peak',
  '查看详情和装备': 'Details and gear',
  '查看装备': 'View gear',
  '选择你的狗狗伙伴': 'Choose your dog partner',
  '每个狗狗都有独特的被动特性和策略玩法': 'Each dog has a unique passive trait and strategy.',
  '被动特性': 'Passive trait',
  '策略说明': 'Strategy',
  '幸运数字': 'Lucky number',
  '选择职业装备': 'Choose class equipment',
  '领取职业装备': 'Claim class equipment',
  '选择遗物': 'Choose relic',
  '获得遗物': 'Gain relic',
  '选择升级装备': 'Choose equipment to upgrade',
  '免费升级': 'Free upgrade',
  '选择药水': 'Choose potion',
  '药水': 'Potion',
  '职业装备不可使用药水': 'Class equipment cannot use potions',
  '选择附魔': 'Choose enchantment',
  '免费': 'Free',
  '装备栏': 'Equipment',
  '背包': 'Bag',
  '遗物': 'Relics',
  '匹配': 'Match',
  '匹配对手': 'Match opponent',
  '刷新商店': 'Refresh shop',
  '拖到这里出售': 'Drop here to sell',
  '购买到背包': 'Buy to bag',
  '出售': 'Sell',
  '升级': 'Upgrade',
  '自动战斗': 'Auto battle',
  '准备播放战斗结果': 'Preparing battle playback',
  '展开日志': 'Open log',
  '收起日志': 'Collapse log',
  '你的装备栏': 'Your equipment',
  '对手装备栏': 'Opponent equipment',
  '玩家掷骰': 'Player roll',
  '对手掷骰': 'Opponent roll',
  '战斗结算': 'Battle result',
  '继续': 'Continue',
  '重新开始': 'Restart',
  '设置昵称': 'Set nickname',
  '昵称': 'Nickname',
  '确认': 'Confirm',
  '休闲模式': 'Casual',
  '天梯模式': 'Ladder',
  '斗狗模式': 'Dogfight',
  '巅峰模式': 'Peak',
  '犬王积分榜': 'Dog King leaderboard',
  '选择天梯狗狗': 'Choose ladder dog',
  '巅峰竞技场': 'Peak Arena',
  '可投入的完成狗': 'Completed dogs available',
  '暂无对局': 'No runs yet',
  '暂无房间，创建一个斗狗房间开始。': 'No rooms yet. Create a dogfight room to begin.',
  '创建房间': 'Create room',
  '加入房间': 'Join room',
  '随机匹配': 'Quick match',
  '观战': 'Spectate',
  '开始房间': 'Start room',
  '等待选狗': 'Waiting for dog',
  '参赛者': 'Entrant',
  '玩家': 'Player',
}

const attributeNames = ['title', 'aria-label']

export function translateLegacyText(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return text
  const translated = staticText[trimmed] ?? translatePattern(trimmed)
  if (!translated || translated === trimmed) return text
  return text.replace(trimmed, translated)
}

export function applyLegacyDomLocalization(language: Language, root: ParentNode = document) {
  if (typeof document === 'undefined') return () => undefined

  const apply = () => {
    localizeTextNodes(root, language)
    localizeAttributes(root, language)
    document.documentElement.lang = language
  }

  apply()

  if (language === 'zh-CN') return () => undefined

  const observer = new MutationObserver(() => apply())
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributeNames })
  return () => observer.disconnect()
}

function localizeTextNodes(root: ParentNode, language: Language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode() as Text | null
  while (node) {
    if (!originalText.has(node)) originalText.set(node, node.textContent ?? '')
    const source = originalText.get(node) ?? ''
    node.textContent = language === 'zh-CN' ? source : translateLegacyText(source)
    node = walker.nextNode() as Text | null
  }
}

function localizeAttributes(root: ParentNode, language: Language) {
  const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll('*'))] : Array.from(root.querySelectorAll('*'))
  for (const element of elements) {
    let originals = originalAttributes.get(element)
    if (!originals) {
      originals = new Map()
      originalAttributes.set(element, originals)
    }
    for (const name of attributeNames) {
      const value = element.getAttribute(name)
      if (value == null) continue
      if (!originals.has(name)) originals.set(name, value)
      const source = originals.get(name) ?? value
      element.setAttribute(name, language === 'zh-CN' ? source : translateLegacyText(source))
    }
  }
}

function translatePattern(text: string) {
  let translated = text
    .replace(/^第\s*(\d+)\s*回合$/, 'Round $1')
    .replace(/^(\d+)胜\s*(\d+)败$/, '$1W $2L')
    .replace(/^(\d+)胜$/, '$1W')
    .replace(/^(\d+)败$/, '$1L')
    .replace(/^装备\s*(\d+)$/, 'Gear $1')
    .replace(/^遗物\s*(\d+)\s*个\s*·\s*背包物品\s*(\d+)\s*个$/, 'Relics $1 · Bag items $2')
    .replace(/^遗物\s*(\d+)\s*个$/, 'Relics $1')
    .replace(/^背包物品\s*(\d+)\s*个$/, 'Bag items $1')
    .replace(/^价格\s*(\d+)$/, 'Price $1')
    .replace(/^出售\s*\+(\d+)$/, 'Sell +$1')
    .replace(/^占用\s*(\d+)\s*格$/, '$1 slots')
    .replace(/^(\d+)\s*格$/, '$1 slots')
    .replace(/^点数\s*(.+)$/, 'Dice $1')
    .replace(/^已拥有\s*x(\d+)$/, 'Owned x$1')
    .replace(/^可升级\s*(\d+)\s*件$/, '$1 upgradeable')
    .replace(/^当前\s*(\d+)\s*胜\s*(\d+)\s*败$/, 'Current $1W $2L')

  translated = translated
    .replace(/胜/g, 'W')
    .replace(/败/g, 'L')
    .replace(/回合/g, 'Round')
    .replace(/金币/g, 'Gold')

  return translated === text ? null : translated
}
