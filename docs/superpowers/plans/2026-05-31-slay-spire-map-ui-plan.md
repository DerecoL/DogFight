# Slay Spire Map UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将探索地图改成杀戮尖塔式随机前进路线，并用全屏路线板重做地图 UI。

**Architecture:** 服务端 `src/server/game/map.ts` 负责生成稳定、可达、公平的路线图，公开节点横向坐标和入口节点。前端 `src/App.tsx` 负责把地图作为全屏路线板渲染，PC 横向推进，移动端用响应式布局压缩为纵向/滚动承载，节点详情从节点卡片中拆到详情栏。

**Tech Stack:** TypeScript, React, Vite, Vitest, CSS.

---

## File Structure

- Modify: `src/server/game/map.ts`
  - 增加随机层节点数、入口节点、节点 `x` 坐标、低交叉连线、公平玩家对战层。
- Modify: `src/server/game/map.test.ts`
  - 用失败测试约束 10 层、每层 2-4 节点、出边数量、只向前连线、入口可选、路径玩家对战数 4-5。
- Modify: `src/server/api.test.ts`
  - 更新新地图节点数量和初始可选数量断言，避免继续假设固定 36 节点。
- Modify: `src/App.tsx`
  - 更新 `ExplorationMapNode` 类型，重做 `ExplorationMapView` 的全屏路线板结构，支持选中节点详情栏。
- Modify: `src/App.css`
  - 重写 `.exploration-map-*` 与 `.map-node-*` 样式，移除表格感，强化可选/当前/完成状态。
- Modify: `src/App.css.test.ts`
  - 增加样式断言，防止地图回退到固定表格和大卡片节点。

## Task 1: Server Map Generation Tests

**Files:**
- Modify: `src/server/game/map.test.ts`

- [ ] **Step 1: Write failing tests for randomized forward-only fair routes**

Replace the first map generation test with a new `it` block named `creates a deterministic randomized twelve-layer map with forward-only fair routes`. The test body must include these assertions:

```ts
const first = createExplorationMapState('run-map-seed', 0, 0, 0)
const second = createExplorationMapState('run-map-seed', 0, 0, 0)

expect(first).toEqual(second)
expect(new Set(first.nodes.map((node) => node.layer))).toEqual(new Set(Array.from({ length: 10 }, (_, index) => index)))

for (let layer = 0; layer < 10; layer += 1) {
  const layerNodes = first.nodes.filter((node) => node.layer === layer)
  expect(layerNodes.length).toBeGreaterThanOrEqual(2)
  expect(layerNodes.length).toBeLessThanOrEqual(4)
  for (const node of layerNodes) {
    expect(typeof node.x).toBe('number')
    expect(node.x).toBeGreaterThanOrEqual(0)
    expect(node.x).toBeLessThanOrEqual(1)
  }
}

for (const node of first.nodes.filter((entry) => entry.layer < 9)) {
  expect(node.nextNodeIds.length).toBeGreaterThanOrEqual(1)
  expect(node.nextNodeIds.length).toBeLessThanOrEqual(2)
  for (const nextId of node.nextNodeIds) {
    const next = first.nodes.find((entry) => entry.id === nextId)
    expect(next?.layer).toBe(node.layer + 1)
  }
}

for (const node of first.nodes.filter((entry) => entry.layer === 9)) {
  expect(node.nextNodeIds).toEqual([])
}

const completePaths = enumerateMapPaths(first)
expect(completePaths.length).toBeGreaterThan(0)
for (const path of completePaths) {
  const playerBattles = path.filter((node) => node.kind === 'PLAYER_BATTLE').length
  expect(playerBattles).toBeGreaterThanOrEqual(4)
  expect(playerBattles).toBeLessThanOrEqual(5)
}
```

Add this helper in the test file:

```ts
function enumerateMapPaths(map: ReturnType<typeof createExplorationMapState>) {
  const byId = new Map(map.nodes.map((node) => [node.id, node]))
  const starts = map.nodes.filter((node) => node.layer === 0)
  const paths: typeof starts[] = []
  const visit = (path: typeof starts) => {
    const tail = path[path.length - 1]
    if (!tail) return
    if (tail.layer === 9) {
      paths.push(path)
      return
    }
    for (const nextId of tail.nextNodeIds) {
      const next = byId.get(nextId)
      if (next) visit([...path, next])
    }
  }
  for (const start of starts) visit([start])
  return paths
}
```

- [ ] **Step 2: Update reachability test expectations**

Keep the existing reachability behavior, but rename the test to:

```ts
it('allows only entrance nodes first, then only nodes linked from the completed node', () => {
```

Use:

```ts
const entranceIds = map.nodes.filter((node) => node.layer === 0).map((node) => node.id)
expect(explorationMapPublicState(map).availableNodeIds).toEqual(entranceIds)

const completed = applyMapNodeCompletion({ ...map, currentNodeId: entranceIds[0] })
expect(explorationMapPublicState(completed).availableNodeIds).toEqual(currentMapNode(map, entranceIds[0])?.nextNodeIds)
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
npx vitest run src/server/game/map.test.ts
```

Expected: FAIL because current map still creates fixed 36 nodes without `x` and paths can have fixed player battle distribution assumptions.

## Task 2: Server Map Generation Implementation

**Files:**
- Modify: `src/server/game/map.ts`

- [ ] **Step 1: Extend node type**

Update `ExplorationMapNode`:

```ts
export type ExplorationMapNode = {
  id: string
  layer: number
  column: number
  x?: number
  kind: ExplorationMapNodeKind
  nextNodeIds: string[]
  shopType?: ShopType
  monster?: ExplorationMapMonster
  event?: { type: ExplorationEventType; title: string; description: string }
}
```

- [ ] **Step 2: Replace fixed three-column generation**

Implement `createExplorationMapState()` so it:

```ts
const playerBattleLayers = playerBattleLayerSet(seed)
for (let layer = 0; layer < MAP_LAYER_COUNT; layer += 1) {
  const layerRng = createRng(`${seed}-layer-${layer}`)
  const count = layer === 0 ? 2 + Math.floor(layerRng() * 2) : 2 + Math.floor(layerRng() * 3)
  for (let column = 0; column < count; column += 1) {
    const id = mapNodeId(mapIndex, layer, column)
    const x = layerNodeX(column, count, createRng(`${seed}-x-${layer}-${column}`))
    const kind = playerBattleLayers.has(layer) ? 'PLAYER_BATTLE' : layerNodeKind(layer, column, count, seed)
    nodes.push(createMapNode({ id, layer, column, x, kind, seed, mapIndex, wins, losses }))
  }
}
return {
  version: 1,
  mapIndex,
  currentNodeId: null,
  completedNodeIds: [],
  nodes: connectMapLayers(nodes, mapIndex),
}
```

- [ ] **Step 3: Add helper functions**

Add helpers near existing map helpers:

```ts
function playerBattleLayerSet(seed: string) {
  const rng = createRng(`${seed}-player-battle-layers`)
  const candidates = [1, 3, 5, 7, 9, 11]
  const count = rng() < 0.5 ? 5 : 6
  const shuffled = [...candidates].sort(() => rng() - 0.5)
  return new Set(shuffled.slice(0, count).sort((a, b) => a - b))
}

function layerNodeX(column: number, count: number, rng: () => number) {
  if (count <= 1) return 0.5
  const margin = 0.12
  const span = 1 - margin * 2
  const base = margin + (span * column) / (count - 1)
  const jitter = (rng() - 0.5) * 0.08
  return Math.max(0.08, Math.min(0.92, base + jitter))
}

function layerNodeKind(layer: number, column: number, count: number, seed: string): ExplorationMapNodeKind {
  const rng = createRng(`${seed}-kind-${layer}-${column}-${count}`)
  const pattern = layerNodeKinds(layer)
  const base = pattern[column % pattern.length]
  if (base === 'PLAYER_BATTLE') return rng() < 0.55 ? 'MONSTER_BATTLE' : 'EVENT'
  return base
}
```

