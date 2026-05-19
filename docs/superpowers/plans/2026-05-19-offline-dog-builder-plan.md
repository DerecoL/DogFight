# Offline Dog Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让没有真实 ghost 可匹配时生成的离线狗像真实玩家逐回合构筑出来的对手，会按犬种策略购买、升级、摆放装备并携带职业装备和遗物。

**Architecture:** 新增纯函数模块 `src/server/game/offline-builder.ts` 负责离线构筑模拟，`src/server/state.ts` 的 `seedGhost()` 保持原接口但委托给新模块。测试先覆盖纯构筑器，再覆盖 `seedGhost()` 和 API fallback 行为，避免直接把构筑逻辑绑死在数据库或 HTTP 层。

**Tech Stack:** TypeScript, Vitest, Fastify API tests, Prisma-backed existing integration tests, existing game helpers (`shopPool`, `CLASS_REWARD_DEFS`, `RELIC_DEFS`, `findSlot`, `canPlace`, `nextQuality`, `createRng`).

---

## 文件结构

- Create: `src/server/game/offline-builder.ts`
  - 职责：定义离线构筑输入、策略档案、装备评分、回合模拟、升级、摆放、遗物选择，并输出 `FighterSnapshot`。
- Create: `src/server/game/offline-builder.test.ts`
  - 职责：纯函数测试，不依赖数据库，覆盖确定性、犬种差异、职业装备、遗物、升级和格子合法性。
- Modify: `src/server/state.ts`
  - 职责：让 `seedGhost()` 调用 `buildOfflineFighter()`，并移除旧的固定装备生成逻辑。
- Modify: `src/server/api.test.ts`
  - 职责：补一条 fallback 匹配测试，证明没有真实 ghost 时 API 返回更强的离线构筑且战斗可开始。
- No change: `src/server/game/battle.ts`
  - 战斗模拟只消费 `FighterSnapshot`，本功能不改战斗结算。
- No change: Prisma schema
  - 离线构筑不写入数据库，不需要迁移。

---

### Task 1: 纯构筑器 RED 测试

**Files:**
- Create: `src/server/game/offline-builder.test.ts`
- Test command: `npm test -- src/server/game/offline-builder.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/server/game/offline-builder.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import { itemDef } from './data'
import { canPlace } from './grid'
import { buildOfflineFighter } from './offline-builder'
import type { DogType, GameItem } from './types'

function assertLegalEquipment(items: GameItem[]) {
  const placed: GameItem[] = []
  for (const item of items) {
    expect(item.area).toBe('EQUIPMENT')
    expect(canPlace(placed, item, item.area, item.x, item.y)).toBe(true)
    placed.push(item)
  }
}

describe('offline dog builder', () => {
  it('builds deterministic high-round fighters with class equipment and relics', () => {
    const first = buildOfflineFighter({ round: 6, wins: 5, losses: 1 })
    const second = buildOfflineFighter({ round: 6, wins: 5, losses: 1 })

    expect(second).toEqual(first)
    expect(first.round).toBe(6)
    expect(first.name).toBe('种子狗狗 R6')
    expect(first.items.some((item) => itemDef(item.defId).kind === 'CLASS_EQUIPMENT')).toBe(true)
    expect(first.items.some((item) => !itemDef(item.defId).tags.includes('starter'))).toBe(true)
    expect(first.relics?.length).toBeGreaterThan(0)
    assertLegalEquipment(first.items)
  })

  it('creates dog-specific build identities instead of one fixed item sequence', () => {
    const builds = new Map<DogType, string[]>()
    for (const dogType of ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR'] as DogType[]) {
      const fighter = buildOfflineFighter({ dogType, round: 6, wins: 4, losses: 0 })
      builds.set(dogType, fighter.items.map((item) => item.defId))
    }

    expect(builds.get('SHIBA')?.some((defId) => defId.startsWith('shiba-'))).toBe(true)
    expect(builds.get('SAMOYED')?.some((defId) => defId.startsWith('samoyed-'))).toBe(true)
    expect(builds.get('MUTT')?.some((defId) => defId.startsWith('mutt-'))).toBe(true)
    expect(builds.get('BULLY')?.some((defId) => defId.startsWith('bully-'))).toBe(true)
    expect(builds.get('EMPEROR')?.some((defId) => defId.startsWith('emperor-'))).toBe(true)
    expect(new Set([...builds.values()].map((items) => items.join(','))).size).toBeGreaterThan(1)
  })

  it('upgrades repeated core equipment as the record gets stronger', () => {
    const fighter = buildOfflineFighter({ dogType: 'BULLY', round: 8, wins: 8, losses: 0 })

    expect(fighter.items.some((item) => item.quality === 'SILVER' || item.quality === 'GOLD' || item.quality === 'DIAMOND')).toBe(true)
    expect(fighter.items.some((item) => itemDef(item.defId).size === 4)).toBe(true)
    assertLegalEquipment(fighter.items)
  })

  it('keeps low-round offline fighters modest', () => {
    const fighter = buildOfflineFighter({ dogType: 'SHIBA', round: 1, wins: 0, losses: 0 })

    expect(fighter.items.every((item) => item.quality === 'BRONZE' || item.quality === 'SILVER')).toBe(true)
    expect(fighter.items.some((item) => itemDef(item.defId).kind === 'CLASS_EQUIPMENT')).toBe(false)
    expect(fighter.relics ?? []).toHaveLength(0)
    assertLegalEquipment(fighter.items)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/server/game/offline-builder.test.ts
```

