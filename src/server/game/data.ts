import type { DogType, ItemDef, ShopType } from './types'

export const DOGS: Record<DogType, { name: string; trait: string }> = {
  SHIBA: { name: '柴犬', trait: '20% 概率改掷为小点 1/2/3' },
  SAMOYED: { name: '萨摩耶', trait: '20% 概率改掷为大点 4/5/6' },
  MUTT: { name: '土狗', trait: '20% 概率额外投掷一次' },
  BULLY: { name: '恶霸', trait: '40% 概率使本次触发的大型物品效果翻倍' },
  EMPEROR: { name: '狗皇帝', trait: '开局指定幸运数字，命中时 50% 概率使触发效果翻倍' },
}

function slotItem(
  id: string,
  name: string,
  size: 1 | 2 | 3 | 4,
  price: number,
  dice: number[],
  tags: string[],
  effect: ItemDef['effect'],
): ItemDef {
  return { id, name, size, width: size, height: 1, price, dice, tags, effect }
}

export const ITEM_DEFS: ItemDef[] = [
  ...[1, 2, 3, 4, 5, 6].map((n) =>
    slotItem(`starter-${n}`, `${n}点牙咬`, 1, 2, [n], ['starter'], { type: 'DAMAGE', amount: 5 }),
  ),
  slotItem('small-bite', '小型咬击', 1, 3, [1, 2, 3], ['small'], { type: 'DAMAGE', amount: 4 }),
  slotItem('lucky-paw', '幸运爪垫', 1, 4, [6], ['big'], { type: 'DAMAGE', amount: 12 }),
  slotItem('milk-bone', '牛奶骨头', 1, 4, [2, 4], ['heal'], { type: 'HEAL', amount: 6 }),
  slotItem('rubber-ball', '橡胶球', 2, 6, [3, 5], ['medium'], { type: 'DAMAGE', amount: 9 }),
  slotItem('spiked-collar', '尖刺项圈', 2, 7, [4, 5, 6], ['big', 'medium'], { type: 'DAMAGE', amount: 8 }),
  slotItem('training-disc', '训练飞盘', 2, 6, [1, 6], ['medium'], { type: 'DAMAGE', amount: 10 }),
  slotItem('guard-vest', '护卫背心', 3, 8, [1, 3, 5], ['medium', 'heal'], { type: 'HEAL', amount: 8 }),
  slotItem('giant-bone', '巨型骨棒', 4, 10, [5, 6], ['large', 'big'], { type: 'DAMAGE', amount: 16 }),
  slotItem('dog-house', '小狗窝', 4, 9, [1, 2], ['large', 'small'], { type: 'HEAL', amount: 12 }),
]

export function itemDef(id: string) {
  const found = ITEM_DEFS.find((item) => item.id === id)
  if (!found) throw new Error(`Unknown item def ${id}`)
  return found
}

export function shopPool(type: ShopType) {
  return ITEM_DEFS.filter((item) => {
    if (item.tags.includes('starter')) return false
    if (type === 'GENERAL') return true
    if (type === 'LARGE') return item.size === 4
    if (type === 'MEDIUM') return item.size === 2 || item.size === 3
    if (type === 'SMALL') return item.size === 1
    if (type === 'SMALL_DICE') return item.dice.some((n) => n <= 3)
    if (type === 'BIG_DICE') return item.dice.some((n) => n >= 4)
    return true
  })
}

export const SHOP_CHOICES: ShopType[] = ['GENERAL', 'LARGE', 'MEDIUM', 'SMALL', 'SMALL_DICE', 'BIG_DICE']
