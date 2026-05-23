# Battle Equipment Meteor VFX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让战斗回放中的装备触发以“流星式流光”从触发装备飞向受影响的头像、血条、状态区或目标装备卡。

**Architecture:** 不修改战斗规则和数值，只增强前端回放表现。将当前位于 `.battle-stage` 内部的 canvas 特效层提升为覆盖整个 `.visual-battle` 面板的 overlay，使轨迹可以从上下装备栏飞到舞台目标或另一件装备。继续使用 `feedback.ts` 负责事件语义映射，在 `App.tsx` 内解析真实 DOM 锚点并绘制高亮光核、长拖尾、星屑和命中闪爆。

**Tech Stack:** React 19, TypeScript, Vite, Vitest, CSS animations, HTML canvas.

---

## 文件边界

- 修改 `src/feedback.ts`：把表现目标从泛化的 `dog` / `status` 细化为可解析的视觉锚点。
- 修改 `src/feedback.test.ts`：用 RED 测试锁定伤害、治疗、护盾、负面状态和正面状态的目标锚点。
- 修改 `src/App.structure.test.ts`：用 RED 测试锁定战斗装备、头像、血条、状态区、面板级特效层和目标装备推导的稳定 hook。
- 修改 `src/App.css.test.ts`：用 RED 测试锁定流星特效 CSS hook、目标装备高亮和 reduced motion 降级。
- 修改 `src/App.tsx`：增加 battle panel ref、DOM 锚点、目标装备推导、坐标解析和流星 canvas 绘制。
- 修改 `src/App.css`：增加面板级 overlay、源装备闪光、目标装备扫光、命中光晕和 reduced motion 降级样式。
- 默认不修改 `src/server/game/battle.ts` 和 `src/server/game/types.ts`；只有当前端无法稳定推导目标装备时，才增加纯展示字段。

## 关键约束

- 先写测试，再改生产代码。
- 每个任务完成后运行对应测试并提交。
- 不改装备、遗物、职业道具、战斗参数、经济价格和任何平衡模型。
- 实现完成后必须运行 `npm run build`，确认单文件可玩版本重新生成。
- 不更新外部 Excel，因为本轮不改变任何数值或平衡模型。

### Task 1: 细化战斗表现目标锚点

**Files:**
- Modify: `src/feedback.test.ts`
- Modify: `src/feedback.ts`

- [ ] **Step 1: 写 RED 测试**

在 `src/feedback.test.ts` 的 `describe('feedback presentation mapping', () => { ... })` 内追加：

```ts
  it('maps battle effect types to precise visual target anchors', () => {
    const cases = [
      [{ effectType: 'DAMAGE', targetHpDelta: -3, target: 'opponent' }, { anchor: 'dog-avatar', side: 'opponent' }],
      [{ effectType: 'DAMAGE', targetHpDelta: 0, target: 'opponent' }, { anchor: 'dog-avatar', side: 'opponent' }],
      [{ effectType: 'HEAL', target: 'player' }, { anchor: 'hp', side: 'player' }],
      [{ effectType: 'UTILITY', playerStatuses: { positive: [{ type: 'shield', label: '护盾', tone: 'positive' }] }, target: 'player' }, { anchor: 'hp', side: 'player' }],
      [{ effectType: 'POISON', target: 'opponent' }, { anchor: 'status-negative', side: 'opponent' }],
      [{ effectType: 'UTILITY', opponentStatuses: { positive: [], negative: [{ type: 'weak', label: '虚弱', tone: 'negative' }] }, target: 'opponent' }, { anchor: 'status-negative', side: 'opponent' }],
      [{ effectType: 'UTILITY', playerStatuses: { positive: [{ type: 'thorns', label: '荆棘', tone: 'positive' }], negative: [] }, target: 'player' }, { anchor: 'status-positive', side: 'player' }],
    ] as const

    for (const [patch, expectedTarget] of cases) {
      expect(createBattlePresentation({ ...baseEvent, ...patch }).target).toEqual(expectedTarget)
    }
  })
```

- [ ] **Step 2: 确认 RED**

Run:

```bash
npx vitest run src/feedback.test.ts
```