Expected: FAIL because `./offline-builder` does not exist or `buildOfflineFighter` is not exported.

- [ ] **Step 3: Commit only the failing test**

```bash
git add src/server/game/offline-builder.test.ts
git commit -m "test: specify offline dog builder behavior"
```

---

### Task 2: 构筑器最小实现

**Files:**
- Create: `src/server/game/offline-builder.ts`
- Test: `src/server/game/offline-builder.test.ts`

- [ ] **Step 1: Create the offline builder module**

Create `src/server/game/offline-builder.ts` with this structure:

```ts
import { randomUUID } from 'node:crypto'
import { CLASS_REWARD_DEFS, RELIC_DEFS, itemDef, shopPool } from './data'
import { canPlace } from './grid'
import { nextQuality, normalizeQuality } from './quality'
import { createRng } from './rng'
import type { DogType, FighterSnapshot, GameItem, ItemDef, ItemQuality, RelicInstance, ShopType } from './types'

export type OfflineBuildInput = {
  dogType?: DogType
  round: number
  wins: number
  losses: number
  seed?: string
}

type OfflineBuildProfile = {
  dogType: DogType
  shopPreference: ShopType[]
  itemTags: string[]
  classRewards: string[]
  relics: string[]
  keepStarterDice: number[]
  preferredDice: number[]
}

const dogOrder: DogType[] = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR']

const profiles: Record<DogType, OfflineBuildProfile> = {
  SHIBA: {
    dogType: 'SHIBA',
    shopPreference: ['SMALL', 'SMALL_DICE', 'GENERAL'],
    itemTags: ['small', 'extra-roll', 'trigger', 'attack-speed'],
    classRewards: ['shiba-great-katana', 'shiba-swallow-katana', 'shiba-shadow-clone', 'shiba-break'],
    relics: ['midas-right', 'half-die-right'],
    keepStarterDice: [1, 2, 3],
    preferredDice: [1, 2, 3],
  },
  SAMOYED: {
    dogType: 'SAMOYED',
    shopPreference: ['BIG_DICE', 'MEDIUM', 'GENERAL'],
    itemTags: ['big', 'heal', 'weak', 'medium'],
    classRewards: ['samoyed-soft-fur', 'samoyed-frost-fur', 'samoyed-absolute-zero', 'samoyed-cold-proof'],
    relics: ['midas-left', 'half-die-left'],
    keepStarterDice: [4, 5, 6],
    preferredDice: [4, 5, 6],
  },
  MUTT: {
    dogType: 'MUTT',
    shopPreference: ['GENERAL', 'MEDIUM', 'SMALL_DICE'],
    itemTags: ['extra-roll', 'medium', 'late'],
    classRewards: ['mutt-counting-collar', 'mutt-charged-collar', 'mutt-chase-car', 'mutt-eat-air'],
    relics: ['midas-left', 'midas-right'],
    keepStarterDice: [1, 2, 3, 4, 5, 6],
    preferredDice: [1, 2, 3, 4, 5, 6],
  },
  BULLY: {
    dogType: 'BULLY',
    shopPreference: ['LARGE', 'MEDIUM', 'BIG_DICE'],
    itemTags: ['large', 'big', 'medium'],
    classRewards: ['bully-gym', 'bully-armband', 'bully-sacrifice', 'bully-colossus'],
    relics: ['midas-left', 'half-die-left'],
    keepStarterDice: [5, 6],
    preferredDice: [4, 5, 6],
  },
  EMPEROR: {
    dogType: 'EMPEROR',
    shopPreference: ['GENERAL', 'BIG_DICE', 'SMALL_DICE'],
    itemTags: ['lucky', 'big', 'small'],
    classRewards: ['emperor-dice-cup', 'emperor-minister', 'emperor-curtain', 'emperor-fallen'],
    relics: ['midas-left', 'midas-right'],
    keepStarterDice: [1, 3, 5, 6],
    preferredDice: [1, 3, 5, 6],
  },
}

function deterministicDogType(input: OfflineBuildInput): DogType {
  return input.dogType ?? dogOrder[(input.round + input.wins + input.losses) % dogOrder.length]
}

function deterministicLuckyNumber(dogType: DogType, input: OfflineBuildInput, rng: () => number) {
  if (dogType !== 'EMPEROR') return null
  return Math.floor(rng() * 6) + 1
}

function makeItem(defId: string, index: number, quality: ItemQuality = 'BRONZE'): GameItem {
  return { id: `offline-${index}-${defId}`, defId, quality, area: 'EQUIPMENT', x: 0, y: 0 }
}

function scoreDef(def: ItemDef, profile: OfflineBuildProfile, items: GameItem[]) {
  let score = 0
  for (const tag of profile.itemTags) if (def.tags.includes(tag)) score += 12
  for (const die of def.dice) if (profile.preferredDice.includes(die)) score += 3
  if (items.some((item) => item.defId === def.id && nextQuality(item.quality))) score += 16
  if (def.kind === 'CLASS_EQUIPMENT') score += 20
  if (profile.dogType === 'BULLY' && def.size === 4) score += 18
  if (profile.dogType === 'SHIBA' && def.size === 1) score += 8
  if (profile.dogType === 'EMPEROR' && def.tags.includes('lucky')) score += 18
  return score
}

function qualityRank(quality: ItemQuality) {
  return ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'].indexOf(normalizeQuality(quality))
}

function tryUpgrade(items: GameItem[]) {
  for (const source of [...items]) {
    const target = items.find((item) => item.id !== source.id && item.defId === source.defId && item.quality === source.quality && nextQuality(item.quality))
    if (!target) continue
    target.quality = nextQuality(target.quality) ?? target.quality
    const index = items.findIndex((item) => item.id === source.id)
    if (index >= 0) items.splice(index, 1)
    return true
  }
  return false
}

function addBestItem(items: GameItem[], profile: OfflineBuildProfile, roundIndex: number, wins: number, losses: number, rng: () => number) {
  const shopType = profile.shopPreference[roundIndex % profile.shopPreference.length]
  const pool = shopPool(shopType === 'RELIC' ? 'GENERAL' : shopType)
  const candidates = pool
    .map((def) => ({ def, score: scoreDef(def, profile, items) + rng() }))
    .sort((a, b) => b.score - a.score)
  const budget = Math.max(1, 1 + roundIndex + wins - losses)
  for (let count = 0; count < Math.min(2, budget); count += 1) {
    const chosen = candidates[(count + roundIndex) % candidates.length]?.def
    if (chosen) items.push(makeItem(chosen.id, items.length))
    tryUpgrade(items)
  }
}

function addClassRewards(items: GameItem[], profile: OfflineBuildProfile, round: number) {
  const unlocks = CLASS_REWARD_DEFS.filter((def) => def.classDog === profile.dogType && def.unlockRound <= round)
  for (const preferred of profile.classRewards) {
    const found = unlocks.find((def) => def.id === preferred)
    if (found && !items.some((item) => item.defId === found.id)) {
      items.push(makeItem(found.id, items.length, normalizeQuality(found.defaultQuality)))
    }
  }
}

function chooseRelics(profile: OfflineBuildProfile, round: number, wins: number): RelicInstance[] {
  if (round < 4) return []
  const count = round >= 7 || wins >= 6 ? 2 : 1
  return profile.relics.slice(0, count).flatMap((relicId, slot) => {
    if (!RELIC_DEFS.some((relic) => relic.id === relicId)) return []
    return [{ id: `offline-relic-${slot}-${relicId}`, relicId, quality: 'SILVER' as const, slot }]
  })
}

function layoutEquipment(items: GameItem[], profile: OfflineBuildProfile) {
  const sorted = [...items].sort((a, b) => {
    const aDef = itemDef(a.defId)
    const bDef = itemDef(b.defId)
    return (scoreDef(bDef, profile, items) + qualityRank(b.quality) * 10) - (scoreDef(aDef, profile, items) + qualityRank(a.quality) * 10)
  })
  const placed: GameItem[] = []
  for (const item of sorted) {
    for (let x = 0; x < 12; x += 1) {
      const next = { ...item, area: 'EQUIPMENT' as const, x, y: 0 }
      if (canPlace(placed, next, 'EQUIPMENT', x, 0)) {
        placed.push(next)
        break
      }
    }
  }
  return placed
}

export function buildOfflineFighter(input: OfflineBuildInput): FighterSnapshot {
  const dogType = deterministicDogType(input)
  const profile = profiles[dogType]
  const rng = createRng(input.seed ?? `offline-${dogType}-${input.round}-${input.wins}-${input.losses}`)
  const luckyNumber = deterministicLuckyNumber(dogType, input, rng)
  const items: GameItem[] = profile.keepStarterDice.map((die, index) => makeItem(`starter-${die}`, index))

  for (let roundIndex = 1; roundIndex <= input.round; roundIndex += 1) {
    addBestItem(items, profile, roundIndex, input.wins, input.losses, rng)
  }
  addClassRewards(items, profile, input.round)

  return {
    name: `种子狗狗 R${input.round}`,
    dogType,
    luckyNumber,
    wins: input.wins,
    losses: input.losses,
    round: input.round,
    items: layoutEquipment(items, profile),
    relics: chooseRelics(profile, input.round, input.wins),
  }
}
```

