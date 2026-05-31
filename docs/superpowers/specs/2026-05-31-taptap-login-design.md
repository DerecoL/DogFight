# TapTap 登录接入规格

## 目标

为《狗骰乱斗》接入 TapTap 小游戏登录最小闭环，让 TapTap 渠道玩家可以使用平台账号进入现有游戏账户体系，同时保持非 TapTap 渠道继续使用当前账号密码登录。

## 范围

- 新增 TapTap 登录后端接口，接收一次性 `code` 并由服务端换取 `openid`、`unionid` 和 `session_key`。
- 新增第三方身份绑定表，把 TapTap 身份映射到现有 `User`。
- 新增前端 TapTap 渠道登录入口，仅在 TapTap 渠道和 TapTap 运行环境中触发。
- 保留现有账号密码注册和登录流程，不改变普通 Web 渠道行为。

## 非目标

- 本轮不接入 TapTap 云存档、排行榜、支付、广告、分享或内部分包加载。
- 本轮不重构整套账号系统，不迁移已有账号数据。
- 本轮不要求在代码中保存真实 TapTap 密钥；密钥通过线上环境变量配置。

## 后端设计

新增配置项：

- `TAPTAP_MINIAPP_ID`
- `TAPTAP_MINIAPP_SECRET`
- `TAPTAP_MINIAPP_REGION`，默认 `cn`，可选 `cn` 或 `io`

新增服务模块负责 TapTap 换码：

- 国内请求 `https://cloud-miniapp.tapapis.cn/auth/v1/jscode2session`
- 国际请求 `https://cloud-miniapp.tapapis.com/auth/v1/jscode2session`
- 请求参数为 `appid`、`secret`、`js_code`、`grant_type=authorization_code`
- 换码失败时返回明确错误，不泄露密钥或 session_key

新增接口：

- `POST /api/auth/taptap`
- 入参：`{ "code": "..." }`
- 成功后复用当前 JWT cookie 登录态，返回 `{ user, needsNickname }`
- 首次登录自动创建本地用户，账号名使用稳定前缀，例如 `taptap:<openid>`
- 再次登录复用同一用户

`session_key` 只允许保存在服务端或暂不落库，本轮不下发给客户端。

## 数据模型

新增 `UserIdentity`：

- `id`
- `userId`
- `provider`
- `providerUserId`
- `unionId`
- `sessionKey`
- `createdAt`
- `updatedAt`

唯一约束：

- `(provider, providerUserId)`

这样后续可继续扩展微信、Apple 或其他渠道身份。

## 前端设计

新增 TapTap 平台适配逻辑：

- 构建变量 `VITE_CHANNEL=taptap` 时启用 TapTap 登录。
- 通过 `globalThis.tap` 检测 TapTap 小游戏 API 是否存在。
- 未登录状态下，TapTap 渠道优先展示“TapTap 登录”按钮。
- 登录流程先尝试 `tap.checkSession()`，再调用 `tap.login()` 获取 `code`，把 `code` 发给 `/api/auth/taptap`。
- 普通 Web 渠道继续展示账号密码登录/注册。

## 错误处理

- 前端没有 TapTap API 时显示当前账号密码登录，不阻塞 Web 调试。
- `tap.login()` 失败时显示“TapTap 登录失败，请重试”。
- 后端缺少 TapTap 配置时返回 503。
- TapTap 换码返回错误时返回 401。

## 测试要求

- 后端测试：
  - 配置解析支持 TapTap 环境变量。
  - 换码成功时创建本地用户和身份绑定。
  - 同一个 `openid` 重复登录复用同一用户。
  - 换码失败返回 401。
- 前端测试：
  - TapTap 渠道存在 `tap` API 时出现 TapTap 登录入口。
  - 普通 Web 渠道仍显示账号密码登录。

## 交付要求

- 代码修改后运行 `npm run build`，同步生成单文件可玩版本。
- 本轮不修改装备、遗物或战斗数值，因此不更新外部数值 Excel。
- 完成后按项目规则合并到 `main`、上传线上并推送远端。
