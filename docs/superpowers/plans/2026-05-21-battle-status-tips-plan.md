# Battle Status Tips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让战斗中狗狗血条旁的增益/减益状态芯片可点击，并弹出中文 tips 解释具体规则。

**Architecture:** 前端只改 `src/App.tsx` 和 `src/App.css`，复用现有 `TipAnchor`、`getFloatingTipPosition`、`useOutsideTipDismiss` 和 `.floating-tip.paper-card`。在 `BattleStage` 内维护一个局部 `statusTip`，由 `BattleDog` 传入 `StatusEffectRow`，点击 chip 后渲染新的 `StatusFloatingTip`。

**Tech Stack:** React 19、TypeScript、Vitest 字符串结构测试、Vite 构建。

---

## 文件结构

- Modify: `src/App.tooltip.test.ts`
  - 增加状态 tips 的结构测试，先红后绿。
- Modify: `src/App.css.test.ts`
  - 增加状态 chip 可点击样式和状态浮层样式测试。
- Modify: `src/App.tsx`
  - 新增 `StatusTipState`、状态说明表、点击处理和 `StatusFloatingTip`。
  - 修改 `BattleStage`、`BattleDog`、`StatusEffectRow`，把状态 chip 从静态 `span` 改成可点击 `button`。
- Modify: `src/App.css`
  - 保持 chip 尺寸稳定，补 hover/focus 样式和状态 tip 的紧凑布局。

## Task 1: 写状态 tips 的失败测试

**Files:**
- Modify: `src/App.tooltip.test.ts`
- Modify: `src/App.css.test.ts`

- [ ] **Step 1: 在 `src/App.tooltip.test.ts` 写失败测试**

在 `describe('item detail tooltip interactions', () => { ... })` 内追加：