- [ ] **Step 2: Run focused test**

Run:

```bash
npm test -- src/server/game/offline-builder.test.ts
```

Expected: PASS for `offline-builder.test.ts`.

- [ ] **Step 3: Remove unused imports if TypeScript reports them**

If `npm test` or `npm run build` reports unused `randomUUID`, remove this line from `src/server/game/offline-builder.ts`:

```ts
import { randomUUID } from 'node:crypto'
```

The module uses deterministic IDs so it does not need `randomUUID`.

- [ ] **Step 4: Commit passing pure builder**

```bash
git add src/server/game/offline-builder.ts src/server/game/offline-builder.test.ts
git commit -m "feat: add offline dog builder"
```

---

### Task 3: 接入 `seedGhost()`

**Files:**
- Modify: `src/server/state.ts`
- Modify: `src/server/game/offline-builder.test.ts`

- [ ] **Step 1: Add a failing `seedGhost()` integration test**

Append this import to `src/server/game/offline-builder.test.ts`:

```ts
import { seedGhost } from '../state'
```

Append this test inside `describe('offline dog builder', () => { ... })`:

```ts
  it('routes seedGhost through the offline builder fallback', () => {
    const ghost = seedGhost(6, 5, 1)

    expect(ghost.name).toBe('种子狗狗 R6')
    expect(ghost.items.some((item) => itemDef(item.defId).kind === 'CLASS_EQUIPMENT')).toBe(true)
    expect(ghost.relics?.length).toBeGreaterThan(0)
    assertLegalEquipment(ghost.items)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/server/game/offline-builder.test.ts
```

