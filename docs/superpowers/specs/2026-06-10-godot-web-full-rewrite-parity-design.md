# Godot 版与 Web 版全功能一致重写规格

## 一、背景与目标

用户要求：“把现在 Godot 和网页版功能完全详尽地进行对比，让引擎内的功能跟网页版做到一样。”

当前仓库已经存在两条 UI 线：

- Web 版：`src/App.tsx` 是实际功能与交互的权威实现，配套 `src/App.css`、`src/server/**`、`public/assets/**`。
- Godot 版：`godot-client` 已经有独立屏幕、API 客户端、路由、Overlay、状态 Store 和大量 smoke 测试，但仍保留 `LegacyRunScreen` 兼容层。

本规格选择用户确认的方案 3：**Godot UI 全量重写为 Web 等价版**。

目标不是做一个“类似 Web 的 Godot 体验”，而是让 Godot 版在玩家可见功能、屏幕结构、交互入口、流程顺序、状态反馈、资源展示、错误处理、弹窗浮层和核心 UI 层级上与当前 Web 版保持一致。

## 二、最高原则

### 1. Web 是 UI 与交互源头

Godot 版必须以以下内容为准：

- `src/App.tsx`：屏幕流程、条件分支、组件结构、交互行为、API 调用时机。
- `src/App.css` 与 `src/ui/**`：视觉层级、纸片卡片、按钮、网格、浮层、战斗 HUD、地图与商店样式。
- `src/i18n/**`：中英文文本、规则词条、战斗文本与本地化行为。
- `public/assets/**`：狗头像、背景、贴纸图标、地图图标、装备卡图、音频。
- `src/server/**`：状态和规则的权威来源。

如果 Web 与 Godot 存在差异，默认 Web 正确。Godot 不得自行发明新流程来替代 Web 流程。

### 2. 服务端仍是规则权威

Godot 不迁移 TypeScript 业务规则，不在 GDScript 内重新实现战斗、商店、地图、奖励、赛季、成就、每日任务或多人房间规则。

Godot 负责：

- 渲染原生 UI。
- 收集输入。
- 调用 Fastify API。
- 使用 API 返回的 run、room、battle、wallet、cosmetics、history、leaderboard 等数据刷新本地状态。
- 播放服务端返回的 `BattleResult.events`。

Godot 不负责：

- 自行计算战斗结果。
- 自行决定商店商品、价格、折扣、奖励、地图节点结果。
- 自行决定成就、每日任务、赛季、巅峰和多人房间状态。

### 3. 全量重写不等于一次性大爆炸

最终目标是移除正式流程对 `LegacyRunScreen` 的依赖，但实施必须分阶段完成。每个阶段都必须有独立验收标准和自动化 smoke 测试，避免同时改动所有系统导致无法定位回归。

## 三、当前仓库现状

### Web 版现状

`src/App.tsx` 当前包含完整客户端体验，核心功能包括：

- 登录、注册、TapTap 登录提示。
- 昵称设置。
- Shell 顶栏、账号摘要、资源胶囊、音乐开关、语言选择、返回大厅、登出。
- 模式大厅：休闲、天梯、斗狗、巅峰、未解锁模式、新手引导入口。
- 跑局历史：历史列表、历史详情、装备预览、背包摘要、赛季历史、快照查看。
- 选狗：狗种卡、狗种特性、幸运数字。
- 探索地图：路线图、节点状态、路线连线、节点详情、怪物装备预览、奖励预览、路线草稿工具。
- 奖励选择：商店三选一、职业奖励、附魔、遗物、升级、药水。
- 商店：货架、商品卡、价格、折扣、已拥有数量、购买详情、刷新、匹配入口。
- 装备板：装备栏、背包、遗物栏、装备详情、遗物详情、拖拽放置、点击目标格放置、出售、升级、药水和附魔目标选择。
- 备战与匹配：匹配对手、开始战斗、对手狗种与配置摘要。
- 战斗回放：双方狗、血条、护盾、状态、骰子、装备触发、高亮、战斗特效、速度控制、日志筛选、结算入口。
- 结算：胜负、得分、奖励、战报复盘、天梯结算、隐藏/显示结算、返回大厅。
- 账号商城：外观商品、购买、装备、货币余额、稀有度。
- 成就与每日：任务刷新、领取、成就分类、隐藏/可领取状态。
- 设置：已拥有外观、默认外观、装备/卸下。
- 天梯排行：段位、战绩、天梯榜、近期结算。
- 巅峰：候选配置、提交、排行榜、配置快照。
- 赛季：当前赛季、赛季历史、赛季快照。
- 多人斗狗：房间列表、创建/加入/匹配、房间详情、选狗、准备、战斗观战、战报、房间轮询。
- 反馈系统：Toast、错误提示、音效、Loading、浮层、确认弹窗。
- 新手引导：步骤、锚点、自动开始、重看、跳过。

