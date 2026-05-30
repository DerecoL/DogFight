# 商店页签随机样式与立体感增强设计

## 背景

当前商店选择页签和商店商品纸条已经有手绘纸张方向，但视觉变化主要依赖少量 `nth-child` 倾斜和纸色。进入商店前的页签卡片重复感仍然明显；商品纸条虽然有品质柔光，但深度主要靠发光和普通阴影，缺少“纸片压在木质托盘上”的接触关系。

## 目标

- 商店选择页签新增两套可轮换的纸片样式，降低重复感。
- 商品纸条也补两套额外轮廓/纸色/高度变化，让货架里的五张纸条更不相同。
- 立体感以轻透视、接触阴影、下沿压暗和托盘凹槽表现，不使用厚重 3D 变形。
- 品质仍然通过纸张边缘外侧柔光表达，阴影和柔光要叠加而不是互相覆盖。
- 移动端不因为透视、阴影或页签高度导致文字溢出、卡片重叠或布局抖动。

## 范围

- 修改 `src/App.css`：
  - `ShopChoiceSelect` 使用的 `.shop-choice-screen .choice` 及其 `nth-child` 视觉变体。
  - 商店货架 `.shop-shelf`、`.shop-shelf .offer-row`、`.paper-shop-card` 及其 `nth-child` 变体。
  - 商店卡片悬浮、选中、不可购买状态下的阴影和品质柔光叠加。
- 修改 `src/App.css.test.ts`：
  - 用 CSS 结构测试锁定新增两套页签变体。
  - 用 CSS 结构测试锁定商品纸条新增两套变体和更强深度阴影。
- 不修改装备数值、价格、品质倍率、战斗逻辑、随机离线狗数据或 Excel 数值表。

## 视觉方案

采用 B 方案：轻透视托盘 + 两套新增纸片变体。

- 页签层：
  - `.shop-choice-screen .choice-grid` 增加轻微 `perspective`。
  - `.shop-choice-screen .choice` 增加接触阴影变量、下沿内阴影和轻微 `rotateX`。
  - 保留现有手绘卡片内容结构，不新增 DOM。
  - 通过 `nth-child(3n + 1)`、`nth-child(3n + 2)`、`nth-child(3n)` 形成基础三类，再补 `nth-child(4n)`、`nth-child(5n)` 两套额外轮廓和纸色。
- 商品纸条层：
  - 保留 `.paper-shop-card::before` 作为真正剪裁纸张外形和品质柔光承载层。
  - 增强 `--shop-paper-contact-shadow` 与 `--shop-paper-depth-filter`，让阴影从纸张下方和右下方产生。
  - 为 `.offer-row .paper-shop-card:nth-child(6n + 2)` 和 `nth-child(6n + 5)` 增加两套额外轮廓、纸色、半径和高度偏移。
  - 品质柔光保留 `--shop-quality-glow-ring`，并确保 hover/selected 使用更强柔光但不变成粗边框。

## 交互与状态

- 悬浮状态：只做轻微上浮，保留纸片旋转角度，不改变布局尺寸。
- 选中状态：保留现有选中反馈，并让 `::before` 使用 hover 强度柔光。
- 不可购买状态：继续灰化和降亮度，但保留一个较弱接触阴影，避免纸片完全贴平。
- 占位页签：仍然是低透明度占位卡，不参与强立体样式。

## 验证

- 先新增 `src/App.css.test.ts` 失败测试：
  - 页签选择卡存在两套新增随机样式。
  - 商店商品纸条存在两套额外变体，并包含接触阴影和品质柔光叠加。
- 再修改 `src/App.css` 使测试通过。
- 运行 `npx vitest run src/App.css.test.ts`。
- 因为本次影响前端展示和可玩单文件版本，交付前运行 `npm run build`，确认 `E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd` 同步生成。
- 本次不涉及数值或平衡模型，不更新 `C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx`。
