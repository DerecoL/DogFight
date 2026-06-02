# Godot 原生客户端重设计规格

## 背景

当前仓库已经有一个 Godot 竖切 Demo，覆盖登录、读取或创建跑局、最小局内商店、装备移动、战斗回放和结算。这个 Demo 验证了“Godot 只做客户端，现有 Fastify API 继续作为权威状态来源”的路线可行。

本规格将目标从竖切 Demo 扩展为并行 Beta 版 Godot 客户端。Godot 版需要覆盖当前网页版的主要功能范围，包括账号面板、账号商城、成就、每日任务、排行榜、赛季、多人房间、跑局、地图、局内商城、装备与遗物、所有弹窗和战斗特效。

本规格不要求 Godot 逐像素复刻 React/Vite 页面。Godot 和 Web 的布局、拖拽、弹窗、动画、渲染层级和移动端适配方式不同，如果强行照搬 DOM/CSS 结构，后续会积累大量临时补丁。因此本轮采用“Godot 原生体验重设计 + Web 功能对齐”的方向。

## 目标

- 建立一个正式的 Godot 4.x Beta 客户端工程，和现有 Web 客户端并行存在。
- 保持现有 Fastify API、Prisma 存档和 TypeScript 游戏规则为唯一权威来源。
- 用 Godot 原生 UI、场景树、CanvasLayer、Tween、Shader、粒子和音效系统重设计客户端体验。
- 完整覆盖当前网页版的功能入口和核心流程，让玩家不打开网页版也能完成主要游玩、账号和多人流程。
- 同时面向 Windows 桌面和移动端适配，避免先做桌面后再返工移动交互。
- 保持当前美术识别：手绘贴纸、纸片卡、狗、骰子、装备格、局内商店、战斗反馈和轻量故事书气质。

## 非目标

- 不迁移 TypeScript 战斗、商店、赛季、成就、任务或多人规则到 GDScript 或 C#。
- 不重写 Prisma 数据库模型。
- 不替换现有 Web 客户端；Godot 版先作为并行 Beta。
- 不为了像素级一致而复制 React 组件层级或 CSS 特效实现。
- 不在 Godot 本地绕过服务端直接修改账号资产、货币、成就、每日任务、赛季、排行榜、房间、跑局、装备、遗物或战斗结果。

## 核心原则

### 规则权威

所有会改变结果的数据都必须由服务端决定。Godot 发起请求后，只能用 API 返回的数据刷新本地状态。

适用范围包括：

- 登录、注册、TapTap 渠道登录和登出。
- 昵称、账号面板、个人战绩和赛季历史。
- 账号货币、账号商城、外观购买和外观装备。
- 成就进度、成就领取、每日任务刷新和每日任务领取。
- 天梯档案、天梯排行榜、巅峰榜、赛季状态和赛季历史快照。
- 多人房间创建、加入、离开、选狗、准备、开局和回合结果。
- 跑局创建、地图节点、局内商店、装备移动、装备出售、遗物、附魔、药水、职业奖励、匹配、战斗开始、战斗结算和放弃当前局。

### 功能对齐

Godot 可以重设计表现和交互，但不能减少当前网页版的功能覆盖。任何当前 Web 可进入、可查看或可提交的关键功能，都需要进入 Godot Beta 的覆盖清单。

### 原生体验

Godot 版优先使用 Godot 原生能力组织界面：

- 用场景和组件管理可复用 UI，而不是模拟 DOM。
- 用 `CanvasLayer` 管理弹窗、Toast、拖拽层、战斗特效层和全局遮罩层。
- 用稳定尺寸、滚动区域和断点布局处理桌面与移动端。
- 用 Tween、粒子、Shader 和音效表达战斗事件与操作反馈。

### 并行 Beta

Godot Beta 不替换 Web。Web 继续线上可用，Godot 用独立入口、独立打包和独立验证流程逐步补齐功能。后续是否替换 Web，需要在 Beta 稳定后单独决策。

## 架构设计

### 目录结构

建议将 `godot-client` 从竖切 Demo 扩展为正式客户端工程：

