# Shop Paper Edge Quality Glow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把商店装备卡片从粗品质色边框改成“小纸条”：深咖色细纸边负责轮廓，品质色用更明显但柔和的边缘光效表达。

**Architecture:** 这是纯前端 CSS 调整。先用 `src/App.css.test.ts` 固化结构要求，再修改 `src/App.css` 中 `.paper-shop-card`、商店品质类和悬浮/选中状态，让纸边和品质光效都跟随现有 `clip-path` 纸条边缘。

**Tech Stack:** React 19、Vite、TypeScript、Vitest、CSS `clip-path`、`box-shadow`、`filter: drop-shadow()`。

---

## 文件结构

- 修改：`src/App.css.test.ts`
  - 负责验证商店纸条不再使用粗品质色 `border`，并存在深咖色纸边、品质柔光变量、跟随纸边的光效实现。
- 修改：`src/App.css`
  - 负责实际视觉样式：纸条本体、深咖色边缘、品质柔光、悬浮/选中/已拥有/不可购买状态。
- 不修改：`src/App.tsx`
  - 当前 DOM 结构已有 `.paper-shop-card`、`.quality-*`、`.shop-card-owned`、`.shop-card-unaffordable`，无需改 JSX。
- 不修改：`C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx`
  - 本次不涉及装备数值、战斗参数、经济价格或平衡模型。

## Task 1: 先写商店纸条样式失败测试

**Files:**
- Modify: `src/App.css.test.ts`
- Test: `src/App.css.test.ts`

- [ ] **Step 1: 替换商店纸边测试**

在 `src/App.css.test.ts` 中，将现有测试 `it('keeps shop paper edges visibly stroked while preserving paper shadows', ...)` 和 `it('uses item quality colors for shop card paper strokes', ...)` 替换为下面两个测试：

```ts
  it('keeps shop cards as brown-edged paper notes instead of thick quality frames', () => {
    expect(cssRule('.paper-shop-card')).toContain('--shop-paper-edge-ink: rgba(61, 45, 37, .58)')
    expect(cssRule('.paper-shop-card')).toContain('--shop-paper-edge-width: 1.25px')
    expect(cssRule('.paper-shop-card')).toContain('--shop-quality-glow')
    expect(cssRule('.paper-shop-card')).toContain('border: 0')
    expect(cssRule('.paper-shop-card')).toContain('filter: var(--shop-paper-filter)')
    expect(cssRule('.paper-shop-card::before')).toContain('inset: 0')
    expect(cssRule('.paper-shop-card::before')).toContain('box-shadow: inset 0 0 0 var(--shop-paper-edge-width) var(--shop-paper-edge-ink)')
    expect(cssRule('.paper-shop-card::before')).toContain('clip-path: inherit')
    expect(cssRule('.paper-shop-card::after')).toContain('clip-path: inherit')
    expect(css).not.toMatch(/\.paper-shop-card\.quality-bronze,\s*\.paper-shop-card\.quality-silver,\s*\.paper-shop-card\.quality-gold,\s*\.paper-shop-card\.quality-diamond\s*\{[^}]*border:/s)
  })

  it('uses stronger quality glow on shop paper edges without replacing the brown edge', () => {
    expect(cssRule('.paper-shop-card.quality-bronze')).toContain('--shop-quality-glow: rgba(190, 111, 50, .46)')
    expect(cssRule('.paper-shop-card.quality-silver')).toContain('--shop-quality-glow: rgba(207, 224, 236, .56)')
    expect(cssRule('.paper-shop-card.quality-gold')).toContain('--shop-quality-glow: rgba(255, 207, 66, .7)')
    expect(cssRule('.paper-shop-card.quality-diamond')).toContain('--shop-quality-glow: rgba(102, 231, 255, .78)')
    expect(cssRule('.paper-shop-card.quality-gold')).not.toContain('border-width: 5px')
    expect(cssRule('.paper-shop-card.quality-diamond')).not.toContain('border-width: 5px')
    expect(cssRule('.paper-shop-card:hover')).toContain('filter: var(--shop-paper-filter-hover)')
    expect(cssRule('.paper-shop-card.shop-card-unaffordable')).toContain('filter: grayscale(.82) brightness(.68) saturate(.55) drop-shadow')
    expect(cssRule('.paper-shop-card.shop-card-unaffordable:hover')).toContain('filter: grayscale(.82) brightness(.68) saturate(.55) drop-shadow')
  })
```

