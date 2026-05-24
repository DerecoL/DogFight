# 惊喜界面背景与结算页面实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将三张犬类手稿图接入职业晋升、附魔商店和结算页，并把跑局完成状态做成更完整的结算页面。

**Architecture:** 前端继续使用现有 React 单文件组件结构，新增轻量背景资源映射和 `SettlementView` 展示组件，不修改战斗、奖励或结算数值逻辑。CSS 通过稳定 class hook 统一处理手稿背景、暗化遮罩和纸面内容层，保持文字可读。

**Tech Stack:** React, TypeScript, Vite, Vitest, CSS, public static assets.

---

## 文件结构

- 修改 `src/App.structure.test.ts`：先添加结构测试，覆盖背景资源映射、职业晋升/附魔 ceremony hook、独立结算页面 hook。
- 修改 `src/App.tsx`：新增惊喜背景映射、`surpriseBackgroundStyle`、`SettlementView`，并将 `COMPLETE` 展示从 `BattleView` 小结果卡迁移到独立页面。
- 修改 `src/App.css`：新增 `.surprise-surface`、`.settlement-page`、`.settlement-card` 等样式，增强 ceremony 背景图和结算页面布局。
- 新增静态资源到 `public/assets/backgrounds/`：
  - `canine-fighting-study.png`
  - `canine-anatomy-run.png`
  - `canine-comparative-anatomy.png`
- 运行 `npm run build`，同步生成 `dist-click/DogFight-standalone.cmd`。

---

### Task 1: 资源与结构测试

- [ ] 在 `src/App.structure.test.ts` 添加测试，断言 `surpriseBackgrounds` 包含三张背景路径。
- [ ] 添加测试，断言 `ClassRewardCeremony` 和 `EnchantCeremony` 使用 `.surprise-surface` 与对应背景 key。
- [ ] 添加测试，断言 `SettlementView` 存在，并在 `run.phase === 'COMPLETE'` 时渲染。
- [ ] 运行 `npm test -- src/App.structure.test.ts -t "surprise backgrounds"`，确认新增测试先失败。

### Task 2: 静态资源接入

- [ ] 将用户提供的三张 PNG 复制到 `public/assets/backgrounds/`。
- [ ] 在 `src/App.tsx` 添加 `surpriseBackgrounds` 映射和 `surpriseBackgroundStyle()`。
- [ ] 给 `ClassRewardCeremony` 使用 `classReward` 背景，给 `EnchantCeremony` 使用 `enchant` 背景。

### Task 3: 独立结算页面

- [ ] 新增 `SettlementView` 组件，展示跑局结束标题、胜负记录、积分、天梯结算摘要和重新选择狗狗按钮。
- [ ] 将 `BattleView` 的 `COMPLETE` 小结果卡替换为 `SettlementView`。
- [ ] 保留战斗未完成时的继续按钮逻辑不变。

### Task 4: 背景与响应式样式

- [ ] 在 `src/App.css` 添加 `.surprise-surface` 背景层、暗化层和纸面内容保护。
- [ ] 添加 `.settlement-page`、`.settlement-hero`、`.settlement-card`、`.settlement-score-grid` 样式。
- [ ] 补移动端样式，避免背景图、结算卡和按钮在窄屏重叠。

### Task 5: 验证

- [ ] 运行 `npm test -- src/App.structure.test.ts -t "surprise backgrounds"`。
- [ ] 运行 `npm test -- src/App.structure.test.ts`。
- [ ] 运行 `npm run build`，确保单文件版本同步更新。

---

## 自检

- 本计划只修改 UI、静态资源和展示结构，不改战斗、装备、遗物、经济或天梯结算数值。
- 因不涉及数值和平衡模型，不需要更新 `C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx`。
- 因会影响前端展示和可玩单文件版本，交付前必须运行 `npm run build`。
