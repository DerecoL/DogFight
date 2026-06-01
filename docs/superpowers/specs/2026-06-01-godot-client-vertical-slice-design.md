# Godot 客户端竖切 Demo 设计说明

## 目标

本阶段目标是为《狗骰乱斗》新增一个 Godot 客户端竖切 Demo，用最小闭环验证“Godot 负责客户端表现，现有 Web 服务端继续负责权威规则和存档”的路线是否可行。

竖切 Demo 不是完整替换当前 React/Vite Web 客户端，也不迁移战斗、商店、地图、账号或数据库规则。它只验证一条可玩的核心链路：连接现有 API、读取跑局、进行基础装备操作、开始战斗、播放服务端战斗事件、回到下一阶段。

## 范围

本阶段包含：

- 新增独立 Godot 4.x 客户端工程目录，优先面向 Windows 桌面调试。
- 通过 HTTP 连接现有 Fastify API，API 基础地址可配置，默认连接本地开发服务。
- 支持最小账号入口：优先复用现有账号密码登录接口；若本地已有测试账号，可直接登录并保持 cookie 或 token 会话。
- 支持创建或读取当前跑局，并展示 `publicRun` 中的核心字段。
- 支持展示装备栏、背包、商店商品和基础资源信息。
- 支持基础装备拖拽或点击移动，调用现有装备移动、购买、出售、刷新等 API 中的必要子集。
- 支持匹配并开始战斗，播放服务端返回的 `BattleResult.events`。
- 支持战斗播放结束后调用结算接口，并刷新到下一阶段。

本阶段不包含：

- 不迁移 TypeScript 战斗模拟逻辑到 GDScript 或 C#。
- 不迁移 Prisma 数据库、Fastify 路由或线上部署结构。
- 不重做完整多人房间、排行榜、账号商店、成就、每日任务和 TapTap 登录。
- 不一次性复刻 Web 客户端全部视觉细节、手绘特效、音效和复杂动画。
- 不替换当前 Web 客户端；Web 版与 Godot Demo 并存。

## 推荐架构

采用“薄 Godot 客户端 + 现有权威服务端”的架构。

Godot 客户端负责：

- 场景组织、UI 展示、输入交互、战斗回放表现。
- 维护当前屏幕状态、选中状态、拖拽状态和播放进度。
- 将用户操作转换为 API 请求。
- 使用 API 响应整体刷新本地展示状态。

现有服务端负责：

- 登录、会话、用户资料。
- 跑局创建、阶段流转、地图节点、商店、装备位置、奖励、遗物、附魔、药水。
- 匹配、战斗模拟、战斗结果、战斗结算。
- 存档、赛季、天梯、狗王赛和多人房间的权威数据。

核心原则是：Godot 不自行计算会影响结果的规则。任何会改变金币、装备、胜负、阶段、奖励或存档的数据，都必须由服务端返回后再展示。

## 工程结构

建议新增目录：

```text
godot-client/
  project.godot
  scenes/
    Main.tscn
    LoginScreen.tscn
    RunScreen.tscn
    BattleReplayScreen.tscn
  scripts/
    api/
      ApiClient.gd
      ApiTypes.gd
    state/
      GameSession.gd
      RunStore.gd
    ui/
      LoginScreen.gd
      RunScreen.gd
      EquipmentGrid.gd
      ShopPanel.gd
      BattleReplayScreen.gd
  assets/
    icons/
    dogs/
```

资源复用优先级：

- 第一阶段可以复用 `public/assets` 中已有图片资源，避免重做美术。
- 装备和遗物 icon 优先引用现有 WebP 贴纸资源。
- 若 Godot 导入 WebP 存在兼容或体积问题，再批量转换为 Godot 更适合的导入格式，但转换脚本和产物要保持可重复。

## 数据流

登录流程：

1. Godot 收集账号和密码。
2. 调用 `POST /api/auth/login`。
3. 保存会话 cookie 或服务端返回的登录状态。
4. 调用 `GET /api/me` 校验当前用户。

跑局流程：

1. 调用历史或当前跑局接口读取可继续的 run。
2. 没有可用 run 时调用 `POST /api/runs` 创建新 run。
3. 将服务端返回的 `run` 保存到 `RunStore`。
4. UI 只从 `RunStore` 渲染，不直接伪造权威数据。

商店和装备流程：

1. 用户购买、出售、刷新、移动装备时，Godot 调用对应 API。
2. 成功后用 API 返回的 `run` 替换本地 `RunStore`。
3. 失败时展示服务端错误，不在本地强行修正数据。

战斗流程：

1. `PREP` 阶段调用匹配接口。
2. `MATCH` 阶段调用开始战斗接口。
3. 服务端返回 `BattleResult` 后进入 `BattleReplayScreen`。
4. Godot 按 `events` 的 `time` 和结构化字段播放回放。
5. 播放结束后调用战斗结算接口，刷新下一阶段。

## UI 与交互设计

第一阶段 UI 以功能闭环为主，不追求完整复刻 Web 版。

主要界面：

