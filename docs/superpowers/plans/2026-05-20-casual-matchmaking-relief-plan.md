# Casual Matchmaking Relief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让休闲匹配优先匹配低一胜场对手，并减少按最近创建时间造成的重复匹配扎堆。

**Architecture:** 将候选选择规则放进 `src/server/game/matchmaking.ts` 的纯函数中，API 只负责读取数据库候选和持久化匹配结果。离线 fallback 复用同一个目标胜场计算，单文件 mock 同步降低离线对手胜场。

**Tech Stack:** TypeScript, Vitest, Fastify API tests, Prisma, existing Vite build.

---

### Task 1: 纯匹配规则测试

**Files:**
- Modify: `src/server/game/matchmaking.ts`
- Create: `src/server/game/matchmaking.test.ts`

- [ ] 写失败测试：低一胜场候选优先于同胜场候选，即使同胜场候选更新更晚。
- [ ] 写失败测试：同优先级候选由 seed 稳定选择，不能等价于 `createdAt desc`。
- [ ] 运行 `npm test -- src/server/game/matchmaking.test.ts`，确认失败来自缺少新函数。
- [ ] 实现 `targetOpponentWins()` 和 `selectCasualGhostSnapshot()`。
- [ ] 再运行同一测试，确认通过。

### Task 2: API 接入

**Files:**
- Modify: `src/server/app.ts`
- Modify: `src/server/api.test.ts`

- [ ] 写失败 API 测试：当前用户自己的 ghost 不会被选中，匹配优先低一胜场的其他玩家 ghost。
- [ ] 修改 `/api/runs/:runId/battle/match` 查询：排除当前 run 和当前用户，读取 `[targetWins, wins]` 候选，交给纯函数选择。
- [ ] 修改真实候选为空时的 `seedGhost()` 参数为低一胜场。
- [ ] 运行 `npm test -- src/server/api.test.ts`。

### Task 3: 单文件 mock 同步

**Files:**
- Modify: `scripts/package-click-index.mjs`

- [ ] 将 standalone mock 的 `createGhost(run)` 调整为 `wins: max(0, run.wins - 1)`。
- [ ] 检查脚本中重复定义的 mock 段落，全部同步。
- [ ] 运行 `npm test -- scripts/package-click-index.test.mjs`。

### Task 4: 最终验证

**Files:**
- Generated: `dist-click/DogFight-standalone.cmd`
- Generated: `dist-click/index.html`

- [ ] 运行 `npm test -- src/server/game/matchmaking.test.ts src/server/api.test.ts scripts/package-click-index.test.mjs`。
- [ ] 运行 `npm run build`。
- [ ] 检查 `git diff --stat`，确认变更只覆盖匹配逻辑、测试、计划文档和构建产物。
