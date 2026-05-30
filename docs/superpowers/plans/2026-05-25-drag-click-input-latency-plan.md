# 拖拽与点击反馈延迟优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 恢复装备点击反馈和拖拽跟手性，避免 WebP 卡面图与复杂卡面效果阻塞高频交互。

**Architecture:** 将完整装备卡展示和拖拽预览拆开：静态卡片保留当前美术，拖拽层使用轻量 `DraggingItemGhost`。图片加载通过 `decoding="async"` 与 run 级别预解码降低首次点击成本，CSS 在拖拽和按压态禁用昂贵绘制。

**Tech Stack:** React 19、TypeScript、Vite、@dnd-kit/core、Vitest、CSS。

---

### Task 1: 拖拽预览结构测试

**Files:**
- Modify: `src/App.drag.test.ts`

- [ ] **Step 1: 写失败测试**

在 `starts item drags with a low movement threshold and shows immediate press feedback` 后新增测试：

```ts
it('uses a lightweight drag ghost without full card art content', () => {
  expect(app).toContain('function DraggingItemGhost')
  expect(app).toContain('<DraggingItemGhost item={draggingItem} />')
  const overlayStart = app.indexOf('function DraggingItemOverlay')
  const overlayEnd = app.indexOf('function FloatingTip')
  const overlaySource = app.slice(overlayStart, overlayEnd)
  expect(overlaySource).not.toContain('ItemCardContent')
  expect(overlaySource).not.toContain('ItemArt')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -- src/App.drag.test.ts`

Expected: FAIL，因为 `DraggingItemGhost` 还不存在，overlay 仍包含 `ItemCardContent`。

- [ ] **Step 3: 暂不实现，进入 Task 2 的样式测试**

该任务只建立结构约束，生产代码在 Task 4 实现。

### Task 2: 图片异步解码与预解码测试

**Files:**
- Modify: `src/App.structure.test.ts`

- [ ] **Step 1: 写失败测试**

在已有结构测试中新增：

```ts
it('decodes item card art asynchronously and prewarms visible run art', () => {
  expect(app).toContain('decoding="async"')
  expect(app).toContain('function prewarmItemArt')
  expect(app).toContain('const prewarmedItemArt = new Set<string>()')
  expect(app).toContain('image.decode?.()')
  expect(app).toContain('run.items.forEach')
  expect(app).toContain('run.shopItems.forEach')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -- src/App.structure.test.ts`

Expected: FAIL，因为当前 `ItemArt` 图片没有 `decoding="async"`，也没有预解码函数。

- [ ] **Step 3: 暂不实现，进入 Task 3 的 CSS 测试**

该任务只建立图片加载约束，生产代码在 Task 5 实现。

### Task 3: 高频交互态 CSS 测试

**Files:**
- Modify: `src/App.css.test.ts`

- [ ] **Step 1: 写失败测试**

新增测试：

```ts
it('keeps drag and press feedback on cheap composited styles', () => {
  expect(cssRule('.drag-overlay-item')).toContain('will-change: transform')
  expect(cssRule('.drag-overlay-item')).toContain('contain: paint')
  expect(cssRule('.drag-overlay-item::before, .drag-overlay-item::after')).toContain('display: none')
  expect(cssRule('.drag-overlay-ghost')).toContain('box-shadow')
  expect(cssRule('.drag-overlay-ghost .item-icon')).toContain('filter: none')
  expect(cssRule('.item-card.input-active, .item-card:active')).not.toContain('filter:')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -- src/App.css.test.ts`

Expected: FAIL，因为当前 `.drag-overlay-item` 没有 `will-change`/`contain`，按压态仍有 `filter`。

- [ ] **Step 3: 暂不实现，进入生产代码**

该任务只建立样式约束，生产 CSS 在 Task 4 和 Task 6 实现。

### Task 4: 实现轻量拖拽影子

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 替换 overlay 渲染**

将 `DraggingItemOverlay` 改为调用 `DraggingItemGhost`：

```tsx
function DraggingItemOverlay({ item }: { item: Item | null; relics?: Relic[] }) {
  if (!item) return null
  return <DraggingItemGhost item={item} />
}
```

- [ ] **Step 2: 新增 `DraggingItemGhost`**

在 `DraggingItemOverlay` 前新增：

```tsx
function DraggingItemGhost({ item }: { item: Item }) {
  const { language } = useLanguage()
  const localizedDef = localizeItemDef(item.def, language)
  const quality = normalizeQuality(item.quality)
  const qualityText = language === 'en-US' ? localizeQuality(quality, language) : qualityLabel[quality]
  return (
    <div
      className={`drag-overlay-item drag-overlay-ghost ${itemTone(item.def)} ${qualityClass(item.quality)}`}
      style={{ width: `calc(${item.def.width} * var(--slot-w))`, height: `calc(${item.def.height} * var(--board-slot-h))` }}
    >
      <span className="quality-chip">{qualityText}</span>
      <img className="item-icon" src={itemIcon(item.def)} alt="" decoding="async" />
      <strong>{localizedDef.name}</strong>
      <small>{item.def.size}{language === 'en-US' ? ' slots' : '格'}</small>
    </div>
  )
}
```

