import type { DogType, ItemDef } from './types'

export const BUILD_ARCHETYPE_IDS = [
  'SMALL_DICE',
  'BIG_DICE',
  'MULTI',
  'RESERVOIR',
  'POISON',
  'SHIELD_THORNS',
  'LIFESTEAL_GROWTH',
  'BOOM_FREQUENCY',
  'LUCKY',
  'LARGE_ITEM',
  'ECONOMY',
] as const

export type BuildArchetypeId = typeof BUILD_ARCHETYPE_IDS[number]

export const BUILD_STATUSES = ['FORMED', 'PARTIAL', 'FRAGMENTS'] as const
export type BuildStatus = typeof BUILD_STATUSES[number]

export const BUILD_GAP_TYPES = [
  'CORE',
  'ENGINE',
  'PAYOFF',
  'DEFENSE',
  'COUNTER',
  'BRIDGE',
  'FINISHER',
  'VISIBILITY',
] as const
export type BuildGapType = typeof BUILD_GAP_TYPES[number]

export type BuildArchetype = {
  id: BuildArchetypeId
  name: string
  status: BuildStatus
  primaryDogs: DogType[]
  secondaryDogs: DogType[]
  goal: string
  gaps: BuildGapType[]
  recommendation: string
}

// Descriptive only: used for hints, analysis, and content planning. Never use this to lock items, dogs, shops, or player builds.
export type DogBuildMapping = {
  primary: BuildArchetypeId
  secondary: BuildArchetypeId[]
}

export const BUILD_ARCHETYPES: BuildArchetype[] = [
  {
    id: 'SMALL_DICE',
    name: '小点流',
    status: 'PARTIAL',
    primaryDogs: ['SHIBA'],
    secondaryDogs: ['FROG'],
    goal: '围绕 1/2/3 高频触发和小型装备滚动收益。',
    gaps: ['PAYOFF', 'COUNTER', 'FINISHER'],
    recommendation: '补一个低点触发次数越多收益越高的通用终局件。',
  },
  {
    id: 'BIG_DICE',
    name: '大点流',
    status: 'PARTIAL',
    primaryDogs: ['SAMOYED'],
    secondaryDogs: ['BULLY'],
    goal: '围绕 4/5/6 高伤、护盾、荆棘或大型物品形成中后期质量路线。',
    gaps: ['BRIDGE', 'COUNTER'],
    recommendation: '补一个低频但可靠的大点过渡件，减少核心没来时的空转。',
  },
  {
    id: 'MULTI',
    name: '多重流',
    status: 'PARTIAL',
    primaryDogs: ['MUTT'],
    secondaryDogs: ['SHIBA', 'FROG'],
    goal: '通过多重次数、相邻加成和重复触发堆频率。',
    gaps: ['VISIBILITY', 'COUNTER'],
    recommendation: '增加明确路线标记和反高频入口。',
  },
  {
    id: 'RESERVOIR',
    name: '蓄水流',
    status: 'FORMED',
    primaryDogs: ['FROG'],
    secondaryDogs: [],
    goal: '将显式点数装备改为计时充水，稳定触发持续收益。',
    gaps: ['COUNTER', 'BRIDGE'],
    recommendation: '补延缓充能或打断最高水位装备的反制方向。',
  },
  {
    id: 'POISON',
    name: '毒伤流',
    status: 'FRAGMENTS',
    primaryDogs: ['SHIBA'],
    secondaryDogs: [],
    goal: '通过中毒层数和毒结算加成造成持续伤害。',
    gaps: ['CORE', 'DEFENSE', 'COUNTER'],
    recommendation: '补毒伤核心件，让毒流不只依赖柴犬终阶或单件被动。',
  },
  {
    id: 'SHIELD_THORNS',
    name: '护盾荆棘流',
    status: 'PARTIAL',
    primaryDogs: ['SAMOYED'],
    secondaryDogs: ['EMPEROR'],
    goal: '用护盾拖时间，用荆棘反伤和正面层数压制对手。',
    gaps: ['PAYOFF', 'COUNTER', 'FINISHER'],
    recommendation: '补护盾荆棘终局奖励，同时保留通用净化作为明确克制。',
  },
  {
    id: 'LIFESTEAL_GROWTH',
    name: '吸血成长流',
    status: 'PARTIAL',
    primaryDogs: [],
    secondaryDogs: ['MUTT'],
    goal: '用成长伤害或高伤装备配合吸血形成续航上限。',
    gaps: ['BRIDGE', 'COUNTER'],
    recommendation: '优先补治疗降低、吸血失效或过量治疗转弱点的反治疗体系。',
  },
  {
    id: 'BOOM_FREQUENCY',
    name: '爆鸣高频流',
    status: 'PARTIAL',
    primaryDogs: ['MUTT'],
    secondaryDogs: ['SHIBA', 'FROG'],
    goal: '通过大量成功触发积攒爆鸣计数打终局爆发。',
    gaps: ['BRIDGE', 'DEFENSE', 'COUNTER'],
    recommendation: '增加反高频标识和连续触发阈值失效类道具。',
  },
  {
    id: 'LUCKY',
    name: '天命流',
    status: 'FORMED',
    primaryDogs: ['EMPEROR'],
    secondaryDogs: [],
    goal: '围绕天命数字改点、强制命中和单点翻倍爆发。',
    gaps: ['BRIDGE', 'COUNTER'],
    recommendation: '补改变敌方核心数字或暂时错位指定点数的反单点体系。',
  },
  {
    id: 'LARGE_ITEM',
    name: '大物品流',
    status: 'FORMED',
    primaryDogs: ['BULLY'],
    secondaryDogs: ['SAMOYED'],
    goal: '用 4 格或被视作大型的装备打高质量触发。',
    gaps: ['BRIDGE', 'COUNTER'],
    recommendation: '补更清晰的小件过渡，降低路线对职业奖励的依赖。',
  },
  {
    id: 'ECONOMY',
    name: '经济流',
    status: 'FRAGMENTS',
    primaryDogs: [],
    secondaryDogs: ['BULLY'],
    goal: '牺牲短期战力换金币、出售收益或品质速度。',
    gaps: ['PAYOFF', 'DEFENSE', 'VISIBILITY'],
    recommendation: '补经济风险回报提示和局后收益预估。',
  },
]