### Godot 版现状

Godot 已具备以下基础：

- `godot-client/scripts/api/ApiClient.gd`：HTTP JSON 客户端、Cookie、Loading 信号。
- `godot-client/scripts/api/ApiRoutes.gd`：Web API 路由集中定义。
- `godot-client/scripts/state/GameSession.gd`：登录、跑局、地图、商店、奖励、战斗、外围数据刷新与屏幕路由。
- `godot-client/scripts/state/AppStore.gd`、`RunStore.gd`、`AccountStore.gd`：本地状态 Store。
- `godot-client/scripts/router/ScreenRouter.gd`、`ModalStack.gd`、`ToastBus.gd`、`FeedbackSoundBus.gd`：路由、弹窗、Toast、反馈音。
- `godot-client/scripts/ui/web/WebUiScreenIds.gd`：Godot 屏幕 ID 与 run phase 映射。
- `godot-client/scripts/ui/web/WebUiTokens.gd`：Web 风格 UI token。
- `godot-client/scripts/ui/web/BaseWebScreen.gd`：独立屏幕基类。
- 独立屏幕：`ModeLobbyScreen`、`DogSelectScreen`、`ExplorationMapScreen`、`RunShopScreen`、`RewardChoiceScreen`、`RunShellScreen`、`BattleReplayScreen`、`RunSettlementScreen`、`AccountHistoryScreen`、`AccountShopScreen`、`AchievementsScreen`、`AccountSettingsScreen`、`LeaderboardsScreen`、`ApexScreen`、`SeasonScreen`、`DogfightRoomsScreen`、`DogfightRoomDetailScreen`。
- 大量 Godot smoke 测试，用于约束 Web 同构结构、路由、标签、动作、防占位、无旧屏承载等。

主要问题：

- `LegacyRunScreen` 仍在主场景中注册，并保留大量跑局、账号、历史、房间、设置和弹窗逻辑。
- `RunScreen.gd` 约 6154 行，几乎等同于 `src/App.tsx` 约 6583 行，说明旧 Godot 大屏仍承担了过多职责。
- 部分测试仍直接访问 `ScreenRoot/LegacyRunScreen`，说明验收体系尚未完全切换到独立屏幕。
- 多个独立屏幕已经实现主体，但仍存在 Web 细节未完全覆盖、重复实现和兼容路径。

## 四、功能域完整对比

### 1. 账号认证与昵称

Web 功能：

- 账号密码登录。
- 注册。
- TapTap 登录能力检测与授权码登录。
- 错误提示本地化。
- 登录后若缺昵称，进入昵称设置。
- 登出清理本地用户、run、battle、外围数据。

Godot 现状：

- `LoginScreen.gd` 支持登录、注册、TapTap 授权码、快速开始提示。
- `NicknameSetupScreen.gd` 支持昵称输入、提交、登出。
- `GameSession.gd` 已接入 `/auth/login`、`/auth/register`、`/auth/taptap`、`/profile/nickname`、`/auth/logout`。

差异与重写要求：

- 登录页视觉必须复刻 Web 的 `auth-shell`、游戏 logo、纸片面板、TapTap 提示、错误区域。
- 错误文案必须使用与 Web 一致的本地化映射。
- Loading 与按钮禁用必须与 Web 的 `action()` 行为一致，防止重复提交。
- 登出必须停止房间轮询、关闭弹窗、清空浮层、清空当前 run 与外围 payload。

### 2. Shell、顶栏与全局反馈

Web 功能：

- `Shell` 包裹多数登录后屏幕。
- `TopBar` 显示 run 信息、用户、称号、头像、货币/金币、音乐、语言、返回大厅、登出。
- `FeedbackLayer` 显示操作反馈。
- 全局错误显示在当前 Shell 内。

Godot 现状：

