# 狗殴对战村庄底图实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用用户提供的图 2 作为全局底图，让主界面整体接近参考图 1 的明亮童话村庄视觉，同时保证 UI 文本、按钮和卡片可读。

**Architecture:** 将背景图作为静态前端资源放入 `public/assets/backgrounds/`。通过 `.app-shell` 负责整页背景和浅色遮罩，现有 `.topbar`、卡片和玩法面板继续保留纸质半透明表面。

**Tech Stack:** React、Vite、CSS、Vitest、静态 public 资产。

---

### Task 1: 全局村庄背景资产与 CSS 约束

**Files:**
- Create: `public/assets/backgrounds/dog-brawl-town.png`
- Modify: `src/App.css`
- Test: `src/App.css.test.ts`

- [ ] **Step 1: Write the failing test**

在 `src/App.css.test.ts` 的视觉主题测试附近新增断言：

```ts
  it('uses the dog brawl town illustration as the readable full-page background', () => {
    expect(existsSync(new URL('../public/assets/backgrounds/dog-brawl-town.png', import.meta.url))).toBe(true)
    expect(css).toContain('/assets/backgrounds/dog-brawl-town.png')
    expect(cssRule(':root')).toContain('--app-illustration-bg')
    expect(cssRule('.app-shell')).toContain('var(--app-illustration-bg)')
    expect(cssRule('.app-shell')).toContain('background-size: cover')
    expect(cssRule('.app-shell')).toContain('background-position: center')
    expect(cssRule('.app-shell::before')).toContain('background')
    expect(cssRule('.app-shell::before')).toContain('rgba(255, 250, 241, .34)')
    expect(cssRule('.app-shell > *')).toContain('z-index: 1')
    expect(cssRule('.topbar')).toContain('rgba(255, 250, 241, .78)')
    expect(cssRule('.screen-content')).toContain('position: relative')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/App.css.test.ts
```

Expected: FAIL，因为 `dog-brawl-town.png`、`--app-illustration-bg` 和 `.app-shell::before` 尚未存在。

- [ ] **Step 3: Add the asset**

复制用户提供的图 2：

```powershell
Copy-Item -LiteralPath 'C:\Users\admin\Downloads\Gemini_Generated_Image_fzbv7yfzbv7yfzbv.png' -Destination 'D:\AI\DogFight\public\assets\backgrounds\dog-brawl-town.png' -Force
```

- [ ] **Step 4: Write minimal CSS implementation**

在 `:root` 中加入：

```css
  --app-illustration-bg: url("/assets/backgrounds/dog-brawl-town.png");
```

更新截图驱动皮肤段落中的 `.app-shell`：

```css
.app-shell {
  position: relative;
  padding: 0 24px 20px;
  display: grid;
  grid-template-rows: auto auto;
  align-content: start;
  gap: 0;
  background:
    linear-gradient(180deg, rgba(255, 250, 241, .34), rgba(255, 244, 228, .18)),
    var(--app-illustration-bg);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
}

.app-shell::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(ellipse at 50% 18%, rgba(255, 250, 241, .34), transparent 42%),
    linear-gradient(180deg, rgba(255, 250, 241, .22), rgba(255, 244, 228, .08));
  pointer-events: none;
}

.app-shell > * {
  position: relative;
  z-index: 1;
}
```

将 `.topbar` 背景中的纸张透明度调到更贴近参考图：

```css
background: var(--hud-paper), rgba(255, 250, 241, .78);
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
npm test -- src/App.css.test.ts
```

Expected: PASS。

- [ ] **Step 6: Run required build**

Run:

```bash
npm run build
```

Expected: exit 0，并重新生成 `D:\AI\DogFight\dist-click\DogFight-standalone.cmd`。
