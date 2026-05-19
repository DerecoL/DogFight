# Background Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为游戏接入用户提供的循环背景音乐，并在顶部栏提供默认开启的音乐开关。

**Architecture:** 背景音乐只属于已登录后的 `Shell` 游戏壳层，不在登录页播放。`App` 持有音乐偏好、音频引用和播放控制逻辑，`Shell` 与 `TopBar` 只负责接收状态和渲染按钮。音频文件作为 Vite 公共静态资源放入 `public/assets/audio`。

**Tech Stack:** React 19、Vite、TypeScript、Vitest、lucide-react、浏览器 `HTMLAudioElement` 与 `localStorage`。

---

## 文件结构

- 新建：`public/assets/audio/the-final-inventory.mp3`
  - 存放用户提供的背景音乐资源。
- 修改：`src/App.structure.test.ts`
  - 添加结构测试，先验证音乐资源路径、按钮渲染、偏好保存和播放失败捕获行为。
- 修改：`src/App.tsx`
  - 引入 `Music` 和 `VolumeX` 图标。
  - 新增 `backgroundMusicSrc` 和 `musicPreferenceKey` 常量。
  - 在 `App` 中新增 `musicEnabled`、`musicBlocked`、`audioRef` 和播放/暂停逻辑。
  - 扩展 `Shell`、`TopBar` props，渲染音乐按钮。
- 修改：`src/App.css`
  - 为顶部栏右侧按钮组增加稳定布局，避免音乐按钮和退出按钮破坏顶部栏排版。

## Task 1: 音乐结构测试

**Files:**
- Modify: `src/App.structure.test.ts`

- [ ] **Step 1: Write the failing test**

在 `selection screen structure` describe 块末尾新增测试：

```ts
  it('wires default-on background music through the logged-in shell', () => {
    expect(app).toContain("backgroundMusicSrc = '/assets/audio/the-final-inventory.mp3'")
    expect(app).toContain("musicPreferenceKey = 'dogfight:background-music'")
    expect(app).toContain("localStorage.getItem(musicPreferenceKey) !== 'off'")
    expect(app).toContain("window.localStorage.setItem(musicPreferenceKey, nextEnabled ? 'on' : 'off')")
    expect(app).toContain('audio.play().catch(() => setMusicBlocked(true))')
    expect(app).toContain('musicEnabled={musicEnabled}')
    expect(app).toContain('onToggleMusic={toggleMusic}')
    expect(app).toContain('function TopBar({ run, musicEnabled, onToggleMusic, onLogout }')
    expect(app).toContain('<Music size={18} />')
    expect(app).toContain('<VolumeX size={18} />')
    expect(css).toContain('.topbar-actions')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/App.structure.test.ts
```

Expected: FAIL because `backgroundMusicSrc`, `musicPreferenceKey`, music props, icons, and `.topbar-actions` do not exist yet.

## Task 2: 添加音频资源

**Files:**
- Create: `public/assets/audio/the-final-inventory.mp3`

- [ ] **Step 1: Copy the provided asset**

Run:

```powershell
New-Item -ItemType Directory -Force -Path public\assets\audio
Copy-Item -LiteralPath 'C:\Users\User\Documents\WXWork\1688850732719142\Cache\File\2026-05\The_Final_Inventory.mp3' -Destination 'public\assets\audio\the-final-inventory.mp3' -Force
```

- [ ] **Step 2: Verify the asset exists**

Run:

```powershell
Get-Item -LiteralPath public\assets\audio\the-final-inventory.mp3 | Format-List FullName,Length
```

Expected: file exists and length is greater than 0.

## Task 3: 实现背景音乐控制

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Update imports and constants**

In `src/App.tsx`, import `Music` and `VolumeX` from `lucide-react`, then add:

```ts
const backgroundMusicSrc = '/assets/audio/the-final-inventory.mp3'
const musicPreferenceKey = 'dogfight:background-music'
```

- [ ] **Step 2: Add app-level audio state**

Inside `App`, add:

```ts
  const [musicEnabled, setMusicEnabled] = useState(() => window.localStorage.getItem(musicPreferenceKey) !== 'off')
  const [musicBlocked, setMusicBlocked] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
```

- [ ] **Step 3: Add playback effect**

Inside `App`, add:

```ts
  useEffect(() => {
    if (!user) {
      audioRef.current?.pause()
      return
    }

    let audio = audioRef.current
    if (!audio) {
      audio = new Audio(backgroundMusicSrc)
      audio.loop = true
      audio.volume = 0.55
      audioRef.current = audio
    }

    if (!musicEnabled) {
      audio.pause()
      setMusicBlocked(false)
      return
    }

    audio.play().then(() => setMusicBlocked(false)).catch(() => setMusicBlocked(true))
  }, [musicEnabled, user])
```

- [ ] **Step 4: Add toggle handler**

Inside `App`, add:

```ts
  const toggleMusic = () => {
    const nextEnabled = !musicEnabled
    window.localStorage.setItem(musicPreferenceKey, nextEnabled ? 'on' : 'off')
    setMusicEnabled(nextEnabled)
    if (nextEnabled) {
      audioRef.current?.play().then(() => setMusicBlocked(false)).catch(() => setMusicBlocked(true))
    } else {
      audioRef.current?.pause()
      setMusicBlocked(false)
    }
  }
```

- [ ] **Step 5: Pass music props through Shell**

Update each `Shell` usage to include:

```tsx
musicEnabled={musicEnabled}
musicBlocked={musicBlocked}
onToggleMusic={toggleMusic}
```

Update `Shell` signature and `TopBar` call accordingly.

- [ ] **Step 6: Render music button in TopBar**

Update `TopBar` signature to receive music props and render:

```tsx
      <div className="topbar-actions">
        <IconButton title={musicEnabled ? (musicBlocked ? '音乐待播放，点击重试' : '关闭音乐') : '开启音乐'} onClick={onToggleMusic}>
          {musicEnabled ? <Music size={18} /> : <VolumeX size={18} />}
        </IconButton>
        <IconButton title="退出登录" onClick={onLogout}><LogOut size={18} /></IconButton>
      </div>
```

- [ ] **Step 7: Add CSS for the button group**

In `src/App.css`, add:

```css
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
```

Update the existing `.topbar > .brand-block, .topbar > .stats, .topbar > .icon-button` selector to use `.topbar > .topbar-actions` instead of `.topbar > .icon-button`.

- [ ] **Step 8: Run test to verify it passes**

Run:

```bash
npm test -- src/App.structure.test.ts
```

Expected: PASS.

## Task 4: 全量验证

**Files:**
- Verify only.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 3: Inspect changed files**

Run:

```bash
git status --short
git diff -- src/App.tsx src/App.css src/App.structure.test.ts docs/superpowers/plans/2026-05-19-background-music-plan.md
```

Expected: only intended files plus the new MP3 asset are changed.