Expected: FAIL，原因是 `battlePresentationTarget()` 仍返回 `dog`、`status` 等泛化锚点。

- [ ] **Step 3: 最小实现**

在 `src/feedback.ts` 中扩展 `FeedbackAnchor`：

```ts
export type FeedbackAnchor =
  | 'item'
  | 'dice'
  | 'dog'
  | 'dog-avatar'
  | 'hp'
  | 'status'
  | 'status-positive'
  | 'status-negative'
  | 'equipment-row'
  | 'log'
  | 'screen'
```

替换 `battlePresentationTarget()`：

```ts
function battlePresentationTarget(event: BattleEventLike | null | undefined, kind: PresentationKind): FxAnchor {
  if (kind === 'roll') return { anchor: 'dice', side: normalizeSide(event?.actor) }
  const targetSide = battlePresentationTargetSide(event, kind)
  if (!targetSide) return { anchor: 'screen', side: 'system' }
  if (kind === 'heal' || kind === 'shield') return { anchor: 'hp', side: targetSide }
  if (kind === 'poison' || kind === 'weak' || kind === 'freeze') return { anchor: 'status-negative', side: targetSide }
  if (kind === 'thorns') return { anchor: 'status-positive', side: targetSide }
  return { anchor: 'dog-avatar', side: targetSide }
}
```

- [ ] **Step 4: 确认 GREEN**

Run:

```bash
npx vitest run src/feedback.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/feedback.ts src/feedback.test.ts
git commit -m "feat: refine battle vfx target anchors"
```

### Task 2: 增加战斗 DOM 锚点并提升特效层范围

**Files:**
- Modify: `src/App.structure.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: 写 RED 测试**

在 `src/App.structure.test.ts` 的 `describe('selection screen structure', () => { ... })` 内追加：

```ts
  it('exposes stable battle anchors for meteor vfx source and target resolution', () => {
    expect(app).toContain('const battlePanelRef = useRef<HTMLElement | null>(null)')
    expect(app).toContain('ref={battlePanelRef}')
    expect(app).toContain('rootRef={battlePanelRef}')
    expect(app).toContain('data-battle-anchor="item"')
    expect(app).toContain('data-battle-side={owner}')
    expect(app).toContain('data-battle-item-id={item.id}')
    expect(app).toContain('data-battle-anchor="equipment-row"')
    expect(app).toContain('data-battle-anchor="dog-avatar"')
    expect(app).toContain('data-battle-anchor="hp"')
    expect(app).toContain('data-battle-anchor="status-positive"')
    expect(app).toContain('data-battle-anchor="status-negative"')
  })
```

- [ ] **Step 2: 确认 RED**

Run:

```bash
npx vitest run src/App.structure.test.ts
```

Expected: FAIL，原因是新的 `data-battle-anchor` 字符串不存在。

- [ ] **Step 3: 提升 `BattleFxStage` 到整个战斗面板**

在 `BattleView` 内增加：

```ts
  const battlePanelRef = useRef<HTMLElement | null>(null)
```

将根节点改为：

```tsx
    <section ref={battlePanelRef} className={`battle-panel visual-battle sketch-panel high-impact-vfx visual-theme-${visualTheme}`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)}>
      <BattleFxStage event={event} presentation={presentation} speed={speed} rootRef={battlePanelRef} player={playerSnapshot} opponent={opponentSnapshot} />
```

删除 `BattleStage` 内部原来的：

```tsx
      <BattleFxStage event={event} presentation={presentation} speed={speed} />
