# Forfeit Current Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增“放弃并按当前结算”功能，让玩家在进行中的跑局里主动结束，并按当前胜负生成休闲完成记录或天梯积分结算。

**Architecture:** 服务端新增独立结算接口 `POST /api/runs/:runId/settle`，不复用 `battle/finish` 的战斗推进逻辑，避免额外增加胜负和回合。前端新增统一放弃入口，确认后调用新接口，并复用现有跑局完成页、历史刷新和天梯刷新逻辑。

**Tech Stack:** Fastify、Prisma、Vitest、Supertest、React、Vite、lucide-react。

---

## 文件结构

- 修改 `src/server/api.test.ts`：新增服务端 API 行为测试，先覆盖休闲放弃、天梯放弃、重复放弃拒绝。
- 修改 `src/server/app.ts`：新增 `POST /api/runs/:runId/settle` 路由，复用现有 `settleLadderRun`。
- 修改 `src/App.structure.test.ts`：新增前端结构测试，确保 UI 有放弃入口并调用新接口。
- 修改 `src/App.tsx`：新增 `settleRun` 处理器、`ForfeitRunAction` 组件，并在非战斗播放的 ACTIVE 跑局中渲染入口。
- 修改 `src/App.css`：为放弃入口补充布局样式。
- 构建产物 `dist-click/index.html` 和 `dist-click/DogFight-standalone.cmd` 会由 `npm run build` 自动更新。

---

### Task 1: 服务端 API 红灯测试

**Files:**
- Modify: `src/server/api.test.ts`

- [ ] **Step 1: 写休闲放弃失败测试**

在 `describeWithDatabase('run API', () => {` 内，放在 `keeps casual runs active until the fifth loss` 测试之后，插入：

```ts
  it('settles a casual active run at the current record without adding a loss', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ account: `forfeit-casual-${Date.now()}`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'MUTT' }).expect(200)
    const runId = created.body.run.id

    await prisma.run.update({
      where: { id: runId },
      data: {
        wins: 4,
        losses: 2,
        round: 6,
        gold: 23,
        phase: 'CHOICE',
        status: 'ACTIVE',
        matchedGhost: JSON.stringify({ name: 'Pending Opponent' }),
      },
    })

    const settled = await agent.post(`/api/runs/${runId}/settle`).send({}).expect(200)

    expect(settled.body.run).toMatchObject({
      id: runId,
      mode: 'CASUAL',
      wins: 4,
      losses: 2,
      round: 6,
      gold: 23,
      status: 'COMPLETE',
      phase: 'COMPLETE',
      matchedGhost: null,
      ladderSettlement: null,
    })

    const history = await agent.get('/api/runs/history').expect(200)
    expect(history.body.history).toMatchObject({
      completedRuns: 1,
      abandonedRuns: 0,
      totalWins: 4,
      totalLosses: 2,
    })
  })
```

- [ ] **Step 2: 运行测试确认红灯**

Run:

```bash
npm test -- src/server/api.test.ts -t "settles a casual active run"
```

Expected: FAIL，接口不存在导致返回 404，而测试期望 200。

- [ ] **Step 3: 写天梯放弃失败测试**

在上一个测试后继续插入：

```ts
  it('settles a ladder active run at the current record and updates the ladder profile', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ account: `forfeit-ladder-${Date.now()}`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SHIBA', mode: 'LADDER' }).expect(200)
    const runId = created.body.run.id

    await prisma.run.update({
      where: { id: runId },
      data: {
        wins: 7,
        losses: 2,
        round: 9,
        phase: 'PREP',
        status: 'ACTIVE',
      },
    })

    const settled = await agent.post(`/api/runs/${runId}/settle`).send({}).expect(200)

    expect(settled.body.run).toMatchObject({
      id: runId,
      mode: 'LADDER',
      wins: 7,
      losses: 2,
      round: 9,
      status: 'COMPLETE',
      phase: 'COMPLETE',
      ladderSettlement: {
        beforeTier: 'BRONZE',
        beforeScore: 0,
        wins: 7,
        losses: 2,
      },
    })

    const ladder = await agent.get('/api/ladder/me').expect(200)
    expect(ladder.body.profile).toMatchObject({
      gamesPlayed: 1,
      totalWins: 7,
      totalLosses: 2,
    })
    expect(ladder.body.recentSettlements[0]).toMatchObject({
      wins: 7,
      losses: 2,
    })
  })
```

- [ ] **Step 4: 运行测试确认红灯**