- [ ] **Step 4: Add forward-only connection helper**

Add:

```ts
function connectMapLayers(nodes: ExplorationMapNode[], mapIndex: number) {
  const byLayer = Array.from({ length: MAP_LAYER_COUNT }, (_, layer) =>
    nodes.filter((node) => node.layer === layer).sort((a, b) => (a.x ?? 0.5) - (b.x ?? 0.5)),
  )
  return nodes.map((node) => {
    if (node.layer >= MAP_LAYER_COUNT - 1) return { ...node, nextNodeIds: [] }
    const nextLayer = byLayer[node.layer + 1]
    const nearest = [...nextLayer]
      .sort((a, b) => Math.abs((a.x ?? 0.5) - (node.x ?? 0.5)) - Math.abs((b.x ?? 0.5) - (node.x ?? 0.5)))
      .slice(0, node.column % 2 === 0 && nextLayer.length > 1 ? 2 : 1)
      .map((next) => next.id)
    if (nearest.length > 0) return { ...node, nextNodeIds: nearest }
    return { ...node, nextNodeIds: [mapNodeId(mapIndex, node.layer + 1, 0)] }
  })
}
```

- [ ] **Step 5: Run map tests**

Run:

```bash
npx vitest run src/server/game/map.test.ts
```

Expected: PASS.

## Task 3: API Test Updates

**Files:**
- Modify: `src/server/api.test.ts`

- [ ] **Step 1: Update fixed node count assertions**

Change assertions that expect exactly 36 nodes or exactly 3 available nodes:

```ts
expect(run.mapState.nodes.length).toBeGreaterThanOrEqual(24)
expect(run.mapState.nodes.length).toBeLessThanOrEqual(48)
expect(run.mapState.availableNodeIds.length).toBeGreaterThanOrEqual(2)
expect(run.mapState.availableNodeIds.length).toBeLessThanOrEqual(3)
```

- [ ] **Step 2: Run API tests**

Run:

```bash
npx vitest run src/server/api.test.ts --maxConcurrency=1
```

Expected: PASS.

## Task 4: Frontend Static Tests

**Files:**
- Modify: `src/App.css.test.ts`

- [ ] **Step 1: Add CSS regression test**

Add a test near existing CSS tests:

```ts
it('renders exploration map as a full-screen route board with compact nodes and separate details', () => {
  expect(css).toContain('.exploration-map-overlay')
  expect(css).toContain('.exploration-map-shell')
  expect(css).toContain('.map-route-canvas')
  expect(css).toContain('.map-node-detail-panel')
  expect(css).toContain('.map-node.compact-route-node')
  expect(css).toContain('@media (max-width: 760px)')
})
```

- [ ] **Step 2: Add source layout regression test**

If `App.css.test.ts` already reads `src/App.tsx` as `app`, add:

```ts
it('uses map node coordinates instead of only fixed three-column positions', () => {
  expect(app).toContain("node.x")
  expect(app).toContain("orientation")
  expect(app).toContain("map-node-detail-panel")
})
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npx vitest run src/App.css.test.ts
```

Expected: FAIL because the new classes and layout do not exist yet.

## Task 5: Frontend Route Board Implementation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Extend frontend node type**

Update frontend `ExplorationMapNode`:

```ts
type ExplorationMapNode = {
  id: string
  layer: number
  column: number
  x?: number
  kind: ExplorationMapNodeKind
  nextNodeIds: string[]
  shopType?: ShopType
  monster?: ExplorationMapMonster
  event?: { type: ExplorationEventType; title: string; description: string }
}
```

- [ ] **Step 2: Add selected node state**

Inside `ExplorationMapView`, add:

```ts
const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
const highlightedNode = selectedNodeId
  ? map.nodes.find((node) => node.id === selectedNodeId) ?? currentNode
  : currentNode ?? map.nodes.find((node) => available.has(node.id)) ?? map.nodes[0] ?? null
const orientation = 'horizontal'
```

- [ ] **Step 3: Replace board wrapper structure**

Change the map board area to:

```tsx
<div className="exploration-map-overlay">
  <div className="exploration-map-shell">
    <div className="exploration-map-topbar">
      <div>
        <h2>探索地图</h2>
        <p>第 {map.mapIndex + 1} 张地图 · 第 {Math.min(mapLayerCount, currentLayer + 1)} / {mapLayerCount} 层</p>
      </div>
      <div className="map-run-stats">
        <ResourcePill icon={<Trophy size={16} />} label="胜场" value={`${run.wins}/12`} tone="gold" />
        <ResourcePill icon={<Heart size={16} />} label="容错" value={`${Math.max(0, 5 - run.losses)}/5`} tone="pink" />
        <ResourcePill icon={<Coins size={16} />} label="金币" value={run.gold} tone="gold" />
      </div>
    </div>
    <div className="exploration-map-route-board">
      <div className="map-route-canvas" data-orientation={orientation}>
        <div className="map-route-layer" aria-hidden="true">
          {map.nodes.flatMap((node) => node.nextNodeIds.map((nextId) => {
            const next = map.nodes.find((entry) => entry.id === nextId)
            if (!next) return null
            const start = mapNodePosition(node, orientation)
            const end = mapNodePosition(next, orientation)
            const dx = end.x - start.x
            const dy = end.y - start.y
            const length = Math.sqrt(dx * dx + dy * dy)
            const angle = Math.atan2(dy, dx) * 180 / Math.PI
            const active = completed.has(node.id) && available.has(next.id)
            const done = completed.has(node.id) && completed.has(next.id)
            return (
              <span
                key={`${node.id}:${next.id}`}
                className={`map-route-line ${active ? 'available' : ''} ${done ? 'completed' : ''}`}
                style={{ '--x1': start.x, '--y1': start.y, '--line-length': length, '--line-angle': `${angle}deg` } as React.CSSProperties}
              />
            )
          }))}
        </div>
        {map.nodes.map((node) => (
          <MapNodeButton
            key={node.id}
            node={node}
            completed={completed.has(node.id)}
            available={available.has(node.id)}
            current={map.currentNodeId === node.id}
            selected={highlightedNode?.id === node.id}
            orientation={orientation}
            onInspect={setSelectedNodeId}
            onSelect={onSelectNode}
          />
        ))}
      </div>
      <aside className="map-node-detail-panel">
        {highlightedNode ? (
          <MapNodeDetail node={highlightedNode} current={map.currentNodeId === highlightedNode.id} available={available.has(highlightedNode.id)} onSelect={onSelectNode} />
        ) : null}
      </aside>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Update position helper**

Replace `mapNodePosition()`:

```ts
function mapNodePosition(node: Pick<ExplorationMapNode, 'layer' | 'column' | 'x'>, orientation: 'horizontal' | 'vertical' = 'horizontal') {
  const lane = typeof node.x === 'number' ? node.x : ([0.18, 0.5, 0.82][node.column] ?? 0.5)
  const progress = 0.06 + node.layer * (0.88 / Math.max(1, layerCount - 1))
  if (orientation === 'vertical') {
    return { x: Math.max(8, Math.min(92, lane * 100)), y: progress * 100 }
  }
  return { x: progress * 100, y: Math.max(10, Math.min(90, lane * 100)) }
}
```

- [ ] **Step 5: Update node button props**

Use:

```tsx
function MapNodeButton({ node, completed, available, current, selected, orientation, onInspect, onSelect }: {
  node: ExplorationMapNode
  completed: boolean
  available: boolean
  current: boolean
  selected: boolean
  orientation: 'horizontal' | 'vertical'
  onInspect: (nodeId: string) => void
  onSelect: (nodeId: string) => void
}) {
  const position = mapNodePosition(node, orientation)
  const locked = !available && !completed && !current
  return (
    <button
      className={`map-node compact-route-node ${node.kind.toLowerCase().replaceAll('_', '-')} ${available ? 'available' : ''} ${completed ? 'completed' : ''} ${current ? 'current' : ''} ${selected ? 'selected' : ''} ${locked ? 'locked' : ''}`}
      style={{ '--node-x': position.x, '--node-y': position.y } as React.CSSProperties}
      disabled={!available}
      onMouseEnter={() => onInspect(node.id)}
      onFocus={() => onInspect(node.id)}
      onClick={() => available ? onSelect(node.id) : onInspect(node.id)}
      aria-label={mapNodeTitle(node)}
    >
      <MapNodeSticker kind={node.kind} />
      <span className="map-node-title">{mapNodeTitle(node)}</span>
    </button>
  )
}
```

- [ ] **Step 6: Replace CSS map section**

Rewrite the existing `.exploration-map-screen` through map media query block so it defines:

```css
.exploration-map-overlay {
  position: fixed;
  inset: 0;
  z-index: 35;
  padding: 18px;
  background: rgba(42, 31, 24, .42);
}