```text
godot-client/
  project.godot
  scenes/
    Main.tscn
    screens/
    overlays/
    components/
    fx/
  scripts/
    api/
      ApiClient.gd
      ApiTypes.gd
      ApiRoutes.gd
      PollingClient.gd
    state/
      AccountStore.gd
      RunStore.gd
      ShopStore.gd
      AchievementStore.gd
      SeasonStore.gd
      LeaderboardStore.gd
      DogfightRoomStore.gd
      BattleReplayStore.gd
    router/
      ScreenRouter.gd
      ModalStack.gd
      ToastBus.gd
    ui/
      kit/
      screens/
      overlays/
    fx/
      BattleFxDirector.gd
      DiceFx.gd
      ItemTriggerFx.gd
      ProjectileFx.gd
      RewardFx.gd
  assets/
    imported/
    generated/
  scripts/tests/
```

### API 层

`ApiClient` 负责：

- API 基础地址配置。
- JSON 编码和解码。
- cookie 或会话头保存。
- 错误响应解析。
- loading 状态广播。
- 请求超时和失败重试。
- 统一返回 `{ ok, status, error, data }` 结构。

`ApiRoutes` 负责集中定义已使用接口，避免 UI 层散落字符串路径。Godot Beta 至少需要覆盖这些接口：

```text
GET  /api/health
POST /api/auth/register
POST /api/auth/login
POST /api/auth/taptap
POST /api/auth/logout
POST /api/profile/nickname
GET  /api/me

GET  /api/shop
POST /api/shop/purchase
GET  /api/cosmetics/me
POST /api/cosmetics/equip

GET  /api/achievements
POST /api/achievements/:achievementId/claim
GET  /api/daily-tasks
POST /api/daily-tasks/refresh
POST /api/daily-tasks/:taskId/claim

GET  /api/ladder/me
GET  /api/ladder/leaderboard
GET  /api/apex
POST /api/apex/submit
GET  /api/runs/history

POST /api/runs
GET  /api/runs/:runId
POST /api/runs/:runId/map/select
POST /api/runs/:runId/map/event
POST /api/runs/:runId/map/complete-node
POST /api/runs/:runId/map/monster-reward/claim
POST /api/runs/:runId/map/monster-reward/skip
POST /api/runs/:runId/shop/reroll
POST /api/runs/:runId/shop/buy
POST /api/runs/:runId/shop/sell
POST /api/runs/:runId/items/move
POST /api/runs/:runId/items/upgrade
POST /api/runs/:runId/choice/select
POST /api/runs/:runId/upgrade/select
POST /api/runs/:runId/upgrade/skip
POST /api/runs/:runId/potion/select
POST /api/runs/:runId/class-reward/select
POST /api/runs/:runId/enchant/select
POST /api/runs/:runId/relic/select
POST /api/runs/:runId/relic/sell
POST /api/runs/:runId/battle/match
POST /api/runs/:runId/battle/start
POST /api/runs/:runId/battle/finish
POST /api/runs/:runId/settle

GET  /api/dogfight/rooms
POST /api/dogfight/rooms
POST /api/dogfight/rooms/:roomId/join
POST /api/dogfight/rooms/:roomId/leave
POST /api/dogfight/match
POST /api/dogfight/rooms/:roomId/start
POST /api/dogfight/rooms/:roomId/dog-choice
GET  /api/dogfight/rooms/:roomId
POST /api/dogfight/rooms/:roomId/ready
GET  /api/dogfight/battles/:battleId
```

### Store 层

Store 层保存 API 返回的最新权威状态，并向 UI 广播变化。Store 不做规则推断，只做读取、排序、筛选、派生展示字段和过期状态清理。

- `AccountStore`：用户、昵称、钱包、已装备外观、个人战绩摘要。
- `ShopStore`：账号商城、常驻区、精选轮换区、购买状态和装备状态。
- `AchievementStore`：成就、每日任务、分类筛选、可领取状态。
- `SeasonStore`：当前赛季、赛季历史、赛季快照。
- `LeaderboardStore`：天梯榜、巅峰总榜、巅峰日榜、玩家排名。
- `RunStore`：当前跑局、地图、装备、背包、局内商店、遗物、奖励、阶段。
- `DogfightRoomStore`：房间列表、当前房间、玩家席位、准备状态、轮询状态。
- `BattleReplayStore`：当前战斗结果、事件播放进度、派生视觉事件。