Expected: FAIL because current `seedGhost()` still creates the old fixed item list and no relics.

- [ ] **Step 3: Modify `src/server/state.ts`**

Add this import near the existing game imports:

```ts
import { buildOfflineFighter } from './game/offline-builder'
```

Replace the existing `seedGhost()` body with:

```ts
export function seedGhost(round: number, wins: number, losses: number): FighterSnapshot {
  return buildOfflineFighter({ round, wins, losses })
}
```

Remove now-unused imports from `src/server/state.ts`:

```ts
import { findSlot } from './game/grid'
```

Keep `randomUUID` if `initialItems()` still uses it.

- [ ] **Step 4: Run focused test**

Run:

```bash
npm test -- src/server/game/offline-builder.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit seedGhost integration**

```bash
git add src/server/state.ts src/server/game/offline-builder.test.ts
git commit -m "feat: use offline builder for seed ghosts"
```

---

### Task 4: API fallback 行为测试

**Files:**
- Modify: `src/server/api.test.ts`

- [ ] **Step 1: Add the failing API test**

Append this test inside `describeWithDatabase('run API', () => { ... })`:

```ts
  it('uses strategic offline dogs when no real ghost is available', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ email: `offline${Date.now()}@dog.test`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA' }).expect(200)
    const runId = created.body.run.id

    await prisma.run.update({
      where: { id: runId },
      data: { round: 6, wins: 5, losses: 1, phase: 'SHOP' },
    })

    const matched = await agent.post(`/api/runs/${runId}/battle/match`).send({}).expect(200)
    expect(matched.body.run.matchedGhost.ghostId).toBeNull()
    expect(matched.body.run.matchedGhost.items.some((item: { defId: string }) => item.defId.includes('-'))).toBe(true)
    expect(matched.body.run.matchedGhost.relics.length).toBeGreaterThan(0)
    expect(matched.body.run.matchedGhost.items.some((item: { defId: string }) => item.defId.startsWith('samoyed-') || item.defId.startsWith('mutt-') || item.defId.startsWith('bully-') || item.defId.startsWith('emperor-') || item.defId.startsWith('shiba-'))).toBe(true)

    const battled = await agent.post(`/api/runs/${runId}/battle/start`).send({}).expect(200)
    expect(battled.body.battle.opponentSnapshot.items.length).toBeGreaterThan(0)
    expect(battled.body.battle.opponentSnapshot.relics.length).toBeGreaterThan(0)
  })
