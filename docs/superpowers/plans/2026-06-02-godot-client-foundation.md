# Godot 客户端底座 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 `godot-client` 竖切 Demo 扩展为可承载正式 Beta 的客户端底座，包括 API 路由表、请求状态、Store 边界、屏幕路由、弹窗栈、Toast、基础 UI Kit、响应式布局工具和 smoke 测试。

**Architecture:** 保留现有 `ApiClient.gd`、`GameSession.gd`、`RunStore.gd` 和三个竖切屏幕，但把 `GameSession` 中混在一起的 API 调用、状态管理和屏幕切换逐步拆到专门模块。第一阶段不新增账号商城、成就、排行榜或多人业务 UI，只建立后续阶段可复用的工程边界。

**Tech Stack:** Godot 4.x、GDScript、HTTPRequest、CanvasLayer、Control、现有 Fastify API、现有 Godot headless smoke、PowerShell、`npm run build` 作为共享仓库交付验证。

---

## Scope Check

本计划只覆盖规格中的“阶段一：客户端底座”。它不实现账号商城、成就、每日任务、排行榜、赛季、多人与完整跑局 UI。原因是这些业务属于独立子系统，直接塞进同一个计划会造成不可审查的大任务。

阶段一完成后，现有竖切 Demo 仍应能登录、读 run、操作最小商店、播放战斗回放。新增底座会先被旧屏幕轻量接入，为后续阶段替换和扩展屏幕做准备。

---

## Files And Responsibilities

- Create: `godot-client/scripts/api/ApiRoutes.gd`  
  集中定义 Godot 已知 API 路径和带参数路径构造，避免 UI 或 Store 散落字符串。

- Modify: `godot-client/scripts/api/ApiClient.gd`  
  增加请求计数、超时配置、最后错误、统一 `is_loading()`，保留当前 `get_json()` 和 `post_json()` 调用方式。

- Create: `godot-client/scripts/state/AccountStore.gd`  
  保存当前用户、钱包和外观摘要的最小结构；阶段一只接入 `/api/me` 用户字段，不拉商城业务。

- Create: `godot-client/scripts/state/AppStore.gd`  
  持有 `AccountStore` 和 `RunStore`，提供统一 `user_changed`、`run_changed`、`error_raised` 信号。

- Modify: `godot-client/scripts/state/GameSession.gd`  
  作为根控制器保留，但把本地状态写入 `AppStore`，屏幕显示切换委托给 `ScreenRouter`。

- Create: `godot-client/scripts/router/ScreenRouter.gd`  
  管理 `ScreenRoot` 下屏幕显示、返回栈和当前屏幕 id。

- Create: `godot-client/scripts/router/ModalStack.gd`  
  管理弹窗层，支持 push、pop、clear 和阻塞状态。

- Create: `godot-client/scripts/router/ToastBus.gd`  
  管理短提示消息队列。

- Create: `godot-client/scripts/ui/kit/Responsive.gd`  
  根据视口宽度返回 `desktop`、`tablet`、`mobile` 断点。

- Create: `godot-client/scenes/overlays/OverlayRoot.tscn`  
  包含 Toast 层、Modal 层和 Blocking 层，后续所有弹窗和提示统一挂载。

- Modify: `godot-client/scenes/Main.tscn`  
  新增 `OverlayRoot` 实例，保留现有 Login、Run、BattleReplay 屏幕。

- Modify: `godot-client/scripts/tests/api_client_smoke.gd`  
  覆盖 `ApiRoutes`、`ApiClient.is_loading()`、`AppStore`、`ScreenRouter` 基础加载。

- Create: `godot-client/scripts/tests/router_smoke.gd`  
  验证屏幕路由、弹窗栈、Toast 队列和响应式断点。

- Modify: `godot-client/README.md`  
  记录阶段一底座模块、测试命令和当前仍未覆盖的业务范围。

---

### Task 1: API 路由表和请求状态

**Files:**
- Create: `godot-client/scripts/api/ApiRoutes.gd`
- Modify: `godot-client/scripts/api/ApiClient.gd`
- Modify: `godot-client/scripts/tests/api_client_smoke.gd`

- [ ] **Step 1: 写入失败测试，先要求 ApiRoutes 可加载并返回关键路径**

Modify `godot-client/scripts/tests/api_client_smoke.gd` by adding route loading after existing `types_script` load:

```gdscript
	var routes_script := load("res://scripts/api/ApiRoutes.gd")
	if routes_script == null:
		push_error("ApiRoutes.gd failed to load")
		quit(1)
		return
	if routes_script.login() != "/auth/login":
		push_error("ApiRoutes.login returned wrong path")
		quit(1)
		return
	if routes_script.run_battle_start("run-1") != "/runs/run-1/battle/start":
		push_error("ApiRoutes.run_battle_start returned wrong path")
		quit(1)
		return
```

- [ ] **Step 2: 运行失败测试**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/api_client_smoke.gd
```

Expected: FAIL with `ApiRoutes.gd failed to load`.

- [ ] **Step 3: 新增 ApiRoutes**

Create `godot-client/scripts/api/ApiRoutes.gd`:

```gdscript
class_name ApiRoutes
extends RefCounted

static func health() -> String:
	return "/health"

static func login() -> String:
	return "/auth/login"

static func register() -> String:
	return "/auth/register"

static func logout() -> String:
	return "/auth/logout"

static func me() -> String:
	return "/me"

static func profile_nickname() -> String:
	return "/profile/nickname"

static func runs() -> String:
	return "/runs"

static func run_detail(run_id: String) -> String:
	return "/runs/%s" % _encode_segment(run_id)

static func run_shop_buy(run_id: String) -> String:
	return "%s/shop/buy" % run_detail(run_id)

static func run_shop_sell(run_id: String) -> String:
	return "%s/shop/sell" % run_detail(run_id)

static func run_shop_reroll(run_id: String) -> String:
	return "%s/shop/reroll" % run_detail(run_id)

static func run_item_move(run_id: String) -> String:
	return "%s/items/move" % run_detail(run_id)

static func run_map_select(run_id: String) -> String:
	return "%s/map/select" % run_detail(run_id)

static func run_battle_match(run_id: String) -> String:
	return "%s/battle/match" % run_detail(run_id)

static func run_battle_start(run_id: String) -> String:
	return "%s/battle/start" % run_detail(run_id)

static func run_battle_finish(run_id: String) -> String:
	return "%s/battle/finish" % run_detail(run_id)

static func _encode_segment(value: String) -> String:
	return value.uri_encode()
```

- [ ] **Step 4: 扩展 ApiClient 请求状态**

Modify `godot-client/scripts/api/ApiClient.gd`:

```gdscript
class_name ApiClient
extends Node

signal request_started(path: String)
signal request_finished(path: String, ok: bool, status: int, payload: Dictionary)
signal loading_changed(active: bool)

var base_url := "http://127.0.0.1:4000/api"
var cookie_header := ""
var timeout_seconds := 20.0
var active_request_count := 0
var last_error := ""

func configure(next_base_url: String) -> void:
	base_url = next_base_url.rstrip("/")

func is_loading() -> bool:
	return active_request_count > 0

func request_json(method: int, path: String, body: Dictionary = {}) -> Dictionary:
	var http := HTTPRequest.new()
	http.timeout = timeout_seconds
	add_child(http)
	var headers := PackedStringArray(["Content-Type: application/json"])
	if cookie_header.length() > 0:
		headers.append("Cookie: %s" % cookie_header)
	var payload := "" if method == HTTPClient.METHOD_GET and body.is_empty() else JSON.stringify(body)
	var url := "%s%s" % [base_url, path]
	_begin_request(path)
	var start_error := http.request(url, headers, method, payload)
	if start_error != OK:
		http.queue_free()
		var failed := {"ok": false, "status": 0, "error": "请求启动失败", "data": {}}
		_finish_request(path, false, 0, failed)
		return failed
	var response: Array = await http.request_completed
	var status := int(response[1])
	var response_headers: PackedStringArray = response[2]
	var bytes: PackedByteArray = response[3]
	_capture_cookie(response_headers)
	var text := bytes.get_string_from_utf8()
	var parsed = JSON.parse_string(text)
	var data: Dictionary = parsed if parsed is Dictionary else {}
	var ok := status >= 200 and status < 300
	var result := {
		"ok": ok,
		"status": status,
		"error": "" if ok else str(data.get("error", "请求失败")),
		"data": data,
	}
	_finish_request(path, ok, status, result)
	http.queue_free()
	return result

func get_json(path: String) -> Dictionary:
	return await request_json(HTTPClient.METHOD_GET, path)

