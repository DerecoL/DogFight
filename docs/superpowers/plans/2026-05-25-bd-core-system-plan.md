# BD 核心体系 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增一层只读 BD tag 元数据与查询辅助函数，让当前装备、职业装备、遗物、狗狗和标签能映射到稳定的构筑体系，为后续商店提示、构筑缺口提示、统计分析和内容设计提供统一来源。

**Architecture:** 新建 `src/server/game/build-archetypes.ts`，集中定义 BD 路线、组件角色、标签映射、狗狗主副路线、反制关系和查询函数；新建 `src/server/game/build-archetypes.test.ts` 用 Vitest 锁住数据完整性、现有资源引用有效性和“标签不限制自由构筑”的约束。第一阶段不改战斗结算、不改装备数值、不改 UI、不接入购买/穿戴/商店刷新流程，也不强制离线狗或玩家必须符合某条主 BD。BD tag 只描述倾向，可以叠加，可以混搭。

**Tech Stack:** TypeScript, Vitest, existing game data in `src/server/game/data.ts`, existing dog/item/relic types in `src/server/game/types.ts`.

---

## 文件结构

- Create: `E:\AI-GPT\DogFight\src\server\game\build-archetypes.ts`
  - 负责 BD id、组件角色、缺口类型、路线定义、组件目录、标签映射、狗狗映射、反制关系和纯查询函数。
- Create: `E:\AI-GPT\DogFight\src\server\game\build-archetypes.test.ts`
  - 负责验证 11 条 BD、6 个狗狗映射、6 类组件角色、标签映射、反制关系和引用 id 全部有效。
- 第一阶段不修改 `E:\AI-GPT\DogFight\src\server\game\offline-builder.ts`
  - 原因：先把 BD tag 做成非限制性识别层，避免把“主 BD”误用成离线狗或玩家构筑的硬约束。

## Task 1: 新增 BD 路线元数据

**Files:**
- Create: `E:\AI-GPT\DogFight\src\server\game\build-archetypes.ts`
- Create: `E:\AI-GPT\DogFight\src\server\game\build-archetypes.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/server/game/build-archetypes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  BUILD_ARCHETYPES,
  BUILD_ARCHETYPE_IDS,
  BUILD_DOG_MAPPINGS,
  BUILD_GAP_TYPES,
  BUILD_STATUSES,
  getBuildArchetype,
} from './build-archetypes'
import type { DogType } from './types'

const DOG_TYPES: DogType[] = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR', 'FROG']

describe('BD core archetype metadata', () => {
  it('defines the exact first-stage BD route set', () => {
    expect(BUILD_ARCHETYPE_IDS).toEqual([
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
    ])
    expect(BUILD_ARCHETYPES).toHaveLength(11)
  })

  it('keeps every BD route reviewable and actionable', () => {
    for (const archetype of BUILD_ARCHETYPES) {
      expect(BUILD_STATUSES).toContain(archetype.status)
      expect(archetype.name).toBeTruthy()
      expect(archetype.goal).toBeTruthy()
      expect(archetype.primaryDogs.length + archetype.secondaryDogs.length).toBeGreaterThan(0)
      expect(archetype.gaps.length).toBeGreaterThan(0)
      expect(archetype.gaps.every((gap) => BUILD_GAP_TYPES.includes(gap))).toBe(true)
      expect(archetype.recommendation).toBeTruthy()
    }
  })

  it('maps every dog to one primary BD and at least one secondary BD', () => {
    expect(Object.keys(BUILD_DOG_MAPPINGS).sort()).toEqual([...DOG_TYPES].sort())
    for (const dogType of DOG_TYPES) {
      const mapping = BUILD_DOG_MAPPINGS[dogType]
      expect(getBuildArchetype(mapping.primary).id).toBe(mapping.primary)
      expect(mapping.secondary.length).toBeGreaterThan(0)
      for (const archetypeId of mapping.secondary) {
        expect(getBuildArchetype(archetypeId).id).toBe(archetypeId)
      }
    }
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- src/server/game/build-archetypes.test.ts -t "BD core archetype metadata"
```

Expected: FAIL，错误包含 `Failed to resolve import "./build-archetypes"`。

- [ ] **Step 3: 新增最小实现**

Create `src/server/game/build-archetypes.ts`:

```ts
import type { DogType } from './types'

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
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
npm test -- src/server/game/build-archetypes.test.ts -t "BD core archetype metadata"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/server/game/build-archetypes.ts src/server/game/build-archetypes.test.ts
git commit -m "feat: add BD archetype metadata"
```

## Task 2: 新增组件角色目录与引用校验

**Files:**
- Modify: `E:\AI-GPT\DogFight\src\server\game\build-archetypes.ts`
- Modify: `E:\AI-GPT\DogFight\src\server\game\build-archetypes.test.ts`

- [ ] **Step 1: 写失败测试**

Update the import block at the top of `src/server/game/build-archetypes.test.ts` to this complete form, then append the `const itemIds...` declarations and `describe('BD component catalog', ...)` block below the existing metadata tests:

```ts
import { describe, expect, it } from 'vitest'
import {
  BUILD_ARCHETYPES,
  BUILD_ARCHETYPE_IDS,
  BUILD_DOG_MAPPINGS,
  BUILD_GAP_TYPES,
  BUILD_STATUSES,
  BUILD_COMPONENT_ROLES,
  BUILD_COMPONENTS,
  componentsForArchetype,
  getBuildArchetype,
} from './build-archetypes'
import {
  ALL_ITEM_DEFS,
  DOGS,
  RELIC_DEFS,
} from './data'
import type { DogType } from './types'

const itemIds = new Set(ALL_ITEM_DEFS.map((def) => def.id))
const relicIds = new Set(RELIC_DEFS.map((def) => def.id))
const dogIds = new Set(Object.keys(DOGS))

describe('BD component catalog', () => {
  it('uses the exact first-stage component role set', () => {
    expect(BUILD_COMPONENT_ROLES).toEqual(['CORE', 'ENGINE', 'PAYOFF', 'DEFENSE', 'COUNTER', 'BRIDGE'])
  })

  it('gives every BD route all six component roles', () => {
    for (const archetypeId of BUILD_ARCHETYPE_IDS) {
      const roles = new Set(componentsForArchetype(archetypeId).map((component) => component.role))
      expect([...roles].sort()).toEqual([...BUILD_COMPONENT_ROLES].sort())
    }
  })

  it('references only existing dog, item, relic, or system component ids', () => {
    for (const component of BUILD_COMPONENTS) {
      if (component.source === 'DOG') expect(dogIds.has(component.sourceId)).toBe(true)
      if (component.source === 'ITEM') expect(itemIds.has(component.sourceId)).toBe(true)
      if (component.source === 'RELIC') expect(relicIds.has(component.sourceId)).toBe(true)
      if (component.source === 'SYSTEM') expect(component.sourceId).toMatch(/^system:/)
    }
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- src/server/game/build-archetypes.test.ts -t "BD component catalog"
```

Expected: FAIL，错误包含 `BUILD_COMPONENT_ROLES` 或 `componentsForArchetype` 未导出。

- [ ] **Step 3: 增加组件角色类型与目录**

Append to `src/server/game/build-archetypes.ts`:

```ts
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
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
npm test -- src/server/game/build-archetypes.test.ts -t "BD component catalog"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/server/game/build-archetypes.ts src/server/game/build-archetypes.test.ts
git commit -m "feat: catalog BD build components"
```

## Task 3: 新增标签映射、反制关系和查询函数

**Files:**
- Modify: `E:\AI-GPT\DogFight\src\server\game\build-archetypes.ts`
- Modify: `E:\AI-GPT\DogFight\src\server\game\build-archetypes.test.ts`

- [ ] **Step 1: 写失败测试**

Update the import block at the top of `src/server/game/build-archetypes.test.ts` to include the new helper exports and `itemDef`, then append the `describe('BD tag and counter helpers', ...)` block below the component catalog tests:

```ts
import { describe, expect, it } from 'vitest'
import { ALL_ITEM_DEFS, DOGS, RELIC_DEFS, itemDef } from './data'
import {
  BUILD_ARCHETYPES,
  BUILD_ARCHETYPE_IDS,
  BUILD_COMPONENT_ROLES,
  BUILD_COMPONENTS,
  BUILD_COUNTER_RELATIONS,
  BUILD_DOG_MAPPINGS,
  BUILD_GAP_TYPES,
  BUILD_STATUSES,
  BUILD_TAG_MAPPINGS,
  archetypesForItemDef,
  componentsForArchetype,
  countersForArchetype,
  getBuildArchetype,
  rolesForComponent,
} from './build-archetypes'
import type { DogType } from './types'

describe('BD tag and counter helpers', () => {
  it('maps existing tags to expected BD routes', () => {
    expect(BUILD_TAG_MAPPINGS.find((mapping) => mapping.tag === 'small')?.archetypes).toContain('SMALL_DICE')
    expect(BUILD_TAG_MAPPINGS.find((mapping) => mapping.tag === 'multi')?.archetypes).toEqual(expect.arrayContaining(['MULTI', 'BOOM_FREQUENCY']))
    expect(BUILD_TAG_MAPPINGS.find((mapping) => mapping.tag === 'reservoir')?.archetypes).toContain('RESERVOIR')
    expect(BUILD_TAG_MAPPINGS.find((mapping) => mapping.tag === 'economy')?.archetypes).toContain('ECONOMY')
  })

  it('infers BD routes from current item definitions without changing item data', () => {
    expect(archetypesForItemDef(itemDef('training-disc'))).toEqual(expect.arrayContaining(['MULTI', 'BOOM_FREQUENCY']))
    expect(archetypesForItemDef(itemDef('v4-blood-contract-fang'))).toContain('LIFESTEAL_GROWTH')
    expect(archetypesForItemDef(itemDef('v4-boom-counter'))).toContain('BOOM_FREQUENCY')
    expect(archetypesForItemDef(itemDef('dog-gold-ingot'))).toContain('ECONOMY')
  })

  it('returns roles for known component ids', () => {
    expect(rolesForComponent('ITEM', 'v4-boom-counter')).toEqual(expect.arrayContaining([
      { archetype: 'BOOM_FREQUENCY', role: 'CORE' },
      { archetype: 'BOOM_FREQUENCY', role: 'PAYOFF' },
    ]))
    expect(rolesForComponent('DOG', 'FROG')).toEqual([{ archetype: 'RESERVOIR', role: 'CORE' }])
  })

  it('describes first-stage counter directions', () => {
    expect(BUILD_COUNTER_RELATIONS.length).toBeGreaterThanOrEqual(7)
    expect(countersForArchetype('BOOM_FREQUENCY').map((relation) => relation.method).join(' ')).toContain('反高频')
    expect(countersForArchetype('LIFESTEAL_GROWTH').map((relation) => relation.method).join(' ')).toContain('反治疗')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- src/server/game/build-archetypes.test.ts -t "BD tag and counter helpers"
```

Expected: FAIL，错误包含 `BUILD_TAG_MAPPINGS` 或 `archetypesForItemDef` 未导出。

- [ ] **Step 3: 增加标签映射、反制关系和查询函数**

First merge `ItemDef` into the existing top import so it reads `import type { DogType, ItemDef } from './types'`, then append this code to `src/server/game/build-archetypes.ts`:

```ts
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
  { source: 'BOOM_FREQUENCY', counters: ['MULTI', 'RESERVOIR', 'BOOM_FREQUENCY'], method: '反高频：连续触发阈值失效、重复触发衰减或触发冷却。' },
  { source: 'LIFESTEAL_GROWTH', counters: ['BIG_DICE', 'SHIELD_THORNS'], method: '反成长：清空或压低单件战斗内成长。' },
  { source: 'SHIELD_THORNS', counters: ['LIFESTEAL_GROWTH'], method: '反治疗：治疗降低、吸血失效或治疗转弱点。' },
  { source: 'POISON', counters: ['SHIELD_THORNS'], method: '反毒：净化、负面减半或短时毒免。' },
  { source: 'LUCKY', counters: ['BIG_DICE', 'BOOM_FREQUENCY'], method: '反控制：短时免控或控制后返还收益。' },
  { source: 'LARGE_ITEM', counters: ['LARGE_ITEM'], method: '反大物品：大型装备失效或低价反大件过渡。' },
  { source: 'BIG_DICE', counters: ['LUCKY'], method: '反单核心点数：临时错位、数字扰动或触发点保护。' },
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
```

Important: Keep the `import type { ItemDef } from './types'` merged with the existing `import type { DogType } from './types'` at the top:

```ts
import type { DogType, ItemDef } from './types'
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
npm test -- src/server/game/build-archetypes.test.ts -t "BD tag and counter helpers"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/server/game/build-archetypes.ts src/server/game/build-archetypes.test.ts
git commit -m "feat: add BD tag and counter helpers"
```