.exploration-map-shell {
  width: min(1440px, 100%);
  height: min(900px, calc(100vh - 36px));
  margin: 0 auto;
  display: grid;
  grid-template-rows: auto 1fr;
  border-radius: 14px;
}

.exploration-map-topbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.exploration-map-route-board {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
}

.map-route-canvas {
  position: relative;
  min-height: 520px;
  overflow: hidden;
}

.map-node-detail-panel {
  min-width: 0;
  align-self: stretch;
}

.map-node.compact-route-node {
  width: 86px;
  min-height: 84px;
}

.map-node.compact-route-node.available {
  border-color: rgba(86, 126, 239, .86);
}

.map-node.compact-route-node.current {
  outline: 4px solid rgba(255, 216, 107, .66);
}

.map-node.compact-route-node.completed {
  border-color: rgba(72, 150, 82, .72);
}

.map-node.compact-route-node.locked {
  opacity: .42;
}
```

The CSS must remove fixed large card assumptions: no `width: 136px` long text cards, no manuscript grid overpowering the route board, no long preview inside nodes.

- [ ] **Step 7: Run frontend static tests**

Run:

```bash
npx vitest run src/App.css.test.ts
```

Expected: PASS.

## Task 6: Full Verification

**Files:**
- No source edits unless verification fails and root cause is identified.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx vitest run src/server/game/map.test.ts src/App.css.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full build**

Run:

```bash
npm run build
```

Expected: PASS and regenerated `E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd`.

- [ ] **Step 3: Browser visual check**

Start or reuse the local dev server, open the app, enter a run map, and verify:

- route board is no longer a dense table;
- PC route direction is left to right;
- node detail is in the side panel;
- available next steps are clearly highlighted;
- locked nodes do not visually dominate;
- no obvious text overlap or layout jump.

## Task 7: Delivery

**Files:**
- All modified files from previous tasks.

- [ ] **Step 1: Check git status**

Run:

```bash
git status --short --branch
```

Expected: only intentional files changed.

- [ ] **Step 2: Commit**

Run:

```bash
git add src/server/game/map.ts src/server/game/map.test.ts src/server/api.test.ts src/App.tsx src/App.css src/App.css.test.ts docs/superpowers/specs/2026-05-31-slay-spire-map-ui-design.md docs/superpowers/plans/2026-05-31-slay-spire-map-ui-plan.md
git commit -m "feat: rework exploration map routes"
```

- [ ] **Step 3: Push and deploy**

Because project instructions require default delivery to main and remote deployment unless the user opts out, run the repository's existing deploy/upload workflow after confirming the current branch is `main`, then push:

```bash
git push origin main
```

Use the existing project deploy scripts or documented upload commands found in `package.json`, `deploy/`, or repository docs.