func post_json(path: String, body: Dictionary = {}) -> Dictionary:
	return await request_json(HTTPClient.METHOD_POST, path, body)

func _begin_request(path: String) -> void:
	active_request_count += 1
	if active_request_count == 1:
		loading_changed.emit(true)
	request_started.emit(path)

func _finish_request(path: String, ok: bool, status: int, payload: Dictionary) -> void:
	active_request_count = max(0, active_request_count - 1)
	last_error = "" if ok else str(payload.get("error", "请求失败"))
	request_finished.emit(path, ok, status, payload)
	if active_request_count == 0:
		loading_changed.emit(false)

func _capture_cookie(headers: PackedStringArray) -> void:
	for header in headers:
		var lower := header.to_lower()
		if lower.begins_with("set-cookie:"):
			var raw_cookie := header.substr("set-cookie:".length()).strip_edges()
			var pair := raw_cookie.split(";", false, 1)[0]
			if pair.length() > 0:
				cookie_header = pair
```

- [ ] **Step 5: 扩展 smoke 检查 ApiClient 默认状态**

Add to `godot-client/scripts/tests/api_client_smoke.gd` after `api.configure(...)`:

```gdscript
	if api.is_loading():
		push_error("ApiClient should not be loading before requests")
		quit(1)
		return
	if api.timeout_seconds <= 0:
		push_error("ApiClient timeout_seconds must be positive")
		quit(1)
		return
```

- [ ] **Step 6: 运行通过测试**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/api_client_smoke.gd
```

Expected: exit code `0`.

- [ ] **Step 7: Commit**

```powershell
git add godot-client/scripts/api/ApiRoutes.gd godot-client/scripts/api/ApiClient.gd godot-client/scripts/tests/api_client_smoke.gd
git commit -m "Add Godot API route registry"
```

---

### Task 2: AppStore 和 AccountStore

**Files:**
- Create: `godot-client/scripts/state/AccountStore.gd`
- Create: `godot-client/scripts/state/AppStore.gd`
- Modify: `godot-client/scripts/state/GameSession.gd`
- Modify: `godot-client/scripts/tests/api_client_smoke.gd`

- [ ] **Step 1: 写入失败测试，要求 AppStore 可加载**

Add to `godot-client/scripts/tests/api_client_smoke.gd`:

```gdscript
	var account_store_script := load("res://scripts/state/AccountStore.gd")
	var app_store_script := load("res://scripts/state/AppStore.gd")
	if account_store_script == null or app_store_script == null:
		push_error("Store foundation scripts failed to load")
		quit(1)
		return
	var app_store = app_store_script.new()
	app_store.set_user({"id": "user-1", "account": "tester", "nickname": "测试员"})
	if str(app_store.account.user_id()) != "user-1":
		push_error("AppStore did not update AccountStore user")
		quit(1)
		return
```

- [ ] **Step 2: 运行失败测试**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/api_client_smoke.gd
```

Expected: FAIL with `Store foundation scripts failed to load`.

- [ ] **Step 3: 新增 AccountStore**

Create `godot-client/scripts/state/AccountStore.gd`:

```gdscript
class_name AccountStore
extends RefCounted

var user: Dictionary = {}
var wallet: Dictionary = {}
var cosmetics: Dictionary = {}

func set_user(next_user: Dictionary) -> void:
	user = next_user.duplicate(true)

func set_wallet(next_wallet: Dictionary) -> void:
	wallet = next_wallet.duplicate(true)

func set_cosmetics(next_cosmetics: Dictionary) -> void:
	cosmetics = next_cosmetics.duplicate(true)

func is_logged_in() -> bool:
	return user_id().length() > 0

func user_id() -> String:
	return str(user.get("id", ""))

func account_name() -> String:
	return str(user.get("account", ""))

func display_name() -> String:
	var nickname := str(user.get("nickname", ""))
	return nickname if nickname.length() > 0 else account_name()

func currency_balance() -> int:
	return int(wallet.get("balance", 0))
```

- [ ] **Step 4: 新增 AppStore**

Create `godot-client/scripts/state/AppStore.gd`:

```gdscript
class_name AppStore
extends RefCounted

signal user_changed(user: Dictionary)
signal run_changed(run: Dictionary)
signal error_raised(message: String)

const AccountStore := preload("res://scripts/state/AccountStore.gd")
const RunStore := preload("res://scripts/state/RunStore.gd")

