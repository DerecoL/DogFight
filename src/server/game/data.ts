import { normalizeQuality, qualityMultiplier } from './quality'
import type { AdvancedEffect, DogType, ItemDef, ItemQuality, RelicDef, RelicEffect, ShopType } from './types'

export const DOGS: Record<DogType, { name: string; trait: string }> = {
  SHIBA: { name: '柴犬', trait: '20% 概率改掷为小点 1/2/3' },
  SAMOYED: { name: '萨摩耶', trait: '20% 概率改掷为大点 4/5/6' },
  MUTT: { name: '土狗', trait: '20% 概率额外投掷一次' },
  BULLY: { name: '恶霸', trait: '40% 概率使本次触发的大型物品效果翻倍' },
  EMPEROR: { name: '狗皇帝', trait: '指定幸运数字，命中时 50% 概率使触发效果翻倍' },
}

function slotItem(
  id: string,
  name: string,
  size: 1 | 2 | 3 | 4,
  price: number,
  dice: number[],
  tags: string[],
  effect: ItemDef['effect'],
  extras: Partial<ItemDef> = {},
): ItemDef {
  return { id, name, size, width: size, height: 1, price, dice, tags, advancedEffect: 'NONE', ...extras, effect }
}

function classItem(
  classDog: DogType,
  unlockRound: 3 | 6,
  id: string,
  name: string,
  size: 1 | 2 | 3 | 4,
  dice: number[],
  tags: string[],
  description: string,
  advancedEffect: AdvancedEffect,
  defaultQuality: ItemQuality,
  effect: ItemDef['effect'] = { type: 'UTILITY', amount: 0 },
) {
  return slotItem(id, name, size, 0, dice, tags, effect, {
    kind: 'CLASS_EQUIPMENT',
    classDog,
    unlockRound,
    description,
    advancedEffect,
    defaultQuality,
  })
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
  slotItem('v3-broken-canine', '断裂的犬齿', 1, 3, [1, 2], ['small', 'weak'], { type: 'DAMAGE', amount: 3 }, {
    description: '造成 3 点伤害。若目标处于【虚弱】，额外造成 4 点真实伤害。',
    advancedEffect: 'TARGET_WEAK_BONUS_DAMAGE',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-chew-scratch-post', '耐咬磨爪柱', 1, 4, [1, 6], ['extreme', 'trigger'], { type: 'UTILITY', amount: 0 }, {
    description: '使【相邻】装备的下一次触发伤害 +4。',
    advancedEffect: 'ADJACENT_DAMAGE_BONUS',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-cone-collar', '耻辱圈(防咬套)', 1, 3, [1, 2, 3], ['small', 'shield'], { type: 'UTILITY', amount: 3 }, {
    description: '获得 3 点护盾。',
    advancedEffect: 'GAIN_SHIELD',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-dog-catnip', '特效狗薄荷', 1, 4, [3, 4], ['cleanse', 'heal'], { type: 'HEAL', amount: 4 }, {
    description: '恢复 4 点生命值，并使自身的一层【中毒】或者【虚弱】失效。',
    advancedEffect: 'CLEANSE_ONE',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-flea-disc', '跳蚤飞盘', 1, 4, [1], ['small', 'poison'], { type: 'UTILITY', amount: 2 }, {
    description: '对敌人施加 2 层【中毒】。',
    advancedEffect: 'APPLY_POISON',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-large-bone-sword', '大号磨牙骨剑', 2, 6, [3, 4, 5], ['stable', 'damage'], { type: 'DAMAGE', amount: 8 }, {
    description: '造成 8 点伤害。',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-wooden-shield', '狗屋木板盾', 2, 6, [2, 3, 4], ['stable', 'shield'], { type: 'UTILITY', amount: 9 }, {
    description: '获得 9 点护盾。',
    advancedEffect: 'GAIN_SHIELD',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-spiked-vest', '带刺防爆冲胸背', 2, 7, [4, 5, 6], ['big', 'thorn', 'shield'], { type: 'UTILITY', amount: 6 }, {
    description: '获得 6 点护盾，并获得 1 层【荆棘】。',
    advancedEffect: 'GAIN_SHIELD_THORNS',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-hydrant-axe', '消防栓战斧', 3, 8, [5, 6], ['big', 'weak'], { type: 'DAMAGE', amount: 15 }, {
    description: '造成 15 点伤害，并给敌人施加 1 层【虚弱】。',
    advancedEffect: 'APPLY_WEAK_ON_HIT',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-dinosaur-leg-bone', '巨型恐龙腿骨', 4, 10, [6], ['big', 'shield-break'], { type: 'DAMAGE', amount: 25 }, {
    description: '造成 25 点伤害。如果敌方有护盾，该次伤害直接对护盾造成 2 倍伤害。',
    advancedEffect: 'DOUBLE_SHIELD_DAMAGE',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-auto-waterer', '全自动饮水机', 4, 9, [1, 2, 3], ['small', 'growth', 'heal'], { type: 'HEAL', amount: 10 }, {
    description: '恢复 10 点生命值。如果你当前处于满血，则永久提升自身 1 点最大生命值。',
    advancedEffect: 'HEAL_OR_MAX_HP',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-night-patrol-light', '夜巡犬探照灯', 2, 12, [1, 2, 3], ['small', 'trigger'], { type: 'UTILITY', amount: 0 }, {
    description: '使你【相邻】的装备触发概率在接下来的 2 秒内暂时提升（底层权重翻倍）。',
    advancedEffect: 'ADJACENT_TEMP_TRIGGER',
    defaultQuality: 'GOLD',
  }),
  slotItem('v3-blood-mad-fang', '嗜血疯狗之牙', 2, 12, [1, 6], ['extreme', 'heal'], { type: 'DAMAGE', amount: 6 }, {
    description: '造成 6 点伤害，并将造成伤害的 100% 转化为自身治疗。',
    advancedEffect: 'LIFESTEAL',
    defaultQuality: 'GOLD',
  }),
  slotItem('v3-fermented-trash-bin', '发酵的翻倒垃圾桶', 4, 14, [4, 5, 6], ['big', 'poison', 'disable'], { type: 'UTILITY', amount: 5 }, {
    description: '对敌方施加 5 层【中毒】，并使敌方最右侧的一个装备【失效】一次。',
    advancedEffect: 'POISON_AND_DISABLE_RIGHTMOST',
    defaultQuality: 'GOLD',
  }),
  slotItem('v3-golden-kennel', '不可侵犯的纯金狗窝', 4, 18, [4, 5], ['shield', 'immune'], { type: 'UTILITY', amount: 25 }, {
    description: '获得 25 点护盾。只要你拥有护盾，你免疫所有【中毒】和【虚弱】的施加。',
    advancedEffect: 'SHIELD_IMMUNITY',
    defaultQuality: 'DIAMOND',
  }),
]