```ts
  it('lets battle status chips open compact rule tips', () => {
    expect(app).toContain('type StatusTipState')
    expect(app).toContain('const statusTipDetails')
    expect(app).toContain('function StatusFloatingTip')
    expect(app).toContain('const [statusTip, setStatusTip] = useState<StatusTipState | null>(null)')
    expect(app).toContain('onStatusInspect')
    expect(app).toContain('aria-label={`查看${status.label}说明`}')
    expect(app).toContain('className={`status-chip handdrawn-status-chip ${status.type}`}')
    expect(app).toContain('<StatusFloatingTip statusTip={statusTip} onClose={() => setStatusTip(null)} />')
    expect(app).toContain('useOutsideTipDismiss(Boolean(statusTip), onClose)')
    for (const statusType of ['shield', 'thorns', 'extraRoll', 'poison', 'weak', 'freeze', 'disabled']) {
      expect(app).toContain(`${statusType}: {`)
    }
  })
```

- [ ] **Step 2: 在 `src/App.css.test.ts` 写失败测试**

在 `describe('equipment layout scale', () => { ... })` 内追加：

```ts
  it('styles clickable battle status chips and their compact tips without resizing rows', () => {
    expect(cssRule('.status-chip')).toContain('appearance: none')
    expect(cssRule('.status-chip')).toContain('cursor: pointer')
    expect(cssRule('.status-chip')).toContain('font-family: inherit')
    expect(cssRule('.status-chip:hover, .status-chip:focus-visible')).toContain('transform: translateY(-1px)')
    expect(cssRule('.status-floating-tip')).toContain('width: min(320px, calc(100vw - 28px))')
    expect(cssRule('.status-tip-title')).toContain('display: flex')
    expect(cssRule('.status-tip-description')).toContain('line-height: 1.55')
  })
```

- [ ] **Step 3: 运行失败测试**

Run:

```bash
npm test -- src/App.tooltip.test.ts src/App.css.test.ts
```

Expected: FAIL，失败原因是 `StatusTipState`、`StatusFloatingTip`、`.status-floating-tip` 等字符串尚不存在。

## Task 2: 实现状态说明表、点击状态和浮层

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 在 `TipAnchor` 附近新增状态 tip 类型**

在 `type TipAnchor = { x: number; y: number }` 后添加：

```ts
type StatusTipState = {
  status: BattleStatusEntry
  side: 'player' | 'opponent'
  polarity: 'positive' | 'negative'
  anchor: TipAnchor
}
```

- [ ] **Step 2: 在 `ruleTerms` 或其他静态说明常量附近新增状态说明表**

加入：

```ts
const statusTipDetails: Record<string, { polarity: '正面效果' | '负面效果'; timing: string; description: string; source: string }> = {
  shield: {
    polarity: '正面效果',
    timing: '受到伤害时优先结算',
    description: '护盾会先吸收即将受到的伤害。护盾值被扣完后，剩余伤害才会进入生命值。',
    source: '常见来源：护盾类装备、职业道具和遗物。',
  },
  thorns: {
    polarity: '正面效果',
    timing: '受到直接伤害后触发',
    description: '荆棘会在被直接攻击后对攻击方造成反伤。层数越高，反伤能力越强。',
    source: '常见来源：荆棘、反伤和防御类装备。',
  },
  extraRoll: {
    polarity: '正面效果',
    timing: '后续投骰或触发时消耗',
    description: '额外骰会增加后续投骰或装备触发机会。显示的数值代表当前剩余次数。',
    source: '常见来源：加速、连击和额外触发类效果。',
  },
  poison: {
    polarity: '负面效果',
    timing: '持续结算时造成伤害',
    description: '中毒会在结算时造成持续伤害。芯片上的层数表示毒性强度，倒计时提示下一次毒伤时机。',
    source: '常见来源：毒刃、毒牙和持续伤害类装备。',
  },
  weak: {
    polarity: '负面效果',
    timing: '造成伤害时生效',
    description: '虚弱会降低后续造成的伤害。层数越高，输出被削弱得越明显。',
    source: '常见来源：削弱、压制和控制类效果。',
  },
  freeze: {
    polarity: '负面效果',
    timing: '行动或触发前检查',
    description: '冻结会限制行动或跳过触发。显示的剩余时间或次数代表控制还会持续多久。',
    source: '常见来源：冰冻、寒冷和控制类装备。',
  },
  disabled: {
    polarity: '负面效果',
    timing: '装备或效果触发前检查',
    description: '失效会让装备或效果被跳过。显示的次数代表还会抵消多少次触发。',
    source: '常见来源：缴械、破坏和反制类效果。',
  },
}
```

- [ ] **Step 3: 新增浮层组件和数值文案函数**

在 `FloatingTip` 之后添加：

```tsx
function StatusFloatingTip({ statusTip, onClose }: { statusTip: StatusTipState | null; onClose: () => void }) {
  useOutsideTipDismiss(Boolean(statusTip), onClose)
  if (!statusTip) return null
  const { status, anchor, side, polarity } = statusTip
  const detail = statusTipDetails[status.type] ?? {
    polarity: polarity === 'positive' ? '正面效果' : '负面效果',
    timing: '状态存在期间生效',
    description: '这个状态会影响当前战斗。请以芯片上的数值和战斗日志为准。',
    source: '来源：装备、职业道具或遗物效果。',
  }
  const style = { '--tip-x': `${anchor.x}px`, '--tip-y': `${anchor.y}px` } as React.CSSProperties
  return (
    <aside className="floating-tip paper-card status-floating-tip" style={style} role="tooltip">
      <div className="status-tip-title">
        <strong>{status.label}</strong>
        <span className={`tip-tag ${status.type}`}>{detail.polarity}</span>
      </div>
      <div className="tip-tags">
        <span className="tip-tag">{side === 'player' ? '我方' : '敌方'}</span>
        <span className="tip-tag">{statusText(status)}</span>
      </div>
      <p className="status-tip-description">{detail.description}</p>
      <small>{detail.timing}</small>
      <small>{detail.source}</small>
    </aside>
  )
}
```

- [ ] **Step 4: 修改 `BattleStage` 维护状态 tip**

把 `function BattleStage(...)` 函数开头加入：

```ts
  const [statusTip, setStatusTip] = useState<StatusTipState | null>(null)
  const inspectStatus = (status: BattleStatusEntry, side: 'player' | 'opponent', polarity: 'positive' | 'negative', element: HTMLElement) => {
    setStatusTip({ status, side, polarity, anchor: getFloatingTipPosition(element) })
  }
```

并在返回的 `.battle-stage` 内、两个 `BattleDog` 之后添加：

```tsx
      <StatusFloatingTip statusTip={statusTip} onClose={() => setStatusTip(null)} />
```

同时给两个 `BattleDog` 传入：

```tsx
        onStatusInspect={inspectStatus}
```

- [ ] **Step 5: 修改 `BattleDog` 和 `StatusEffectRow` 参数**

把 `BattleDog` 签名增加：

```ts
onStatusInspect: (status: BattleStatusEntry, side: 'player' | 'opponent', polarity: 'positive' | 'negative', element: HTMLElement) => void
```

调用状态行时改为：

```tsx
        <StatusEffectRow tone="positive" side={side} statuses={positiveStatuses} onStatusInspect={onStatusInspect} />
        ...
        <StatusEffectRow tone="negative" side={side} statuses={negativeStatuses} onStatusInspect={onStatusInspect} />
```

把 `StatusEffectRow` 改为：

```tsx
function StatusEffectRow({ tone, side, statuses, onStatusInspect }: { tone: 'positive' | 'negative'; side: 'player' | 'opponent'; statuses: BattleStatusEntry[]; onStatusInspect: (status: BattleStatusEntry, side: 'player' | 'opponent', polarity: 'positive' | 'negative', element: HTMLElement) => void }) {
  const visible = statuses.slice(0, 3)
  const hidden = statuses.length - visible.length
  return (
    <div className={`status-effects ${tone}`}>
      {visible.map((status) => (
        <button
          key={`${tone}-${status.type}`}
          type="button"
          className={`status-chip handdrawn-status-chip ${status.type}`}
          aria-label={`查看${status.label}说明`}
          onClick={(event) => onStatusInspect(status, side, tone, event.currentTarget)}
        >
          {statusText(status)}
        </button>
      ))}
      {hidden > 0 && <span className="status-chip handdrawn-status-chip more" title={statuses.map(statusText).join(' / ')}>+{hidden}</span>}
    </div>
  )
}
```

- [ ] **Step 6: 运行测试确认变绿**

Run:

```bash
npm test -- src/App.tooltip.test.ts
```

Expected: PASS。

## Task 3: 实现可点击样式和状态浮层样式

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: 更新 `.status-chip` 基础样式**

在 `.status-chip` 规则中增加：

```css
  appearance: none;
  font-family: inherit;
  cursor: pointer;
  transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
```

- [ ] **Step 2: 增加 hover/focus 和状态 tip 样式**

在状态颜色规则后添加：

```css
.status-chip:hover,
.status-chip:focus-visible {
  transform: translateY(-1px);
  box-shadow: 1px 2px 0 rgba(61, 45, 37, .2);
  filter: brightness(1.03);
  outline: 2px solid rgba(61, 45, 37, .25);
  outline-offset: 2px;
}
.status-floating-tip {
  width: min(320px, calc(100vw - 28px));
}
.status-tip-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.status-tip-title strong {
  font-size: 18px;
  color: var(--ink);
}
.status-tip-description {
  margin: 0;
  line-height: 1.55;
  font-weight: 750;
  color: var(--ink);
}
```

- [ ] **Step 3: 运行 CSS 相关测试确认变绿**

Run:

```bash
npm test -- src/App.css.test.ts src/App.tooltip.test.ts
```

Expected: PASS。

## Task 4: 构建验证和交付检查

**Files:**
- Verify: `dist-click/DogFight-standalone.cmd`
- Verify: `dist-click/index.html`

- [ ] **Step 1: 运行完整前端相关测试**

Run:

```bash
npm test -- src/App.tooltip.test.ts src/App.structure.test.ts src/App.css.test.ts
```

Expected: PASS。

- [ ] **Step 2: 运行构建**

Run:

```bash
npm run build
```

Expected: exit code 0，并重新生成 `E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd`。

- [ ] **Step 3: 检查工作树**

Run:

```bash
git status --short
```

Expected: 只新增本功能相关改动；注意当前仓库已有用户改动，不要回退不属于本任务的文件。

- [ ] **Step 4: 数值文档判断**

本功能只改变 UI 解释和交互，不改变装备数值、遗物数值、战斗参数或平衡模型，因此不更新 `C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx`。最终回复中必须明确说明原因。

## 自查

- 规格覆盖：计划覆盖点击状态芯片、复用浮层、中文说明表、按钮语义、样式稳定和构建要求。
- 占位扫描：计划中不包含待补实现项；每个代码步骤都给出目标代码或明确命令。
- 类型一致：`StatusTipState`、`statusTipDetails`、`StatusFloatingTip`、`onStatusInspect` 在测试和实现步骤中命名一致。