- [ ] **Step 2: 运行测试，确认失败**

Run:

```bash
npx vitest run src/App.css.test.ts
```

Expected: `FAIL`，失败原因应指向 `.paper-shop-card` 仍包含 `--shop-quality-frame-width` 或 `border: var(--shop-quality-frame-width) solid var(--shop-quality-frame-ink)`，并且缺少 `--shop-paper-edge-ink`、`--shop-quality-glow`、`filter: var(--shop-paper-filter)`。

## Task 2: 实现商店纸条深咖色细边与品质柔光

**Files:**
- Modify: `src/App.css`
- Test: `src/App.css.test.ts`

- [ ] **Step 1: 修改 `.paper-shop-card` 基础样式**

在 `src/App.css` 中找到 `.paper-shop-card`，把粗品质边框变量和 `border` 替换成纸边与光效变量。目标代码如下：

```css
.paper-shop-card {
  --shop-paper-edge-width: 1.25px;
  --shop-paper-edge-ink: rgba(61, 45, 37, .58);
  --shop-quality-glow: rgba(190, 111, 50, .46);
  --shop-quality-glow-strong: color-mix(in srgb, var(--shop-quality-glow) 72%, transparent);
  --shop-paper-filter:
    drop-shadow(0 0 9px var(--shop-quality-glow))
    drop-shadow(0 0 18px var(--shop-quality-glow-strong));
  --shop-paper-filter-hover:
    drop-shadow(0 0 12px var(--shop-quality-glow))
    drop-shadow(0 0 24px var(--shop-quality-glow-strong));
  --shop-paper-tone:
    var(--paper-grain),
    radial-gradient(circle at 16% 18%, rgba(255, 255, 255, .55), transparent 24%),
    linear-gradient(180deg, #fffdf4, #f3dfbd);
  --shop-paper-shadow: var(--paper-edge-stroke), 0 12px 22px rgba(112, 72, 30, .16), 2px 4px 0 rgba(61, 45, 37, .12);
  transform-origin: 50% 65%;
  transform: translateY(var(--shop-paper-y, 0)) rotate(var(--paper-tilt));
  border: 0;
  border-radius: var(--shop-paper-radius, 10px 13px 9px 12px);
  background: var(--shop-paper-tone);
  box-shadow: var(--shop-paper-shadow);
  filter: var(--shop-paper-filter);
  clip-path: var(--shop-paper-cut, polygon(1% 2%, 28% 0, 58% 1.4%, 98% 0, 100% 78%, 98% 99%, 61% 98%, 31% 100%, 0 98%, 1.2% 54%));
}
```

- [ ] **Step 2: 替换商店品质类**

把 `.paper-shop-card.quality-*` 改为只设置品质柔光，不再设置 `--shop-quality-frame-width` 或 `--shop-quality-frame-ink`：

```css
.paper-shop-card.quality-bronze {
  --shop-quality-glow: rgba(190, 111, 50, .46);
}

.paper-shop-card.quality-silver {
  --shop-quality-glow: rgba(207, 224, 236, .56);
}

.paper-shop-card.quality-gold {
  --shop-quality-glow: rgba(255, 207, 66, .7);
}

.paper-shop-card.quality-diamond {
  --shop-quality-glow: rgba(102, 231, 255, .78);
}
```

删除这个旧规则：

```css
.paper-shop-card.quality-bronze,
.paper-shop-card.quality-silver,
.paper-shop-card.quality-gold,
.paper-shop-card.quality-diamond {
  border: var(--shop-quality-frame-width) solid var(--shop-quality-frame-ink);
  box-shadow: var(--shop-paper-shadow);
}
```

