# Dog House Steal Buff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 小狗窝触发时治疗并偷取敌方 1 层真正增益，同时把护盾从正面增益定义中移除。

**Architecture:** 在现有 `AdvancedEffect` 和 `simulateBattle` 分支中增加 `STEAL_ENEMY_BUFF`，复用战斗状态中的 `thorns` 与 `shibaSpeedStacks`。护盾继续通过独立数值字段流转，不再写入 `positive` 状态快照。

**Tech Stack:** TypeScript、Vitest、Vite、Node/tsx、Excel 工作簿同步。

---

### Task 1: 战斗规则失败测试

**Files:**
- Modify: `src/server/game.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that assert 小狗窝 steals thorns, steals speed when no thorns exist, and ignores shield-only targets:

```ts
it('lets dog house steal one thorn buff from the opponent after healing', () => {
  const player: FighterSnapshot = {
    name: 'P',
    dogType: 'SHIBA',
    wins: 0,
    losses: 0,
    round: 0,
    items: [
      { id: 'house', defId: 'dog-house', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
    ],
  }
  const opponent: FighterSnapshot = {
    name: 'O',
    dogType: 'SAMOYED',
    wins: 0,
    losses: 0,
    round: 0,
    items: [
      { id: 'thorn', defId: 'samoyed-thorn-fur', quality: 'GOLD', area: 'EQUIPMENT', x: 0, y: 0 },
    ],
    relics: [{ id: 'opening-thorns', relicId: 'v3-fluffed-spike-collar', quality: 'GOLD', slot: 0 }],
  }

  const result = simulateBattle(player, opponent, 'dog-house-steals-thorns')
  const steal = result.events.find((event) => event.itemId === 'house' && event.text.includes('偷取 1 层【荆棘】'))

  expect(steal?.playerStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'thorns', stacks: 1 }))
  expect(steal?.opponentStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'thorns', stacks: 4 }))
})

it('lets dog house steal one speed buff when the opponent has no thorns', () => {
  const player: FighterSnapshot = {
    name: 'P',
    dogType: 'SHIBA',
    wins: 0,
    losses: 0,
    round: 0,
    items: [
      { id: 'house', defId: 'dog-house', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
    ],
  }
  const opponent: FighterSnapshot = {
    name: 'O',
    dogType: 'SHIBA',
    wins: 0,
    losses: 0,
    round: 0,
    items: [
      { id: 'speed', defId: 'shiba-speed-katana', quality: 'GOLD', area: 'EQUIPMENT', x: 0, y: 0 },
    ],
  }

  const result = simulateBattle(player, opponent, 'dog-house-steals-speed-1')
  const steal = result.events.find((event) => event.itemId === 'house' && event.text.includes('偷取 1 层【加速】'))

  expect(steal?.playerStatuses?.positive).toContainEqual(expect.objectContaining({ type: 'extraRoll', stacks: 1 }))
  expect(steal?.opponentStatuses?.positive ?? []).not.toContainEqual(expect.objectContaining({ type: 'extraRoll' }))
})

it('does not let dog house steal shield because shield is special health', () => {
  const player: FighterSnapshot = {
    name: 'P',
    dogType: 'SHIBA',
    wins: 0,
    losses: 0,
    round: 0,
    items: [
      { id: 'house', defId: 'dog-house', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
    ],
  }
  const opponent: FighterSnapshot = {
    name: 'O',
    dogType: 'SHIBA',
    wins: 0,
    losses: 0,
    round: 0,
    items: [
      { id: 'shield', defId: 'v3-cone-collar', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
    ],
  }

  const result = simulateBattle(player, opponent, 'dog-house-does-not-steal-shield')
  const shieldEvent = result.events.find((event) => event.itemId === 'shield')
  const houseEvents = result.events.filter((event) => event.itemId === 'house')

  expect(shieldEvent?.opponentShield).toBe(3)
  expect(houseEvents.some((event) => event.text.includes('偷取'))).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/game.test.ts`

Expected: FAIL because `dog-house` has no steal effect yet and shield still appears as a positive status.

### Task 2: 护盾状态定义失败测试

**Files:**
- Modify: `src/server/game.test.ts`

- [ ] **Step 1: Add shield-special-health assertions**

Update the status snapshot test to assert shield is not in `positive` rows, while `playerShield` still records the shield value:

```ts
expect(shieldEvent?.playerShield).toBe(3)
expect(shieldEvent?.playerStatuses?.positive ?? []).not.toContainEqual(expect.objectContaining({ type: 'shield' }))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/game.test.ts`

Expected: FAIL because shield is still emitted inside `positive`.

### Task 3: 实现战斗逻辑

**Files:**
- Modify: `src/server/game/types.ts`
- Modify: `src/server/game/data.ts`
- Modify: `src/server/game/battle.ts`
- Modify: `scripts/package-click-index.mjs`

- [ ] **Step 1: Add effect type and description**

Add `STEAL_ENEMY_BUFF` to `AdvancedEffect`, set `dog-house` to that effect, and return the quality-aware description:

```ts
if (advanced === 'STEAL_ENEMY_BUFF') return `${baseEffect}并偷取敌方 1 层增益（优先【荆棘】，其次【加速】；护盾不算增益）。`
```

- [ ] **Step 2: Remove shield from positive statuses**

Delete the `shield` entry from `statusRows(...).positive`; keep `playerShield` and `opponentShield` event fields unchanged.

- [ ] **Step 3: Add steal helper**

Inside `simulateBattle`, add a helper that moves one layer from target to actor:

```ts
const stealPositiveBuff = (actorSide: Side, targetSide: Side) => {
  if (state[targetSide].thorns > 0) {
    state[targetSide].thorns -= 1
    state[actorSide].thorns += 1
    return '荆棘'
  }
  if (state[targetSide].shibaSpeedStacks > 0) {
    state[targetSide].shibaSpeedStacks -= 1
    state[actorSide].shibaSpeedStacks += 1
    return '加速'
  }
  return null
}
```

- [ ] **Step 4: Trigger steal from dog house**

After normal heal handling, if `advanced === 'STEAL_ENEMY_BUFF'`, call the helper and push a utility event only when it returns a label.

- [ ] **Step 5: Mirror standalone simulator**

Update `scripts/package-click-index.mjs` so generated standalone data includes the new `dog-house` advanced effect and the offline battle mock also excludes shield from `positive` statuses and performs the same thorn-first steal.

- [ ] **Step 6: Run tests**

Run: `npm test -- src/server/game.test.ts src/server/game.quality-description.test.ts scripts/package-click-index.test.mjs`

Expected: PASS.

### Task 4: 数值文档与构建

**Files:**
- Modify: `C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx`
- Generated: `dist-click\DogFight-standalone.cmd`

- [ ] **Step 1: Sync external workbook**

Update the rows or notes for 小狗窝 and shield terminology so the workbook says 小狗窝 heals and steals 1 layer of thorns/speed, while shield is special health rather than a buff.

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: exit code 0 and regenerated `dist-click\DogFight-standalone.cmd`.

- [ ] **Step 3: Final verification**

Run: `npm test -- src/server/game.test.ts src/server/game.quality-description.test.ts scripts/package-click-index.test.mjs`

Expected: PASS.