### 路由与弹窗

`ScreenRouter` 负责主屏切换和返回栈。建议主屏包括：

- 登录屏。
- 游戏大厅。
- 跑局屏。
- 账号商城屏。
- 成就与每日任务屏。
- 排行榜屏。
- 赛季屏。
- 多人房间大厅。
- 多人房间详情。
- 战斗回放屏。
- 结算屏。

`ModalStack` 负责所有弹窗，并统一层级：

1. 主屏内容层。
2. 战斗/拖拽/局部特效层。
3. Toast 层。
4. 普通弹窗层。
5. 阻塞确认弹窗层。
6. 全局 loading 和断线重连层。

任何新增 UI 都必须检查 `position`、绘制顺序、`z-index` 等价层级、拖拽层、提示层、特效层和按钮层，避免提示、图例、按钮、弹窗或拖拽节点被背景、卡片、画布或特效遮挡。

## UI 与交互设计

### 桌面布局

桌面端保留高信息密度：

- 顶部或侧边主导航。
- 中央区域显示当前主流程。
- 右侧或底部显示上下文操作、账号摘要、任务提示和战斗日志。
- 跑局界面可以同时显示地图、装备区、背包、商店和阶段操作。

### 移动布局

移动端优先触控稳定：

- 使用底部导航或分段页签切换主功能。
- 跑局界面拆成地图、装备、商店、奖励等页签或抽屉。
- 关键操作放在底部固定操作区。
- 弹窗使用稳定宽高、内部滚动和安全区留白。
- 拖拽可保留，但必须提供点击选择再点击目标的替代操作。

### 稳定尺寸

核心 UI 必须显式设计宽高、最小/最大尺寸、网格轨道、滚动区域、截断和占位空间。适用范围包括：

- 账号面板。
- 商城卡片。
- 成就卡片。
- 每日任务行。
- 排行榜行。
- 房间卡片。
- 玩家席位。
- 装备格。
- 背包格。
- 地图节点。
- 战斗 HUD。
- 结算奖励。
- Toast 和弹窗。

长文本默认在内部换行、截断或滚动，不允许撑开外层关键布局。

## 功能覆盖设计

### 登录与账号

Godot 需要支持：

- 账号密码登录。
- 注册。
- TapTap 渠道入口，按运行环境决定是否展示。
- 登出。
- 昵称修改。
- `/api/me` 读取用户和 active run。
- 断线、未登录、登录过期和请求失败提示。

### 大厅与账号面板

大厅作为 Godot 原生主入口，不需要照搬 Web 区块。建议展示：

- 当前账号、昵称、称号、头像和货币。
- 当前赛季和天梯段位。
- 当前跑局继续入口。
- 休闲模式、天梯模式、多人模式入口。
- 商城、成就、每日、排行、赛季、个人设置入口。
- 最近战绩和赛季历史摘要。

### 账号商城与外观

覆盖：

- 常驻区。
- 精选轮换区。
- 商品详情。
- 软货币购买。
- 已拥有状态。
- 已装备状态。
- 外观装备和卸下。
- 支付预留商品显示，但不在 Godot 本地实现支付规则。

### 成就与每日任务

覆盖：

- 成就分类。
- 隐藏成就展示规则。
- 进度条。
- 可领取状态。
- 已领取状态。
- 每日任务日期。
- 每日刷新按钮。
- 每日任务领取。
- 钱包余额刷新。

### 排行榜与赛季

覆盖：

- 天梯个人档案。
- 天梯排行榜。
- 巅峰总榜。
- 巅峰日榜。
- 巅峰提交候选跑局。
- 巅峰配置快照查看。
- 当前赛季信息。
- 赛季历史摘要。
- 已归档巅峰快照。

### 跑局与地图

覆盖：

- 狗选择。
- 休闲/天梯模式选择。
- 幸运数字。
- 当前跑局继续。
- 地图节点展示和选择。
- 事件节点。
- 商店节点。
- 野怪节点。
- 节点完成。
- 待领取奖励。
- 跑局放弃和结算提示。