- `GameSession.gd` 有 Toast、Loading、ModalStack。
- 各独立屏幕局部实现标题、按钮、面板。
- 尚未形成完全等价的统一 Shell 组件。

差异与重写要求：

- 新建 Godot 原生 `WebShell` 或等价组件，所有登录后屏幕统一复用。
- 顶栏尺寸必须稳定，长昵称、长称号、不同货币值不能撑开布局。
- 音乐开关、语言选择、返回大厅、登出必须跨屏一致。
- Toast、错误、Loading、阻塞弹窗必须使用统一层级。
- `LegacyRunScreen` 中的 header、tab、外围导航不得继续作为正式 UI。

### 3. 模式大厅与新手引导

Web 功能：

- 模式大厅显示休闲、天梯、斗狗、巅峰、锁定模式。
- 当前 active run 可继续。
- 历史面板显示战绩、段位、近期 run、账号入口。
- 新手引导可自动开始、重看、跳过，并绑定锚点。

Godot 现状：

- `ModeLobbyScreen.gd` 已实现模式按钮、历史摘要、赛季历史、新手引导入口。
- `GameSession.gd` 会刷新历史和天梯数据。

差异与重写要求：

- 复刻 Web 的模式卡视觉层级、锁链锁定态、休闲按钮锚点。
- 新手引导应有与 Web 一致的步骤、锚点、文案、跳过状态和重看状态。
- 历史面板入口必须打开独立历史屏或独立历史浮层，不再走旧 `LegacyRunScreen`。
- 大厅进入休闲、天梯、斗狗、巅峰必须严格映射 Web 的 `appScreen` 分支。

### 4. 选狗与开局

Web 功能：

- 狗种列表：柴犬、萨摩耶、土狗、恶霸、狗皇帝、祖灵。
- 每只狗有名称、标签、特性、策略说明、头像。
- 幸运数字选择。
- 休闲/天梯等不同模式创建 run。

Godot 现状：

- `DogSelectScreen.gd` 独立存在。
- `GameSession.create_run()` 支持 dogType、mode、luckyNumber。

差异与重写要求：

- 狗卡必须复刻 Web 的卡片数量、锁定/占位槽、头像和特性描述。
- 幸运数字必须复刻 Web 行为，未选择时允许按 Web 默认逻辑提交。
- 创建 run 后必须按 run phase 路由到地图/商店/奖励/备战等目标屏幕。
- 天梯开局必须复刻 Web 的 `LadderHome` 与 `DogSelect` 分支关系。

### 5. 探索地图

Web 功能：

- 地图路线板。
- 节点层级、连线、可选/当前/已完成/锁定/预览状态。
- 节点详情侧栏。
- 节点选择、进入战斗、处理事件、完成节点。
- 掉落奖励预览。
- 怪物装备预览。
- 路线草稿工具：查看、画笔、橡皮、清空。
- 地图背景与地图图标资源。

Godot 现状：

- `ExplorationMapScreen.gd` 约 1120 行，已经实现地图、详情、奖励、怪物装备、背包、遗物、浮层等大量内容。
- 仍需核对 Web 细节与层级。

差异与重写要求：

- 地图节点坐标、连线方向、层级标记必须与 Web 的 `mapNodePosition`、`routePathData` 等表现一致。
- 草稿层必须位于地图节点之上但不遮挡详情、浮层、Toast 和弹窗。
- 节点详情必须支持所有 Web 节点类型：玩家战斗、怪物战斗、商店、休息、事件、未知商店等。
- 怪物装备和奖励预览必须使用正式贴纸图标和装备卡样式。
- 地图阶段允许装备调整、出售、升级、遗物查看，必须与 Web 的可操作范围一致。

### 6. 商店、装备板、背包与遗物

Web 功能：

- `ShopShelf` 显示货架、刷新、价格、折扣、已拥有数量、匹配按钮。
- `ShopCard` 显示品质、画花、尺寸、触发点数、效果、价格、金币不足。
- `FloatingTip` 显示商品/装备详情、购买、出售、升级、价格、禁用原因。
- `InventoryBoard` 显示装备栏、背包、遗物栏。
- 桌面支持拖拽。
- 移动端支持点击装备再点击目标格。
- 出售区支持拖拽出售。
- 遗物 6 槽轨道，支持详情和出售。

Godot 现状：