Run:

```bash
npm test -- src/server/api.test.ts -t "settles a ladder active run"
```

Expected: FAIL，接口不存在导致返回 404，而测试期望 200。

- [ ] **Step 5: 写重复放弃拒绝失败测试**

在上一个测试后继续插入：

```ts
  it('rejects settling a run that is already complete', async () => {
    const agent = request.agent(app.server)
    await app.ready()

    await agent.post('/api/auth/register').send({ account: `forfeit-complete-${Date.now()}`, password: 'dogdice' }).expect(200)
    const created = await agent.post('/api/runs').send({ dogType: 'SAMOYED' }).expect(200)
    const runId = created.body.run.id

    await prisma.run.update({
      where: { id: runId },
      data: {
        wins: 3,
        losses: 1,
        phase: 'COMPLETE',
        status: 'COMPLETE',
      },
    })

    const rejected = await agent.post(`/api/runs/${runId}/settle`).send({}).expect(400)

    expect(rejected.body.error).toContain('当前跑局已经结算或不可放弃')
  })
```

- [ ] **Step 6: 运行测试确认红灯**

Run:

```bash
npm test -- src/server/api.test.ts -t "rejects settling a run"
```

Expected: FAIL，接口不存在导致返回 404，而测试期望 400。

- [ ] **Step 7: 提交红灯测试**

```bash
git add src/server/api.test.ts
git commit -m "test: cover forfeit settlement api"
```

---

### Task 2: 服务端结算接口实现

**Files:**
- Modify: `src/server/app.ts`
- Test: `src/server/api.test.ts`

- [ ] **Step 1: 添加最小接口实现**

在 `app.post('/api/runs/:runId/battle/finish', ...)` 路由结束后、`return app` 之前插入：

```ts
  app.post('/api/runs/:runId/settle', async (request, reply) => {
    const userId = requireUser(request.userId)
    const { runId } = z.object({ runId: z.string() }).parse(request.params)
    const run = await prisma.run.findFirstOrThrow({ where: { id: runId, userId }, include: { items: true, ladderSettlement: true } })
    if (run.status !== 'ACTIVE') {
      return reply.code(400).send({ error: '当前跑局已经结算或不可放弃' })
    }

    const updated = await prisma.run.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETE',
        phase: 'COMPLETE',
        matchedGhost: null,
      },
      include: { items: true, ladderSettlement: true },
    })

    if (run.mode === 'LADDER') {
      await settleLadderRun(userId, run.id, run.wins, run.losses)
      const settledRun = await prisma.run.findUniqueOrThrow({ where: { id: run.id }, include: { items: true, ladderSettlement: true } })
      return { run: publicRun(settledRun) }
    }

    return { run: publicRun(updated) }
  })
```

- [ ] **Step 2: 运行服务端目标测试确认绿灯**

Run:

```bash
npm test -- src/server/api.test.ts -t "settles a casual active run|settles a ladder active run|rejects settling a run"
```

Expected: PASS，三个新增测试通过。

- [ ] **Step 3: 运行相关回归测试**

Run:

```bash
npm test -- src/server/api.test.ts -t "battle/finish|ladder"
```

Expected: PASS，现有战斗完成和天梯相关测试不受影响。如果过滤表达式没有匹配到测试，改运行完整文件：

```bash
npm test -- src/server/api.test.ts
```

- [ ] **Step 4: 提交服务端实现**

```bash
git add src/server/app.ts
git commit -m "feat: settle active runs on forfeit"
```

---

### Task 3: 前端入口红灯测试

**Files:**
- Modify: `src/App.structure.test.ts`

- [ ] **Step 1: 写结构测试**

在 `defers battle result data updates until playback is continued` 测试后插入：

```ts
  it('offers active runs a confirmed forfeit settlement action outside battle playback', () => {
    expect(app).toContain('function ForfeitRunAction')
    expect(app).toContain('window.confirm')
    expect(app).toContain('/settle')
    expect(app).toContain("run.status === 'ACTIVE'")
    expect(app).toContain("run.phase !== 'BATTLE'")
    expect(app).toContain('onForfeit={() => void settleRun()}')
    expect(css).toContain('.forfeit-run-action')
  })
```

- [ ] **Step 2: 运行测试确认红灯**

Run:

```bash
npm test -- src/App.structure.test.ts -t "confirmed forfeit settlement"
```

Expected: FAIL，`ForfeitRunAction` 尚不存在。

