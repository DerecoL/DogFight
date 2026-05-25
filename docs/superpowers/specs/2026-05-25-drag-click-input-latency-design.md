# 拖拽与点击反馈延迟优化设计

## 背景

当前玩家反馈的主要问题是：点击装备或商店卡后，详情反馈过一会儿才显示；拖动装备时，拖拽预览不跟手。该问题以前不明显，近期更可能是前端视觉升级带来的性能回归，而不是游戏数值或服务端逻辑问题。

已定位到两个高风险变化：

- `738cad9 Upgrade item card art visuals` 引入了装备 WebP 卡面图、`ItemArt`、`ItemFrame` 和更复杂的装备卡内容。
- `cfe678e Refine shop cards as glowing paper notes` 为商店卡加入多层 `drop-shadow`、`filter`、`clip-path` 和纸片发光效果。

当前 `DraggingItemOverlay` 复用了完整 `ItemCardContent`，拖动时会移动包含 WebP 图片、长文本、品质边框、遮罩、阴影和动画的完整装备卡。这会增加每帧合成与绘制压力。点击详情时，浮窗也会再次渲染装备卡面图，首次解码 WebP 可能导致反馈延迟。

## 目标

- 按下、点击和拖拽启动必须立即有视觉反馈。
- 拖拽预览必须跟手，移动过程不应带明显卡顿。
- 保留当前装备卡和商店卡的成熟视觉风格，但在高频交互态下主动降级绘制成本。
- 不改变装备、遗物、战斗和经济数值。
- 修改后必须运行 `npm run build`，确保单文件可玩版本同步更新。

## 非目标

- 不重做整套 UI 风格。
- 不移除已生成的装备卡面图。
- 不改服务端移动、升级、购买、出售接口语义。
- 不调整平衡模型，也不更新数值 Excel。

## 方案选择

### 推荐方案：轻量拖拽影子 + 图片预解码 + 交互态降级

该方案将输入即时反馈与业务结果反馈拆开处理。

1. 拖拽预览改为轻量 `DragGhost`，只渲染品质、名称短文本、尺寸和 SVG 小图标，不渲染 WebP 卡面图、长描述、品质 shimmer、复杂遮罩和重阴影。
2. 装备卡图片添加 `decoding="async"`，并根据可见 run 内容预解码当前商店、背包、装备栏和当前浮窗可能用到的 WebP。
3. `.dragging`、`.drag-overlay-item`、`.input-active` 等高频交互态禁用或弱化昂贵效果，包括边框动画、重 `filter`、大半径阴影和复杂遮罩。

优点：最直接命中“不跟手”和“首次点击慢”的根因，同时保留静态视觉品质。风险较低，改动集中在 `src/App.tsx`、`src/App.css` 和相关测试。

### 备选方案 A：只做图片预加载

进入商店或背包时提前加载并解码所有当前装备 WebP，让点击详情时不会等图片。

优点：改动小。缺点：无法解决拖拽 overlay 本身太重的问题，拖动不跟手可能继续存在。

### 备选方案 B：回退装备卡视觉

移除近期 WebP 卡面图和商店发光效果，恢复以前更轻量的 SVG 图标卡。

优点：性能风险最低。缺点：会牺牲最近的视觉升级，不符合当前美术方向，回退范围也更大。

## 详细设计

### 轻量拖拽预览

新增一个只用于拖拽层的组件，例如 `DraggingItemGhost`。它接收 `item`，显示：

- 品质标签；
- 装备名称；
- 装备尺寸；
- SVG 小图标；
- 简化背景色和品质边框。

拖拽层不再复用 `ItemCardContent`，也不渲染 `ItemArt`。`DragOverlay` 仍使用 `dropAnimation={null}` 和 `zIndex={1000}`，保持响应直接。

### 图片解码策略

为 `ItemArt` 内的自定义 WebP 增加：

- `decoding="async"`；
- 可保留浏览器默认加载策略，商店首屏中的图不强制 lazy，以免首屏闪烁；
- 浮窗或非首屏位置可允许异步解码，不阻塞点击反馈。

在当前 run 变化时，收集以下来源的 `artSrc`：

- `run.items`；
- `run.shopItems`；
- 当前选择/浮窗可能引用的装备或商店项。

使用 `new Image()` 创建预解码请求。如果浏览器支持 `decode()`，调用并忽略失败；不支持时只设置 `src` 让浏览器缓存。预解码应做去重，避免每次渲染重复创建请求。

### 高频交互态 CSS 降级

新增或调整 CSS：

- `.drag-overlay-item` 使用简化阴影、`will-change: transform`、`contain: paint`。
- `.drag-overlay-item::before`、`.drag-overlay-item::after` 禁用复杂品质遮罩和 shimmer。
- `.item-card.dragging` 降低透明度即可，不触发额外滤镜。
- `.item-card.input-active` 避免 `filter`，只用轻量 `transform` 和简单阴影。
- 对拖拽影子内部的图片选择器不再适用，因为拖拽影子不渲染 WebP。

### 点击反馈

点击装备或商店卡时，立即更新选择态和浮窗基本内容。图片解码不应阻塞浮窗出现；如果图片仍未准备好，先显示 SVG 小图标和色块背景。

## 测试

需要更新或新增测试：

- `src/App.drag.test.ts`：确认拖拽 overlay 使用轻量组件，不包含完整 `ItemCardContent`。
- `src/App.structure.test.ts` 或相关结构测试：确认 `ItemArt` 图片带有 `decoding="async"`。
- `src/App.css.test.ts`：确认拖拽 overlay 禁用昂贵动画或使用轻量样式。

验证命令：

- 针对性测试：`npm run test -- src/App.drag.test.ts src/App.css.test.ts src/App.structure.test.ts`
- 最终构建：`npm run build`

## 交付影响

本次后续实现会影响前端展示、资源使用方式和可玩版本，因此完成代码修改后必须运行 `npm run build`，并确认 `E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd` 是最新构建产物。

本次不改变数值和平衡模型，因此不需要更新 `C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx`。

## 风险与取舍

- 轻量拖拽影子会比完整装备卡少一些美术细节，但拖拽过程持续时间短，跟手性优先级更高。
- 预解码会提前占用少量网络和内存，但当前自定义 WebP 单张约几十 KB，且只解码当前 run 可见内容，风险可控。
- 商店发光效果保留在静态卡面上，高频拖拽和按压态优先降级，以避免交互卡顿。