- `RunShopScreen.gd` 已独立实现货架、商品卡、背包、遗物栏、详情 tip、购买、刷新、匹配。
- `RunShellScreen.gd`、`RewardChoiceScreen.gd`、`ExplorationMapScreen.gd` 也有局部装备板逻辑。
- `LegacyRunScreen` 仍保留同类实现。

差异与重写要求：

- 抽出共享 `InventoryBoard`、`GridPanel`、`ItemCard`、`RelicRail`、`FloatingTip`，避免四个屏幕重复实现。
- 所有装备卡必须使用 `public/assets/sticker-icons/<id>.webp` 对应 Godot 导入资源。
- 价格标签必须与 Web 一致，例如折扣只显示 `7 · 8折`，不额外加“价格”前缀。
- 拖拽层必须独立，不能被卡片、画布或背景压住。
- 点击目标格放置、出售、升级、附魔、药水必须统一走 `GameSession` API 调用，不能本地推断最终结果。
- 长效果文本必须内部换行/截断，不得撑开装备卡或浮层。

### 7. 奖励选择

Web 功能：

- `CHOICE`：商店三选一。
- `CLASS_REWARD`：职业奖励仪式屏与选择。
- `ENCHANT_CHOICE`：附魔仪式屏、附魔选择、后续目标装备选择。
- `RELIC_CHOICE`：遗物选择、确认获得。
- `UPGRADE_CHOICE`：升级选择、可跳过。
- `POTION_CHOICE`：药水选择、后续目标装备选择，职业装备禁用。

Godot 现状：

- `RewardChoiceScreen.gd` 已覆盖主要 phase。
- 仍需核对仪式屏、目标选择、禁用态和选中态。

差异与重写要求：

- 奖励卡视觉必须复刻 Web 的 `reward-choice-grid`、`HanddrawnChoiceCard`、品质标签和说明。
- 职业奖励与附魔仪式屏必须完整保留，不得直接跳到按钮列表。
- 附魔和药水选择后，装备板必须进入目标选择状态，按钮文案和禁用原因与 Web 一致。
- 升级商店必须显示当前可升级数量和最高品质限制。
- 所有奖励完成后必须使用 API 返回的 run 路由，不本地猜下一阶段。

### 8. 备战、匹配与放弃

Web 功能：

- `PREP` 阶段显示匹配入口。
- `MATCH` 阶段显示对手摘要与开始战斗。
- 备战阶段可以调整装备、查看遗物、升级。
- `ForfeitRunAction` 提供放弃并结算当前跑局的确认入口。

Godot 现状：

- `RunShellScreen.gd` 已实现 PREP/MATCH 面板和装备板。
- 放弃确认部分仍需核对是否完全脱离旧屏。

差异与重写要求：

- PREP/MATCH 屏必须使用统一 Shell 顶栏和 Web 同构面板。
- 对手摘要必须显示狗种、胜负、回合、装备快照。
- 放弃确认必须用全局 ConfirmLayer，防重复点击，成功后进入结算或大厅。
- 匹配和开始战斗按钮的 Loading、Toast、错误必须与 Web `action()` 语义一致。

### 9. 战斗回放

Web 功能：

- `BattleView` 包含战斗工具栏、速度控制、状态、继续按钮。
- `BattleStage` 显示双方狗、血条、护盾、状态、骰子。
- `BattleEquipmentRow` 显示双方装备，支持触发高亮、目标高亮、成长数值、爆鸣/冻结/蓄水等特殊 UI。
- `BattleFxStage` 使用 canvas 播放投射物/数字/闪光等特效。
- `StatusFloatingTip` 支持状态详情。
- `CollapsedBattleLog` 支持展开/收起和日志分类。
- 结算完成后可显示 `SettlementView`。

Godot 现状：

- `BattleReplayScreen.gd` 存在，负责播放战斗事件。
- 需要重点核对与 Web 战斗表现一致性。

差异与重写要求：

- 双方装备行必须复刻 Web 的槽位数量、装备卡视觉、触发高亮、目标高亮和特殊计数器。
- 状态 chip 必须支持正面/负面、堆叠、持续时间、点击详情。
- 战斗速度、暂停/继续、跳过、重播、完成结算必须与 Web 操作一致。
- 战斗日志必须支持分类过滤：全部、伤害、回复/护盾、状态、装备。
- 特效层必须低于 HUD、按钮、日志、浮层和弹窗。
- 战斗回放必须只播放服务端事件，不重新模拟结果。

### 10. 结算与战报复盘