- [ ] **Step 3: 提交红灯测试**

```bash
git add src/App.structure.test.ts
git commit -m "test: cover forfeit settlement action"
```

---

### Task 4: 前端入口实现

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Test: `src/App.structure.test.ts`

- [ ] **Step 1: 增加图标导入**

在 `lucide-react` 导入列表中加入 `Flag`：

```ts
  Flag,
```

- [ ] **Step 2: 增加前端处理器**

在 `finishBattle` 函数后插入：

```ts
  const settleRun = async () => {
    if (!run) return
    const confirmed = window.confirm('将按当前胜负结算，不会额外增加失败。确定放弃本局吗？')
    if (!confirmed) return
    setError('')
    try {
      const data = await api<{ run: Run }>(`/runs/${run.id}/settle`, { method: 'POST' })
      setRun(data.run)
      setBattle(null)
      setEventIndex(0)
      void loadRunHistory().catch(() => undefined)
      void loadLadderProfile().catch(() => undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    }
  }
```

- [ ] **Step 3: 渲染统一入口**

在主 `return` 中，紧跟战斗视图渲染块之后插入：

```tsx
      {!battle && run.status === 'ACTIVE' && run.phase !== 'BATTLE' && (
        <ForfeitRunAction run={run} onForfeit={() => void settleRun()} />
      )}
```

- [ ] **Step 4: 新增组件**

在 `BattleView` 函数之前插入：

```tsx
function ForfeitRunAction({ run, onForfeit }: { run: Run; onForfeit: () => void }) {
  return (
    <section className="forfeit-run-action paper-card" aria-label="放弃并结算当前跑局">
      <div>
        <strong>当前 {run.wins} 胜 {run.losses} 败</strong>
        <span>放弃后立即按当前记录结算，不会额外增加失败。</span>
      </div>
      <button className="danger-button action-button" type="button" onClick={onForfeit}>
        <Flag size={18} /> 放弃并结算
      </button>
    </section>
  )
}
```

- [ ] **Step 5: 新增样式**

在 `src/App.css` 中靠近 `.battle-continue-row` 或其他操作区样式处加入：

```css
.forfeit-run-action {
  width: min(760px, 100%);
  margin: 14px auto 0;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.forfeit-run-action div {
  display: grid;
  gap: 4px;
}

.forfeit-run-action span {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.35;
}

.forfeit-run-action .danger-button {
  flex: 0 0 auto;
}
```

- [ ] **Step 6: 移动端样式**

在现有移动端媒体查询里补充：

```css
  .forfeit-run-action {
    align-items: stretch;
    flex-direction: column;
  }
```

如果现有媒体查询位置不清晰，可以放在文件末尾新建：

```css
@media (max-width: 720px) {
  .forfeit-run-action {
    align-items: stretch;
    flex-direction: column;
  }
}
```

- [ ] **Step 7: 运行前端结构测试确认绿灯**

Run:

```bash
npm test -- src/App.structure.test.ts -t "confirmed forfeit settlement"
```

Expected: PASS。

- [ ] **Step 8: 提交前端实现**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: add forfeit settlement action"
```

---

### Task 5: 全量验证与单文件构建

**Files:**
- Generated: `dist-click/index.html`
- Generated: `dist-click/DogFight-standalone.cmd`

- [ ] **Step 1: 运行完整测试**

Run:

```bash
npm test
```

Expected: PASS，所有 Vitest 测试通过。

- [ ] **Step 2: 运行构建并同步单文件版本**

Run:

```bash
npm run build
```

Expected: PASS，并重新生成：

```text
E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd
```

- [ ] **Step 3: 检查工作区改动**

Run:

```bash
git status --short
```

Expected: 只包含本功能相关源码、测试、样式、计划文档和构建产物改动；不要回退进入本任务前已经存在的用户改动。

- [ ] **Step 4: 提交构建产物**

```bash
git add dist-click/index.html dist-click/DogFight-standalone.cmd
git commit -m "build: update standalone dogfight bundle"
```

---

## 自查结果

- 规格覆盖：休闲放弃、天梯放弃、重复结算拒绝、前端确认、历史和天梯刷新、构建同步均有对应任务。
- 占位符扫描：计划没有使用待补实现占位，每个代码改动步骤都有具体代码片段。
- 类型一致性：服务端接口路径统一为 `/api/runs/:runId/settle`，前端 API 客户端调用 `/runs/${run.id}/settle`，与现有 `api()` 前缀规则一致。