- [ ] **Step 3: 修改伪元素纸边**

把 `.paper-shop-card::before` 调整为跟随纸条切边的深咖色细线和纸面高光：

```css
.paper-shop-card::before {
  inset: 0;
  border: 0;
  background:
    linear-gradient(100deg, rgba(255, 255, 255, .24), transparent 36%, rgba(112, 72, 30, .07)),
    var(--paper-fiber);
  box-shadow:
    inset 0 0 0 var(--shop-paper-edge-width) var(--shop-paper-edge-ink),
    inset 0 2px 0 rgba(255, 255, 255, .64),
    inset 0 -4px 0 rgba(112, 72, 30, .10);
  opacity: .9;
  clip-path: inherit;
  transform: none;
}
```

保留 `.paper-shop-card::after` 的纸纹，但确认它仍包含：

```css
clip-path: inherit;
```

- [ ] **Step 4: 调整悬浮、已拥有、不可购买状态**

更新这些规则，保证光效可见且不会覆盖纸边：

```css
.paper-shop-card:hover {
  transform: translateY(calc(var(--shop-paper-y, 0px) - 2px)) rotate(var(--paper-tilt));
  box-shadow: var(--paper-edge-stroke), 0 16px 30px rgba(112, 72, 30, .18), 3px 5px 0 rgba(61, 45, 37, .14);
  filter: var(--shop-paper-filter-hover);
}

.paper-shop-card.shop-card-owned {
  --shop-paper-edge-ink: rgba(31, 92, 64, .64);
  box-shadow:
    var(--paper-edge-stroke),
    inset 0 -22px 0 rgba(34, 168, 111, .10),
    0 0 0 4px rgba(34, 168, 111, .14),
    2px 4px 0 rgba(61, 45, 37, .12);
}

.paper-shop-card.shop-card-unaffordable {
  filter: grayscale(.82) brightness(.68) saturate(.55) drop-shadow(0 0 7px rgba(61, 45, 37, .18));
}

.paper-shop-card.shop-card-unaffordable:hover {
  transform: translateY(var(--shop-paper-y, 0)) rotate(var(--paper-tilt));
  box-shadow: var(--shop-paper-shadow);
  filter: grayscale(.82) brightness(.68) saturate(.55) drop-shadow(0 0 7px rgba(61, 45, 37, .18));
}
```

保留全局 `.shop-card-owned` 的 `outline`，但如果 `.shop-card.shop-card-owned` 旧规则仍把 `border-color` 当主表达，应在实现时让 `.paper-shop-card.shop-card-owned` 位于其后覆盖它。

- [ ] **Step 5: 运行测试，确认通过**

Run:

```bash
npx vitest run src/App.css.test.ts
```

Expected: `PASS`，并且没有新的警告。

## Task 3: 同步检查装备卡片品质粗边框残留

**Files:**
- Modify: `src/App.css.test.ts`
- Modify: `src/App.css`
- Test: `src/App.css.test.ts`

- [ ] **Step 1: 增加通用装备卡片的保护性断言**

在 `it('enhances item quality borders with frame-only material and shimmer effects', ...)` 内补充这些断言：

```ts
    expect(cssRule('.item-card.quality-gold')).toContain('--quality-frame-width: 3px')
    expect(cssRule('.item-card.quality-diamond')).toContain('--quality-frame-width: 3px')
    expect(css).not.toMatch(/\.item-card\.quality-gold,\s*\.shop-card\.quality-gold,\s*\.tip-tag\.quality-gold\s*\{[^}]*border-width:\s*5px/s)
    expect(css).not.toMatch(/\.item-card\.quality-diamond,\s*\.shop-card\.quality-diamond,\s*\.tip-tag\.quality-diamond\s*\{[^}]*border-width:\s*5px/s)
```

- [ ] **Step 2: 运行测试，确认失败**

Run:

```bash
npx vitest run src/App.css.test.ts
```

Expected: `FAIL`，失败原因应指向 `.item-card.quality-gold` 和 `.item-card.quality-diamond` 仍使用 `--quality-frame-width: 5px` 或组合品质规则仍有 `border-width: 5px`。