```

- [ ] **Step 2: Run API test**

Run:

```bash
npm test -- src/server/api.test.ts
```

Expected: PASS when `TEST_DATABASE_URL` or `DATABASE_URL` points to a test database; otherwise Vitest reports the database suite as skipped. If the suite is skipped, continue and rely on full local verification later.

- [ ] **Step 3: Tighten the assertion if it is too broad**

If the new API test passes but does not prove class equipment clearly enough, replace the class-equipment assertion with exact known prefixes:

```ts
expect(matched.body.run.matchedGhost.items.some((item: { defId: string }) =>
  ['shiba-', 'samoyed-', 'mutt-', 'bully-', 'emperor-'].some((prefix) => item.defId.startsWith(prefix)),
)).toBe(true)
```

- [ ] **Step 4: Commit API coverage**

```bash
git add src/server/api.test.ts
git commit -m "test: cover strategic offline ghost fallback"
```

---

### Task 5: 构筑质量校准和类型检查

**Files:**
- Modify: `src/server/game/offline-builder.ts`
- Modify: `src/server/game/offline-builder.test.ts` if assertions reveal overly weak or overly strong output

- [ ] **Step 1: Run all server-focused tests**

Run:

```bash
npm test -- src/server/game.test.ts src/server/game/offline-builder.test.ts src/server/api.test.ts
```

Expected: PASS for pure tests; API database suite may be skipped if no database URL is configured.

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: TypeScript project build and Vite build complete successfully.

- [ ] **Step 3: Fix any deterministic ID or import issue**

If TypeScript complains about unused imports, remove the reported import. If a test fails because IDs differ between two deterministic calls, replace any remaining random ID generation in `offline-builder.ts` with deterministic IDs using:

```ts
function makeItem(defId: string, index: number, quality: ItemQuality = 'BRONZE'): GameItem {
  return { id: `offline-${index}-${defId}`, defId, quality, area: 'EQUIPMENT', x: 0, y: 0 }
}
```

- [ ] **Step 4: Keep low-round strength bounded**

If `keeps low-round offline fighters modest` fails because a class item or relic appears too early, ensure `addClassRewards()` is called after the round loop but only uses `unlockRound <= round`, and ensure `chooseRelics()` starts with:

```ts
if (round < 4) return []
```

- [ ] **Step 5: Commit calibration**

```bash
git add src/server/game/offline-builder.ts src/server/game/offline-builder.test.ts
git commit -m "fix: calibrate offline dog progression"
```

---

### Task 6: 最终验证

**Files:**
- No required source changes unless verification exposes a bug.

- [ ] **Step 1: Run complete test suite**

Run:

```bash
npm test
```

Expected: All non-skipped Vitest suites pass.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build succeed.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
git diff --stat
git diff -- src/server/game/offline-builder.ts src/server/game/offline-builder.test.ts src/server/state.ts src/server/api.test.ts
```

Expected: Diff only contains offline-builder implementation, tests, and `seedGhost()` delegation.

- [ ] **Step 4: Final commit if any verification fixes were made**

If Task 6 required edits:

```bash
git add src/server/game/offline-builder.ts src/server/game/offline-builder.test.ts src/server/state.ts src/server/api.test.ts
git commit -m "fix: verify offline dog builder"
```

If Task 6 required no edits, do not create an empty commit.

---

## 自检结果

- 规格覆盖：计划覆盖了离线构筑器、犬种策略、回合模拟、职业装备、遗物、升级、确定性、强度分段、API fallback 和最终验证。
- 红旗词扫描：计划没有使用未定义的临时步骤；每个测试和实现步骤都包含具体代码或命令。
- 类型一致性：计划中使用的 `DogType`、`FighterSnapshot`、`GameItem`、`ItemQuality`、`ShopType`、`RelicInstance` 与现有 `src/server/game/types.ts` 一致；`seedGhost()` 仍返回 `FighterSnapshot`。