- [ ] **Step 3: 运行 Task 1 测试**

Run: `npm run test -- src/App.drag.test.ts`

Expected: PASS。

### Task 5: 实现装备图异步解码与预热

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 新增预热缓存与函数**

在 `itemIcon` 附近新增：

```ts
const prewarmedItemArt = new Set<string>()

function prewarmItemArt(src: string | null | undefined) {
  if (!src || prewarmedItemArt.has(src) || typeof Image === 'undefined') return
  prewarmedItemArt.add(src)
  const image = new Image()
  image.src = src
  void image.decode?.().catch(() => undefined)
}
```

- [ ] **Step 2: 在 App 中按 run 预热当前可见装备图**

在 `pushUiFeedback` 附近新增 effect：

```ts
useEffect(() => {
  if (!run) return
  run.items.forEach((item) => prewarmItemArt(itemVisualProfile(item.def).artSrc))
  run.shopItems.forEach((offer) => prewarmItemArt(itemVisualProfile(offer.def).artSrc))
}, [run])
```

- [ ] **Step 3: 为 `ItemArt` 自定义图添加异步解码**

将 `ItemArt` 内自定义图改为：

```tsx
{visual.artSrc ? <img className="item-card-art" src={visual.artSrc} alt="" decoding="async" /> : <span className="item-card-art-fallback" aria-hidden="true" />}
```

- [ ] **Step 4: 运行 Task 2 测试**

Run: `npm run test -- src/App.structure.test.ts`

Expected: PASS。

### Task 6: 实现高频交互态 CSS 降级

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: 移除按压态 filter**

将 `.item-card.input-active, .item-card:active` 调整为：

```css
.item-card.input-active,
.item-card:active {
  transform: translateY(1px) scale(.985);
  box-shadow: var(--pressed-sketch-shadow);
}
```

- [ ] **Step 2: 调整拖拽层样式**

将 `.drag-overlay-item` 调整并新增 ghost 规则：

```css
.drag-overlay-item {
  z-index: 1000;
  pointer-events: none;
  cursor: grabbing;
  transform: rotate(-1deg) scale(1.03);
  will-change: transform;
  contain: paint;
  box-shadow: 0 12px 26px rgba(37, 48, 71, .24), 2px 3px 0 rgba(61, 45, 37, .18);
}

.drag-overlay-item::before,
.drag-overlay-item::after {
  display: none;
}

.drag-overlay-ghost {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 6px;
  min-width: 0;
  padding: 8px;
  overflow: hidden;
  border: 3px solid var(--item-tone-ink);
  border-radius: 12px;
  background:
    radial-gradient(circle at 35% 24%, rgba(255, 255, 255, .72), transparent 24%),
    var(--item-tone-soft);
  color: var(--item-tone-ink);
  text-align: center;
}

.drag-overlay-ghost .item-icon {
  width: 34px;
  height: 34px;
  filter: none;
}

.drag-overlay-ghost strong,
.drag-overlay-ghost small {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 3: 运行 Task 3 测试**

Run: `npm run test -- src/App.css.test.ts`

Expected: PASS。

### Task 7: 集成验证与构建

**Files:**
- Verify: `src/App.drag.test.ts`
- Verify: `src/App.structure.test.ts`
- Verify: `src/App.css.test.ts`
- Build output: `dist-click/DogFight-standalone.cmd`

- [ ] **Step 1: 运行目标测试**

Run: `npm run test -- src/App.drag.test.ts src/App.structure.test.ts src/App.css.test.ts`

Expected: PASS，三个测试文件全部通过。

- [ ] **Step 2: 运行构建**

Run: `npm run build`

Expected: exit 0，并重新生成 `E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd`。

- [ ] **Step 3: 检查 diff**

Run: `git diff -- src/App.tsx src/App.css src/App.drag.test.ts src/App.structure.test.ts src/App.css.test.ts docs/superpowers/plans/2026-05-25-drag-click-input-latency-plan.md`

Expected: 只包含本计划相关改动；保留用户已有的骨骼血条 CSS 修复，不回退。

---

## 自检

- 规格覆盖：轻量拖拽影子、图片预解码、CSS 降级、测试和 build 均有任务。
- 范围控制：不改数值、不改服务端 API、不删除装备卡面图。
- 风险处理：保留静态美术，交互态降级；不覆盖已有未提交骨骼血条修复。