- [ ] **Step 3: 降低通用装备品质框厚度**

在 `src/App.css` 中修改 `.item-card.quality-gold` 和 `.item-card.quality-diamond`：

```css
.item-card.quality-gold {
  --quality-frame-width: 3px;
  --quality-frame-ink: #8a5a16;
  --quality-frame-material:
    linear-gradient(132deg, rgba(61, 45, 37, .74), rgba(255, 240, 168, .64) 48%, rgba(97, 62, 8, .62));
  --quality-frame-shadow:
    inset 0 -22px 0 rgba(61, 45, 37, .08),
    0 0 18px rgba(255, 213, 74, .56),
    2px 3px 0 rgba(61, 45, 37, .22);
  --quality-shimmer-opacity: .56;
  --quality-shimmer-color: rgba(255, 255, 218, .9);
}

.item-card.quality-diamond {
  --quality-frame-width: 3px;
  --quality-frame-ink: #286f82;
  --quality-frame-material:
    linear-gradient(132deg, rgba(61, 45, 37, .72), rgba(232, 253, 255, .72) 48%, rgba(74, 120, 210, .62));
  --quality-frame-shadow:
    inset 0 -22px 0 rgba(61, 45, 37, .08),
    0 0 18px rgba(102, 231, 255, .72),
    0 0 34px rgba(122, 140, 255, .35),
    2px 3px 0 rgba(61, 45, 37, .22);
  --quality-shimmer-opacity: .66;
  --quality-shimmer-color: rgba(238, 255, 255, .94);
}
```

同时把组合规则中的 `.shop-card.quality-gold` 和 `.shop-card.quality-diamond` 从粗 `border-width: 5px` 表达中拆出；商店卡片由 Task 2 的 `.paper-shop-card.quality-*` 接管，`tip-tag` 可保留清晰品质标签边框。

- [ ] **Step 4: 运行 CSS 测试**

Run:

```bash
npx vitest run src/App.css.test.ts
```

Expected: `PASS`。

## Task 4: 构建与视觉验证

**Files:**
- Modify: `dist-click/DogFight-standalone.cmd`
- Modify: `dist-click/index.html`

- [ ] **Step 1: 运行完整构建**

Run:

```bash
npm run build
```

Expected: `tsc -b`、`vite build` 和 `tsx scripts/package-click-index.mjs` 全部成功；`dist-click\DogFight-standalone.cmd` 被同步生成。

- [ ] **Step 2: 启动本地预览**

Run:

```bash
npm run dev
```

Expected: Vite 客户端和 Fastify 服务启动成功。若默认端口被占用，使用输出中的实际端口。

- [ ] **Step 3: 用浏览器检查商店卡片**

打开本地游戏，进入任意商店。检查：

- 商店卡片外形仍是轻微不规则纸条。
- 深咖色细边能从背景中分辨，不融入背景。
- 品质色只表现为纸条边缘外侧柔光，黄金和钻石明显强于 B 视觉稿，但不是粗色框。
- 悬浮、选中、已拥有、不可购买状态没有把纸边盖掉。

- [ ] **Step 4: 记录验证结果并提交**

Run:

```bash
git status --short
git add src/App.css src/App.css.test.ts dist-click/index.html dist-click/DogFight-standalone.cmd
git commit -m "Refine shop cards as glowing paper notes"
```

Expected: commit 成功；最终回复说明已运行 `npm run build`。因为本次不涉及数值，最终回复明确说明没有更新 `C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx`。

## 自检

- 规格目标均覆盖：Task 2 处理商店纸条、咖色细边、品质柔光；Task 3 检查通用品质粗边残留；Task 4 覆盖构建与视觉验证。
- 无占位语或未定实现内容。
- 计划中的类名均来自现有 `src/App.css` 和 `src/App.tsx`：`.paper-shop-card`、`.shop-card`、`.quality-*`、`.shop-card-owned`、`.shop-card-unaffordable`。
- 本计划不修改数值数据，因此不更新外部 Excel。
