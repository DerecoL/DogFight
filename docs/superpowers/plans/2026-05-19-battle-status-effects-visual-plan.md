# Battle Status Effects Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为战斗回放增加正面/负面状态可视化、毒伤预损血条、状态层数/时间展示，以及对应战斗特效。

**Architecture:** 服务端战斗模拟在每个 `BattleEvent` 上输出双方状态快照；前端 `BattleDog` 将状态分成血条上方正面效果和血条下方负面效果展示。单文件可玩版内嵌 mock 战斗逻辑输出同样字段，避免线上版和可分享版本表现不一致。

**Tech Stack:** TypeScript, React, Vite, Vitest, CSS, existing canvas battle FX, standalone packaging script.

---

### Task 1: 战斗事件状态快照

**Files:**
- Modify: `src/server/game/types.ts`
- Modify: `src/server/game/battle.ts`
- Test: `src/server/game.test.ts`

- [ ] **Step 1: Write the failing test**

在 `battle simulation` 分组里新增测试：

```ts
it('records positive and negative status snapshots on battle events', () => {
  const player: FighterSnapshot = {
    name: 'P',
    dogType: 'SHIBA',
    wins: 0,
    losses: 0,
    round: 0,
    items: [
      { id: 'poison', defId: 'shiba-poison', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
      { id: 'shield', defId: 'v3-cone-collar', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
    ],
  }
  const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 0, items: [] }
  const result = simulateBattle(player, opponent, 'status-snapshot')
  const poisonApply = result.events.find((event) => event.defId === 'shiba-poison' && event.effectType === 'POISON')
  const poisonTick = result.events.find((event) => event.kind === 'POISON' && event.target === 'opponent')
  const shieldEvent = result.events.find((event) => event.defId === 'v3-cone-collar')

  expect(poisonApply?.opponentStatuses?.negative).toContainEqual(expect.objectContaining({ type: 'poison', stacks: 10, nextTickIn: 1, tickDamage: 10 }))
  expect(poisonTick?.opponentStatuses?.negative).toContainEqual(expect.objectContaining({ type: 'poison', stacks: 10, tickDamage: 10 }))
  expect(shieldEvent?.playerStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'shield', amount: 3 }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/game.test.ts -t "records positive and negative status snapshots"`

Expected: FAIL because `playerStatuses` / `opponentStatuses` do not exist.

- [ ] **Step 3: Add event status types**

Add exported types in `src/server/game/types.ts`:

```ts
export type BattleStatusType = 'shield' | 'thorns' | 'extraRoll' | 'poison' | 'weak' | 'freeze' | 'disabled'

export type BattleStatusEntry = {
  type: BattleStatusType
  label: string
  tone: 'positive' | 'negative'
  amount?: number
  stacks?: number
  remaining?: number
  nextTickIn?: number
  tickDamage?: number
}

export type BattleStatusRows = {
  positive: BattleStatusEntry[]
  negative: BattleStatusEntry[]
}
```

Add optional event fields:

```ts
playerStatuses?: BattleStatusRows
opponentStatuses?: BattleStatusRows
statusChanged?: BattleStatusType[]
```

- [ ] **Step 4: Add snapshot builder in `battle.ts`**

Add helper functions near `push`:

```ts
const poisonTickDamage = (side: Side) => {
  if (state[side].poison <= 0) return 0
  const poisonedBy = side === 'player' ? opponent : player
  const poisonBonusRelic = relicWithEffect(poisonedBy, 'POISON_TICK_BONUS')
  return state[side].poison + (poisonBonusRelic ? relicPoisonTickBonus(poisonBonusRelic.relicId, poisonBonusRelic.quality) : 0)
}

const statusRows = (side: Side): BattleStatusRows => ({
  positive: [
    ...(state[side].shield > 0 ? [{ type: 'shield' as const, label: '护盾', tone: 'positive' as const, amount: Math.round(state[side].shield) }] : []),
    ...(state[side].thorns > 0 ? [{ type: 'thorns' as const, label: '荆棘', tone: 'positive' as const, stacks: state[side].thorns }] : []),
    ...(state[side].shibaSpeedStacks > 0 ? [{ type: 'extraRoll' as const, label: '加速', tone: 'positive' as const, stacks: state[side].shibaSpeedStacks }] : []),
  ],
  negative: [
    ...(state[side].poison > 0 ? [{ type: 'poison' as const, label: '中毒', tone: 'negative' as const, stacks: state[side].poison, nextTickIn: 1, tickDamage: poisonTickDamage(side) }] : []),
    ...(state[side].weak > 0 ? [{ type: 'weak' as const, label: '虚弱', tone: 'negative' as const, stacks: state[side].weak }] : []),
    ...(state[side].freeze > 0 ? [{ type: 'freeze' as const, label: '冻结', tone: 'negative' as const, remaining: state[side].freeze }] : []),
    ...((state[side].disabledLarge + state[side].disabledItemIds.length) > 0 ? [{ type: 'disabled' as const, label: '失效', tone: 'negative' as const, amount: state[side].disabledLarge + state[side].disabledItemIds.length }] : []),
  ],
})
```

Include `playerStatuses: statusRows('player')` and `opponentStatuses: statusRows('opponent')` in every pushed event.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/server/game.test.ts -t "records positive and negative status snapshots"`

Expected: PASS.

### Task 2: 前端状态行与预损血条

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Test: `src/App.structure.test.ts`

- [ ] **Step 1: Write failing structure test**

Add assertions to `src/App.structure.test.ts`:

```ts
expect(app).toContain('function StatusEffectRow')
expect(app).toContain('positiveStatuses')
expect(app).toContain('negativeStatuses')
expect(app).toContain('poisonPreviewPercent')
expect(css).toContain('.status-effects.positive')
expect(css).toContain('.status-effects.negative')
expect(css).toContain('.hp-preview.poison')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.structure.test.ts`

Expected: FAIL because the new component/classes do not exist.

- [ ] **Step 3: Extend frontend types**

In `src/App.tsx`, add:

```ts
type BattleStatusEntry = {
  type: 'shield' | 'thorns' | 'extraRoll' | 'poison' | 'weak' | 'freeze' | 'disabled' | string
  label: string
  tone: 'positive' | 'negative'
  amount?: number
  stacks?: number
  remaining?: number
  nextTickIn?: number
  tickDamage?: number
}
type BattleStatusRows = { positive: BattleStatusEntry[]; negative: BattleStatusEntry[] }
```

Add to `BattleEvent`:

```ts
playerStatuses?: BattleStatusRows
opponentStatuses?: BattleStatusRows
statusChanged?: string[]
```

- [ ] **Step 4: Render positive row above health and negative row below**

In `BattleDog`, derive:

```ts
const rows = side === 'player' ? event?.playerStatuses : event?.opponentStatuses
const positiveStatuses = rows?.positive ?? []
const negativeStatuses = rows?.negative ?? []
const poisonStatus = negativeStatuses.find((status) => status.type === 'poison')
const poisonPreviewPercent = maxHp > 0 ? ((poisonStatus?.tickDamage ?? 0) / maxHp) * 100 : 0
```

Render:

```tsx
<StatusEffectRow tone="positive" statuses={positiveStatuses} />
<div className="hp-bar">
  {shieldValue > 0 && <i className="hp-shield" style={{ width: `${Math.max(6, Math.min(100, shieldPercent))}%` }} />}
  <i className="hp-current" style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }} />
  {poisonPreviewPercent > 0 && <i className="hp-preview poison" style={{ left: `${Math.max(0, Math.min(100, hpPercent - poisonPreviewPercent))}%`, width: `${Math.max(3, Math.min(100, poisonPreviewPercent))}%` }} />}