export const BUILD_DOG_MAPPINGS: Record<DogType, DogBuildMapping> = {
  SHIBA: { primary: 'SMALL_DICE', secondary: ['POISON', 'BOOM_FREQUENCY', 'MULTI'] },
  SAMOYED: { primary: 'BIG_DICE', secondary: ['SHIELD_THORNS'] },
  MUTT: { primary: 'MULTI', secondary: ['BOOM_FREQUENCY', 'LIFESTEAL_GROWTH'] },
  BULLY: { primary: 'LARGE_ITEM', secondary: ['ECONOMY', 'BIG_DICE'] },
  EMPEROR: { primary: 'LUCKY', secondary: ['SHIELD_THORNS'] },
  FROG: { primary: 'RESERVOIR', secondary: ['SMALL_DICE', 'BOOM_FREQUENCY', 'MULTI'] },
}

export function getBuildArchetype(id: BuildArchetypeId) {
  const archetype = BUILD_ARCHETYPES.find((entry) => entry.id === id)
  if (!archetype) throw new Error(`Unknown build archetype ${id}`)
  return archetype
}

export const BUILD_COMPONENT_ROLES = ['CORE', 'ENGINE', 'PAYOFF', 'DEFENSE', 'COUNTER', 'BRIDGE'] as const
export type BuildComponentRole = typeof BUILD_COMPONENT_ROLES[number]

export type BuildComponentSource = 'DOG' | 'ITEM' | 'RELIC' | 'SYSTEM'

export type BuildComponent = {
  archetype: BuildArchetypeId
  role: BuildComponentRole
  source: BuildComponentSource
  sourceId: string
  note: string
}

function component(
  archetype: BuildArchetypeId,
  role: BuildComponentRole,
  source: BuildComponentSource,
  sourceId: string,
  note: string,
): BuildComponent {
  return { archetype, role, source, sourceId, note }
}