export const CLASS_REWARD_DEFS: ItemDef[] = [
  classItem('SHIBA', 3, 'shiba-speed-katana', '极速太刀', 1, [1, 2, 3], ['attack-speed', 'small'], '每次触发时，下一次投掷的间隔时间缩短0.1秒（最高叠加至0.5秒/次，战斗结束重置）', 'SHIBA_SPEED', 'GOLD', { type: 'DAMAGE', amount: 6 }),
  classItem('SHIBA', 3, 'shiba-great-katana', '大太刀', 2, [1, 2, 3], ['trigger', 'small'], '会额外触发该道具【相邻】的装备1次', 'TRIGGER_ADJACENT', 'GOLD', { type: 'DAMAGE', amount: 8 }),
  classItem('SHIBA', 3, 'shiba-swallow-katana', '燕回太刀', 1, [1, 2, 3], ['extra-roll', 'small'], '20%概率会额外投掷一次（可叠加，最多3次）', 'EXTRA_ROLL_CHANCE', 'GOLD', { type: 'DAMAGE', amount: 5 }),
  classItem('SHIBA', 6, 'shiba-shadow-clone', '忍法·影分身', 1, [1, 2, 3], ['small'], '每次投掷会投掷两次，选取更接近1~3的那次', 'ROLL_TWO_PICK_SMALL', 'DIAMOND'),
  classItem('SHIBA', 6, 'shiba-break', '忍法·破', 1, [1, 2, 3], ['small'], '装备将不按照点数触发，按照其容量触发', 'TRIGGER_BY_SIZE', 'DIAMOND'),
  classItem('SHIBA', 6, 'shiba-poison', '忍法·剧毒', 1, [1, 2, 3, 4, 5, 6], ['poison'], '每次投掷都会对敌人叠加3层【中毒】', 'POISON_ON_ROLL', 'DIAMOND'),

  classItem('SAMOYED', 3, 'samoyed-soft-fur', '松软毛皮', 2, [4, 5, 6], ['big', 'heal'], '每次触发恢复10的血量', 'NONE', 'GOLD', { type: 'HEAL', amount: 10 }),
  classItem('SAMOYED', 3, 'samoyed-thorn-fur', '荆棘毛发', 2, [4, 5, 6], ['big', 'thorn'], '每次触发有 50% 概率获得1层【荆棘】', 'GAIN_THORNS', 'GOLD'),
  classItem('SAMOYED', 3, 'samoyed-frost-fur', '冰霜毛发', 1, [4, 5, 6], ['big', 'weak'], '每次触发有 50% 概率给敌人施加 1 层【虚弱】', 'APPLY_WEAK', 'GOLD'),
  classItem('SAMOYED', 6, 'samoyed-avalanche-core', '雪崩核心', 3, [1, 2, 3], ['big'], '每当掷出【小点】时，积攒1层“雪崩”。5层雪崩时会清空层数同时对敌人造成50点伤害。每次雪崩后下次雪崩伤害加倍。', 'AVALANCHE', 'DIAMOND'),
  classItem('SAMOYED', 6, 'samoyed-absolute-zero', '绝对零度', 2, [4, 5, 6], ['big', 'weak'], '每当掷出【大点】时，积攒1层“冻结”。10层冻结时会清空层数同时使敌人冻结2S无法行动。', 'FREEZE_STACK', 'DIAMOND'),
  classItem('SAMOYED', 6, 'samoyed-cold-proof', '不畏严寒', 2, [4, 5, 6], ['big', 'reverse'], '每当掷出【大点】时，会额外触发一次该点减3的装备物品。', 'TRIGGER_MINUS_THREE', 'DIAMOND'),

  classItem('MUTT', 3, 'mutt-old-collar', '老旧项圈', 1, [1, 2, 3, 4, 5, 6], ['late', 'extra-roll'], '每当系统触发职业特性的“额外投掷”时，永久使你最大生命值+1', 'MAX_HP_ON_EXTRA_ROLL', 'GOLD'),
  classItem('MUTT', 3, 'mutt-counting-collar', '计数项圈', 2, [1, 2, 3, 4, 5, 6], ['extra-roll'], '战斗中每发生 4 次投掷，立即进行一次额外投掷', 'ROLL_COUNTER_EXTRA', 'GOLD'),
  classItem('MUTT', 3, 'mutt-charged-collar', '充能项圈', 1, [1, 2, 3, 4, 5, 6], ['extra-roll'], '发生额外投掷时，触发该装备【相邻】的装备1次', 'ADJACENT_ON_EXTRA_ROLL', 'GOLD'),
  classItem('MUTT', 6, 'mutt-chase-tail', '咬尾巴', 3, [1, 2, 3, 4, 5, 6], ['extra-roll'], '你的“额外投掷”也有 20% 的概率再次触发额外投掷（无嵌套上限）。且单局每一次连续投掷，使所有伤害临时提升10%', 'EXTRA_ROLL_RECURSE', 'DIAMOND'),
  classItem('MUTT', 6, 'mutt-chase-car', '追车车', 1, [1, 2, 3, 4, 5, 6], ['extra-roll'], '额外投掷会额外触发你所有的装备1次', 'EXTRA_ROLL_TRIGGERS_ALL', 'DIAMOND'),
  classItem('MUTT', 6, 'mutt-eat-air', '吃空气', 4, [1, 2, 3, 4, 5, 6], ['extra-roll'], '战斗开始后的前 10 秒内，基础投掷频率固定提升2倍，作为代价，此期间你无法通过任何途径获得治疗与护盾', 'DOUBLE_RATE_FIRST_TEN', 'DIAMOND'),

  classItem('BULLY', 3, 'bully-vault', '恶霸金库', 2, [1, 2, 3, 4, 5, 6], ['large'], '每回合战斗结束后获得一个【大型物品】', 'POST_BATTLE_LARGE_ITEM', 'GOLD'),
  classItem('BULLY', 3, 'bully-gym', '恶霸健身房', 3, [1, 2, 3, 4, 5, 6], ['large'], '【大型物品】触发时会额外触发随机一个非【大型物品】', 'LARGE_TRIGGERS_NON_LARGE', 'GOLD'),
  classItem('BULLY', 3, 'bully-armband', '恶霸袖标', 1, [1, 2, 3, 4, 5, 6], ['large'], '3格的物品也被算为【大型物品】', 'SIZE_THREE_IS_LARGE', 'GOLD'),
  classItem('BULLY', 6, 'bully-sacrifice', '无情献祭', 4, [1, 2, 3, 4, 5, 6], ['large'], '你场上所有的【小型物品】道具失去原有基础效果，每次触发时触发你的【大型物品】', 'SMALL_TRIGGERS_LARGE', 'DIAMOND'),
  classItem('BULLY', 6, 'bully-colossus', '巨兽压迫', 3, [1, 2, 3, 4, 5, 6], ['large'], '当你的【大型物品】成功触发“翻倍”效果时，有 20% 的几率获得4倍翻倍效果', 'BULLY_QUADRUPLE_CHANCE', 'DIAMOND'),
  classItem('BULLY', 6, 'bully-demolish', '无理强拆', 2, [1, 2, 3, 4, 5, 6], ['large'], '【大型物品】命中时会让对方的所有大型物品【失效】1次，可叠加', 'DISABLE_ENEMY_LARGE', 'DIAMOND'),

  classItem('EMPEROR', 3, 'emperor-dice-cup', '御用骰盅', 1, [1, 2, 3, 4, 5, 6], ['lucky'], '如果你连续 2 次投掷都没有掷出你的【天命数字】，则下一次系统投掷结果强行修正为【天命数字】', 'LUCKY_NUMBER_PITY', 'GOLD'),
  classItem('EMPEROR', 3, 'emperor-minister', '权臣架空', 2, [1, 2, 3, 4, 5, 6], ['lucky'], '非【天命数字】时获得5点护盾', 'SHIELD_ON_NON_LUCKY', 'GOLD'),
  classItem('EMPEROR', 3, 'emperor-robe', '金丝龙袍', 2, [1, 2, 3, 4, 5, 6], ['lucky'], '每次掷出【天命数字】时，瞬间驱散自身持有的所有负面状态', 'CLEANSE_ON_LUCKY', 'GOLD'),
  classItem('EMPEROR', 6, 'emperor-curtain', '垂帘听政', 2, [1, 2, 3, 4, 5, 6], ['lucky'], '原【天命数字】无效，该装备【相邻】的装备的触发数字为【天命数字】', 'ADJACENT_USES_LUCKY', 'DIAMOND'),
  classItem('EMPEROR', 6, 'emperor-edict', '蛮横圣旨', 2, [1, 2, 3, 4, 5, 6], ['lucky'], '战斗开始时，强行将敌我双方最左侧的 2 个道具的触发点数，强行篡改为你的【天命数字】', 'OPENING_FORCE_LUCKY', 'DIAMOND'),
  classItem('EMPEROR', 6, 'emperor-fallen', '亡国之君', 1, [1, 2, 3, 4, 5, 6], ['lucky'], '仅【天命数字】的装备才能生效（包含不计入），但是【天命数字】装备生效2次', 'ONLY_LUCKY_DOUBLE', 'DIAMOND'),
]