</div>
<StatusEffectRow tone="negative" statuses={negativeStatuses} />
```

- [ ] **Step 5: Add `StatusEffectRow`**

```tsx
function StatusEffectRow({ tone, statuses }: { tone: 'positive' | 'negative'; statuses: BattleStatusEntry[] }) {
  const visible = statuses.slice(0, 3)
  const hidden = statuses.length - visible.length
  return (
    <div className={`status-effects ${tone}`}>
      {visible.map((status) => <span key={`${tone}-${status.type}`} className={`status-chip ${status.type}`}>{statusText(status)}</span>)}
      {hidden > 0 && <span className="status-chip more" title={statuses.map(statusText).join(' / ')}>+{hidden}</span>}
    </div>
  )
}

function statusText(status: BattleStatusEntry) {
  if (status.type === 'poison') return `${status.label} ${status.stacks ?? 0}层 · ${status.nextTickIn ?? 1}s`
  if (status.stacks != null) return `${status.label} ${status.stacks}层`
  if (status.amount != null) return `${status.label} ${status.amount}`
  if (status.remaining != null) return `${status.label} ${status.remaining}s`
  return status.label
}
```

- [ ] **Step 6: Add CSS**

Add classes for `.status-effects`, `.status-chip`, `.hp-bar`, `.hp-current`, `.hp-shield`, `.hp-preview.poison`, and specific status colors.

- [ ] **Step 7: Run frontend structure test**

Run: `npm test -- src/App.structure.test.ts`

Expected: PASS.

### Task 3: 战斗特效颜色与日志强调

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Test: `src/App.structure.test.ts`

- [ ] **Step 1: Write failing test**

Assert:

```ts
expect(app).toContain('event.effectType === \\'POISON\\' ? \\'#22c55e\\'')
expect(css).toContain('.battle-log p.poison')
```

- [ ] **Step 2: Implement minimal UI behavior**

Change poison burst color from purple to green:

```ts
context.fillStyle = event.effectType === 'HEAL' ? '#16a34a' : event.effectType === 'POISON' ? '#22c55e' : '#ef4444'
```

Add log class:

```tsx
className={`${event.actor} ${event.effectType === 'POISON' ? 'poison' : ''}`}
```

Add CSS:

```css
.battle-log p.poison { color: #22c55e; font-weight: 900; }
.battle-dog.poisoned .battle-dog-img { filter: drop-shadow(0 18px 24px rgba(112, 72, 30, .20)) drop-shadow(0 0 14px rgba(34, 197, 94, .45)); }
```

- [ ] **Step 3: Run test**

Run: `npm test -- src/App.structure.test.ts`

Expected: PASS.

### Task 4: 单文件可玩版状态快照

**Files:**
- Modify: `scripts/package-click-index.mjs`
- Test: `scripts/package-click-index.test.mjs`

- [ ] **Step 1: Extend existing standalone poison test**

In `standalone mock applies shiba poison class reward during battle`, assert:

```js
expect(poisonApply.opponentStatuses.negative).toContainEqual(expect.objectContaining({ type: 'poison', stacks: 10, tickDamage: 10 }))
expect(poisonTick.opponentStatuses.negative).toContainEqual(expect.objectContaining({ type: 'poison', stacks: 10, tickDamage: 10 }))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- scripts/package-click-index.test.mjs -t "standalone mock applies shiba poison"`

Expected: FAIL because standalone events do not include status rows.

- [ ] **Step 3: Add standalone status rows**

Inside `simulateBattleV3`, add `statusRows(side)` and include `playerStatuses` / `opponentStatuses` in `push` using current state.

- [ ] **Step 4: Run test**

Run: `npm test -- scripts/package-click-index.test.mjs -t "standalone mock applies shiba poison"`

Expected: PASS.

### Task 5: Full verification and build

**Files:**
- Generated: `dist-click/index.html`
- Generated: `dist-click/DogFight-standalone.cmd`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- src/server/game.test.ts src/App.structure.test.ts scripts/package-click-index.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run full tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Rebuild playable standalone**

Run: `npm run build`

Expected: `Wrote E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd`.