export const BUILD_COMPONENTS: BuildComponent[] = [
  component('SMALL_DICE', 'CORE', 'DOG', 'SHIBA', '柴犬被动把骰点推向 1/2/3。'),
  component('SMALL_DICE', 'ENGINE', 'ITEM', 'shiba-swallow-katana', '小点额外投掷。'),
  component('SMALL_DICE', 'PAYOFF', 'ITEM', 'v4-growing-chew-sword', '高频触发转成长伤害。'),
  component('SMALL_DICE', 'DEFENSE', 'ITEM', 'v3-cone-collar', '低价小点护盾。'),
  component('SMALL_DICE', 'COUNTER', 'ITEM', 'v4-reverse-fur-comb', '通用反增益。'),
  component('SMALL_DICE', 'BRIDGE', 'ITEM', 'small-bite', '前期小点过渡伤害。'),

  component('BIG_DICE', 'CORE', 'DOG', 'SAMOYED', '萨摩耶被动把骰点推向 4/5/6。'),
  component('BIG_DICE', 'ENGINE', 'RELIC', 'midas-left', '大点映射到小点触发。'),
  component('BIG_DICE', 'PAYOFF', 'ITEM', 'giant-bone', '大点高伤收益。'),
  component('BIG_DICE', 'DEFENSE', 'ITEM', 'v3-golden-kennel', '高质量护盾与负面减半。'),
  component('BIG_DICE', 'COUNTER', 'ITEM', 'bully-demolish', '职业侧反大型装备。'),
  component('BIG_DICE', 'BRIDGE', 'ITEM', 'spiked-collar', '中期大点攻击过渡。'),

  component('MULTI', 'CORE', 'ITEM', 'lotus-sea', '多重相邻光环。'),
  component('MULTI', 'ENGINE', 'DOG', 'MUTT', '土狗额外投掷提高触发密度。'),
  component('MULTI', 'PAYOFF', 'ITEM', 'kyushu-bracer', '多重后段触发转伤害和护盾。'),
  component('MULTI', 'DEFENSE', 'ITEM', 'milk-bone', '多重治疗过渡。'),
  component('MULTI', 'COUNTER', 'SYSTEM', 'system:anti-frequency-gap', '当前缺少稳定反高频工具。'),
  component('MULTI', 'BRIDGE', 'ITEM', 'training-disc', '早期多重触发件。'),

  component('RESERVOIR', 'CORE', 'DOG', 'FROG', '青蛙把显式点数装备改为蓄水触发。'),
  component('RESERVOIR', 'ENGINE', 'ITEM', 'frog-lily-pump', '蓄水充水速度提升。'),
  component('RESERVOIR', 'PAYOFF', 'ITEM', 'frog-full-pond-gate', '触发当前水位最高装备。'),
  component('RESERVOIR', 'DEFENSE', 'ITEM', 'v3-auto-waterer', '治疗与满血最大生命成长。'),
  component('RESERVOIR', 'COUNTER', 'SYSTEM', 'system:anti-reservoir-gap', '当前缺少反蓄水工具。'),
  component('RESERVOIR', 'BRIDGE', 'ITEM', 'v3-large-bone-sword', '稳定点数装备可被蓄水承接。'),

  component('POISON', 'CORE', 'ITEM', 'shiba-poison', '柴犬终阶毒核心。'),
  component('POISON', 'ENGINE', 'ITEM', 'v3-flea-disc', '低价叠毒入口。'),
  component('POISON', 'PAYOFF', 'RELIC', 'v3-bad-dog-manual', '毒结算额外伤害。'),
  component('POISON', 'DEFENSE', 'ITEM', 'v3-golden-kennel', '护盾负面减半可拖毒伤时间。'),
  component('POISON', 'COUNTER', 'ITEM', 'v3-dog-catnip', '自身负面净化。'),
  component('POISON', 'BRIDGE', 'ITEM', 'poisoned-dog-fang', '攻击命中叠毒。'),

  component('SHIELD_THORNS', 'CORE', 'ITEM', 'samoyed-thorn-fur', '萨摩耶荆棘职业件。'),
  component('SHIELD_THORNS', 'ENGINE', 'RELIC', 'v3-fluffed-spike-collar', '开局荆棘层数。'),
  component('SHIELD_THORNS', 'PAYOFF', 'ITEM', 'v3-spiked-vest', '护盾和荆棘一起成长。'),
  component('SHIELD_THORNS', 'DEFENSE', 'ITEM', 'v3-wooden-shield', '稳定护盾来源。'),
  component('SHIELD_THORNS', 'COUNTER', 'ITEM', 'v4-reverse-fur-comb', '清除敌方正面层数。'),
  component('SHIELD_THORNS', 'BRIDGE', 'ITEM', 'v3-cone-collar', '低价护盾过渡。'),

  component('LIFESTEAL_GROWTH', 'CORE', 'ITEM', 'v4-blood-contract-fang', '给相邻装备赋予吸血。'),
  component('LIFESTEAL_GROWTH', 'ENGINE', 'ITEM', 'v3-night-patrol-light', '额外触发相邻装备。'),
  component('LIFESTEAL_GROWTH', 'PAYOFF', 'ITEM', 'v4-growing-chew-sword', '无限成长伤害。'),
  component('LIFESTEAL_GROWTH', 'DEFENSE', 'ITEM', 'v3-blood-mad-fang', '单件吸血续航。'),
  component('LIFESTEAL_GROWTH', 'COUNTER', 'SYSTEM', 'system:anti-heal-gap', '当前缺少稳定反治疗工具。'),
  component('LIFESTEAL_GROWTH', 'BRIDGE', 'ITEM', 'milk-bone', '治疗过渡。'),

  component('BOOM_FREQUENCY', 'CORE', 'ITEM', 'v4-boom-counter', '成功触发次数转终局爆发。'),
  component('BOOM_FREQUENCY', 'ENGINE', 'ITEM', 'mutt-chase-car', '额外投掷触发其他装备。'),
  component('BOOM_FREQUENCY', 'PAYOFF', 'ITEM', 'v4-boom-counter', '50 次触发后的爆发伤害。'),
  component('BOOM_FREQUENCY', 'DEFENSE', 'ITEM', 'kyushu-bracer', '高频多重附带护盾。'),
  component('BOOM_FREQUENCY', 'COUNTER', 'SYSTEM', 'system:anti-frequency-gap', '当前缺少稳定反高频工具。'),
  component('BOOM_FREQUENCY', 'BRIDGE', 'ITEM', 'training-disc', '低价多重过渡。'),

  component('LUCKY', 'CORE', 'DOG', 'EMPEROR', '狗皇帝天命数字。'),
  component('LUCKY', 'ENGINE', 'ITEM', 'emperor-dice-cup', '天命保底。'),
  component('LUCKY', 'PAYOFF', 'ITEM', 'emperor-fallen', '天命装备生效 2 次。'),
  component('LUCKY', 'DEFENSE', 'ITEM', 'emperor-minister', '非天命时获得护盾。'),
  component('LUCKY', 'COUNTER', 'RELIC', 'tissue', '触发点错位可间接干扰单点。'),
  component('LUCKY', 'BRIDGE', 'ITEM', 'lucky-paw', '早期单点多重装备。'),

  component('LARGE_ITEM', 'CORE', 'DOG', 'BULLY', '恶霸大型物品翻倍。'),
  component('LARGE_ITEM', 'ENGINE', 'ITEM', 'bully-gym', '大型物品触发非大型物品。'),
  component('LARGE_ITEM', 'PAYOFF', 'ITEM', 'v3-dinosaur-leg-bone', '大件高伤和破盾。'),
  component('LARGE_ITEM', 'DEFENSE', 'ITEM', 'dog-house', '大件治疗和偷取增益。'),
  component('LARGE_ITEM', 'COUNTER', 'ITEM', 'bully-demolish', '大型物品失效。'),
  component('LARGE_ITEM', 'BRIDGE', 'ITEM', 'guard-vest', '中期占格过渡。'),

  component('ECONOMY', 'CORE', 'ITEM', 'dog-gold-ingot', '战后出售价格提高。'),
  component('ECONOMY', 'ENGINE', 'ITEM', 'dog-silver-ingot', '低价经济过渡。'),
  component('ECONOMY', 'PAYOFF', 'ITEM', 'bully-vault', '战后获得大型物品。'),
  component('ECONOMY', 'DEFENSE', 'ITEM', 'v3-cone-collar', '低价防守兜底。'),
  component('ECONOMY', 'COUNTER', 'SYSTEM', 'system:tempo-pressure', '经济流主要被快攻节奏压制。'),
  component('ECONOMY', 'BRIDGE', 'ITEM', 'starter-1', '低成本临时战力。'),
]

