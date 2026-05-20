# 忍法·破额外触发 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `忍法·破` 在装备按容量触发时有 50% 概率额外触发同一装备 1 次。

**Architecture:** 在战斗匹配上下文中标记触发来源，初始触发队列根据该来源做额外入队。描述和数值文档同步更新，不改变单次装备效果倍率。

**Tech Stack:** TypeScript、Vitest、Vite、artifact-tool 工作簿编辑、npm build。

---

### Task 1: 战斗行为测试

**Files:**
- Modify: `src/server/game.test.ts`

- [ ] **Step 1: Write the failing test**

在 `describe('battle simulation', ...)` 中加入测试：

```ts
  it('lets shiba break repeat size-based triggers half the time', () => {
    const player: FighterSnapshot = {
      name: 'P',
      dogType: 'MUTT',
      wins: 0,
      losses: 0,
      round: 6,
      items: [
        { id: 'break', defId: 'shiba-break', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'shield-a', defId: 'v3-wooden-shield', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
      ],
    }
    const opponent: FighterSnapshot = { name: 'O', dogType: 'SHIBA', wins: 0, losses: 0, round: 6, items: [] }
    const result = simulateBattle(player, opponent, 'shiba-break-size-repeat-1')
    const firstPlayerRoll = result.events.find((event) => event.kind === 'ROLL' && event.actor === 'player')
    const shieldEvents = result.events.filter(
      (event) => event.time === firstPlayerRoll?.time && event.itemId === 'shield-a' && event.kind === 'ITEM',
    )

    expect(firstPlayerRoll?.roll).toBe(2)
    expect(shieldEvents).toHaveLength(2)
    expect(shieldEvents.map((event) => event.amount)).toEqual([8, 8])
  })
```

- [ ] **Step 2: Run the failing test**

Run: `npm test -- src/server/game.test.ts -t "shiba break repeat size-based triggers"`

Expected: FAIL because only one `shield-a` event exists before implementation.

### Task 2: 触发来源与额外入队

**Files:**
- Modify: `src/server/game/battle.ts`

- [ ] **Step 1: Add source metadata**

把 `matchingContext()` 返回值扩展为稳定对象，按容量命中时增加 `triggeredBySize: true`，其他分支为 `false`。

- [ ] **Step 2: Add helper for initial queue**

在 `resolveActor()` 里先计算 `{ item, context }`，保留匹配项。对 `context.triggeredBySize === true` 的装备执行 `rng() < 0.5`，成功时追加同一 `item`。

- [ ] **Step 3: Preserve existing rules**

`ONLY_LUCKY_DOUBLE` 仍在最终初始队列上执行双触发；空投保护仍只在没有任何初始匹配时生效；处理循环中继续重新计算 `matchingContext()`，保持现有倍率和日志。

- [ ] **Step 4: Run the focused test**

Run: `npm test -- src/server/game.test.ts -t "shiba break repeat size-based triggers"`

Expected: PASS.

### Task 3: 描述同步

**Files:**
- Modify: `src/server/game/data.ts`
- Modify: `src/server/game.quality-description.test.ts` if needed

- [ ] **Step 1: Update the source description**

把 `shiba-break` 描述更新为：`装备将不按照点数触发，按照其容量触发；按容量触发时有 50% 概率额外触发 1 次`。

- [ ] **Step 2: Ensure generated quality descriptions use the updated text**

如果 `itemDescription()` 对 `TRIGGER_BY_SIZE` 走兜底 `def.description`，不需要新增分支；否则补充分支返回同样描述。

- [ ] **Step 3: Run description tests**

Run: `npm test -- src/server/game.quality-description.test.ts`

Expected: PASS.

### Task 4: 外部数值表同步

**Files:**
- Modify: `C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx`

- [ ] **Step 1: Inspect workbook sheets**

用 artifact-tool 导入工作簿，查看 `职业道具库`、`数值模型-装备期望`、`数值模型-平衡看板` 是否存在，以及 `忍法·破` 所在行。

- [ ] **Step 2: Update relevant cells**

把 `忍法·破` 的效果描述改为包含“按容量触发时有 50% 概率额外触发 1 次”。如果模型页存在触发收益备注或倍率字段，将容量触发期望从 1.0 次更新为 1.5 次或加备注“容量触发期望 +50%”。

- [ ] **Step 3: Verify workbook**

检查关键范围无 `#REF!`、`#VALUE!`、`#NAME?` 等错误，并保存原路径。

### Task 5: 构建验证

**Files:**
- Generated: `dist-click\DogFight-standalone.cmd`

- [ ] **Step 1: Run targeted tests**

Run: `npm test -- src/server/game.test.ts src/server/game.quality-description.test.ts`

Expected: PASS.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: PASS and regenerate `dist-click\DogFight-standalone.cmd`.

- [ ] **Step 3: Check changed files**

Run: `git status --short`

Expected: source, tests, docs, workbook if tracked, and regenerated dist-click outputs reflect this change.