var account: AccountStore = AccountStore.new()
var run: RunStore = RunStore.new()
var last_error := ""

func set_user(next_user: Dictionary) -> void:
	account.set_user(next_user)
	user_changed.emit(account.user.duplicate(true))

func set_wallet(next_wallet: Dictionary) -> void:
	account.set_wallet(next_wallet)

func set_current_run(next_run: Dictionary) -> void:
	run.set_run(next_run)
	run_changed.emit(run.run.duplicate(true))

func raise_error(message: String) -> void:
	last_error = message
	error_raised.emit(message)
```

- [ ] **Step 5: GameSession 接入 AppStore，但保留旧字段兼容**

Modify top of `godot-client/scripts/state/GameSession.gd`:

```gdscript
const ApiClient := preload("res://scripts/api/ApiClient.gd")
const ApiRoutes := preload("res://scripts/api/ApiRoutes.gd")
const AppStore := preload("res://scripts/state/AppStore.gd")
const RunStore := preload("res://scripts/state/RunStore.gd")
const DEFAULT_API_BASE_URL := "http://127.0.0.1:4000/api"

var api_base_url: String = DEFAULT_API_BASE_URL
var api: ApiClient
var store: AppStore = AppStore.new()
var current_user: Dictionary = {}
var run_store: RunStore = store.run
```

Modify `login()` and `refresh_me()` to use `ApiRoutes` and `store`:

```gdscript
func login(account: String, password: String) -> bool:
	var response := await api.post_json(ApiRoutes.login(), {"account": account, "password": password})
	if not response.ok:
		store.raise_error(str(response.error))
		return false
	current_user = response.data.get("user", {})
	store.set_user(current_user)
	user_changed.emit(current_user)
	return await refresh_me()

func refresh_me() -> bool:
	var response := await api.get_json(ApiRoutes.me())
	if not response.ok:
		store.raise_error(str(response.error))
		return false
	current_user = response.data.get("user", current_user)
	store.set_user(current_user)
	user_changed.emit(current_user)
	var active_run = response.data.get("activeRun", null)
	if active_run is Dictionary:
		set_current_run(active_run)
	return true
```

Modify `set_current_run()`:

```gdscript
func set_current_run(run: Dictionary) -> void:
	store.set_current_run(run)
	run_changed.emit(run)
```

Modify existing direct `error_raised.emit(...)` calls so they call `store.raise_error(message)` and then `error_raised.emit(message)` through a helper:

```gdscript
func _raise_error(message: String) -> void:
	store.raise_error(message)
	error_raised.emit(message)
```

Then replace each `error_raised.emit("...")` or `error_raised.emit(str(response.error))` in `GameSession.gd` with `_raise_error("...")` or `_raise_error(str(response.error))`.

- [ ] **Step 6: 运行 smoke**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/api_client_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/run_store_smoke.gd
```

Expected: both exit code `0`.

- [ ] **Step 7: Commit**

```powershell
git add godot-client/scripts/state/AccountStore.gd godot-client/scripts/state/AppStore.gd godot-client/scripts/state/GameSession.gd godot-client/scripts/tests/api_client_smoke.gd
git commit -m "Add Godot app store foundation"
```

---

### Task 3: ScreenRouter

**Files:**
- Create: `godot-client/scripts/router/ScreenRouter.gd`
- Modify: `godot-client/scripts/state/GameSession.gd`
- Create: `godot-client/scripts/tests/router_smoke.gd`

- [ ] **Step 1: 写入 router smoke 失败测试**

Create `godot-client/scripts/tests/router_smoke.gd`:

```gdscript
extends SceneTree

func _init() -> void:
	var router_script := load("res://scripts/router/ScreenRouter.gd")
	if router_script == null:
		push_error("ScreenRouter.gd failed to load")
		quit(1)
		return
	var root := Control.new()
	root.name = "ScreenRoot"
	var login := Control.new()
	login.name = "LoginScreen"
	var run := Control.new()
	run.name = "RunScreen"
	root.add_child(login)
	root.add_child(run)
	var router = router_script.new()
	router.configure(root)
	router.register_screen("login", "LoginScreen")
	router.register_screen("run", "RunScreen")
	router.show_screen("login")
	if not login.visible or run.visible:
		push_error("ScreenRouter failed to show login")
		quit(1)
		return
	router.show_screen("run")
	if login.visible or not run.visible or router.current_screen_id != "run":
		push_error("ScreenRouter failed to show run")
		quit(1)
		return
	if not router.go_back() or router.current_screen_id != "login":
		push_error("ScreenRouter failed to go back")
		quit(1)
		return
	root.free()
	router.free()
	quit(0)
```