export function componentsForArchetype(archetype: BuildArchetypeId) {
  return BUILD_COMPONENTS.filter((component) => component.archetype === archetype)
}

export type BuildTagMapping = {
  tag: string
  archetypes: BuildArchetypeId[]
  roles: BuildComponentRole[]
}

export const BUILD_TAG_MAPPINGS: BuildTagMapping[] = [
  { tag: 'small', archetypes: ['SMALL_DICE', 'RESERVOIR'], roles: ['ENGINE', 'BRIDGE'] },
  { tag: 'big', archetypes: ['BIG_DICE', 'LARGE_ITEM'], roles: ['PAYOFF', 'DEFENSE'] },
  { tag: 'multi', archetypes: ['MULTI', 'BOOM_FREQUENCY'], roles: ['ENGINE', 'PAYOFF'] },
  { tag: 'reservoir', archetypes: ['RESERVOIR'], roles: ['CORE', 'ENGINE'] },
  { tag: 'poison', archetypes: ['POISON'], roles: ['CORE', 'PAYOFF'] },
  { tag: 'shield', archetypes: ['SHIELD_THORNS'], roles: ['DEFENSE', 'PAYOFF'] },
  { tag: 'thorn', archetypes: ['SHIELD_THORNS'], roles: ['CORE', 'PAYOFF'] },
  { tag: 'immune', archetypes: ['SHIELD_THORNS'], roles: ['DEFENSE'] },
  { tag: 'lifesteal', archetypes: ['LIFESTEAL_GROWTH'], roles: ['CORE', 'DEFENSE'] },
  { tag: 'growth', archetypes: ['LIFESTEAL_GROWTH'], roles: ['PAYOFF'] },
  { tag: 'counter', archetypes: ['BOOM_FREQUENCY'], roles: ['CORE', 'COUNTER'] },
  { tag: 'trigger', archetypes: ['BOOM_FREQUENCY', 'MULTI'], roles: ['ENGINE'] },
  { tag: 'lucky', archetypes: ['LUCKY'], roles: ['CORE', 'ENGINE'] },
  { tag: 'large', archetypes: ['LARGE_ITEM'], roles: ['CORE', 'PAYOFF'] },
  { tag: 'economy', archetypes: ['ECONOMY'], roles: ['CORE'] },
  { tag: 'sell', archetypes: ['ECONOMY'], roles: ['PAYOFF'] },
  { tag: 'cleanse', archetypes: ['SHIELD_THORNS', 'POISON'], roles: ['COUNTER', 'DEFENSE'] },
  { tag: 'disable', archetypes: ['LARGE_ITEM', 'BOOM_FREQUENCY'], roles: ['COUNTER'] },
  { tag: 'shield-break', archetypes: ['SHIELD_THORNS'], roles: ['COUNTER'] },
]

