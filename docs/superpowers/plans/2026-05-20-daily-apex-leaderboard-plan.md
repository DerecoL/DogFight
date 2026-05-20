# 当日巅峰榜 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加按中国时区每日 05:00 刷新的当日巅峰榜，并让玩家投入一只完成局时同时挑战总榜和当日榜。

**Architecture:** 复用 `ApexEntry` 表，通过 `boardType` 和 `boardKey` 区分总榜与日榜。后端提交接口将同一快照分别跑两次排名挑战，前端只负责页签切换展示。

**Tech Stack:** TypeScript、Fastify、Prisma、PostgreSQL、React、Vitest、Vite。

---

### Task 1: 后端榜单口径与 API

**Files:**
- Modify: `src/server/game/apex.ts`
- Modify: `src/server/game/apex.test.ts`
- Modify: `src/server/app.ts`
- Modify: `src/server/api.test.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260520000002_daily_apex_leaderboard/migration.sql`

- [ ] **Step 1: 写失败测试**

在 `src/server/game/apex.test.ts` 增加 05:00 日榜 key 测试。在 `src/server/api.test.ts` 更新巅峰 API 测试，断言 `leaderboards.overall` 和 `leaderboards.daily` 都有 50 个种子，提交后两边都增加玩家条目，重复提交仍为 409。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/server/game/apex.test.ts src/server/api.test.ts -t "apex"`

Expected: 因缺少 `dailyApexBoardKey`、`leaderboards` 或日榜写入而失败。

- [ ] **Step 3: 更新 Prisma 模型与迁移**

`ApexEntry` 增加 `boardType String @default("OVERALL")`、`boardKey String @default("default")`，移除 `sourceRunId @unique` 和 `rank @unique`，新增 `@@unique([sourceRunId, boardType])`、`@@unique([boardType, boardKey, rank])` 与对应索引。

- [ ] **Step 4: 实现榜单辅助函数**

在 `src/server/game/apex.ts` 增加 `dailyApexBoardKey(date = new Date())`，按 `Asia/Shanghai` 且 05:00 前归前一天计算 `YYYY-MM-DD`。

- [ ] **Step 5: 实现 API 双榜逻辑**

`ensureApexSeeds(boardType, boardKey)` 按单榜初始化种子。`apexLeaderboard(boardType, boardKey)` 读取单榜。`POST /api/apex/submit` 分别对 `OVERALL/default` 和 `DAILY/currentKey` 运行挑战和插入。

- [ ] **Step 6: 运行测试确认通过**

Run: `npm test -- src/server/game/apex.test.ts src/server/api.test.ts -t "apex"`

Expected: 相关 apex 测试通过。

### Task 2: 前端页签展示

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/App.structure.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/App.structure.test.ts` 更新巅峰结构断言，要求源码包含 `总榜`、`当日榜`、`每日 05:00 更新` 和 `leaderboards: result.leaderboards`。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/App.structure.test.ts -t "peak arena"`

Expected: 因前端尚未使用双榜结构而失败。

- [ ] **Step 3: 更新类型和状态**

把 `ApexOverview` 改成包含 `leaderboards`、`dailyBoardKey`、`dailyResetHour`。把 `ApexSubmitResponse` 改成包含 `entries`、`reports`、`leaderboards`。

- [ ] **Step 4: 增加页签 UI**

在 `ApexArena` 增加 `activeApexBoard` 状态，右侧榜单 header 里渲染 `总榜` 和 `当日榜` 两个按钮，并根据页签选择对应列表。

- [ ] **Step 5: 运行前端结构测试**

Run: `npm test -- src/App.structure.test.ts -t "peak arena"`

Expected: 测试通过。

### Task 3: 单文件 mock 与构建

**Files:**
- Modify: `scripts/package-click-index.mjs`
- Generated: `dist-click/DogFight-standalone.cmd`

- [ ] **Step 1: 更新单文件本地 API mock**

让 mock state 保存 `apexEntries`，实现 `/apex` 和 `/apex/submit` 的双榜返回，至少保证单文件版本可提交并显示两套榜单。

- [ ] **Step 2: 运行全量验证**

Run: `npm test`

Expected: 全部测试通过。

- [ ] **Step 3: 构建单文件版本**

Run: `npm run build`

Expected: TypeScript、Vite 和 `scripts/package-click-index.mjs` 全部成功，重新生成 `dist-click/DogFight-standalone.cmd`。
