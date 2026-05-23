import { normalizeQuality, qualityAmount, qualityAmountFrom, qualityMultiplier } from './quality'
import type { AdvancedEffect, DogType, ItemDef, ItemQuality, RelicDef, RelicEffect, ShopType } from './types'
import { TERM_DEFS } from '../../shared/rule-terms'
export { TERM_DEFS }

export const DOGS: Record<DogType, { name: string; trait: string }> = {
  SHIBA: { name: '柴犬', trait: '20% 概率改掷为【小点】 1/2/3' },
  SAMOYED: { name: '萨摩耶', trait: '20% 概率改掷为【大点】 4/5/6' },
  MUTT: { name: '土狗', trait: '20% 概率【额外投掷】一次' },
  BULLY: { name: '恶霸', trait: '40% 概率使本次触发的【大型物品】效果翻倍' },
  EMPEROR: { name: '狗皇帝', trait: '指定【天命数字】（幸运数字），命中时 50% 概率使触发效果翻倍' },
}

export const SHIBA_POISON_ON_ROLL_AMOUNT = 6
export const THORNS_DAMAGE_PER_STACK = 2
export const BOOM_COUNTER_TRIGGER_THRESHOLD = 50

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
  slotItem('small-bite', '小型咬击', 1, 3, [1, 2, 3], ['small', 'weak'], { type: 'DAMAGE', amount: 4 }, {
    description: '造成 4 点伤害。命中后有 20% 概率给敌人施加 1 层【虚弱】。',
    advancedEffect: 'APPLY_WEAK_20_ON_HIT',
  }),
  slotItem('lucky-paw', '幸运爪垫', 1, 4, [6], ['big'], { type: 'DAMAGE', amount: 12 }),
  slotItem('milk-bone', '牛奶骨头', 1, 4, [2, 4], ['heal'], { type: 'HEAL', amount: 6 }),
  slotItem('rubber-ball', '橡胶球', 2, 6, [3, 5], ['medium'], { type: 'DAMAGE', amount: 9 }),
  slotItem('spiked-collar', '尖刺项圈', 2, 7, [4, 5, 6], ['big', 'medium'], { type: 'DAMAGE', amount: 8 }),
  slotItem('training-disc', '训练飞盘', 2, 6, [1, 6], ['medium'], { type: 'DAMAGE', amount: 10 }),
  slotItem('guard-vest', '护卫背心', 3, 8, [1, 3, 5], ['medium', 'heal'], { type: 'HEAL', amount: 8 }),
  slotItem('giant-bone', '巨型骨棒', 4, 10, [5, 6], ['large', 'big', 'fury'], { type: 'DAMAGE', amount: 16 }, {
    description: '造成 16 点伤害。攻击时有 50% 概率触发【激昂】；【激昂】使所有攻击伤害 +1，可叠加。',
    advancedEffect: 'GAIN_FURY_ON_ATTACK',
  }),
  slotItem('dog-house', '小狗窝', 4, 9, [1, 2], ['large', 'small'], { type: 'HEAL', amount: 12 }, {
    description: '恢复 12 点生命值，并偷取敌方 1 层增益（优先【荆棘】，其次【加速】；【护盾】不会被偷取）。',
    advancedEffect: 'STEAL_ENEMY_BUFF',
  }),
  slotItem('dog-gold-ingot', '狗狗金元宝', 1, 2, [], ['economy', 'sell'], { type: 'UTILITY', amount: 0 }, {
    description: '无需触发。放在装备栏时，参战结束后出售价格 +3。',
    advancedEffect: 'POST_BATTLE_EQUIPPED_SELL_BONUS',
    defaultQuality: 'BRONZE',
  }),
  slotItem('dog-silver-ingot', '狗狗银元宝', 1, 1, [], ['economy', 'sell'], { type: 'UTILITY', amount: 0 }, {
    description: '无需触发。放在装备栏或背包时，参战结束后出售价格 +3。',
    advancedEffect: 'POST_BATTLE_CARRIED_SELL_BONUS',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-broken-canine', '断裂的犬齿', 1, 3, [1, 2], ['small', 'weak'], { type: 'DAMAGE', amount: 3 }, {
    description: '造成 3 点伤害。若目标处于【虚弱】，额外造成 4 点【真实伤害】。',
    advancedEffect: 'TARGET_WEAK_BONUS_DAMAGE',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-chew-scratch-post', '耐咬磨爪柱', 1, 4, [1, 6], ['extreme', 'trigger'], { type: 'UTILITY', amount: 0 }, {
    description: '使【相邻】装备的下一次触发伤害 +4。',
    advancedEffect: 'ADJACENT_DAMAGE_BONUS',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-cone-collar', '耻辱圈(防咬套)', 1, 3, [1, 2, 3], ['small', 'shield'], { type: 'UTILITY', amount: 3 }, {
    description: '获得 3 点【护盾】。',
    advancedEffect: 'GAIN_SHIELD',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-dog-catnip', '特效狗薄荷', 1, 4, [3, 4], ['cleanse', 'heal'], { type: 'HEAL', amount: 4 }, {
    description: '恢复 4 点生命值，并【净化】自身的一层【中毒】或者【虚弱】。',
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
  slotItem('v3-wooden-shield', '狗屋木板盾', 2, 6, [2, 3, 4], ['stable', 'shield'], { type: 'UTILITY', amount: 8 }, {
    description: '获得 8 点【护盾】。',
    advancedEffect: 'GAIN_SHIELD',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-spiked-vest', '带刺防爆冲胸背', 2, 7, [4, 5, 6], ['big', 'thorn', 'shield'], { type: 'UTILITY', amount: 1 }, {
    description: '获得 1 点【护盾】，并获得 1 层【荆棘】。',
    advancedEffect: 'GAIN_SHIELD_THORNS',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-hydrant-axe', '消防栓战斧', 3, 8, [5, 6], ['big', 'weak'], { type: 'DAMAGE', amount: 15 }, {
    description: '造成 15 点伤害，并给敌人施加 1 层【虚弱】。',
    advancedEffect: 'APPLY_WEAK_ON_HIT',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-dinosaur-leg-bone', '巨型恐龙腿骨', 4, 10, [5, 6], ['big', 'shield-break'], { type: 'DAMAGE', amount: 18 }, {
    description: '造成 18 点伤害。如果敌方有【护盾】，该次伤害直接对【护盾】造成 2 倍伤害。',
    advancedEffect: 'DOUBLE_SHIELD_DAMAGE',
    defaultQuality: 'BRONZE',
  }),
  slotItem('v3-auto-waterer', '全自动饮水机', 4, 9, [1, 2, 3], ['small', 'growth', 'heal'], { type: 'HEAL', amount: 8 }, {
    description: '恢复 8 点生命值。如果你当前处于满血，则永久提升自身 1 点最大生命值。',
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
  slotItem('v3-golden-kennel', '不可侵犯的纯金狗窝', 4, 11, [4, 5], ['shield', 'immune'], { type: 'UTILITY', amount: 14, qualityBase: 'DIAMOND' }, {
    description: '获得 14 点【护盾】。只要你拥有【护盾】，你受到的【中毒】和【虚弱】层数减半（向上取整）。',
    advancedEffect: 'SHIELD_IMMUNITY',
    defaultQuality: 'DIAMOND',
  }),
  slotItem('v4-blood-contract-fang', '血契犬牙', 2, 12, [1, 6], ['lifesteal', 'support', 'extreme'], { type: 'UTILITY', amount: 0 }, {
    description: '触发时，使左边 1 个【相邻】装备获得【吸血】直到战斗结束。钻石品质改为使左右【相邻】装备都获得【吸血】。',
    advancedEffect: 'GRANT_LIFESTEAL_ADJACENT',
    defaultQuality: 'GOLD',
  }),
  slotItem('v4-boom-counter', '爆鸣计数器', 2, 14, [], ['counter', 'trigger', 'damage'], { type: 'UTILITY', amount: 380, qualityBase: 'GOLD' }, {
    description: '只能通过计数触发。己方其他装备每成功触发 1 次，获得 1 点【爆鸣计数】。达到 50 点后清零，对敌方造成 380 点直接伤害。升级只提高伤害。',
    advancedEffect: 'BOOM_COUNTER',
    defaultQuality: 'GOLD',
  }),
  slotItem('v4-growing-chew-sword', '磨牙成长剑', 2, 9, [2, 3, 4], ['growth', 'damage', 'stable'], { type: 'DAMAGE', amount: 1, qualityBase: 'SILVER' }, {
    description: '初始造成 1 点伤害。每次该装备成功触发后，本局内后续伤害 +3，无成长次数上限。',
    advancedEffect: 'GROWTH_DAMAGE',
    defaultQuality: 'SILVER',
  }),
  slotItem('v4-reverse-fur-comb', '逆毛净化梳', 1, 8, [3, 4], ['cleanse', 'heal', 'counter'], { type: 'UTILITY', amount: 3, qualityBase: 'SILVER' }, {
    description: '【净化】敌方最多 3 层正面增益；每实际清除 1 层，自己恢复 5 点生命。优先清除【荆棘】，再清除【加速】层数，最后每 8 点【护盾】折算 1 层。',
    advancedEffect: 'PURGE_ENEMY_BUFFS',
    defaultQuality: 'SILVER',
  }),
  slotItem('patting-bear', '拍拍熊', 2, 10, [1, 6], ['wound', 'attack'], { type: 'UTILITY', amount: 1, qualityBase: 'SILVER' }, {
    description: '每次触发对敌人叠加 1 层【伤口】；【伤口】使受到的直接攻击伤害 +1，可叠加，不影响【中毒】、【荆棘】等非直接攻击伤害。',
    advancedEffect: 'APPLY_WOUND',
    defaultQuality: 'SILVER',
  }),
  slotItem('poisoned-dog-fang', '淬毒狗牙', 2, 7.5, [], ['poison', 'attack', 'passive'], { type: 'UTILITY', amount: 2, qualityBase: 'GOLD' }, {
    description: '无需触发。每次攻击命中时，对敌人施加 1 层【中毒】。',
    advancedEffect: 'POISON_ON_ATTACK_HIT',
    defaultQuality: 'SILVER',
  }),
]

export const CLASS_REWARD_DEFS: ItemDef[] = [
  classItem('SHIBA', 3, 'shiba-speed-katana', '极速太刀', 1, [1, 2, 3], ['attack-speed', 'small'], '每次触发时，获得 1 层【加速】（最高叠加至 5 层，战斗结束重置）', 'SHIBA_SPEED', 'GOLD', { type: 'DAMAGE', amount: 6 }),
  classItem('SHIBA', 3, 'shiba-great-katana', '大太刀', 2, [1, 2, 3], ['trigger', 'small'], '会额外触发该道具【相邻】的装备 1 次', 'TRIGGER_ADJACENT', 'GOLD', { type: 'DAMAGE', amount: 8 }),
  classItem('SHIBA', 3, 'shiba-swallow-katana', '燕回太刀', 1, [1, 2, 3], ['extra-roll', 'small'], '20% 概率会【额外投掷】一次（可叠加，最多 3 次）', 'EXTRA_ROLL_CHANCE', 'GOLD', { type: 'DAMAGE', amount: 5 }),
  classItem('SHIBA', 6, 'shiba-shadow-clone', '忍法·影分身', 1, [1, 2, 3], ['small'], '每次投掷会投掷两次，选取更接近1~3的那次', 'ROLL_TWO_PICK_SMALL', 'DIAMOND'),
  classItem('SHIBA', 6, 'shiba-break', '忍法·破', 1, [1, 2, 3], ['small'], '装备将不按照点数触发，按照其容量触发；按容量触发时有 50% 概率额外触发 1 次', 'TRIGGER_BY_SIZE', 'DIAMOND'),
  classItem('SHIBA', 6, 'shiba-poison', '忍法·剧毒', 1, [1, 2, 3, 4, 5, 6], ['poison'], `每次投掷都会对敌人叠加${SHIBA_POISON_ON_ROLL_AMOUNT}层【中毒】（不随品质提升）`, 'POISON_ON_ROLL', 'DIAMOND'),

  classItem('SAMOYED', 3, 'samoyed-soft-fur', '松软毛皮', 2, [4, 5, 6], ['big', 'heal'], '每次触发恢复8的血量', 'NONE', 'GOLD', { type: 'HEAL', amount: 8 }),
  classItem('SAMOYED', 3, 'samoyed-thorn-fur', '荆棘毛发', 2, [4, 5, 6], ['big', 'thorn'], '每次触发有 50% 概率获得 1 层【荆棘】', 'GAIN_THORNS', 'GOLD'),
  classItem('SAMOYED', 3, 'samoyed-frost-fur', '冰霜毛发', 1, [4, 5, 6], ['big', 'weak'], '每次触发有 50% 概率给敌人施加 1 层【虚弱】', 'APPLY_WEAK', 'GOLD'),
  classItem('SAMOYED', 6, 'samoyed-avalanche-core', '雪崩核心', 3, [1, 2, 3], ['big'], '每当掷出【小点】时，积攒 1 层【雪崩】。5 层【雪崩】时会清空层数同时对敌人造成 50 点伤害。每次【雪崩】后下次【雪崩】伤害加倍。', 'AVALANCHE', 'DIAMOND'),
  classItem('SAMOYED', 6, 'samoyed-absolute-zero', '绝对零度', 2, [4, 5, 6], ['big', 'weak'], '每当掷出【大点】时，积攒 1 层【冻结】计数。10 层【冻结】计数时会清空层数，同时使敌人【冻结】2 秒无法行动。', 'FREEZE_STACK', 'DIAMOND'),
  classItem('SAMOYED', 6, 'samoyed-cold-proof', '不畏严寒', 2, [4, 5, 6], ['big', 'reverse'], '每当掷出【大点】时，会额外触发一次该点减3的装备物品。', 'TRIGGER_MINUS_THREE', 'DIAMOND'),

  classItem('MUTT', 3, 'mutt-old-collar', '老旧项圈', 1, [1, 2, 3, 4, 5, 6], ['late', 'extra-roll'], '每当系统触发职业特性的【额外投掷】时，永久使你最大生命值 +1', 'MAX_HP_ON_EXTRA_ROLL', 'GOLD'),
  classItem('MUTT', 3, 'mutt-counting-collar', '计数项圈', 2, [1, 2, 3, 4, 5, 6], ['extra-roll'], '战斗中每发生 4 次投掷，立即进行一次【额外投掷】', 'ROLL_COUNTER_EXTRA', 'GOLD'),
  classItem('MUTT', 3, 'mutt-charged-collar', '充能项圈', 1, [1, 2, 3, 4, 5, 6], ['extra-roll'], '发生【额外投掷】时，触发该装备【相邻】的装备 1 次', 'ADJACENT_ON_EXTRA_ROLL', 'GOLD'),
  classItem('MUTT', 6, 'mutt-chase-tail', '咬尾巴', 3, [1, 2, 3, 4, 5, 6], ['extra-roll'], '你的【额外投掷】也有 20% 的概率再次触发【额外投掷】（无嵌套上限）。且单局每一次连续投掷，使所有伤害临时提升 10%', 'EXTRA_ROLL_RECURSE', 'DIAMOND'),
  classItem('MUTT', 6, 'mutt-chase-car', '追车车', 1, [1, 2, 3, 4, 5, 6], ['extra-roll'], '【额外投掷】会额外触发 1 件其他装备 2 次', 'EXTRA_ROLL_TRIGGERS_ALL', 'DIAMOND'),
  classItem('MUTT', 6, 'mutt-eat-air', '吃空气', 4, [1, 2, 3, 4, 5, 6], ['extra-roll'], '战斗开始后的前 10 秒内，基础投掷频率固定提升 2 倍，作为代价，此期间你无法通过任何途径获得治疗与【护盾】', 'DOUBLE_RATE_FIRST_TEN', 'DIAMOND'),

  classItem('BULLY', 3, 'bully-vault', '恶霸金库', 2, [1, 2, 3, 4, 5, 6], ['large'], '每回合战斗结束后获得一个【大型物品】', 'POST_BATTLE_LARGE_ITEM', 'GOLD'),
  classItem('BULLY', 3, 'bully-gym', '恶霸健身房', 3, [1, 2, 3, 4, 5, 6], ['large'], '【大型物品】触发时会额外触发随机一个非【大型物品】', 'LARGE_TRIGGERS_NON_LARGE', 'GOLD'),
  classItem('BULLY', 3, 'bully-armband', '恶霸袖标', 1, [1, 2, 3, 4, 5, 6], ['large'], '3格的物品也被算为【大型物品】', 'SIZE_THREE_IS_LARGE', 'GOLD'),
  classItem('BULLY', 6, 'bully-sacrifice', '无情献祭', 4, [1, 2, 3, 4, 5, 6], ['large'], '你场上所有的【小型物品】道具失去原有基础效果，每次触发时触发你的【大型物品】', 'SMALL_TRIGGERS_LARGE', 'DIAMOND'),
  classItem('BULLY', 6, 'bully-colossus', '巨兽压迫', 3, [1, 2, 3, 4, 5, 6], ['large'], '当你的【大型物品】成功触发“翻倍”效果时，有 20% 的几率获得4倍翻倍效果', 'BULLY_QUADRUPLE_CHANCE', 'DIAMOND'),
  classItem('BULLY', 6, 'bully-demolish', '无理强拆', 2, [1, 2, 3, 4, 5, 6], ['large'], '【大型物品】命中时会让对方的所有【大型物品】【失效】1 次，可叠加', 'DISABLE_ENEMY_LARGE', 'DIAMOND'),

  classItem('EMPEROR', 3, 'emperor-dice-cup', '御用骰盅', 1, [1, 2, 3, 4, 5, 6], ['lucky'], '如果你连续 2 次投掷都没有掷出你的【天命数字】，则下一次系统投掷结果强行修正为【天命数字】', 'LUCKY_NUMBER_PITY', 'GOLD'),
  classItem('EMPEROR', 3, 'emperor-minister', '权臣架空', 2, [1, 2, 3, 4, 5, 6], ['lucky'], '非【天命数字】时获得 5 点【护盾】', 'SHIELD_ON_NON_LUCKY', 'GOLD'),
  classItem('EMPEROR', 3, 'emperor-robe', '金丝龙袍', 2, [1, 2, 3, 4, 5, 6], ['lucky'], '每次掷出【天命数字】时，瞬间【净化】自身持有的所有负面状态', 'CLEANSE_ON_LUCKY', 'GOLD'),
  classItem('EMPEROR', 6, 'emperor-curtain', '垂帘听政', 2, [1, 2, 3, 4, 5, 6], ['lucky'], '原【天命数字】无效，该装备【相邻】的装备的触发数字为【天命数字】', 'ADJACENT_USES_LUCKY', 'DIAMOND'),
  classItem('EMPEROR', 6, 'emperor-edict', '蛮横圣旨', 2, [1, 2, 3, 4, 5, 6], ['lucky'], '战斗开始时，强行将敌我双方最左侧的 2 个道具的触发点数，强行篡改为你的【天命数字】', 'OPENING_FORCE_LUCKY', 'DIAMOND'),
  classItem('EMPEROR', 6, 'emperor-fallen', '亡国之君', 1, [1, 2, 3, 4, 5, 6], ['lucky'], '仅【天命数字】的装备才能生效（包含不计入），但是【天命数字】装备生效2次', 'ONLY_LUCKY_DOUBLE', 'DIAMOND'),
]

export const RELIC_DEFS: RelicDef[] = [
  { id: 'midas-left', name: '点金手·左', unlockRound: 3, defaultQuality: 'SILVER', tags: ['big'], effect: 'MIRROR_BIG_TO_SMALL', description: '你场上所有绑定在 4~6 点数的道具，现在在掷出对应减3的【小点】时也会触发，但效果降低 50%' },
  { id: 'midas-right', name: '点金手·右', unlockRound: 3, defaultQuality: 'SILVER', tags: ['small'], effect: 'MIRROR_SMALL_TO_BIG', description: '你场上所有绑定在 1~3 点数的道具，现在在掷出对应加3的【大点】时也会触发，但效果降低 50%' },
  { id: 'half-die-left', name: '半截骰·左', unlockRound: 3, defaultQuality: 'SILVER', tags: ['big'], effect: 'ONLY_BIG_HALF_EFFECT', description: '你只能投掷出【大点】，但所有装备效果降低50%' },
  { id: 'half-die-right', name: '半截骰·右', unlockRound: 3, defaultQuality: 'SILVER', tags: ['small'], effect: 'ONLY_SMALL_HALF_EFFECT', description: '你只能投掷出【小点】，但所有装备效果降低50%' },
  { id: 'carrot', name: '胡萝卜', unlockRound: 3, defaultQuality: 'SILVER', tags: ['trigger', 'shift'], effect: 'SHIFT_TRIGGER_DICE_UP', description: '你场上所有装备的触发点数 +1，6 会变成 1。' },
  { id: 'tissue', name: '纸巾', unlockRound: 3, defaultQuality: 'SILVER', tags: ['trigger', 'shift'], effect: 'SHIFT_TRIGGER_DICE_DOWN', description: '你场上所有装备的触发点数 -1，1 会变成 6。' },
  { id: 'v3-two-sided-gold-tag', name: '两面金狗牌', unlockRound: 3, defaultQuality: 'SILVER', tags: ['extreme'], effect: 'EXTREME_ROLL_BIAS', description: '你的投掷结果出现【极值】（1和6）的概率绝对值提升 30%。' },
  { id: 'v3-balanced-food-bowl', name: '平衡狗粮盆', unlockRound: 3, defaultQuality: 'SILVER', tags: ['middle'], effect: 'MIDDLE_ROLL_BIAS', description: '你的投掷结果出现 3 和 4 的概率绝对值提升 30%。' },
  { id: 'v3-lucky-foxtail', name: '幸运狗尾草', unlockRound: 3, defaultQuality: 'GOLD', tags: ['pity', 'large'], effect: 'EMPTY_ROLL_LARGE_SAFETY', description: '当你连续 2 次投掷“空过”时，第 3 次投掷必定为你随机触发一件【大型物品】（若没有则触发【中型物品】）。' },
  { id: 'v3-bad-dog-manual', name: '坏狗狗作案手册', unlockRound: 3, defaultQuality: 'GOLD', tags: ['poison'], effect: 'POISON_TICK_BONUS', description: '敌方身上的【中毒】状态每次结算时，额外造成 2 点伤害。' },
  { id: 'v3-fluffed-spike-collar', name: '炸毛护颈圈', unlockRound: 3, defaultQuality: 'GOLD', tags: ['thorn'], effect: 'OPENING_THORNS', description: '战斗开始时，你直接获得 5 层【荆棘】。' },
  { id: 'v3-husky-engine', name: '哈士奇永动机', unlockRound: 3, defaultQuality: 'DIAMOND', tags: ['attack-speed'], effect: 'HUSKY_ENGINE', description: '你的基础投掷间隔从 1 秒缩短至 0.85 秒。（全局攻速提升）' },
  { id: 'v3-fourth-dimensional-kennel', name: '四次元狗窝', unlockRound: 3, defaultQuality: 'DIAMOND', tags: ['space'], effect: 'EXTRA_EQUIPMENT_REDUCED_EFFECT', description: '你可以突破背包限制，将第 13 个装备放入战斗区。' },
]

export const ALL_ITEM_DEFS = [...ITEM_DEFS, ...CLASS_REWARD_DEFS]

export function itemDef(id: string) {
  const found = ALL_ITEM_DEFS.find((item) => item.id === id)
  if (!found) throw new Error(`Unknown item def ${id}`)
  return found
}

function itemEffectVerb(type: ItemDef['effect']['type']) {
  return type === 'HEAL' ? '恢复' : '造成'
}

function itemEffectUnit(type: ItemDef['effect']['type']) {
  return type === 'HEAL' ? '点生命值' : '点伤害'
}

export function growthDamageBase(quality?: string | null) {
  const currentQuality = normalizeQuality(quality)
  if (currentQuality === 'DIAMOND') return 3
  return qualityAmountFrom(1, currentQuality, 'SILVER')
}

export function growthDamageStep(quality?: string | null) {
  return qualityAmountFrom(3, quality, 'SILVER')
}

export function nightPatrolLightTriggerCount(quality?: string | null) {
  return Math.max(1, qualityAmountFrom(1, quality, 'GOLD'))
}

export function itemDescription(itemId: string, quality?: string | null) {
  const def = itemDef(itemId)
  const currentQuality = normalizeQuality(quality)
  const amount = qualityAmountFrom(def.effect.amount, currentQuality, def.effect.qualityBase)
  const one = qualityAmount(1, currentQuality)
  const advanced = def.advancedEffect ?? 'NONE'
  const baseEffect = def.effect.amount > 0
    ? `${itemEffectVerb(def.effect.type)} ${amount} ${itemEffectUnit(def.effect.type)}。`
    : ''

  if (advanced === 'TARGET_WEAK_BONUS_DAMAGE') return `${baseEffect}若目标处于【虚弱】，额外造成 ${qualityAmount(4, currentQuality)} 点【真实伤害】。`
  if (advanced === 'ADJACENT_DAMAGE_BONUS') return `${baseEffect}使【相邻】装备的下一次触发伤害 +${qualityAmount(4, currentQuality)}。`
  if (advanced === 'GAIN_SHIELD') return `获得 ${amount} 点【护盾】。`
  if (advanced === 'CLEANSE_ONE') return `恢复 ${amount} 点生命值，并【净化】自身的一层【中毒】或者【虚弱】。`
  if (advanced === 'APPLY_POISON') return `对敌人施加 ${amount} 层【中毒】。`
  if (advanced === 'POISON_ON_ATTACK_HIT') return `无需触发。每次攻击命中时，对敌人施加 ${amount} 层【中毒】。`
  if (advanced === 'GAIN_SHIELD_THORNS') return `获得 ${amount} 点【护盾】，并获得 ${one} 层【荆棘】。`
  if (advanced === 'APPLY_WEAK_ON_HIT') return `${baseEffect}并给敌人施加 ${one} 层【虚弱】。`
  if (advanced === 'APPLY_WEAK_20_ON_HIT') return `${baseEffect}命中后有 20% 概率给敌人施加 ${one} 层【虚弱】。`
  if (advanced === 'GAIN_FURY_ON_ATTACK') return `${baseEffect}攻击时有 50% 概率触发【激昂】；【激昂】使所有攻击伤害 +1，可叠加。`
  if (advanced === 'DOUBLE_SHIELD_DAMAGE') return `${baseEffect}如果敌方有【护盾】，该次伤害直接对【护盾】造成 2 倍伤害。`
  if (advanced === 'HEAL_OR_MAX_HP') return `恢复 ${amount} 点生命值。如果你当前处于满血，则永久提升自身 ${one} 点最大生命值。`
  if (advanced === 'ADJACENT_TEMP_TRIGGER') return `触发时，额外触发【相邻】装备 ${nightPatrolLightTriggerCount(currentQuality)} 次。`
  if (advanced === 'LIFESTEAL') return `${baseEffect}并将造成生命伤害的 100% 转化为自身【吸血】治疗。`
  if (advanced === 'POISON_AND_DISABLE_RIGHTMOST') return `对敌方施加 ${amount} 层【中毒】，并使敌方最右侧的一个装备【失效】一次。`
  if (advanced === 'SHIELD_IMMUNITY') return `获得 ${amount} 点【护盾】。只要你拥有【护盾】，你受到的【中毒】和【虚弱】层数减半（向上取整）。`
  if (advanced === 'STEAL_ENEMY_BUFF') return `恢复 ${amount} 点生命值，并偷取敌方 1 层增益（优先【荆棘】，其次【加速】；【护盾】不算增益，不会被偷取）。`
  if (advanced === 'GRANT_LIFESTEAL_ADJACENT') return currentQuality === 'DIAMOND'
    ? '光环：战斗开始时，使左右【相邻】装备都获得【吸血】直到战斗结束。被赋予【吸血】的装备按实际造成的生命伤害 100% 治疗自己。'
    : '光环：战斗开始时，使左边 1 个【相邻】装备获得【吸血】直到战斗结束。被赋予【吸血】的装备按实际造成的生命伤害 100% 治疗自己。'
  if (advanced === 'BOOM_COUNTER') return `只能通过计数触发。己方其他装备每成功触发 1 次，获得 1 点【爆鸣计数】。达到 ${BOOM_COUNTER_TRIGGER_THRESHOLD} 点后清零，对敌方造成 ${amount} 点直接伤害。`
  if (advanced === 'GROWTH_DAMAGE') {
    const growth = growthDamageStep(currentQuality)
    return `初始造成 ${growthDamageBase(currentQuality)} 点伤害。每次该装备成功触发后，本局内后续伤害 +${growth}，无成长次数上限。`
  }
  if (advanced === 'PURGE_ENEMY_BUFFS') {
    const purgeLimit = amount
    const healPerLayer = qualityAmountFrom(5, currentQuality, 'SILVER')
    return `【净化】敌方最多 ${purgeLimit} 层正面增益；每实际清除 1 层，自己恢复 ${healPerLayer} 点生命。优先清除【荆棘】、【加速】层数，再按每 8 点【护盾】折算 1 层。`
  }
  if (advanced === 'POST_BATTLE_EQUIPPED_SELL_BONUS') return '无需触发。放在装备栏时，参战结束后出售价格 +3。'
  if (advanced === 'POST_BATTLE_CARRIED_SELL_BONUS') return '无需触发。放在装备栏或背包时，参战结束后出售价格 +3。'
  if (advanced === 'POISON_ON_ROLL') return `${baseEffect}每次投掷都会对敌人叠加 ${SHIBA_POISON_ON_ROLL_AMOUNT} 层【中毒】（不随品质提升）。`
  if (advanced === 'GAIN_THORNS') return `${baseEffect}每次触发有 50% 概率获得 ${one} 层【荆棘】。`
  if (advanced === 'APPLY_WEAK') return `${baseEffect}每次触发有 50% 概率给敌人施加 ${one} 层【虚弱】。`
  if (advanced === 'APPLY_WOUND') return `对敌人叠加 ${amount} 层【伤口】；目标受到的直接攻击伤害 +${amount}。`
  if (advanced === 'MAX_HP_ON_EXTRA_ROLL') return `每当系统触发职业特性的【额外投掷】时，永久使你最大生命值 +${one}。`
  if (advanced === 'SHIELD_ON_NON_LUCKY') return `非【天命数字】时获得 ${qualityAmount(5, currentQuality)} 点【护盾】。`
  if (advanced === 'AVALANCHE') return `每当掷出【小点】时，积攒 1 层【雪崩】。5 层【雪崩】时会清空层数同时对敌人造成 ${qualityAmount(50, currentQuality)} 点伤害。每次【雪崩】后下次【雪崩】伤害加倍。`
  if (advanced === 'SHIBA_SPEED') return `${baseEffect}${def.description}`
  if (advanced === 'TRIGGER_ADJACENT') return `${baseEffect}${def.description}`
  if (advanced === 'EXTRA_ROLL_CHANCE') return `${baseEffect}${def.description}`
  if (advanced === 'TRIGGER_MINUS_THREE') return `${baseEffect}${def.description}`
  if (advanced === 'LARGE_TRIGGERS_NON_LARGE') return `${baseEffect}${def.description}`
  if (advanced === 'DISABLE_ENEMY_LARGE') return `${baseEffect}${def.description}`
  if (baseEffect) return baseEffect
  if (def.description) return def.description
  return def.description
}

export function itemDefForQuality(itemId: string, quality?: string | null): ItemDef {
  const def = itemDef(itemId)
  return { ...def, description: itemDescription(itemId, quality) }
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
  if (def.effect === 'EXTRA_EQUIPMENT_REDUCED_EFFECT') return 1
  return clamp(0.85 * relicQualityRatio(def, quality), 0.5, 1)
}

export function relicDescription(relicId: string, quality?: string | null) {
  const def = relicDef(relicId)
  const currentQuality = normalizeQuality(quality)
  const retained = roundPercent(relicEffectScale(relicId, currentQuality))
  const rollBias = roundPercent(relicRollBiasChance(relicId, currentQuality))
  const effectReduction = 100 - retained
  const descriptions: Record<RelicEffect, string> = {
    MIRROR_BIG_TO_SMALL: `你场上所有绑定在 4~6 点数的道具，现在在掷出对应减3的【小点】时也会触发，映射触发保留 ${retained}% 效果`,
    MIRROR_SMALL_TO_BIG: `你场上所有绑定在 1~3 点数的道具，现在在掷出对应加3的【大点】时也会触发，映射触发保留 ${retained}% 效果`,
    ONLY_BIG_HALF_EFFECT: `你只能掷出【大点】，但所有装备效果降低 ${effectReduction}%`,
    ONLY_SMALL_HALF_EFFECT: `你只能掷出【小点】，但所有装备效果降低 ${effectReduction}%`,
    EXTREME_ROLL_BIAS: `你的投掷结果出现【极值】（1和6）的概率绝对值提升 ${rollBias}%。`,
    MIDDLE_ROLL_BIAS: `你的投掷结果出现 3 和 4 的概率绝对值提升 ${rollBias}%。`,
    EMPTY_ROLL_LARGE_SAFETY: `当你连续 ${relicEmptyRollMisses(relicId, currentQuality)} 次投掷“空过”时，下一次投掷必定为你随机触发一件【大型物品】（若没有则触发【中型物品】）。`,
    POISON_TICK_BONUS: `敌方身上的【中毒】状态每次结算时，额外造成 ${relicPoisonTickBonus(relicId, currentQuality)} 点伤害。`,
    OPENING_THORNS: `战斗开始时，你直接获得 ${relicOpeningThorns(relicId, currentQuality)} 层【荆棘】。`,
    HUSKY_ENGINE: def.description,
    EXTRA_EQUIPMENT_REDUCED_EFFECT: '你可以突破背包限制，将第 13 个装备放入战斗区。',
    SHIFT_TRIGGER_DICE_UP: '你场上所有装备的触发点数 +1，6 会变成 1。',
    SHIFT_TRIGGER_DICE_DOWN: '你场上所有装备的触发点数 -1，1 会变成 6。',
  }
  return descriptions[def.effect]
}

export function relicDefForQuality(relicId: string, quality?: string | null): RelicDef {
  const def = relicDef(relicId)
  return { ...def, description: relicDescription(relicId, quality) }
}

export function isShopQualityAvailable(quality: ItemQuality | undefined, round: number) {
  const currentQuality = normalizeQuality(quality)
  const currentRound = Math.max(0, Math.floor(round))
  if (currentRound < 3) return currentQuality === 'BRONZE' || currentQuality === 'SILVER'
  if (currentRound < 6) return currentQuality !== 'DIAMOND'
  return true
}

export function shopPool(type: ShopType, round = Number.POSITIVE_INFINITY) {
  return ITEM_DEFS.filter((item) => {
    if (item.tags.includes('starter')) return false
    if (!isShopQualityAvailable(item.defaultQuality, round)) return false
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