export type BuildCounterRelation = {
  source: BuildArchetypeId
  counters: BuildArchetypeId[]
  method: string
}

export const BUILD_COUNTER_RELATIONS: BuildCounterRelation[] = [
  {
    source: 'BOOM_FREQUENCY',
    counters: ['MULTI', 'RESERVOIR', 'BOOM_FREQUENCY'],
    method: '反高频：连续触发阈值失效、重复触发衰减或触发冷却。',
  },
  {
    source: 'LIFESTEAL_GROWTH',
    counters: ['BIG_DICE', 'SHIELD_THORNS'],
    method: '反成长：清空或压低单件战斗内成长。',
  },
  {
    source: 'SHIELD_THORNS',
    counters: ['LIFESTEAL_GROWTH'],
    method: '反治疗：治疗降低、吸血失效或治疗转弱点。',
  },
  { source: 'POISON', counters: ['SHIELD_THORNS'], method: '反毒：净化、负面减半或短时毒免。' },
  {
    source: 'LUCKY',
    counters: ['BIG_DICE', 'BOOM_FREQUENCY'],
    method: '反控制：短时免控或控制后返还收益。',
  },
  { source: 'LARGE_ITEM', counters: ['LARGE_ITEM'], method: '反大物品：大型装备失效或低价反大件过渡。' },
  {
    source: 'BIG_DICE',
    counters: ['LUCKY'],
    method: '反单核心点数：临时错位、数字扰动或触发点保护。',
  },
]

export function archetypesForItemDef(def: ItemDef): BuildArchetypeId[] {
  const ids = new Set<BuildArchetypeId>()
  for (const tag of def.tags) {
    const mapping = BUILD_TAG_MAPPINGS.find((entry) => entry.tag === tag)
    for (const archetype of mapping?.archetypes ?? []) ids.add(archetype)
  }
  if (def.size === 4) ids.add('LARGE_ITEM')
  if (def.classDog) ids.add(BUILD_DOG_MAPPINGS[def.classDog].primary)
  if (def.dice.some((die) => die <= 3)) ids.add('SMALL_DICE')
  if (def.dice.some((die) => die >= 4)) ids.add('BIG_DICE')
  return [...ids]
}

export function rolesForComponent(source: BuildComponentSource, sourceId: string) {
  return BUILD_COMPONENTS
    .filter((component) => component.source === source && component.sourceId === sourceId)
    .map((component) => ({ archetype: component.archetype, role: component.role }))
}

export function countersForArchetype(target: BuildArchetypeId) {
  return BUILD_COUNTER_RELATIONS.filter((relation) => relation.counters.includes(target))
}
