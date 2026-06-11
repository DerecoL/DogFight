# Godot UI 视觉重构第一阶段规格

## 背景

当前 Godot 版本的 UI 路径结构已经基本正确，登录、昵称、模式大厅以及后续跑局屏幕可以按对应屏幕进入。但玩家可见的美观度、排布密度和手绘卡片风格仍明显偏离网页版，部分界面仍呈现为普通表单、按钮列表或工具面板。

本阶段不再以“功能路径补齐”为主，而是进入“逐屏视觉重构”。目标是在 Godot 原生 UI 中建立稳定的手绘视觉底座，并先完成登录、昵称和模式大厅三屏，作为后续地图、商店、奖励、战斗、结算和外围系统的样板。

## 已确认决策

- Godot 允许根据引擎窗口重新排布，不追求网页版像素级复制。
- 网页版仍是风格、信息层级、操作入口和状态反馈的源头。
- 第一轮采用“先做视觉底座，再逐屏重构”的方式。
- 第一轮验收以桌面横屏 16:9 为主，重点窗口为 `1280x720` 和 `1600x900`。
- 登录页中的“快速开始”和“TapTap 授权码登录”默认折叠到“其他登录方式 / 调试入口”，不抢主视觉。
- 模式大厅采用“主模式卡优先”排布，四个模式入口占据首屏中心。

## 第一阶段范围

### 1. Godot 手绘 UI 底座

扩展和统一 Godot 内的共享视觉能力，避免每个屏幕单独写一套样式。

重点文件：

- `godot-client/scripts/ui/web/WebUiTokens.gd`
- `godot-client/scripts/ui/shared/**`
- `godot-client/scripts/ui/shell/WebShell.gd`
- `godot-client/scenes/overlays/OverlayRoot.tscn`

需要沉淀的能力：

- 纸张卡片：羊皮纸底色、粗描边、内描线、轻微阴影、稳定 padding。
- 木框面板：用于高优先级区域和大厅模式卡的外框。
- 按钮：主按钮、次按钮、危险按钮、图标按钮、禁用、按下、loading 状态。
- 输入框：手绘边框、聚焦状态、错误状态、固定高度。
- 资源胶囊：金币、胜负、回合、称号、账号状态等短信息。
- 浮层：Toast、详情 Tip、确认弹窗、全局 Loading 的层级和样式。
- 16:9 布局规则：安全边距、最大内容宽度、固定高度、内部滚动区、长文本换行或截断。

### 2. 登录页

重点文件：

- `godot-client/scenes/LoginScreen.tscn`
- `godot-client/scripts/ui/LoginScreen.gd`

设计要求：

- 保留 `dog-brawl-town.jpg` 背景，但使用更柔和的遮罩，不让背景压过登录卡。
- 登录卡默认只突出品牌、账号、密码、登录、注册和语言切换。
- “快速开始”和“TapTap 授权码登录”折叠到次级区域，展开后仍在卡片内部，不导致主面板大幅跳动。
- 错误提示区域预留固定高度，长错误文本内部换行或滚动，不撑开整张卡。
- 登录、注册、快速开始和 TapTap 登录保持现有功能入口，相关 smoke 测试仍能找到对应节点。

验收标准：

- `1280x720` 下登录卡完整显示，不需要横向滚动。
- 默认状态第一眼是正式登录界面，不是调试面板。
- 展开调试入口后，卡片布局稳定，按钮不重叠。
- loading 和 disabled 状态不会改变主要控件位置。

### 3. 昵称页

重点文件：

- `godot-client/scenes/screens/NicknameSetupScreen.tscn`
- `godot-client/scripts/ui/screens/NicknameSetupScreen.gd`

设计要求：

- 采用轻仪式感单卡布局，避免只显示标题和输入框。
- 保留昵称输入、2-16 字校验、确认按钮、错误提示和登出能力。
- 输入卡与 WebShell 顶部栏保持统一手绘风格。
- 状态提示预留空间，错误文本不推动整体布局跳动。

验收标准：

- `1280x720` 下昵称卡居中且完整显示。
- 输入框、确认按钮和错误提示视觉层级清楚。
- 按钮 disabled、loading、错误状态尺寸稳定。
- 长昵称输入不会撑开卡片。

### 4. 模式大厅

重点文件：

- `godot-client/scenes/screens/ModeLobbyScreen.tscn`
- `godot-client/scripts/ui/screens/ModeLobbyScreen.gd`
- `godot-client/scripts/ui/shell/WebShell.gd`

设计要求：

- 大厅第一眼以四个模式卡为中心：休闲、天梯、斗狗、巅峰。
- 模式卡使用手绘纸张或木框卡片，包含图标、标题、说明和行动按钮。
- 继续跑局、新手引导、历史摘要和账号入口作为辅助区域，不抢主模式入口。
- 有 active run 时显示继续入口，但不覆盖模式选择。
- 锁定或未开放模式保留卡片占位和禁用状态，避免布局跳动。
- 历史摘要和账号入口可以在首轮简化，但必须保持卡片化，不回退成纯按钮列表。

推荐排布：

- 顶部：统一 WebShell 顶部栏，固定高度。
- 中部：两列两行主模式卡，占据首屏主要空间。
- 底部：继续跑局 / 新手引导 / 历史摘要 / 账号入口辅助区。
- 主内容宽度设置上限，`1600x900` 下不无限拉伸。

验收标准：

- `1280x720` 下顶部栏、模式卡和辅助区完整可见。
- `1600x900` 下主内容不空散。
- 四个模式入口是最强视觉焦点。
- 长昵称、长模式说明、空历史、active run 状态不撑爆布局。

## 非目标

第一阶段暂不重做以下内容：

- 地图、路线、地图草稿工具。
- 商店、装备栏、背包、遗物轨道。
- 奖励选择、附魔、药水、升级。
- 战斗回放、战斗特效、结算。
- 账号商城、成就、排行、赛季、历史详情。
- 多人房间。
- 移动竖屏适配。
- Web 版像素级复制。

## 测试与验证

第一阶段实现后至少运行：

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_tokens_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shared_controls_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/login_visual_shell_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/login_web_auth_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/nickname_setup_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_web_text_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_interaction_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shell_smoke.gd
```

因为后续实现会修改 Godot UI 和前端展示相关资源链路，交付实现时还必须运行：

```powershell
npm run build
```

本规格文档本身只定义计划，不改游戏行为、前端展示、资源、装备数据、战斗逻辑或打包逻辑，因此本次文档交付不需要运行 `npm run build`。

## 后续推进

本规格通过后，下一步创建实现计划，建议拆成以下批次：

1. 扩展 UI token 与共享控件。
2. 重构登录页。
3. 重构昵称页。
4. 重构模式大厅。
5. 更新或新增 smoke 测试。
6. 运行 Godot headless smoke 与 `npm run build`。

第一阶段完成并验收后，再进入第二阶段：选狗、地图、商店、奖励和备战屏幕的逐屏视觉重构。