- [ ] **Step 2: 运行失败测试**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/router_smoke.gd
```

Expected: FAIL with `ScreenRouter.gd failed to load`.

- [ ] **Step 3: 新增 ScreenRouter**

Create `godot-client/scripts/router/ScreenRouter.gd`:

```gdscript
class_name ScreenRouter
extends Node

signal screen_changed(screen_id: String)

var screen_root: Node
var screens: Dictionary = {}
var current_screen_id := ""
var back_stack: Array[String] = []

func configure(root: Node) -> void:
	screen_root = root

func register_screen(screen_id: String, node_name: String) -> void:
	if screen_root == null:
		push_error("ScreenRouter.configure must be called before register_screen")
		return
	var node := screen_root.get_node_or_null(node_name)
	if node == null:
		push_error("Screen not found: %s" % node_name)
		return
	screens[screen_id] = node
	node.visible = false

func show_screen(screen_id: String, add_to_back_stack := true) -> void:
	if not screens.has(screen_id):
		push_error("Unknown screen: %s" % screen_id)
		return
	if add_to_back_stack and current_screen_id.length() > 0 and current_screen_id != screen_id:
		back_stack.append(current_screen_id)
	for id in screens.keys():
		var node: CanvasItem = screens[id]
		node.visible = id == screen_id
	current_screen_id = screen_id
	screen_changed.emit(screen_id)

func go_back() -> bool:
	if back_stack.is_empty():
		return false
	var previous := back_stack.pop_back()
	show_screen(previous, false)
	return true

func clear_history() -> void:
	back_stack.clear()
```

- [ ] **Step 4: GameSession 使用 ScreenRouter**

Modify top of `GameSession.gd`:

```gdscript
const ScreenRouter := preload("res://scripts/router/ScreenRouter.gd")
var router: ScreenRouter
```

Add to `_ready()` after API setup:

```gdscript
	var screen_root := get_node_or_null("ScreenRoot")
	if screen_root != null:
		router = ScreenRouter.new()
		add_child(router)
		router.configure(screen_root)
		router.register_screen("login", "LoginScreen")
		router.register_screen("run", "RunScreen")
		router.register_screen("battle", "BattleReplayScreen")
		router.show_screen("login", false)
```

Modify `_show_run_screen()` to use router:

```gdscript
func _show_run_screen() -> void:
	if router != null:
		router.show_screen("run")
	var run_screen := get_node_or_null("ScreenRoot/RunScreen")
	if run_screen != null and run_screen.has_method("clear_error"):
		run_screen.call("clear_error")
```

Modify `_show_battle_screen()`:

```gdscript
func _show_battle_screen(battle: Dictionary) -> void:
	if router != null:
		router.show_screen("battle")
	var battle_screen := get_node_or_null("ScreenRoot/BattleReplayScreen")
	if battle_screen != null and battle_screen.has_method("start_replay"):
		battle_screen.start_replay(battle)
```

- [ ] **Step 5: 运行 router 和现有 smoke**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/router_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/api_client_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/run_store_smoke.gd
```

Expected: all exit code `0`.

- [ ] **Step 6: Commit**

```powershell
git add godot-client/scripts/router/ScreenRouter.gd godot-client/scripts/state/GameSession.gd godot-client/scripts/tests/router_smoke.gd
git commit -m "Add Godot screen router"
```

---

### Task 4: ModalStack、ToastBus 和 OverlayRoot

**Files:**
- Create: `godot-client/scripts/router/ModalStack.gd`
- Create: `godot-client/scripts/router/ToastBus.gd`
- Create: `godot-client/scenes/overlays/OverlayRoot.tscn`
- Modify: `godot-client/scenes/Main.tscn`
- Modify: `godot-client/scripts/state/GameSession.gd`
- Modify: `godot-client/scripts/tests/router_smoke.gd`

- [ ] **Step 1: 扩展 router smoke，先要求 ModalStack 和 ToastBus 可加载**

Add to `router_smoke.gd` after `router_script` load:

```gdscript
	var modal_script := load("res://scripts/router/ModalStack.gd")
	var toast_script := load("res://scripts/router/ToastBus.gd")
	if modal_script == null or toast_script == null:
		push_error("Overlay foundation scripts failed to load")
		quit(1)
		return
```

Add queue checks before final `quit(0)`:

```gdscript
	var modal_stack = modal_script.new()
	var modal := Control.new()
	modal.name = "ConfirmModal"
	modal_stack.push_modal(modal, true)
	if modal_stack.depth() != 1 or not modal_stack.is_blocking():
		push_error("ModalStack failed to push blocking modal")
		quit(1)
		return
	modal_stack.pop_modal()
	if modal_stack.depth() != 0 or modal_stack.is_blocking():
		push_error("ModalStack failed to pop modal")
		quit(1)
		return
	var toast_bus = toast_script.new()
	toast_bus.push("保存成功", "success")
	var toast := toast_bus.pop_next()
	if str(toast.get("message", "")) != "保存成功" or str(toast.get("kind", "")) != "success":
		push_error("ToastBus failed to pop queued toast")
		quit(1)
		return
```

- [ ] **Step 2: 运行失败测试**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/router_smoke.gd
```

Expected: FAIL with `Overlay foundation scripts failed to load`.

- [ ] **Step 3: 新增 ModalStack**

Create `godot-client/scripts/router/ModalStack.gd`:

```gdscript
class_name ModalStack
extends Node

signal stack_changed(depth: int, blocking: bool)

var modal_root: Node
var stack: Array[Node] = []
var blocking_flags: Array[bool] = []

func configure(root: Node) -> void:
	modal_root = root

func push_modal(modal: Node, blocking := false) -> void:
	if modal_root != null and modal.get_parent() == null:
		modal_root.add_child(modal)
	stack.append(modal)
	blocking_flags.append(blocking)
	_emit_change()

func pop_modal() -> Node:
	if stack.is_empty():
		return null
	var modal := stack.pop_back()
	blocking_flags.pop_back()
	if modal != null and modal.get_parent() != null:
		modal.get_parent().remove_child(modal)
		modal.queue_free()
	_emit_change()
	return modal

func clear() -> void:
	while not stack.is_empty():
		pop_modal()

func depth() -> int:
	return stack.size()

func is_blocking() -> bool:
	return blocking_flags.any(func(value: bool) -> bool: return value)

func _emit_change() -> void:
	stack_changed.emit(depth(), is_blocking())
```

- [ ] **Step 4: 新增 ToastBus**

Create `godot-client/scripts/router/ToastBus.gd`:

```gdscript
class_name ToastBus
extends Node

signal toast_queued(toast: Dictionary)

var queue: Array[Dictionary] = []

func push(message: String, kind := "info", duration_seconds := 2.5) -> void:
	var toast := {
		"message": message,
		"kind": kind,
		"durationSeconds": duration_seconds,
	}
	queue.append(toast)
	toast_queued.emit(toast.duplicate(true))

func pop_next() -> Dictionary:
	if queue.is_empty():
		return {}
	return queue.pop_front().duplicate(true)

func clear() -> void:
	queue.clear()
```

- [ ] **Step 5: 新增 OverlayRoot 场景**

Create `godot-client/scenes/overlays/OverlayRoot.tscn`:

```ini
[gd_scene format=3 uid="uid://dogfight_overlay_root"]

[node name="OverlayRoot" type="CanvasLayer"]
layer = 20

[node name="ToastLayer" type="Control" parent="."]
unique_name_in_owner = true
layout_mode = 3
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
mouse_filter = 2

[node name="ModalLayer" type="Control" parent="."]
unique_name_in_owner = true
layout_mode = 3
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
mouse_filter = 2

[node name="BlockingLayer" type="ColorRect" parent="."]
unique_name_in_owner = true
visible = false
layout_mode = 3
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
mouse_filter = 0
color = Color(0, 0, 0, 0.35)
```

- [ ] **Step 6: Main 场景挂载 OverlayRoot**

Modify `godot-client/scenes/Main.tscn`:

```ini
[gd_scene load_steps=6 format=3 uid="uid://dogfight_main"]