Web 功能：

- `SettlementView` 显示胜负、分数、胜负数、回合、奖励和返回大厅。
- 支持隐藏/显示结算。
- `BattleReviewDashboard` 显示双方伤害、治疗、护盾、毒伤、状态次数、关键装备。
- 天梯有结算摘要和公式展示。

Godot 现状：

- `RunSettlementScreen.gd` 已实现指标、战报统计、天梯摘要。

差异与重写要求：

- 结算背景、卡片、隐藏/显示按钮必须与 Web 一致。
- 战报统计口径必须与 Web `battleReview` 一致，不能另算出不同结果。
- 天梯结算文案、段位、分数变化和公式说明必须一致。
- 返回大厅后必须清空当前 run 或按 Web 的状态刷新行为执行。

### 11. 历史、快照与账号面板

Web 功能：

- 大厅个人战绩面板。
- 历史详情 Overlay：模式 tab、历史 run 列表、选中 run 详情、装备预览、背包摘要。
- 快照查看：巅峰/赛季/历史装备与遗物。

Godot 现状：

- `AccountHistoryScreen.gd`、`ModeLobbyScreen.gd` 已覆盖部分功能。
- 旧屏仍有历史弹窗与快照弹窗逻辑。

差异与重写要求：

- 历史详情应作为独立屏或全局 Overlay，不能继续由 `LegacyRunScreen` 承载。
- 历史装备预览必须复用战斗装备行/装备卡组件。
- 快照物品与遗物详情必须复用统一详情浮层。
- 模式 tab、空状态、选中状态必须与 Web 一致。

### 12. 账号商城与外观设置

Web 功能：

- 账号商城按外观类型分组。
- 显示余额、稀有度、拥有态、装备态。
- 购买、装备。
- 设置页显示已拥有外观和默认外观，支持装备/卸下。

Godot 现状：

- `AccountShopScreen.gd`、`AccountSettingsScreen.gd` 已独立。
- 最近提交显示正在对齐价格和货币胶囊。

差异与重写要求：

- 商品卡必须复刻 Web 稀有度、类型标签、价格、已拥有/已装备按钮。
- 购买失败、余额不足、重复点击必须与 Web 一致。
- 默认外观卡必须显示“默认 · 免费”，并支持装备态。
- 购买后必须刷新 `/cosmetics/me`。

### 13. 成就与每日任务

Web 功能：

- 成就分类 tab。
- 成就卡隐藏、可领取、已完成、进度。
- 每日任务显示日期、刷新按钮、刷新禁用、领取。
- 领取后刷新钱包和列表。

Godot 现状：

- `AchievementsScreen.gd` 已独立。

差异与重写要求：

- 成就分类、隐藏成就、claimable 样式必须与 Web 一致。
- 每日任务刷新只允许一次，刷新按钮禁用态必须一致。
- 领取和刷新必须有 Toast 和 Loading 防重复提交。

### 14. 天梯、巅峰、赛季

Web 功能：

- 天梯首页、狗王板、段位、近期结算。
- 巅峰候选 run、提交报告、巅峰榜、配置详情。
- 赛季当前信息、赛季历史、赛季快照。

Godot 现状：

- `LeaderboardsScreen.gd`、`ApexScreen.gd`、`SeasonScreen.gd` 已独立。

差异与重写要求：

- 所有榜单卡、快照详情、空状态、提交状态必须与 Web 一致。
- 快照装备/遗物详情必须复用统一详情组件。
- 天梯开局入口必须与 Web 的 `LADDER` 分支一致。

### 15. 多人斗狗房间

Web 功能：

- 房间列表、创建、加入、随机匹配。
- 房间详情：工具栏、状态、阶段轨道、倒计时、玩家席位、生存面板。
- 选狗阶段、商店阶段、战斗阶段。
- 准备、完成本回合。
- 观战与战报查看。
- 房间轮询绑定当前房间生命周期。

Godot 现状：

- `DogfightRoomsScreen.gd`、`DogfightRoomDetailScreen.gd` 已独立。
- `GameSession.dogfight_room_request()` 已处理房间请求与 payload。
- 仍需核对轮询生命周期和战斗观战与 Web 一致性。

差异与重写要求：