export const RELIC_DEFS: RelicDef[] = [
  { id: 'midas-left', name: '点金手·左', unlockRound: 3, defaultQuality: 'SILVER', tags: ['big'], effect: 'MIRROR_BIG_TO_SMALL', description: '你场上所有绑定在 4~6 点数的道具，现在在掷出对应减3的点数（即1~3）时也会触发，但效果降低 50%' },
  { id: 'midas-right', name: '点金手·右', unlockRound: 3, defaultQuality: 'SILVER', tags: ['small'], effect: 'MIRROR_SMALL_TO_BIG', description: '你场上所有绑定在 1~3 点数的道具，现在在掷出对应加3的点数（即4~6）时也会触发，但效果降低 50%' },
  { id: 'half-die-left', name: '半截骰·左', unlockRound: 3, defaultQuality: 'SILVER', tags: ['big'], effect: 'ONLY_BIG_HALF_EFFECT', description: '你只能投掷出4~6的点数，但所有装备效果降低50%' },
  { id: 'half-die-right', name: '半截骰·右', unlockRound: 3, defaultQuality: 'SILVER', tags: ['small'], effect: 'ONLY_SMALL_HALF_EFFECT', description: '你只能投掷出1~3的点数，但所有装备效果降低50%' },
  { id: 'v3-two-sided-gold-tag', name: '两面金狗牌', unlockRound: 3, defaultQuality: 'SILVER', tags: ['extreme'], effect: 'EXTREME_ROLL_BIAS', description: '你的投掷结果出现【极值】（1和6）的概率绝对值提升 30%。' },
  { id: 'v3-balanced-food-bowl', name: '平衡狗粮盆', unlockRound: 3, defaultQuality: 'SILVER', tags: ['middle'], effect: 'MIDDLE_ROLL_BIAS', description: '你的投掷结果出现 3 和 4 的概率绝对值提升 30%。' },
  { id: 'v3-lucky-foxtail', name: '幸运狗尾草', unlockRound: 3, defaultQuality: 'GOLD', tags: ['pity', 'large'], effect: 'EMPTY_ROLL_LARGE_SAFETY', description: '当你连续 2 次投掷“空过”时，第 3 次投掷必定为你随机触发一件【大型物品】（若没有则触发中型）。' },
  { id: 'v3-bad-dog-manual', name: '坏狗狗作案手册', unlockRound: 3, defaultQuality: 'GOLD', tags: ['poison'], effect: 'POISON_TICK_BONUS', description: '敌方身上的【中毒】状态每次结算时，额外造成 2 点伤害。' },
  { id: 'v3-fluffed-spike-collar', name: '炸毛护颈圈', unlockRound: 3, defaultQuality: 'GOLD', tags: ['thorn'], effect: 'OPENING_THORNS', description: '战斗开始时，你直接获得 5 层【荆棘】。' },
  { id: 'v3-husky-engine', name: '哈士奇永动机', unlockRound: 3, defaultQuality: 'DIAMOND', tags: ['attack-speed'], effect: 'HUSKY_ENGINE', description: '你的基础投掷间隔从 1 秒缩短至 0.85 秒。（全局攻速提升）' },
  { id: 'v3-fourth-dimensional-kennel', name: '四次元狗窝', unlockRound: 3, defaultQuality: 'DIAMOND', tags: ['space'], effect: 'EXTRA_EQUIPMENT_REDUCED_EFFECT', description: '你可以突破背包限制，将第 13 个装备放入战斗区，但你所有装备的触发效果降低 15%。' },
]