[ext_resource type="Script" path="res://scripts/state/GameSession.gd" id="1_session"]
[ext_resource type="PackedScene" path="res://scenes/LoginScreen.tscn" id="2_login"]
[ext_resource type="PackedScene" path="res://scenes/RunScreen.tscn" id="3_run"]
[ext_resource type="PackedScene" path="res://scenes/BattleReplayScreen.tscn" id="4_battle"]
[ext_resource type="PackedScene" path="res://scenes/overlays/OverlayRoot.tscn" id="5_overlay"]
```

Add node:

```ini
[node name="OverlayRoot" parent="." instance=ExtResource("5_overlay")]
```

- [ ] **Step 7: GameSession 接入 ModalStack 和 ToastBus**

Add to `GameSession.gd`:

```gdscript
const ModalStack := preload("res://scripts/router/ModalStack.gd")
const ToastBus := preload("res://scripts/router/ToastBus.gd")

var modal_stack: ModalStack
var toast_bus: ToastBus
```

Add to `_ready()`:

```gdscript
	var overlay_root := get_node_or_null("OverlayRoot")
	if overlay_root != null:
		modal_stack = ModalStack.new()
		toast_bus = ToastBus.new()
		add_child(modal_stack)
		add_child(toast_bus)
		modal_stack.configure(overlay_root.get_node_or_null("ModalLayer"))
		modal_stack.stack_changed.connect(func(_depth: int, blocking: bool) -> void:
			var blocking_layer := overlay_root.get_node_or_null("BlockingLayer")
			if blocking_layer != null:
				blocking_layer.visible = blocking
		)
```

Modify `_raise_error()`:

```gdscript
func _raise_error(message: String) -> void:
	store.raise_error(message)
	if toast_bus != null:
		toast_bus.push(message, "error")
	error_raised.emit(message)
```

- [ ] **Step 8: 运行 smoke**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/router_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/api_client_smoke.gd
```

Expected: both exit code `0`.

- [ ] **Step 9: Commit**

```powershell
git add godot-client/scripts/router/ModalStack.gd godot-client/scripts/router/ToastBus.gd godot-client/scenes/overlays/OverlayRoot.tscn godot-client/scenes/Main.tscn godot-client/scripts/state/GameSession.gd godot-client/scripts/tests/router_smoke.gd
git commit -m "Add Godot overlay foundation"
```

---

### Task 5: Responsive 工具和基础 UI Kit 入口

**Files:**
- Create: `godot-client/scripts/ui/kit/Responsive.gd`
- Create: `godot-client/scripts/ui/kit/UiTokens.gd`
- Modify: `godot-client/scripts/tests/router_smoke.gd`

- [ ] **Step 1: 扩展失败测试，要求 Responsive 和 UiTokens 可加载**

Add to `router_smoke.gd`:

```gdscript
	var responsive_script := load("res://scripts/ui/kit/Responsive.gd")
	var tokens_script := load("res://scripts/ui/kit/UiTokens.gd")
	if responsive_script == null or tokens_script == null:
		push_error("UI kit foundation scripts failed to load")
		quit(1)
		return
	if responsive_script.breakpoint_for_width(480) != "mobile":
		push_error("Responsive mobile breakpoint failed")
		quit(1)
		return
	if responsive_script.breakpoint_for_width(1280) != "desktop":
		push_error("Responsive desktop breakpoint failed")
		quit(1)
		return
	if tokens_script.touch_target_height() < 44:
		push_error("UiTokens touch target is too small")
		quit(1)
		return
```

- [ ] **Step 2: 运行失败测试**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/router_smoke.gd
```

Expected: FAIL with `UI kit foundation scripts failed to load`.

- [ ] **Step 3: 新增 Responsive**

Create `godot-client/scripts/ui/kit/Responsive.gd`:

```gdscript
class_name Responsive
extends RefCounted

const MOBILE_MAX_WIDTH := 720
const TABLET_MAX_WIDTH := 1024

static func breakpoint_for_width(width: int) -> String:
	if width <= MOBILE_MAX_WIDTH:
		return "mobile"
	if width <= TABLET_MAX_WIDTH:
		return "tablet"
	return "desktop"

static func is_mobile_size(size: Vector2i) -> bool:
	return breakpoint_for_width(size.x) == "mobile"

static func is_desktop_size(size: Vector2i) -> bool:
	return breakpoint_for_width(size.x) == "desktop"
```

- [ ] **Step 4: 新增 UiTokens**

Create `godot-client/scripts/ui/kit/UiTokens.gd`:

```gdscript
class_name UiTokens
extends RefCounted