- 离开房间必须停止旧轮询。
- 切屏必须停止旧房间详情刷新。
- 阶段轨道、倒计时、玩家状态、准备按钮必须与 Web 一致。
- 斗狗房间内的商店/装备/战斗复用单人跑局组件，但房间 action 走房间 API。
- 观战战斗必须复用 `BattleReplayScreen`，并保留返回房间详情。

### 16. 本地化与规则词条

Web 功能：

- 中英文切换。
- 装备、遗物、规则词条、战斗日志、本地化错误。
- 规则词条可点击显示浮层说明。

Godot 现状：

- Godot 文本多为中文，部分文件存在编码显示异常风险。
- 尚未完整确认规则词条浮层。

差异与重写要求：

- Godot 必须统一使用 UTF-8 保存中文文本。
- 长期目标应迁移 Web 的字典与规则词条到可复用数据源，避免手写分叉。
- 规则词条浮层必须可点击、可关闭、不遮挡关键按钮。

### 17. 音效、音乐与资源加载

Web 功能：

- 背景音乐开关。
- Toast/操作反馈音。
- 图片异步加载，图标、背景、贴纸资源分布在 `public/assets`。

Godot 现状：

- `FeedbackSoundBus.gd`、音频资源已存在。
- Godot 已复制部分 `public/assets` 到 `godot-client/assets`。

差异与重写要求：

- 资源导入必须有清单或脚本，避免手工漏同步。
- 新增装备/遗物必须同步 128x128 透明 WebP 贴纸图标和 Godot 导入资源。
- 首屏、大厅、地图、商店、战斗不得一次性加载无关大图。
- 背景音乐开关必须保存偏好并与 Web 行为一致。

## 五、全量重写架构

### 1. Godot 目录结构目标

目标结构：

```text
godot-client/
  scripts/
    api/
    state/
    router/
    ui/
      shell/
      shared/
      screens/
      battle/
      inventory/
      map/
      shop/
      rewards/
      account/
      dogfight/
      web/
    tests/
  scenes/
    shell/
    shared/
    screens/
    overlays/
  assets/
```

`RunScreen.gd` 不再是正式 UI 容器。新代码必须进入更小的领域组件。

### 2. 共享组件

必须优先建立以下共享组件，减少重复：

- `WebShell`：统一顶栏、返回大厅、登出、错误、音乐、语言。
- `WebScreenHeading`：统一标题、eyebrow、描述、右侧资源胶囊。
- `WebActionButton`、`WebIconButton`：统一按钮样式、禁用、Loading。
- `ResourcePill`：金币、货币、胜负、回合、段位。
- `ItemCard`：装备卡。
- `RelicGlyph`、`RelicRail`：遗物图标与 6 槽轨道。
- `GridPanel`、`Slot`：装备栏和背包槽位。
- `InventoryBoard`：装备栏、背包、遗物栏组合。
- `FloatingTip`：装备/商品详情。
- `RelicFloatingTip`：遗物详情。
- `ConfirmDialog`：阻塞确认。
- `MapRouteBoard`：地图节点、连线、草稿层。
- `BattleEquipmentRow`：战斗装备行。
- `BattleDogPanel`：战斗狗、血条、护盾、状态。
- `BattleLogPanel`：战斗日志和筛选。
- `SnapshotPanel`：历史、赛季、巅峰快照查看。

### 3. 路由模型

Godot 路由必须映射 Web 的 `appScreen` 与 `run.phase`：

```text
未登录 -> login
缺昵称 -> nickname_setup
LOBBY -> mode_lobby
SHOP(appScreen) -> account_shop
ACHIEVEMENTS -> achievements
SETTINGS -> account_settings
LADDER 且无天梯 run -> leaderboards / dog_select
DOGFIGHT -> dogfight_rooms / dogfight_room_detail
PEAK -> apex
选狗 -> dog_select

run.phase MAP -> exploration_map
run.phase CHOICE -> reward_choice
run.phase CLASS_REWARD -> reward_choice
run.phase ENCHANT_CHOICE -> reward_choice
run.phase RELIC_CHOICE -> reward_choice
run.phase UPGRADE_CHOICE -> reward_choice
run.phase POTION_CHOICE -> reward_choice
run.phase SHOP -> run_shop
run.phase PREP -> run_shell
run.phase MATCH -> run_shell
run.phase BATTLE -> battle_replay
run.phase COMPLETE -> run_settlement
```

正式验收时，以上任一路由不得进入 `LegacyRunScreen`。

### 4. 状态模型