### 局内商店、装备和遗物

覆盖：

- 商店类型。
- 商品展示。
- 购买。
- 刷新。
- 出售。
- 装备移动。
- 装备升级。
- 背包和装备栏。
- 遗物展示。
- 遗物选择。
- 遗物出售。
- 附魔选择。
- 药水选择。
- 职业奖励选择。
- 选择商店、升级商店和跳过。

装备交互在桌面可用拖拽，移动端必须可用点击选择加目标选择完成同样操作。

### 战斗回放与特效

Godot 不重新模拟战斗，只播放服务端 `BattleResult.events`。`BattleFxDirector` 将事件转换为视觉事件：

- 骰子滚动。
- 装备触发高亮。
- 投射物飞行。
- 伤害数字。
- 治疗数字。
- 护盾变化。
- 毒、虚弱、控制等状态提示。
- 连锁触发节奏。
- 胜负收束。
- 结算奖励。

战斗特效可以比 Web 更强，但必须清楚表达来源、目标、数值变化和胜负结果。特效层不得遮挡关键按钮、血条、日志和结算操作。

### 多人房间

覆盖：

- 房间列表。
- 创建房间。
- 加入房间。
- 离开房间。
- 快速匹配。
- 房间详情。
- 玩家席位。
- 房主状态。
- 选狗。
- 准备。
- 开始。
- 房间轮询同步。
- 多人战斗结果读取。
- 房间状态变化提示。

轮询需要有节流和退出清理，避免离开房间后继续请求旧房间。

## 阶段计划

### 阶段一：客户端底座

目标：

- 建立正式屏幕路由。
- 建立弹窗栈和 Toast。
- 统一 API 客户端和 route 定义。
- 建立 Store 基类或统一信号约定。
- 建立桌面/移动断点布局能力。
- 建立基础 UI Kit。
- 建立资源导入和体积检查流程。

验收：

- Godot 启动后能登录、读取 `/api/me`、切换主屏、打开/关闭弹窗。
- 桌面和移动窗口尺寸下不出现明显遮挡、文本溢出或按钮过小。

### 阶段二：大厅与账号系统

目标：

- 登录、注册、TapTap 渠道入口。
- 大厅。
- 账号面板。
- 个人战绩。
- 赛季历史摘要。
- 个人设置。
- 账号商城。
- 外观装备。

验收：

- 玩家可在 Godot 内完成账号登录、查看账号资产、购买外观并装备。
- Web 账号商城和 Godot 显示同一份服务端状态。

### 阶段三：成就、每日、排行榜和赛季

目标：

- 成就列表、分类和领取。
- 每日任务列表、刷新和领取。
- 天梯个人档案。
- 天梯排行榜。
- 巅峰总榜和日榜。
- 巅峰提交。
- 赛季历史快照。

验收：

- Godot 可完成成就和每日任务领取。
- 天梯和巅峰榜数据与 API 返回一致。
- 赛季历史快照可打开查看，不依赖 Web 弹窗。

### 阶段四：跑局完整流程

目标：

- 狗选择。
- 休闲/天梯入口。
- 地图节点。
- 局内商店。
- 装备和背包。
- 遗物、附魔、药水和职业奖励。
- 跑局放弃。
- 完成局结算。

验收：

- 玩家可从 Godot 创建并完成一局主要流程。
- 所有改变跑局的操作都以 API 返回 run 刷新本地状态。
- 移动端可以不用拖拽也完成装备操作。

### 阶段五：战斗与特效

目标：

- 完整播放 `BattleResult.events`。
- 补齐骰子、装备高亮、投射物、伤害、治疗、护盾、毒、虚弱、控制和胜负反馈。
- 接入音效。
- 接入玩家已装备的战斗特效外观。

验收：

- 战斗事件顺序和结果与服务端一致。
- 关键事件在视觉上可读。
- 特效不会遮挡 HUD、按钮、日志和结算操作。

### 阶段六：多人房间

目标：

- 房间大厅。
- 房间详情。
- 创建、加入、离开、匹配。
- 选狗、准备、开始。
- 房间轮询。
- 多人战斗回放。