static func touch_target_height() -> int:
	return 48

static func panel_radius() -> int:
	return 8

static func gap_small() -> int:
	return 8

static func gap_medium() -> int:
	return 12

static func gap_large() -> int:
	return 20

static func desktop_content_max_width() -> int:
	return 1280

static func mobile_bottom_bar_height() -> int:
	return 64
```

- [ ] **Step 5: 运行 router smoke**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/router_smoke.gd
```

Expected: exit code `0`.

- [ ] **Step 6: Commit**

```powershell
git add godot-client/scripts/ui/kit/Responsive.gd godot-client/scripts/ui/kit/UiTokens.gd godot-client/scripts/tests/router_smoke.gd
git commit -m "Add Godot UI kit foundation"
```

---

### Task 6: README 和阶段一验证

**Files:**
- Modify: `godot-client/README.md`

- [ ] **Step 1: 更新 README 的覆盖范围**

Modify `godot-client/README.md` and add a new section after current coverage:

```markdown
## 正式客户端底座

Godot 客户端正在从竖切 Demo 扩展为并行 Beta。底座模块包括：

- `scripts/api/ApiRoutes.gd`：集中定义 API 路径。
- `scripts/state/AppStore.gd`：集中持有账号与跑局 Store。
- `scripts/router/ScreenRouter.gd`：管理屏幕切换和返回栈。
- `scripts/router/ModalStack.gd`：管理弹窗栈和阻塞层。
- `scripts/router/ToastBus.gd`：管理短提示队列。
- `scripts/ui/kit/Responsive.gd`：提供桌面、平板、移动断点。
- `scenes/overlays/OverlayRoot.tscn`：统一 Toast、弹窗和阻塞遮罩层。

当前阶段仍不覆盖完整账号商城、成就、每日任务、排行榜、赛季和多人房间。这些功能会在后续阶段计划中接入同一套 API、Store、Router 和 Overlay 底座。
```

- [ ] **Step 2: 运行 Godot headless smoke**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/api_client_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/run_store_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/router_smoke.gd
```

Expected: all exit code `0`.

- [ ] **Step 3: 运行本地 API 竖切 smoke**

Start local API in one terminal:

```powershell
npm run dev
```

Then run:

```powershell
godot --headless --quit-after 120 --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/vertical_slice_smoke.gd
```

Expected: exit code `0` and output includes `Godot vertical slice smoke passed`.

- [ ] **Step 4: 运行共享仓库构建**

Because this phase modifies Godot client code and repository delivery rules require current playable artifact regeneration for game-impacting client changes, run:

```powershell
npm run build
```

Expected: `guard:chains`, TypeScript build, Vite build, and standalone packaging all complete with exit code `0`.

- [ ] **Step 5: 确认不需要更新外部数值 Excel**

Run:

```powershell
git diff --name-only HEAD
```

Expected changed files are under `godot-client/` only and do not modify equipment values, relic values, battle parameters, triggers, quality multipliers, healing, shield, damage, poison, weak, control, economy prices, or balance models. Therefore do not update:

```text
C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx
```

- [ ] **Step 6: Commit**

```powershell
git add godot-client/README.md
git commit -m "Document Godot client foundation"
```

- [ ] **Step 7: 推送 main**

Run:

```powershell
git status --short --branch
git push origin main
```

Expected: `main` pushes successfully.

---

## Self-Review Checklist

- Spec coverage: this plan implements only the approved phase-one client foundation: API routes, request state, Store boundary, screen router, modal stack, toast bus, responsive utility, overlay root, README and smoke checks.
- Scope control: account shop, achievements, daily tasks, leaderboards, seasons, full run UI, battle FX and dogfight rooms remain for later phase-specific plans.
- Placeholder scan: this plan contains no unresolved placeholder markers, incomplete task, or shortcut that asks the worker to copy a previous task by analogy.
- Type consistency: `GameSession.store` is `AppStore`; `AppStore.account` is `AccountStore`; `AppStore.run` is `RunStore`; `GameSession.run_store` remains an alias to `store.run` for current screens.
- Verification: implementation must run the three Godot headless smoke scripts, the local API vertical smoke, and `npm run build` before delivery.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-02-godot-client-foundation.md`. Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.

2. **Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.

Choose one before implementation starts.