## Task 4: 增加自由构筑保护测试

**Files:**
- Modify: `E:\AI-GPT\DogFight\src\server\game\build-archetypes.ts`
- Modify: `E:\AI-GPT\DogFight\src\server\game\build-archetypes.test.ts`

- [ ] **Step 1: 写失败测试**

Append this block to `src/server/game/build-archetypes.test.ts`:

```ts
describe('BD tags stay non-restrictive', () => {
  it('allows one item to map to multiple BD routes', () => {
    expect(archetypesForItemDef(itemDef('training-disc'))).toEqual(expect.arrayContaining(['MULTI', 'BOOM_FREQUENCY']))
    expect(archetypesForItemDef(itemDef('training-disc')).length).toBeGreaterThan(1)
  })

  it('treats dog primary and secondary BD routes as descriptive metadata', () => {
    for (const dogType of DOG_TYPES) {
      const mapping = BUILD_DOG_MAPPINGS[dogType]
      expect(mapping.locked).toBeUndefined()
      expect(mapping.allowedOnly).toBeUndefined()
      expect(mapping.secondary.length).toBeGreaterThan(0)
    }
  })

  it('does not export helpers that validate or reject a player build', async () => {
    const module = await import('./build-archetypes')
    expect('validateBuildArchetype' in module).toBe(false)
    expect('isBuildAllowed' in module).toBe(false)
    expect('filterItemsForBuild' in module).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败或通过现状**

Run:

```bash
npm test -- src/server/game/build-archetypes.test.ts -t "BD tags stay non-restrictive"
```

Expected: PASS if Task 1-3 already kept the data layer descriptive. If it fails, remove any `locked`、`allowedOnly`、`validateBuildArchetype`、`isBuildAllowed` 或 `filterItemsForBuild` 设计，并改回只读标签查询。

- [ ] **Step 3: 明确类型注释**

In `src/server/game/build-archetypes.ts`, add a short comment above `DogBuildMapping`:

```ts
// Descriptive only: used for hints, analysis, and content planning. Never use this to lock items, dogs, shops, or player builds.
```

- [ ] **Step 4: 运行 BD 元数据测试**

Run:

```bash
npm test -- src/server/game/build-archetypes.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/server/game/build-archetypes.ts src/server/game/build-archetypes.test.ts
git commit -m "feat: keep BD tags descriptive"
```

## Task 5: 全量验证

**Files:**
- No generated runtime files expected.

- [ ] **Step 1: 运行 BD 元数据测试**

Run:

```bash
npm test -- src/server/game/build-archetypes.test.ts
```

Expected: PASS。

- [ ] **Step 2: 运行全量测试**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 3: 判断是否需要构建**

本阶段只新增未接入运行时流程的只读 BD tag 元数据和测试，不改战斗逻辑、不改装备/遗物数据、不改 UI、不改离线狗生成、不改打包逻辑。按项目规则，默认不需要运行 `npm run build` 或刷新：

E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd

如果后续实现把 BD tag 接入商店提示、离线狗生成、前端展示或任何运行时逻辑，则必须在对应变更完成后运行 `npm run build`。

- [ ] **Step 4: 检查 git 状态**

Run:

```bash
git status --short
```

Expected: 只包含本次 BD 元数据、测试和文档相关文件。

- [ ] **Step 5: 最终提交**

If earlier task commits were skipped during batch execution, commit all implementation changes:

```bash
git add src/server/game/build-archetypes.ts src/server/game/build-archetypes.test.ts
git commit -m "feat: add BD core metadata system"
```

## 自检记录

- Spec coverage: 覆盖 11 条 BD、6 类组件角色、6 个狗狗主副映射、标签映射、反制方向和第一阶段轻量数据层。
- Scope: 不新增装备、不改装备数值、不改战斗结算、不改 UI、不改离线狗生成；只新增非限制性元数据、查询函数和测试。
- Build rule: 第一阶段实现不接入运行时流程，默认不刷新单文件可玩版本；后续一旦接入商店提示、离线狗生成、前端展示或任何会影响游戏行为的逻辑，必须运行 `npm run build`。
- Excel rule: 本实现不改装备数值、遗物数值、职业道具数值或战斗参数，不更新 `C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx`。