```

更新 `BattleStage` 签名，移除 `speed` 参数：

```ts
function BattleStage({ player, opponent, event, presentation, lastRoll, finished, winner, visualTheme }: { player: BattleSnapshot; opponent: BattleSnapshot; event?: BattleEvent; presentation: PresentationEvent | null; lastRoll?: BattleEvent; finished: boolean; winner?: string; visualTheme: VisualThemeId }) {
```

- [ ] **Step 4: 增加装备、装备栏、头像、血条、状态区锚点**

`BattleEquipmentRow` 根节点改为：

```tsx
    <div className={`battle-equipment-row ${owner} sketch-panel`} data-battle-anchor="equipment-row" data-battle-side={owner}>
```

战斗装备按钮增加：

```tsx
            data-battle-anchor="item"
            data-battle-side={owner}
            data-battle-item-id={item.id}
```

`BattleDog` 的血条容器改为：

```tsx
      <div className="hp" data-battle-anchor="hp" data-battle-side={side}>
```

`StatusEffectRow` 增加 `anchor` 参数：

```ts
function StatusEffectRow({ anchor, tone, side, statuses, onStatusInspect, activeStatusKey }: { anchor: 'status-positive' | 'status-negative'; tone: 'positive' | 'negative'; side: 'player' | 'opponent'; statuses: BattleStatusEntry[]; onStatusInspect: (status: BattleStatusEntry, side: 'player' | 'opponent', polarity: 'positive' | 'negative', element: HTMLElement) => void; activeStatusKey: string | null }) {
```

状态行根节点改为：

```tsx
    <div className={`status-effects ${tone}`} data-battle-anchor={anchor} data-battle-side={side}>
```

调用处改为：

```tsx
        <StatusEffectRow anchor="status-positive" tone="positive" side={side} statuses={positiveStatuses} onStatusInspect={onStatusInspect} activeStatusKey={activeStatusKey} />
```

```tsx
        <StatusEffectRow anchor="status-negative" tone="negative" side={side} statuses={negativeStatuses} onStatusInspect={onStatusInspect} activeStatusKey={activeStatusKey} />
```

头像图片改为：

```tsx
      <img className="battle-dog-img" data-battle-anchor="dog-avatar" data-battle-side={side} src={dogAssets[snapshot.dogType]} alt="" />
```

- [ ] **Step 5: 确认 GREEN**

Run:

```bash
npx vitest run src/App.structure.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/App.tsx src/App.structure.test.ts
git commit -m "feat: add battle vfx anchors"
```

### Task 3: 解析面板级源点和目标点坐标

**Files:**
- Modify: `src/App.structure.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: 写 RED 测试**

在 `src/App.structure.test.ts` 追加：

```ts
  it('resolves battle vfx coordinates from panel-wide DOM anchors', () => {
    expect(app).toContain('function battleFxAnchorSelector')
    expect(app).toContain('function resolveBattleFxPoint')
    expect(app).toContain('function resolveBattleFxRoute')
    expect(app).toContain('querySelector<HTMLElement>(battleFxAnchorSelector')
    expect(app).toContain('elementCenterRelativeTo')
    expect(app).toContain("anchor.anchor === 'item'")
    expect(app).toContain("anchor.anchor === 'equipment-row'")
  })
```

- [ ] **Step 2: 确认 RED**

Run:

```bash
npx vitest run src/App.structure.test.ts
```

Expected: FAIL，原因是坐标解析 helper 不存在。

- [ ] **Step 3: 增加坐标 helper**

在 `src/App.tsx` 的 battle VFX helper 附近加入：

```ts
type BattleFxPoint = { x: number; y: number }
type BattleFxRoute = { source: BattleFxPoint; target: BattleFxPoint; targetItemIds: string[]; targetItemOwner: 'player' | 'opponent' | null }

function cssEscapeValue(value: string) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}

function battleFxAnchorSelector(anchor: PresentationEvent['source']) {
  if (anchor.anchor === 'item' && anchor.id) {
    return `[data-battle-anchor="item"][data-battle-side="${anchor.side}"][data-battle-item-id="${cssEscapeValue(anchor.id)}"]`
  }
  if (anchor.anchor === 'equipment-row') return `[data-battle-anchor="equipment-row"][data-battle-side="${anchor.side}"]`
  if (anchor.anchor === 'dog-avatar') return `[data-battle-anchor="dog-avatar"][data-battle-side="${anchor.side}"]`
  if (anchor.anchor === 'hp') return `[data-battle-anchor="hp"][data-battle-side="${anchor.side}"]`
  if (anchor.anchor === 'status-positive') return `[data-battle-anchor="status-positive"][data-battle-side="${anchor.side}"]`
  if (anchor.anchor === 'status-negative') return `[data-battle-anchor="status-negative"][data-battle-side="${anchor.side}"]`
  if (anchor.anchor === 'dice') return '.battle-dice'
  return '.battle-stage'
}

function elementCenterRelativeTo(element: HTMLElement, rootRect: DOMRect): BattleFxPoint {
  const rect = element.getBoundingClientRect()
  return {
    x: rect.left - rootRect.left + rect.width / 2,
    y: rect.top - rootRect.top + rect.height / 2,
  }
}

function fallbackBattleFxPoint(rootRect: DOMRect, side: 'player' | 'opponent' | 'system'): BattleFxPoint {
  if (side === 'player') return { x: rootRect.width * 0.74, y: rootRect.height * 0.55 }
  if (side === 'opponent') return { x: rootRect.width * 0.26, y: rootRect.height * 0.35 }
  return { x: rootRect.width * 0.5, y: rootRect.height * 0.5 }
}

function resolveBattleFxPoint(root: HTMLElement, rootRect: DOMRect, anchor: PresentationEvent['source']) {
  const element = root.querySelector<HTMLElement>(battleFxAnchorSelector(anchor))
  return element ? elementCenterRelativeTo(element, rootRect) : fallbackBattleFxPoint(rootRect, anchor.side)
}

function resolveBattleFxRoute(root: HTMLElement, event: BattleEvent, presentation: PresentationEvent, player: BattleSnapshot, opponent: BattleSnapshot): BattleFxRoute {
  const rootRect = root.getBoundingClientRect()
  const source = resolveBattleFxPoint(root, rootRect, presentation.source)
  const targetItems = targetEquipmentItemsForBattleEvent(event, player, opponent)
  if (targetItems.itemIds.length > 0 && targetItems.owner) {
    const firstTarget = root.querySelector<HTMLElement>(`[data-battle-anchor="item"][data-battle-side="${targetItems.owner}"][data-battle-item-id="${cssEscapeValue(targetItems.itemIds[0])}"]`)
    return {
      source,
      target: firstTarget ? elementCenterRelativeTo(firstTarget, rootRect) : resolveBattleFxPoint(root, rootRect, { anchor: 'equipment-row', side: targetItems.owner }),
      targetItemIds: targetItems.itemIds,
      targetItemOwner: targetItems.owner,
    }
  }
  return {
    source,
    target: resolveBattleFxPoint(root, rootRect, presentation.target),
    targetItemIds: [],
    targetItemOwner: null,
  }
}
```

- [ ] **Step 4: 更新 `BattleFxStage` 使用真实坐标**

签名改为：

```ts
function BattleFxStage({ event, presentation, speed, rootRef, player, opponent }: { event?: BattleEvent; presentation: PresentationEvent | null; speed: number; rootRef: React.RefObject<HTMLElement | null>; player: BattleSnapshot; opponent: BattleSnapshot }) {
```

在 effect 内增加 root 检查：

```ts
    const root = rootRef.current
    if (!root || !presentation || presentation.kind === 'none') return
```

创建 route：

```ts
    const route = resolveBattleFxRoute(root, event, presentation, player, opponent)
    const actorX = route.source.x
    const actorY = route.source.y
    const targetX = route.target.x
    const targetY = route.target.y
```

将旧的固定 `centerY` 调用改为：

```ts
    const particles = createBattleParticles(event, fx, targetX, targetY)
```

```ts
      drawBattleFxTrail(context, actorX, actorY, targetX, targetY, t, fx)
```

```ts
      drawHandwrittenBattleNumber(context, event, fx, targetX, targetY, t)
```

依赖数组改为：

```ts
  }, [event, presentation, speed, rootRef, player, opponent])
```

- [ ] **Step 5: 确认 GREEN**

Run:

```bash
npx vitest run src/App.structure.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/App.tsx src/App.structure.test.ts
git commit -m "feat: resolve battle vfx anchor routes"
```

### Task 4: 推导受影响的目标装备

**Files:**
- Modify: `src/App.structure.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: 写 RED 测试**

在 `src/App.structure.test.ts` 追加：

```ts
  it('infers target equipment cards for equipment-affecting battle events', () => {
    expect(app).toContain('function targetEquipmentItemsForBattleEvent')
    expect(app).toContain('function adjacentBattleItems')
    expect(app).toContain('function rightmostBattleItem')
    expect(app).toContain("event.text.includes('最右侧装备')")
    expect(app).toContain("advancedEffect === 'TRIGGER_ADJACENT'")
    expect(app).toContain("event.text.includes('相邻')")
    expect(app).toContain("targetItemIds.includes(item.id)")
    expect(app).toContain('battle-item-vfx-target')
  })
```

- [ ] **Step 2: 确认 RED**

Run:

```bash
npx vitest run src/App.structure.test.ts
```

Expected: FAIL，原因是目标装备推导 helper 不存在。

- [ ] **Step 3: 增加目标装备推导 helper**

在 `src/App.tsx` 中加入：

```ts
function battleEquipmentItems(snapshot: BattleSnapshot) {
  return snapshot.items.filter((item) => item.area === 'EQUIPMENT').sort((left, right) => left.x - right.x || left.y - right.y)
}

function adjacentBattleItems(snapshot: BattleSnapshot, source: Item) {
  const sourceLeft = source.x
  const sourceRight = source.x + source.def.width
  return battleEquipmentItems(snapshot).filter((item) => {
    if (item.id === source.id) return false
    const itemLeft = item.x
    const itemRight = item.x + item.def.width
    return itemRight === sourceLeft || itemLeft === sourceRight || Math.abs(item.x - source.x) <= source.def.width
  })
}

function rightmostBattleItem(snapshot: BattleSnapshot) {
  return battleEquipmentItems(snapshot).at(-1) ?? null
}

function targetEquipmentItemsForBattleEvent(event: BattleEvent, player: BattleSnapshot, opponent: BattleSnapshot): { owner: 'player' | 'opponent' | null; itemIds: string[] } {
  if (event.kind !== 'ITEM' || !event.itemId) return { owner: null, itemIds: [] }
  const actorSnapshot = event.actor === 'player' ? player : event.actor === 'opponent' ? opponent : null
  const targetOwner = event.target === 'player' || event.target === 'opponent'
    ? event.target
    : event.actor === 'player'
      ? 'opponent'
      : event.actor === 'opponent'
        ? 'player'
        : null
  const targetSnapshot = targetOwner === 'player' ? player : targetOwner === 'opponent' ? opponent : null
  const sourceItem = actorSnapshot?.items.find((item) => item.id === event.itemId) ?? null
  const advancedEffect = sourceItem?.def.advancedEffect

  if (targetSnapshot && event.text.includes('最右侧装备')) {
    const rightmost = rightmostBattleItem(targetSnapshot)
    return rightmost ? { owner: targetOwner, itemIds: [rightmost.id] } : { owner: null, itemIds: [] }
  }

  if (actorSnapshot && sourceItem && (advancedEffect === 'TRIGGER_ADJACENT' || event.text.includes('相邻'))) {
    return { owner: event.actor === 'player' || event.actor === 'opponent' ? event.actor : null, itemIds: adjacentBattleItems(actorSnapshot, sourceItem).map((item) => item.id) }
  }

  return { owner: null, itemIds: [] }
}
```

- [ ] **Step 4: 给目标装备加高亮 class**

`BattleEquipmentRow` 参数增加：

```ts
function BattleEquipmentRow({ owner, snapshot, events, displayIndex, activeEvent, targetItemIds = [], onInspect }: { owner: 'player' | 'opponent'; snapshot: BattleSnapshot; events: BattleEvent[]; displayIndex: number; activeEvent?: BattleEvent; targetItemIds?: string[]; onInspect: (item: Item, element: HTMLElement) => void }) {
```

`BattleView` 里计算：

```ts
  const targetEquipment = event && playback ? targetEquipmentItemsForBattleEvent(event, playerSnapshot, opponentSnapshot) : { owner: null, itemIds: [] }
```

两处 `BattleEquipmentRow` 传入：

```tsx
      <BattleEquipmentRow owner="opponent" snapshot={opponentSnapshot} events={events} displayIndex={displayIndex} activeEvent={event} targetItemIds={targetEquipment.owner === 'opponent' ? targetEquipment.itemIds : []} onInspect={(item, element) => setBattleTip({ item, owner: 'opponent', anchor: getFloatingTipPosition(element) })} />
```

```tsx
      <BattleEquipmentRow owner="player" snapshot={playerSnapshot} events={events} displayIndex={displayIndex} activeEvent={event} targetItemIds={targetEquipment.owner === 'player' ? targetEquipment.itemIds : []} onInspect={(item, element) => setBattleTip({ item, owner: 'player', anchor: getFloatingTipPosition(element) })} />
```

装备卡 class 增加：

```tsx
${targetItemIds.includes(item.id) ? 'battle-item-vfx-target' : ''}
```

- [ ] **Step 5: 确认 GREEN**

Run:

```bash
npx vitest run src/App.structure.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/App.tsx src/App.structure.test.ts
git commit -m "feat: target equipment for battle vfx"
```

### Task 5: 绘制流星式 canvas 特效

**Files:**
- Modify: `src/App.structure.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: 写 RED 测试**

在 `src/App.structure.test.ts` 追加：

```ts
  it('draws battle vfx as meteor trails with glow, tail, sparks, and impact flash', () => {
    expect(app).toContain('function drawMeteorBattleFxTrail')
    expect(app).toContain('function drawMeteorImpactFlash')
    expect(app).toContain('function createMeteorSparkParticles')
    expect(app).toContain('const tailLayers = [')
    expect(app).toContain('context.shadowBlur')
    expect(app).toContain('context.createRadialGradient')
    expect(app).toContain('meteorPulse')
  })
```

- [ ] **Step 2: 确认 RED**

Run:

```bash
npx vitest run src/App.structure.test.ts
```

Expected: FAIL，原因是流星绘制 helper 不存在。

- [ ] **Step 3: 增加流星轨迹绘制**

将旧 `drawBattleFxTrail()` 替换为：

```ts
function drawMeteorBattleFxTrail(context: CanvasRenderingContext2D, actorX: number, actorY: number, targetX: number, targetY: number, t: number, fx: BattleVfxStyle) {
  if (fx.kind === 'none' || fx.kind === 'roll') return
  const progress = Math.min(1, t * 1.2)
  const controlX = (actorX + targetX) / 2
  const controlY = Math.min(actorY, targetY) - 56
  const currentX = quadraticPoint(actorX, controlX, targetX, progress)
  const currentY = quadraticPoint(actorY, controlY, targetY, progress)
  const tailLayers = [
    { width: 18, alpha: .18, lag: .34 },
    { width: 11, alpha: .34, lag: .22 },
    { width: 5, alpha: .92, lag: .1 },
  ]

  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const layer of tailLayers) {
    const tailProgress = Math.max(0, progress - layer.lag)
    const tailX = quadraticPoint(actorX, controlX, targetX, tailProgress)
    const tailY = quadraticPoint(actorY, controlY, targetY, tailProgress)
    const gradient = context.createLinearGradient(tailX, tailY, currentX, currentY)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
    gradient.addColorStop(.55, fx.accent)
    gradient.addColorStop(1, '#ffffff')
    context.globalAlpha = Math.max(0, 1 - t * .55) * layer.alpha
    context.strokeStyle = gradient
    context.lineWidth = layer.width
    context.shadowColor = fx.color
    context.shadowBlur = 18 * layer.alpha + 8
    context.beginPath()
    context.moveTo(tailX, tailY)
    context.quadraticCurveTo((tailX + currentX) / 2, (tailY + currentY) / 2 - 10, currentX, currentY)
    context.stroke()
  }

  const meteorPulse = 1 + Math.sin(t * Math.PI * 5) * .08
  const core = context.createRadialGradient(currentX, currentY, 1, currentX, currentY, 18 * meteorPulse)
  core.addColorStop(0, '#ffffff')
  core.addColorStop(.35, fx.accent)
  core.addColorStop(1, fx.color)
  context.globalAlpha = Math.max(0, .98 - t * .22)
  context.fillStyle = core
  context.shadowColor = fx.accent
  context.shadowBlur = 24
  context.beginPath()
  context.arc(currentX, currentY, 9 * meteorPulse, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function quadraticPoint(start: number, control: number, end: number, t: number) {
  return (1 - t) * (1 - t) * start + 2 * (1 - t) * t * control + t * t * end
}
```

调用处改为：

```ts
      drawMeteorBattleFxTrail(context, actorX, actorY, targetX, targetY, t, fx)
```

- [ ] **Step 4: 增加星屑和命中闪爆**

将 `createBattleParticles()` 重命名为 `createMeteorSparkParticles()`，调用处改为：

```ts
    const particles = createMeteorSparkParticles(event, fx, targetX, targetY)
```

在绘制循环中追加：

```ts
      drawMeteorImpactFlash(context, targetX, targetY, t, fx)
```

新增：

```ts
function drawMeteorImpactFlash(context: CanvasRenderingContext2D, targetX: number, targetY: number, t: number, fx: BattleVfxStyle) {
  if (t < .62 || fx.kind === 'none' || fx.kind === 'roll') return
  const localT = Math.min(1, (t - .62) / .38)
  const radius = 18 + localT * 54
  context.save()
  context.globalAlpha = Math.max(0, 1 - localT)
  context.strokeStyle = fx.accent
  context.lineWidth = 4
  context.shadowColor = fx.accent
  context.shadowBlur = 18
  context.beginPath()
  context.arc(targetX, targetY, radius, 0, Math.PI * 2)
  context.stroke()
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8
    context.beginPath()
    context.moveTo(targetX + Math.cos(angle) * (radius * .35), targetY + Math.sin(angle) * (radius * .35))
    context.lineTo(targetX + Math.cos(angle) * radius, targetY + Math.sin(angle) * radius)
    context.stroke()
  }
  context.restore()
}
```

- [ ] **Step 5: 确认 GREEN**

Run:

```bash
npx vitest run src/App.structure.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/App.tsx src/App.structure.test.ts
git commit -m "feat: draw meteor battle vfx"
```

### Task 6: 增加流星 CSS 和 reduced motion 降级

**Files:**
- Modify: `src/App.css.test.ts`
- Modify: `src/App.css`

- [ ] **Step 1: 写 RED 测试**

在 `src/App.css.test.ts` 的 `describe('equipment layout scale', () => { ... })` 内追加：

```ts
  it('styles meteor battle vfx with bright source, target, and reduced motion hooks', () => {
    expect(cssRule('.visual-battle')).toContain('position: relative')
    expect(cssRule('.visual-battle')).toContain('overflow: hidden')
    expect(cssRule('.visual-battle .battle-fx-stage')).toContain('z-index')
    expect(cssRule('.battle-item-vfx-target')).toContain('meteorTargetPulse')
    expect(cssRule('.battle-item-vfx-target::after')).toContain('meteorTargetSweep')
    expect(cssRule('.battle-item-trigger')).toContain('meteorSourcePulse')
    expect(cssRule('.battle-dog.vfx-target-shield .hp::after')).toContain('box-shadow')
    expect(css).toContain('@keyframes meteorSourcePulse')
    expect(css).toContain('@keyframes meteorTargetPulse')
    expect(css).toContain('@keyframes meteorTargetSweep')
    expect(css).toContain('@keyframes meteorImpactGlow')
    expect(cssRule('@media (prefers-reduced-motion: reduce)')).toContain('.battle-item-vfx-target')
  })
```

- [ ] **Step 2: 确认 RED**

Run:

```bash
npx vitest run src/App.css.test.ts
```

Expected: FAIL，原因是新 CSS hook 不存在。

- [ ] **Step 3: 增加样式**

在 `src/App.css` 的战斗 VFX 样式附近加入：

```css
.visual-battle {
  position: relative;
  overflow: hidden;
}

.visual-battle .battle-fx-stage {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 8;
}

.visual-battle .battle-fx-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.battle-item-trigger {
  animation: battleTriggerStamp .5s ease-out 1, itemPulse .58s ease-in-out 2, meteorSourcePulse .72s ease-out 1;
}

.battle-item-vfx-target {
  animation: meteorTargetPulse .62s cubic-bezier(.2, 1.45, .38, 1) 1;
  box-shadow: 0 0 0 5px rgba(255, 255, 255, .58), 0 0 34px rgba(255, 216, 107, .82), inset 0 -18px 30px rgba(90, 132, 246, .12);
}

.battle-item-vfx-target::after {
  content: "";
  position: absolute;
  inset: 4px;
  border-radius: inherit;
  background: linear-gradient(115deg, transparent 12%, rgba(255, 255, 255, .88) 42%, rgba(255, 216, 107, .72) 52%, transparent 78%);
  pointer-events: none;
  animation: meteorTargetSweep .68s ease-out both;
}
```

新增 keyframes：

```css
@keyframes meteorSourcePulse {
  0% { filter: brightness(1); }
  42% { filter: brightness(1.42) saturate(1.28); box-shadow: 0 0 0 6px rgba(255, 255, 255, .72), 0 0 36px rgba(255, 216, 107, .95); }
  100% { filter: brightness(1); }
}
@keyframes meteorTargetPulse {
  0% { transform: scale(.98) rotate(var(--paper-tilt, 0deg)); filter: brightness(1); }
  48% { transform: scale(1.08) rotate(var(--paper-tilt, 0deg)); filter: brightness(1.34) saturate(1.2); }
  100% { transform: scale(1) rotate(var(--paper-tilt, 0deg)); filter: brightness(1); }
}
@keyframes meteorTargetSweep {
  from { opacity: 0; transform: translateX(-42%); }
  35% { opacity: 1; }
  to { opacity: 0; transform: translateX(42%); }
}
@keyframes meteorImpactGlow {
  0% { filter: brightness(1); }
  42% { filter: brightness(1.42) saturate(1.22); }
  100% { filter: brightness(1); }
}
```

- [ ] **Step 4: 增加 reduced motion 降级**

在已有 `@media (prefers-reduced-motion: reduce)` 中加入：

```css
  .visual-battle .battle-fx-canvas {
    opacity: .32;
  }
  .battle-item-vfx-target,
  .battle-item-trigger {
    animation-duration: .001ms !important;
  }
```

- [ ] **Step 5: 确认 GREEN**

Run:

```bash
npx vitest run src/App.css.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/App.css src/App.css.test.ts
git commit -m "feat: style meteor battle vfx"
```

### Task 7: 验证、构建和交付检查

**Files:**
- Verify only.

- [ ] **Step 1: 运行聚焦测试**

Run:

```bash
npx vitest run src/feedback.test.ts src/App.structure.test.ts src/App.css.test.ts
```

Expected: PASS。

- [ ] **Step 2: 运行完整测试**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 3: 运行必需构建**

Run:

```bash
npm run build
```

Expected: PASS。输出应包含 TypeScript/Vite 构建成功，并且 `scripts/package-click-index.mjs` 没有报错。

- [ ] **Step 4: 确认单文件版本存在**

Run:

```powershell
Test-Path 'E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd'
```

Expected: `True`。

- [ ] **Step 5: 检查最终改动**

Run:

```bash
git status --short
git diff -- src/feedback.ts src/feedback.test.ts src/App.tsx src/App.structure.test.ts src/App.css src/App.css.test.ts
```

Expected: 只有本计划涉及的文件有改动。

- [ ] **Step 6: 提交实现**

```bash
git add src/feedback.ts src/feedback.test.ts src/App.tsx src/App.structure.test.ts src/App.css src/App.css.test.ts
git commit -m "feat: add meteor battle equipment vfx"
```

## 自审结果

- 规格覆盖：计划覆盖了装备源点、头像/血条/状态区目标、目标装备推导、流星光核、长拖尾、星屑、命中闪爆、reduced motion、测试和构建。
- 范围检查：计划不改战斗结算、不改装备数值、不改遗物数值、不处理商店/升级/出售/奖励反馈。
- 占位检查：计划中没有待补充步骤或未定义实现路径。
- 类型一致性：`FeedbackAnchor`、`PresentationEvent`、`BattleFxStage` props、`targetEquipmentItemsForBattleEvent()` 在各任务中命名一致。