`GameSession` 仍保留为顶层协调器，但需要瘦身：

- API 调用集中在 `GameSession` 或领域 service。
- UI 屏幕只调用明确的 session 方法。
- `RunStore` 保存当前 run。
- `AccountStore` 保存用户、钱包、外观。
- 房间、历史、赛季、排行、巅峰数据应拆出对应 store 或 payload cache。
- 所有状态改变以 API 返回结果为准。

### 5. Layer 层级

Godot 必须显式规划层级：

1. 背景层。
2. 主屏幕内容层。
3. 拖拽层。
4. 地图草稿层。
5. 战斗特效层。
6. 浮层提示层。
7. Toast 层。
8. 普通弹窗层。
9. 阻塞确认层。
10. 全局 Loading / 断线重连层。

UI 修改前后必须检查层级，特别是地图、战斗、商店、背包、弹窗、拖拽和提示。

## 六、实施阶段

### 阶段 0：基线冻结与对比测试

目标：

- 固定当前 Web 功能清单。
- 固定当前 Godot 可运行基线。
- 建立“不得走 LegacyRunScreen”的最终验收测试，但初期允许标记为待迁移清单。

产出：

- Web 功能矩阵。
- Godot 屏幕矩阵。
- API 路由矩阵。
- 资源同步矩阵。
- Legacy 依赖清单。

验收：

- 所有矩阵列出责任文件和测试文件。
- 不改变游戏行为。

### 阶段 1：Web Shell 与共享组件重建

目标：

- 建立统一 Shell、顶栏、按钮、资源胶囊、弹窗、Toast、Loading、浮层、拖拽层。
- 所有独立屏幕使用共享组件。

优先文件：

- `godot-client/scripts/ui/shell/**`
- `godot-client/scripts/ui/shared/**`
- `godot-client/scenes/overlays/OverlayRoot.tscn`
- `godot-client/scripts/state/GameSession.gd`

验收：

- 登录后任意正式屏幕都有同构顶栏。
- Toast、Loading、Modal、Confirm、Tip 层级正确。
- 长昵称、长文本、Loading、禁用态不造成布局跳动。

### 阶段 2：跑局核心屏幕重写

目标：

- 重写 `ExplorationMapScreen`、`RunShopScreen`、`RewardChoiceScreen`、`RunShellScreen`、`RunSettlementScreen`。
- 抽出并复用 Inventory、Item、Relic、Tip 组件。
- 跑局主流程不再依赖 `LegacyRunScreen`。

验收：

- 休闲模式从选狗到完成一局，所有正式路由都进入独立屏幕。
- 地图、商店、奖励、备战、结算主要 Web 结构一致。
- 拖拽、点击目标格、出售、升级、药水、附魔均通过 API 刷新。

### 阶段 3：战斗回放重写

目标：

- 重写战斗 HUD、装备行、状态、骰子、日志、速度、特效。
- 只播放服务端事件。

验收：

- 战斗回放对齐 Web 的主要视觉和交互。
- 状态详情、日志筛选、装备触发、继续结算可用。
- 特效层不遮挡 HUD 和按钮。

### 阶段 4：外围系统重写

目标：

- 历史、账号商城、成就每日、设置、天梯、巅峰、赛季全部脱离 Legacy。
- 快照查看和详情浮层复用共享组件。

验收：

- 所有外围入口从大厅进入独立屏幕。
- 购买、装备、领取、刷新、提交、快照查看全部可用。
- 旧 `LegacyRunScreen` 不再承载外围页面。

### 阶段 5：多人斗狗重写

目标：

- 房间列表、房间详情、选狗、准备、轮询、观战、战报对齐 Web。
- 房间内跑局复用阶段 2/3 组件。

验收：

- 创建、加入、随机匹配、开始、选狗、准备、战斗观战、下一轮可用。
- 切屏/离开房间停止旧轮询。
- 房间战斗复用 `BattleReplayScreen`。

### 阶段 6：Legacy 退场与最终一致性验收

目标：

- 正式路由完全移除 `LegacyRunScreen`。
- 删除或隔离旧大屏。
- 测试全部切换到独立屏幕。

验收：

- `WebUiScreenIds.PLAYABLE_RUN` 不再作为正式 fallback。
- `GameSession` 不再调用 `_show_playable_run_screen()` 处理正式流程。
- Godot smoke 覆盖所有 Web 功能域。
- `npm run build` 成功，单文件可玩版本同步。
- Godot headless 核心 smoke 全部通过。