export const TERM_DEFS = [
  { term: '相邻', description: '该物品左边和右边的第1个物品', note: '无' },
  { term: '小点', description: '投掷出1~3点', note: '无' },
  { term: '大点', description: '投掷出4~6点', note: '无' },
  { term: '极值', description: '投掷出1和6点', note: '无' },
  { term: '荆棘', description: '每次受到攻击对敌方玩家造成3点伤害（可叠加）', note: '无' },
  { term: '中毒', description: '造成2秒持续伤害，每秒结算1次（可叠加，叠加刷新持续时间）', note: '无' },
  { term: '虚弱', description: '玩家的下次攻击造成的伤害减少50%（可叠加层数，不叠加效果）', note: '无' },
  { term: '大型物品', description: '容量为4的物品', note: '恶霸袖标可让3格物品也按大型物品处理' },
  { term: '中型物品', description: '容量为2或3的物品', note: '无' },
  { term: '小型物品', description: '容量为1的物品', note: '无' },
  { term: '失效', description: '下次生效将不会有任何行为，生效后去除一层该效果', note: '无' },
  { term: '天命数字', description: '开局时确定的幸运数字', note: '狗皇帝专属规则' },
]

export const ALL_ITEM_DEFS = [...ITEM_DEFS, ...CLASS_REWARD_DEFS]