- `LoginScreen`：账号、密码、登录按钮、错误提示。
- `RunScreen`：顶部资源栏，中部装备栏和背包，右侧或底部商店，底部阶段操作按钮。
- `BattleReplayScreen`：双方头像/名称/血量、当前骰点、装备触发列表、战斗日志、播放/加速/跳过按钮。

装备操作第一阶段可采用两级实现：

- 优先实现点击选中装备，再点击目标格子移动，降低 Godot 拖拽调试成本。
- 如果点击移动稳定，再补充拖拽交互。

UI 尺寸需要稳定：

- 装备格、商店条目、战斗日志和按钮使用固定或最小尺寸。
- 长文本在内部换行、截断或滚动，不撑开主布局。
- 战斗特效层、提示层、拖拽层和按钮层需要明确层级，避免被面板或装备节点遮挡。

## API 适配

Godot 新增 `ApiClient.gd`，统一处理：

- API 基础地址。
- JSON 编码和解码。
- cookie 或会话头保存。
- 错误响应解析。
- 请求中的 loading 状态。

第一阶段需要覆盖的接口以现有 Web 客户端调用为准，优先包括：

- `POST /api/auth/login`
- `GET /api/me`
- `POST /api/runs`
- 跑局读取或历史读取接口
- 装备移动接口
- 商店购买、出售、刷新接口
- `POST /api/runs/:runId/battle/match`
- `POST /api/runs/:runId/battle/start`
- `POST /api/runs/:runId/battle/finish`

如果某些 Web 客户端行为目前只在 React 内部组合完成，需要先确认服务端是否已有稳定接口。缺接口时优先补小型服务端接口，而不是在 Godot 复制复杂状态推导。

## 战斗回放

Godot 不重新模拟战斗，只播放服务端返回的事件。

第一阶段回放规则：

- 以 `BattleResult.events` 作为唯一输入。
- 根据 `event.time` 推进播放，也支持跳过到最后。
- `ROLL` 事件更新骰子显示。
- `ITEM`、`POISON`、`END` 事件更新日志和当前血量。
- 使用 `playerHp`、`opponentHp`、`playerMaxHp`、`opponentMaxHp` 渲染血条。
- 使用 `itemId`、`targetItemId`、`effectType`、`amount` 做最小触发高亮。

复杂粒子、飞行特效、音效和高级镜头不是第一阶段目标。第一阶段只需要清楚表达事件顺序、来源、目标和数值变化。

## 测试与验证

第一阶段验证重点：

- 本地 API 服务启动后，Godot 能登录并读取用户。
- Godot 创建或读取 run 后，展示阶段、金币、装备、商店数据正确。
- 购买、移动、出售、刷新成功后，本地 UI 与服务端返回一致。
- 战斗开始后能播放完整 `BattleResult.events`，不会卡死或空白。
- 结算后能进入下一阶段。
- Web 版现有测试不被破坏。

需要保留现有项目验证：

- 如果只新增 Godot 工程和文档，不改 Web/服务端代码，可以不运行 `npm run build`。
- 一旦修改服务端接口、共享数据、资源路径或 Web 构建逻辑，必须运行 `npm run build`。
- 一旦修改装备、遗物、战斗数值或平衡模型，必须同步更新外部数值 Excel。

## 风险与取舍

主要风险：

- `src/App.tsx` 目前承载大量 UI 和流程细节，Godot 无法低成本复用这些 React 组件。
- 现有前端类型在 `App.tsx` 中重复定义较多，Godot 需要单独维护 API 数据结构映射。
- 若服务端缺少“读取当前 run”之类的清晰接口，Godot 会被迫依赖历史接口或补充新 API。
- Godot 的 cookie/session 处理和跨域行为需要单独验证，不能假设与浏览器一致。
- 图片资源导入可能影响包体和加载速度，需要控制 icon 和背景资源体积。

取舍：

- 保留服务端规则，牺牲一部分本地离线能力，换取规则一致性和迁移安全。
- 先做功能闭环，暂缓完整视觉复刻，换取更早验证 Godot 路线是否值得继续。
- Web 与 Godot 并存，短期维护两套客户端 UI，但避免一次性切换导致线上风险。

## 里程碑

第一里程碑：工程和 API 通信

- 创建 Godot 工程。
- 实现 `ApiClient`。
- 完成登录和 `GET /api/me` 验证。

第二里程碑：跑局和商店闭环

- 读取或创建 run。
- 展示装备栏、背包、商店和资源。
- 完成购买、移动、出售、刷新中的最小可玩集合。

第三里程碑：战斗回放闭环

- 完成匹配和开始战斗。
- 播放 `BattleResult.events`。
- 完成战斗结算并刷新下一阶段。

第四里程碑：体验加固

- 补充错误提示、loading、重试和跳过回放。
- 检查 UI 层级、固定尺寸、长文本和小屏适配。
- 梳理资源导入和加载性能。

## 交付定义

本阶段完成时应满足：

- Godot 客户端可以在本地连接现有 API 并完成一局核心流程。
- 服务端仍是权威状态来源。
- Web 客户端不受影响。
- 文档记录 Godot 客户端的目录、启动方式、API 配置方式和当前已覆盖功能。
- 若产生代码变更，按项目规则完成必要测试、构建、提交、合并到 `main`、上传线上并推送远端。
