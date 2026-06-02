# Godot 客户端竖切 Demo

这是《狗骰乱斗》的 Godot 4.x 客户端竖切 Demo。它只负责客户端显示、输入、HTTP 调用和战斗事件回放；账号、跑局、装备、商店、匹配、战斗模拟和结算仍由现有 Fastify API 负责。

## 启动本地服务

在仓库根目录运行：

```powershell
npm run dev
```

默认 API 地址：

```text
http://127.0.0.1:4000/api
```

## 启动 Godot 客户端

```powershell
godot --path E:\AI-GPT\DogFight\godot-client
```

如果要连接其他 API 地址：

```powershell
$env:DOGFIGHT_API_BASE_URL="https://www.torcharena.online/api"
godot --path E:\AI-GPT\DogFight\godot-client
```

## 当前覆盖范围

- 账号密码登录。
- 读取 `/api/me` 返回的 `activeRun`。
- 创建柴犬休闲跑局。
- 展示阶段、回合、金币、胜负、装备栏、背包和普通商店商品。
- 最小商店操作：购买、出售、刷新。
- 最小装备操作：选择道具并移动到背包或装备栏的 `(0,0)`。
- 阶段推进：`PREP` 匹配、`MATCH` 开始战斗、`BATTLE` 结算。
- 播放 `BattleResult.events`，显示日志、血条和骰点。

## 当前限制

- 不替换现有 Web 客户端，网页版仍可继续使用。
- 不迁移 TypeScript 战斗规则，Godot 不复制服务端规则。
- 不覆盖多人房间、排行榜、账号商店、成就、每日任务和 TapTap 登录。
- 第一版战斗表现以日志、血条、骰点为主，不复刻完整 Web 特效。
- 移动装备当前只提供固定目标 `(0,0)`，具体合法性由服务端返回结果决定。

## 验证方式

Godot CLI 可用时运行：

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/api_client_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/run_store_smoke.gd
```

仓库交付前仍需运行现有 Web/服务构建：

```powershell
npm run build
```

`npm run build` 会重新生成可直接分发的单文件版本：

```text
E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd
```