## 七、测试策略

### 1. Godot 单屏 smoke

每个屏幕至少有：

- 场景可加载测试。
- 空状态测试。
- 典型 payload 渲染测试。
- 主要按钮存在和禁用态测试。
- 主要 API action 请求路径测试。
- 不显示 `PlaceholderPanel` 测试。
- 不显示 `LegacyRunScreen` 测试。

### 2. 路由测试

覆盖：

- 登录状态。
- 缺昵称状态。
- appScreen 分支。
- run phase 分支。
- battle 存在/不存在。
- 房间列表/房间详情。
- 返回大厅。
- 登出清理。

### 3. UI 层级与尺寸测试

覆盖：

- Toast 高于内容，不遮挡阻塞弹窗。
- Tip 高于主内容，不被地图/商店/战斗层压住。
- DragLayer 高于主内容。
- BattleFxLayer 不遮挡 HUD、日志、按钮和弹窗。
- 长文本、空状态、Loading、禁用态、不同数量内容不撑开关键布局。

### 4. 端到端 smoke

覆盖：

- 注册/登录/昵称。
- 休闲完整一局。
- 天梯开局与结算。
- 地图节点选择与奖励。
- 商店购买、刷新、出售。
- 奖励选择、附魔、药水、升级、遗物。
- 战斗开始、回放、完成、结算。
- 成就/每日领取与刷新。
- 账号商城购买与装备。
- 多人房间创建、加入、选狗、准备、战斗。

### 5. 构建测试

凡是修改 Godot UI、前端展示、资源、游戏行为或打包逻辑，交付前必须运行：

```powershell
npm run build
```

如果只修改本规格文档，可以不运行构建，但最终回复必须说明原因。

## 八、风险与约束

### 风险 1：范围极大

全量重写覆盖几乎整个客户端。必须按阶段交付，不能一次性改所有屏幕。

### 风险 2：双轨逻辑分叉

独立屏幕和 `LegacyRunScreen` 同时存在时，容易出现同一功能两套行为。解决方式是阶段性移除正式路由对 Legacy 的依赖，并逐步删除旧测试。

### 风险 3：视觉一致性难以自动判断

Godot 原生控件无法 1:1 复刻 CSS，但必须复刻玩家可见的结构、层级、尺寸和状态。需要结合 smoke 测试、截图检查和人工验收。

### 风险 4：资源同步遗漏

Web 使用 `public/assets`，Godot 使用 `godot-client/assets`。新增装备、遗物、背景或图标必须有同步规则和测试。

### 风险 5：编码问题

当前部分 Godot 文档或 GDScript 文本在终端中显示为乱码。后续重写必须统一 UTF-8，避免中文文案不可审阅。

## 九、最终验收标准

Godot 版视为与 Web 版功能一致，必须同时满足：

- 玩家从登录到完成一局的主流程与 Web 屏幕顺序一致。
- 所有 Web appScreen 都有 Godot 独立屏幕承载。
- 所有 run phase 都有 Godot 独立屏幕承载。
- 所有正式路由不再进入 `LegacyRunScreen`。
- 商店、装备、背包、遗物、地图、奖励、战斗、结算、多人与外围系统的主要交互可用。
- 所有状态改变由 API 返回结果决定。
- UI 层级不遮挡，核心容器尺寸稳定。
- 装备/遗物图标使用正式 WebP 贴纸资源。
- Godot headless smoke 全部通过。
- `npm run build` 成功，`dist-click/DogFight-standalone.cmd` 同步生成。
- 若涉及数值或平衡改动，同步更新外部 Excel；本规格本身不涉及数值。

## 十、建议的下一步计划

本规格通过后，下一步不直接修改所有代码，而是创建第一份实现计划：

**计划名称：Godot Web 全量重写阶段 0 与阶段 1 基座计划**

范围：

- 固定矩阵。
- 建立 Legacy 依赖清单。
- 新建 Shell 与共享组件骨架。
- 统一 Overlay 层级。
- 将一到两个低风险屏幕切换到新 Shell 验证架构。

暂不在第一阶段处理：

- 战斗特效细节。
- 多人房间完整流程。
- 全部地图草稿工具。
- 删除 `LegacyRunScreen`。

这样可以先把架构方向坐实，再逐域迁移，避免全量重写在第一步就失控。

