# 祖灵初始水位补强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让祖灵战斗开始时所有蓄水装备获得 50% 初始水位，改善前期空转体验。

**Architecture:** 战斗模拟继续由 `src/server/game/battle.ts` 负责蓄水运行时状态，只在初始化祖灵蓄水装备时传入固定初始进度。展示层读取现有 `reservoirs` 快照，不需要新增 UI 状态；文案和规则说明同步描述初始水位。

**Tech Stack:** TypeScript, Vitest, React/Vite, artifact-tool spreadsheet workflow, npm build.

---

## File Map

- Modify: `src/server/game.test.ts`，用现有祖灵蓄水测试覆盖 50% 初始水位、首次提前、后续完整间隔。
- Modify: `src/server/game/battle.ts`，在祖灵蓄水初始化时使用 `0.5` 初始进度。
- Modify: `src/server/game/data.ts`，同步中文职业特性和祖灵职业文案。
- Modify: `src/App.tsx`，同步前端本地 dog trait 文案。
- Modify: `src/i18n/game-text.ts`，同步英文 dog trait 和术语说明。
- Modify: `src/shared/rule-terms.ts`，同步中文【蓄水】术语说明。
- Modify: `src/server/game.test.ts` 和可能相关结构测试，更新仍包含 `6 / 点数数量` 与新增 `50%` 的断言。
- Modify: `C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx`，同步基础数据、模型和看板里祖灵蓄水起始水位参数。

### Task 1: 战斗行为测试

**Files:**
- Modify: `src/server/game.test.ts`

- [ ] **Step 1: Write the failing test**

更新 `uses frog reservoir timing instead of base rolls for explicit trigger dice equipment` 的核心断言：

```ts
expect(firstByItem('six')?.time).toBe(0.5)
expect(firstByItem('three')?.time).toBe(1)
expect(firstByItem('one')?.time).toBe(3)
const oneEvents = result.events.filter((event) => event.kind === 'ITEM' && event.itemId === 'one')
expect(oneEvents.slice(0, 2).map((event) => event.time)).toEqual([3, 9])
expect((eventAtOrBefore(result, 1) as never as { reservoirs?: { player: Array<{ itemId: string; duration: number; progress: number; nextAt: number }> } }).reservoirs?.player)
  .toContainEqual(expect.objectContaining({ itemId: 'one', duration: 6, progress: expect.closeTo(0.6667, 3), nextAt: 3 }))
```

更新 `stores overflow progress when frog reservoir charging pushes an item past full`：

```ts
expect(biteEvents.slice(0, 2).map((event) => event.time)).toEqual([1, 2])
expect(firstBiteReservoir).toContainEqual(expect.objectContaining({ itemId: 'bite', duration: 2, progress: 0.5, nextAt: 2 }))
```

更新 `counts only explicit trigger dice when frog reservoir timing is changed by potions, enchants, and relic shifts`：

```ts
expect(firstByItem('potion')?.time).toBe(1.5)
expect(firstByItem('enchant')?.time).toBe(1.5)
expect(firstByItem('mapped')?.time).toBe(3)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/game.test.ts -t "frog reservoir"`

Expected: FAIL because implementation still initializes reservoirs at 0% progress.

### Task 2: 战斗逻辑实现

**Files:**
- Modify: `src/server/game/battle.ts`

- [ ] **Step 1: Write minimal implementation**

Introduce a constant near `ReservoirRuntime`:

```ts
const FROG_STARTING_RESERVOIR_PROGRESS = 0.5
```

Change the initialization loop:

```ts
for (const item of triggerOrder(fighter.items)) refreshReservoir(side, item, 0, FROG_STARTING_RESERVOIR_PROGRESS)
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/server/game.test.ts -t "frog reservoir"`

Expected: PASS with updated reservoir timing expectations.

### Task 3: 文案与规则同步

**Files:**
- Modify: `src/server/game/data.ts`
- Modify: `src/App.tsx`
- Modify: `src/i18n/game-text.ts`
- Modify: `src/shared/rule-terms.ts`
- Modify: `src/App.structure.test.ts` if string expectations require updates
- Modify: `src/server/game.test.ts` if dog trait assertions require updates

- [ ] **Step 1: Update text**

Use this Chinese trait wording in both server and frontend dog traits:

```ts
FROG: '显式点数装备改为【蓄水】触发，开局获得 50% 初始水位；间隔 = 6 / 点数数量，可被职业装备提速'
```

Use this English dog text:

```ts
FROG: { name: 'Zuling', description: 'Explicit-dice gear fills a reservoir instead of using base rolls, starts battle at 50% reservoir progress, and triggers every 6 divided by explicit dice count before class speed bonuses.' },
```

Update 【蓄水】 notes to include:

```ts
祖灵战斗开始时，所有蓄水装备获得 50% 初始水位。
```

English note:

```ts
Zuling reservoir gear starts battle at 50% progress.
```

- [ ] **Step 2: Run text-related tests**

Run: `npx vitest run src/server/game.test.ts -t "frog as the reservoir timing dog" src/App.structure.test.ts`

Expected: PASS after updating string expectations if needed.

### Task 4: 数值表同步

**Files:**
- Modify: `C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx`

- [ ] **Step 1: Inspect workbook**

Use the bundled workspace dependency runtime and artifact-tool to inspect workbook sheets and locate relevant pages:

```js
await workbook.inspect({ kind: "workbook,sheet,table", maxChars: 6000, tableMaxRows: 8, tableMaxCols: 8 })
```

- [ ] **Step 2: Apply workbook edits**

Update rows or notes mentioning 祖灵、蓄水、青蛙、FROG:

```text
开局初始水位：50%
首次触发时间：完整充水间隔 × 50%
后续循环间隔：max(0.5, 6 / 显式点数数量 / 速度倍率)
```

- [ ] **Step 3: Verify workbook**

Inspect updated ranges and scan formula errors:

```js
await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 300 } })
```

Expected: no new formula errors in edited sheets.

### Task 5: 全量验证与构建

**Files:**
- Generated: `dist-click/DogFight-standalone.cmd`
- Generated: `dist-click/index.html`

- [ ] **Step 1: Run focused tests**

Run: `npx vitest run src/server/game.test.ts -t "frog reservoir"`

Expected: PASS.

- [ ] **Step 2: Run complete tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS and refreshes `E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd`.

- [ ] **Step 4: Final diff review**

Run: `git diff --stat` and `git diff -- src/server/game/battle.ts src/server/game.test.ts src/server/game/data.ts src/App.tsx src/i18n/game-text.ts src/shared/rule-terms.ts`

Expected: only祖灵初始水位、文案、测试、构建产物和数值表相关变更。

## Self Review

- Spec coverage: plan covers战斗逻辑、文案、测试、Excel 和 build。
- Placeholder scan: no `TBD` / `TODO` / unspecified implementation steps remain.
- Type consistency: uses existing `refreshReservoir(side, item, time, progress)` API and existing `reservoirs` snapshot fields.