export function itemDef(id: string) {
  const found = ALL_ITEM_DEFS.find((item) => item.id === id)
  if (!found) throw new Error(`Unknown item def ${id}`)
  return found
}

export function relicDef(id: string) {
  const found = RELIC_DEFS.find((relic) => relic.id === id)
  if (!found) throw new Error(`Unknown relic def ${id}`)
  return found
}

function relicQualityRatio(def: RelicDef, quality?: string | null) {
  return qualityMultiplier(normalizeQuality(quality)) / qualityMultiplier(def.defaultQuality)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function roundPercent(value: number) {
  return Math.round(value * 100)
}

export function relicEffectScale(relicId: string, quality?: string | null) {
  const def = relicDef(relicId)
  return clamp(0.5 * relicQualityRatio(def, quality), 0.25, 1)
}

export function relicRollBiasChance(relicId: string, quality?: string | null) {
  const def = relicDef(relicId)
  return clamp(0.3 * relicQualityRatio(def, quality), 0, 0.95)
}

export function relicOpeningThorns(relicId: string, quality?: string | null) {
  const def = relicDef(relicId)
  return Math.max(1, Math.round(5 * relicQualityRatio(def, quality)))
}

export function relicPoisonTickBonus(relicId: string, quality?: string | null) {
  const def = relicDef(relicId)
  return Math.max(1, Math.round(2 * relicQualityRatio(def, quality)))
}

export function relicEmptyRollMisses(relicId: string, quality?: string | null) {
  const def = relicDef(relicId)
  return Math.max(1, Math.round(2 / relicQualityRatio(def, quality)))
}

export function relicEquipmentEffectScale(relicId: string, quality?: string | null) {
  const def = relicDef(relicId)
  return clamp(0.85 * relicQualityRatio(def, quality), 0.5, 1)
}

export function relicDescription(relicId: string, quality?: string | null) {
  const def = relicDef(relicId)
  const currentQuality = normalizeQuality(quality)
  const retained = roundPercent(relicEffectScale(relicId, currentQuality))
  const rollBias = roundPercent(relicRollBiasChance(relicId, currentQuality))
  const effectReduction = 100 - retained
  const extraEquipmentReduction = 100 - roundPercent(relicEquipmentEffectScale(relicId, currentQuality))
  const descriptions: Record<RelicEffect, string> = {
    MIRROR_BIG_TO_SMALL: `你场上所有绑定在 4~6 点数的道具，现在在掷出对应减3的点数（即1~3）时也会触发，映射触发保留 ${retained}% 效果`,
    MIRROR_SMALL_TO_BIG: `你场上所有绑定在 1~3 点数的道具，现在在掷出对应加3的点数（即4~6）时也会触发，映射触发保留 ${retained}% 效果`,
    ONLY_BIG_HALF_EFFECT: `你只能掷出4~6的点数，但所有装备效果降低 ${effectReduction}%`,
    ONLY_SMALL_HALF_EFFECT: `你只能掷出1~3的点数，但所有装备效果降低 ${effectReduction}%`,
    EXTREME_ROLL_BIAS: `你的投掷结果出现【极值】（1和6）的概率绝对值提升 ${rollBias}%。`,
    MIDDLE_ROLL_BIAS: `你的投掷结果出现 3 和 4 的概率绝对值提升 ${rollBias}%。`,
    EMPTY_ROLL_LARGE_SAFETY: `当你连续 ${relicEmptyRollMisses(relicId, currentQuality)} 次投掷“空过”时，下一次投掷必定为你随机触发一件【大型物品】（若没有则触发中型）。`,
    POISON_TICK_BONUS: `敌方身上的【中毒】状态每次结算时，额外造成 ${relicPoisonTickBonus(relicId, currentQuality)} 点伤害。`,
    OPENING_THORNS: `战斗开始时，你直接获得 ${relicOpeningThorns(relicId, currentQuality)} 层【荆棘】。`,
    HUSKY_ENGINE: def.description,
    EXTRA_EQUIPMENT_REDUCED_EFFECT: `你可以突破背包限制，将第 13 个装备放入战斗区，但你所有装备的触发效果降低 ${extraEquipmentReduction}%。`,
  }
  return descriptions[def.effect]
}

export function relicDefForQuality(relicId: string, quality?: string | null): RelicDef {
  const def = relicDef(relicId)
  return { ...def, description: relicDescription(relicId, quality) }
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
    return false
  })
}

export const SHOP_CHOICES: ShopType[] = ['GENERAL', 'LARGE', 'MEDIUM', 'SMALL', 'SMALL_DICE', 'BIG_DICE']