验收：

- 两个客户端能通过现有 API 完成房间流程。
- 离开房间、房间关闭、对方准备、战斗生成等状态变化能稳定同步。

### 阶段七：Beta 打包与交付

目标：

- Windows 桌面 Beta 包。
- 移动端 Beta 包或移动导出预检查。
- Godot smoke tests。
- API smoke tests。
- Web `npm run build`。
- 资源体积和加载速度检查。

验收：

- Web 继续可用。
- Godot Beta 可独立运行。
- 主流程在桌面和移动尺寸下通过。
- 没有因为 Godot 资源引入导致明显加载变慢、闪烁、布局抖动或交互阻塞。

## 测试策略

- Godot headless smoke：验证核心脚本、Store、API 客户端和路由能加载。
- Godot UI smoke：用固定窗口尺寸检查主屏、弹窗和关键控件存在。
- API smoke：启动本地 `npm run dev` 后，验证登录、读取账号、读取商城、读取成就、读取排行榜、创建跑局和房间列表。
- Web/server 测试：修改共享 API、服务端、资源路径或 Web 构建逻辑时运行 `npm run build` 和相关 Vitest。
- UI 层级回归：新增弹窗、拖拽层、战斗特效或复杂 UI 时，补充层级测试或截图检查。
- 尺寸稳定回归：关键容器在 loading、empty、overflow、selected、disabled、移动端和桌面端状态下不能随内容随意跳动。
- 资源测试：检查新增图片尺寸、格式、体积、导入路径和加载时机。

## 资源与性能

- 优先复用 `public/assets` 中已有 WebP 资源。
- 若 Godot 导入 WebP 存在兼容或性能问题，应使用可重复脚本转换为适合 Godot 的格式。
- 装备和遗物图标继续使用统一贴纸风格资源。
- 首屏、大厅、战斗和商店资源需要控制加载体积，避免一次性加载所有大图。
- 移动端需要优先检查包体、纹理尺寸、内存峰值和加载闪烁。

## 风险与护栏

### 风险：Godot 与 Web 功能分叉

护栏：所有关键规则走 API。Godot Store 不实现会改变结果的规则。

### 风险：原生重设计偏离现有版本

护栏：功能清单、文案语义、状态语义、奖励、数值和资产识别必须与 Web 对齐。视觉可以更适合 Godot，但不能变成另一个不相关产品。

### 风险：桌面和移动同时做导致范围过大

护栏：同一套 Store 和屏幕逻辑，布局按断点切换；每阶段都做桌面和移动最小验收，不把移动端留到最后。

### 风险：多人房间轮询产生旧状态污染

护栏：轮询必须绑定当前房间 id 和屏幕生命周期，离开房间或切屏时取消旧轮询。

### 风险：特效遮挡交互

护栏：战斗特效、拖拽、Toast、弹窗和按钮使用明确 CanvasLayer 层级。每次 UI/特效改动前后检查层级关系。

### 风险：资源加载变慢

护栏：新增图片默认检查格式、尺寸、体积、导入配置和首屏加载影响。大图延迟加载，图标使用合适尺寸。

## 交付定义

Godot Beta 达到以下条件才算完成：

- 可在 Windows 桌面运行。
- 可在移动尺寸或移动导出预检查中完成主要流程。
- 登录、账号面板、账号商城、成就、每日任务、排行榜、赛季、多人房间、跑局、地图、局内商店、装备、遗物、弹窗、战斗回放和结算都有 Godot 入口。
- 所有权威状态来自现有 Fastify API。
- Web 客户端继续可用。
- Godot smoke、API smoke 和必要的 Web/server 构建验证通过。
- 资源加载、UI 层级、稳定尺寸和移动端触控经过检查。

## 后续计划

本规格经确认后，应继续编写分阶段实现计划。由于范围覆盖多个子系统，实现计划不应写成单个超大任务，而应拆成至少七个阶段计划：

1. Godot 客户端底座计划。
2. 大厅与账号系统计划。
3. 成就、每日、排行榜和赛季计划。
4. 跑局完整流程计划。
5. 战斗与特效计划。
6. 多人房间计划。
7. Beta 打包与验收计划。
