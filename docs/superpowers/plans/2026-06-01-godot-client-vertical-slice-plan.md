# Godot 客户端竖切 Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增一个独立 Godot 4.x 客户端竖切 Demo，让它通过现有 Fastify API 完成登录、读取或创建跑局、最小装备/商店操作、战斗回放和结算闭环。

**Architecture:** Godot 客户端只负责 UI、输入、HTTP 调用和战斗事件回放；现有 TypeScript/Fastify 服务端继续作为权威状态来源。Godot 每次操作后用 API 返回的 `run` 整体刷新本地 `RunStore`，不在客户端复制战斗、商店、奖励或存档规则。

**Tech Stack:** Godot 4.x、GDScript、HTTPRequest、现有 Fastify API、现有 `public/assets` WebP 资源、PowerShell 验证脚本、现有 `npm run build` 验证。

---

## Scope Check

本计划只覆盖 Godot 竖切 Demo 第一版。它不迁移服务端规则，不改数据库模型，不替换 Web 版，不实现完整多人房间、排行榜、账号商店、成就、TapTap 登录或完整视觉复刻。

若执行过程中发现现有 API 缺少必要能力，先记录缺口；只有当竖切无法继续时，才在单独任务里补最小服务端接口，并运行 `npm run build`。

## Files And Responsibilities

- Create: `godot-client/project.godot`  
  Godot 工程入口和基础窗口配置。
- Create: `godot-client/icon.svg`
  Godot 工程图标，与 `project.godot` 的 `config/icon` 保持一致。
- Create: `godot-client/scenes/Main.tscn`  
  根场景，挂载 `GameSession`，切换登录、跑局和战斗回放界面。
- Create: `godot-client/scenes/LoginScreen.tscn`  
  登录界面节点树。
- Create: `godot-client/scenes/RunScreen.tscn`  
  跑局、商店、装备栏、背包和阶段操作界面节点树。
- Create: `godot-client/scenes/BattleReplayScreen.tscn`  
  战斗回放界面节点树。
- Create: `godot-client/scripts/api/ApiClient.gd`  
  统一 HTTP 请求、JSON 编解码、cookie 保存、错误解析。
- Create: `godot-client/scripts/api/ApiTypes.gd`  
  API 响应读取工具，避免 UI 层直接写散乱字典访问。
- Create: `godot-client/scripts/state/GameSession.gd`  
  全局会话状态、当前用户、当前 run、API 基础地址。
- Create: `godot-client/scripts/state/RunStore.gd`  
  跑局状态写入、查询、装备区域筛选、商店商品筛选。
- Create: `godot-client/scripts/ui/LoginScreen.gd`  
  登录按钮、错误提示、登录成功事件。
- Create: `godot-client/scripts/ui/RunScreen.gd`  
  跑局渲染、装备选择、格子点击、购买、出售、刷新、阶段按钮。
- Create: `godot-client/scripts/ui/BattleReplayScreen.gd`  
  按 `BattleResult.events` 播放战斗日志、血条、骰点和触发高亮。
- Create: `godot-client/scripts/tests/api_client_smoke.gd`  
  Godot headless 冒烟脚本，验证工程能加载并创建核心对象。
- Create: `godot-client/scripts/tests/run_store_smoke.gd`  
  Godot headless 冒烟脚本，验证 `RunStore` 的区域筛选和商店读取。
- Create: `godot-client/README.md`  
  中文记录启动方式、API 配置、已覆盖功能和限制。
- Modify: `.gitignore`  
  忽略 Godot 导入缓存和本地覆盖配置，保留工程源文件。

---

### Task 1: Godot 工程骨架与版本控制边界

**Files:**
- Create: `godot-client/project.godot`
- Create: `godot-client/icon.svg`
- Create: `godot-client/scenes/Main.tscn`
- Create: `godot-client/scripts/state/GameSession.gd`
- Create: `godot-client/scripts/tests/api_client_smoke.gd`
- Modify: `.gitignore`

- [ ] **Step 1: 写入最小 Godot 工程配置**

Create `godot-client/project.godot`:

```ini
; Engine configuration file.
; It is best edited using the editor UI and not directly,
; since the parameters that go here are not all obvious.

config_version=5

[application]

config/name="DogFight Godot Client"
run/main_scene="res://scenes/Main.tscn"
config/features=PackedStringArray("4.2")
config/icon="res://icon.svg"

[display]

window/size/viewport_width=1280
window/size/viewport_height=720
window/size/mode=2

[rendering]

renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
```

- [ ] **Step 2: 创建工程图标**

创建 `godot-client/icon.svg`：

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#20242a"/>
  <circle cx="64" cy="64" r="42" fill="#f1c27d"/>
  <circle cx="48" cy="56" r="8" fill="#20242a"/>
  <circle cx="80" cy="56" r="8" fill="#20242a"/>
  <path d="M55 78c6 7 12 7 18 0" fill="none" stroke="#20242a" stroke-width="8" stroke-linecap="round"/>
  <path d="M30 34l16 18M98 34L82 52" fill="none" stroke="#f1c27d" stroke-width="14" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 3: 创建根场景**

Create `godot-client/scenes/Main.tscn`:

```ini
[gd_scene load_steps=2 format=3 uid="uid://dogfight_main"]

[ext_resource type="Script" path="res://scripts/state/GameSession.gd" id="1_session"]

[node name="Main" type="Control"]
layout_mode = 3
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
script = ExtResource("1_session")

[node name="ScreenRoot" type="Control" parent="."]
layout_mode = 1
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
```

- [ ] **Step 4: 创建最小会话脚本**

Create `godot-client/scripts/state/GameSession.gd`:

```gdscript
extends Control

const DEFAULT_API_BASE_URL := "http://127.0.0.1:4000/api"

var api_base_url: String = DEFAULT_API_BASE_URL
var current_user: Dictionary = {}
var current_run: Dictionary = {}

func _ready() -> void:
	var override_url := OS.get_environment("DOGFIGHT_API_BASE_URL")
	if override_url.length() > 0:
		api_base_url = override_url.rstrip("/")
```

- [ ] **Step 5: 创建工程加载冒烟脚本**

Create `godot-client/scripts/tests/api_client_smoke.gd`:

```gdscript
extends SceneTree

func _init() -> void:
	var script := load("res://scripts/state/GameSession.gd")
	if script == null:
		push_error("GameSession.gd failed to load")
		quit(1)
		return
	var node := Control.new()
	node.set_script(script)
	if node.api_base_url != "http://127.0.0.1:4000/api":
		push_error("Unexpected default api_base_url")
		quit(1)
		return
	OS.set_environment("DOGFIGHT_API_BASE_URL", "http://127.0.0.1:4000/api/")
	node._ready()
	if node.api_base_url != "http://127.0.0.1:4000/api":
		push_error("Unexpected normalized api_base_url after _ready")
		quit(1)
		return
	quit(0)
```

- [ ] **Step 6: 更新 Git 忽略规则**

Append to `.gitignore`:

```gitignore

# Godot local/import artifacts
godot-client/.godot/
godot-client/.import/
godot-client/export.cfg
godot-client/*.translation
godot-client/.env
```

- [ ] **Step 7: 验证工程文件存在**

Run:

```powershell
Test-Path E:\AI-GPT\DogFight\godot-client\project.godot
Test-Path E:\AI-GPT\DogFight\godot-client\scenes\Main.tscn
Test-Path E:\AI-GPT\DogFight\godot-client\scripts\state\GameSession.gd
Test-Path E:\AI-GPT\DogFight\godot-client\icon.svg
```

Expected: each command prints `True`.

- [ ] **Step 8: 如果本机有 Godot CLI，运行 headless 冒烟测试**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/api_client_smoke.gd
```

Expected: exit code `0`. If `godot` is not installed or not on PATH, record that verification is blocked and continue with file existence checks.

- [ ] **Step 9: Commit**

```powershell
git add .gitignore godot-client/project.godot godot-client/icon.svg godot-client/scenes/Main.tscn godot-client/scripts/state/GameSession.gd godot-client/scripts/tests/api_client_smoke.gd
git commit -m "Add Godot client project skeleton"
```

---

### Task 2: HTTP API 客户端与响应工具

**Files:**
- Create: `godot-client/scripts/api/ApiClient.gd`
- Create: `godot-client/scripts/api/ApiTypes.gd`
- Modify: `godot-client/scripts/state/GameSession.gd`
- Modify: `godot-client/scripts/tests/api_client_smoke.gd`

- [ ] **Step 1: 实现 API 类型读取工具**

Create `godot-client/scripts/api/ApiTypes.gd`:

```gdscript
class_name ApiTypes
extends RefCounted

static func dict_value(source: Dictionary, key: String, fallback: Variant = null) -> Variant:
	return source[key] if source.has(key) else fallback

static func string_value(source: Dictionary, key: String, fallback := "") -> String:
	var value := dict_value(source, key, fallback)
	return str(value) if value != null else fallback

static func int_value(source: Dictionary, key: String, fallback := 0) -> int:
	var value := dict_value(source, key, fallback)
	return int(value) if value != null else fallback

static func array_value(source: Dictionary, key: String) -> Array:
	var value := dict_value(source, key, [])
	return value if value is Array else []

static func dict_array(source: Dictionary, key: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for entry in array_value(source, key):
		if entry is Dictionary:
			result.append(entry)
	return result
```

- [ ] **Step 2: 实现统一 HTTP 客户端**

Create `godot-client/scripts/api/ApiClient.gd`:

```gdscript
class_name ApiClient
extends Node

signal request_started(path: String)
signal request_finished(path: String, ok: bool, status: int, payload: Dictionary)

var base_url := "http://127.0.0.1:4000/api"
var cookie_header := ""

func configure(next_base_url: String) -> void:
	base_url = next_base_url.rstrip("/")

func request_json(method: int, path: String, body: Dictionary = {}) -> Dictionary:
	var http := HTTPRequest.new()
	add_child(http)
	var headers := PackedStringArray(["Content-Type: application/json"])
	if cookie_header.length() > 0:
		headers.append("Cookie: %s" % cookie_header)
	var payload := "" if body.is_empty() else JSON.stringify(body)
	var url := "%s%s" % [base_url, path]
	request_started.emit(path)
	var start_error := http.request(url, headers, method, payload)
	if start_error != OK:
		http.queue_free()
		var failed := {"ok": false, "status": 0, "error": "请求启动失败", "data": {}}
		request_finished.emit(path, false, 0, failed)
		return failed
	var response: Array = await http.request_completed
	var status := int(response[1])
	var response_headers: PackedStringArray = response[2]
	var bytes: PackedByteArray = response[3]
	_capture_cookie(response_headers)
	var text := bytes.get_string_from_utf8()
	var parsed := JSON.parse_string(text)
	var data: Dictionary = parsed if parsed is Dictionary else {}
	var ok := status >= 200 and status < 300
	var result := {
		"ok": ok,
		"status": status,
		"error": "" if ok else str(data.get("error", "请求失败")),
		"data": data,
	}
	request_finished.emit(path, ok, status, result)
	http.queue_free()
	return result

func get_json(path: String) -> Dictionary:
	return await request_json(HTTPClient.METHOD_GET, path)

func post_json(path: String, body: Dictionary = {}) -> Dictionary:
	return await request_json(HTTPClient.METHOD_POST, path, body)

func _capture_cookie(headers: PackedStringArray) -> void:
	for header in headers:
		var lower := header.to_lower()
		if lower.begins_with("set-cookie:"):
			var raw_cookie := header.substr("set-cookie:".length()).strip_edges()
			var pair := raw_cookie.split(";", false, 1)[0]
			if pair.length() > 0:
				cookie_header = pair
```

- [ ] **Step 3: 将 API 客户端接入会话**

Modify `godot-client/scripts/state/GameSession.gd`:

```gdscript
extends Control

const ApiClient := preload("res://scripts/api/ApiClient.gd")
const DEFAULT_API_BASE_URL := "http://127.0.0.1:4000/api"

var api_base_url: String = DEFAULT_API_BASE_URL
var api: ApiClient
var current_user: Dictionary = {}
var current_run: Dictionary = {}

func _ready() -> void:
	var override_url := OS.get_environment("DOGFIGHT_API_BASE_URL")
	if override_url.length() > 0:
		api_base_url = override_url.rstrip("/")
	api = ApiClient.new()
	api.configure(api_base_url)
	add_child(api)
```

- [ ] **Step 4: 扩展冒烟脚本验证 API 类加载**

Modify `godot-client/scripts/tests/api_client_smoke.gd`:

```gdscript
extends SceneTree

func _init() -> void:
	var session_script := load("res://scripts/state/GameSession.gd")
	var api_script := load("res://scripts/api/ApiClient.gd")
	var types_script := load("res://scripts/api/ApiTypes.gd")
	if session_script == null or api_script == null or types_script == null:
		push_error("Core Godot client scripts failed to load")
		quit(1)
		return
	var api := api_script.new()
	api.configure("http://example.test/api/")
	if api.base_url != "http://example.test/api":
		push_error("ApiClient.configure did not normalize base_url")
		quit(1)
		return
	var value := types_script.string_value({"phase": "SHOP"}, "phase", "MAP")
	if value != "SHOP":
		push_error("ApiTypes.string_value returned wrong value")
		quit(1)
		return
	quit(0)
```

- [ ] **Step 5: Run smoke test**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/api_client_smoke.gd
```

Expected: exit code `0`. If `godot` is unavailable, run `Test-Path` for the three scripts and record the CLI blocker.

- [ ] **Step 6: Commit**

```powershell
git add godot-client/scripts/api/ApiClient.gd godot-client/scripts/api/ApiTypes.gd godot-client/scripts/state/GameSession.gd godot-client/scripts/tests/api_client_smoke.gd
git commit -m "Add Godot API client"
```

---

### Task 3: RunStore 状态读取与数据筛选

**Files:**
- Create: `godot-client/scripts/state/RunStore.gd`
- Create: `godot-client/scripts/tests/run_store_smoke.gd`
- Modify: `godot-client/scripts/state/GameSession.gd`

- [ ] **Step 1: 实现 RunStore**

Create `godot-client/scripts/state/RunStore.gd`:

```gdscript
class_name RunStore
extends RefCounted

var run: Dictionary = {}

func set_run(next_run: Dictionary) -> void:
	run = next_run.duplicate(true)

func has_run() -> bool:
	return not run.is_empty() and run.has("id")

func run_id() -> String:
	return str(run.get("id", ""))

func phase() -> String:
	return str(run.get("phase", ""))

func gold() -> int:
	return int(run.get("gold", 0))

func wins() -> int:
	return int(run.get("wins", 0))

func losses() -> int:
	return int(run.get("losses", 0))

func round_number() -> int:
	return int(run.get("round", 0))

func items_in_area(area: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for item in run.get("items", []):
		if item is Dictionary and str(item.get("area", "")) == area:
			result.append(item)
	result.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var ay := int(a.get("y", 0))
		var by := int(b.get("y", 0))
		if ay != by:
			return ay < by
		return int(a.get("x", 0)) < int(b.get("x", 0))
	)
	return result

func shop_offers() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for offer in run.get("shopItems", []):
		if offer is Dictionary:
			result.append(offer)
	return result

func last_battle() -> Dictionary:
	var battle := run.get("lastBattle", {})
	return battle if battle is Dictionary else {}
```

- [ ] **Step 2: 将 RunStore 加到会话状态**

Modify `godot-client/scripts/state/GameSession.gd`:

```gdscript
extends Control

const ApiClient := preload("res://scripts/api/ApiClient.gd")
const RunStore := preload("res://scripts/state/RunStore.gd")
const DEFAULT_API_BASE_URL := "http://127.0.0.1:4000/api"

var api_base_url: String = DEFAULT_API_BASE_URL
var api: ApiClient
var current_user: Dictionary = {}
var run_store: RunStore = RunStore.new()

func _ready() -> void:
	var override_url := OS.get_environment("DOGFIGHT_API_BASE_URL")
	if override_url.length() > 0:
		api_base_url = override_url.rstrip("/")
	api = ApiClient.new()
	api.configure(api_base_url)
	add_child(api)

func set_current_run(run: Dictionary) -> void:
	run_store.set_run(run)
```

- [ ] **Step 3: 创建 RunStore 冒烟测试**

Create `godot-client/scripts/tests/run_store_smoke.gd`:

```gdscript
extends SceneTree

func _init() -> void:
	var script := load("res://scripts/state/RunStore.gd")
	if script == null:
		push_error("RunStore.gd failed to load")
		quit(1)
		return
	var store := script.new()
	store.set_run({
		"id": "run-1",
		"phase": "SHOP",
		"gold": 9,
		"wins": 1,
		"losses": 0,
		"round": 2,
		"items": [
			{"id": "bag-1", "area": "BAG", "x": 2, "y": 0},
			{"id": "eq-1", "area": "EQUIPMENT", "x": 0, "y": 0}
		],
		"shopItems": [{"offerId": "offer-1"}]
	})
	if not store.has_run() or store.phase() != "SHOP" or store.gold() != 9:
		push_error("RunStore basic accessors failed")
		quit(1)
		return
	if store.items_in_area("EQUIPMENT").size() != 1:
		push_error("RunStore equipment filter failed")
		quit(1)
		return
	if store.shop_offers().size() != 1:
		push_error("RunStore shop offers failed")
		quit(1)
		return
	quit(0)
```

- [ ] **Step 4: Run smoke test**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/run_store_smoke.gd
```

Expected: exit code `0`. If `godot` is unavailable, record the blocker and run `Test-Path E:\AI-GPT\DogFight\godot-client\scripts\state\RunStore.gd`.

- [ ] **Step 5: Commit**

```powershell
git add godot-client/scripts/state/GameSession.gd godot-client/scripts/state/RunStore.gd godot-client/scripts/tests/run_store_smoke.gd
git commit -m "Add Godot run store"
```

---

### Task 4: 登录界面与会话 API

**Files:**
- Create: `godot-client/scenes/LoginScreen.tscn`
- Create: `godot-client/scripts/ui/LoginScreen.gd`
- Modify: `godot-client/scripts/state/GameSession.gd`
- Modify: `godot-client/scenes/Main.tscn`

- [ ] **Step 1: 给会话增加登录和用户刷新方法**

Modify `godot-client/scripts/state/GameSession.gd`:

```gdscript
extends Control

signal user_changed(user: Dictionary)
signal run_changed(run: Dictionary)
signal error_raised(message: String)

const ApiClient := preload("res://scripts/api/ApiClient.gd")
const RunStore := preload("res://scripts/state/RunStore.gd")
const DEFAULT_API_BASE_URL := "http://127.0.0.1:4000/api"

var api_base_url: String = DEFAULT_API_BASE_URL
var api: ApiClient
var current_user: Dictionary = {}
var run_store: RunStore = RunStore.new()

func _ready() -> void:
	var override_url := OS.get_environment("DOGFIGHT_API_BASE_URL")
	if override_url.length() > 0:
		api_base_url = override_url.rstrip("/")
	api = ApiClient.new()
	api.configure(api_base_url)
	add_child(api)

func login(account: String, password: String) -> bool:
	var response := await api.post_json("/auth/login", {"account": account, "password": password})
	if not response.ok:
		error_raised.emit(str(response.error))
		return false
	current_user = response.data.get("user", {})
	user_changed.emit(current_user)
	await refresh_me()
	return true

func refresh_me() -> bool:
	var response := await api.get_json("/me")
	if not response.ok:
		error_raised.emit(str(response.error))
		return false
	current_user = response.data.get("user", current_user)
	user_changed.emit(current_user)
	var active_run := response.data.get("activeRun", null)
	if active_run is Dictionary:
		set_current_run(active_run)
	return true

func set_current_run(run: Dictionary) -> void:
	run_store.set_run(run)
	run_changed.emit(run)
```

- [ ] **Step 2: 创建登录界面场景**

Create `godot-client/scenes/LoginScreen.tscn`:

```ini
[gd_scene load_steps=2 format=3 uid="uid://dogfight_login"]

[ext_resource type="Script" path="res://scripts/ui/LoginScreen.gd" id="1_login_script"]

[node name="LoginScreen" type="PanelContainer"]
custom_minimum_size = Vector2(420, 280)
anchors_preset = 8
anchor_left = 0.5
anchor_top = 0.5
anchor_right = 0.5
anchor_bottom = 0.5
offset_left = -210.0
offset_top = -140.0
offset_right = 210.0
offset_bottom = 140.0
script = ExtResource("1_login_script")

[node name="Margin" type="MarginContainer" parent="."]
layout_mode = 2
theme_override_constants/margin_left = 24
theme_override_constants/margin_top = 24
theme_override_constants/margin_right = 24
theme_override_constants/margin_bottom = 24

[node name="Form" type="VBoxContainer" parent="Margin"]
layout_mode = 2
theme_override_constants/separation = 12

[node name="Title" type="Label" parent="Margin/Form"]
layout_mode = 2
text = "狗骰乱斗 Godot Demo"
horizontal_alignment = 1

[node name="AccountInput" type="LineEdit" parent="Margin/Form"]
layout_mode = 2
placeholder_text = "账号"

[node name="PasswordInput" type="LineEdit" parent="Margin/Form"]
layout_mode = 2
placeholder_text = "密码"
secret = true

[node name="LoginButton" type="Button" parent="Margin/Form"]
layout_mode = 2
text = "登录"

[node name="ErrorLabel" type="Label" parent="Margin/Form"]
layout_mode = 2
text = ""
autowrap_mode = 3
```

- [ ] **Step 3: 实现登录界面脚本**

Create `godot-client/scripts/ui/LoginScreen.gd`:

```gdscript
extends PanelContainer

signal login_succeeded

@onready var account_input: LineEdit = %AccountInput
@onready var password_input: LineEdit = %PasswordInput
@onready var login_button: Button = %LoginButton
@onready var error_label: Label = %ErrorLabel

var session: Node

func bind_session(next_session: Node) -> void:
	session = next_session
	session.error_raised.connect(_on_error_raised)

func _ready() -> void:
	login_button.pressed.connect(_on_login_pressed)

func _on_login_pressed() -> void:
	error_label.text = ""
	login_button.disabled = true
	var ok: bool = await session.login(account_input.text.strip_edges(), password_input.text)
	login_button.disabled = false
	if ok:
		login_succeeded.emit()

func _on_error_raised(message: String) -> void:
	error_label.text = message
```

- [ ] **Step 4: Main 场景挂载 LoginScreen**

Modify `godot-client/scenes/Main.tscn` to add the ext resource and child:

```ini
[gd_scene load_steps=3 format=3 uid="uid://dogfight_main"]

[ext_resource type="Script" path="res://scripts/state/GameSession.gd" id="1_session"]
[ext_resource type="PackedScene" path="res://scenes/LoginScreen.tscn" id="2_login"]

[node name="Main" type="Control"]
layout_mode = 3
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
script = ExtResource("1_session")

[node name="ScreenRoot" type="Control" parent="."]
layout_mode = 1
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2

[node name="LoginScreen" parent="ScreenRoot" instance=ExtResource("2_login")]
```

- [ ] **Step 5: 在 GameSession 绑定登录场景**

Add to `GameSession.gd` after creating `api` in `_ready()`:

```gdscript
	var login_screen := get_node_or_null("ScreenRoot/LoginScreen")
	if login_screen != null and login_screen.has_method("bind_session"):
		login_screen.bind_session(self)
```

- [ ] **Step 6: Manual verification**

Run local API:

```powershell
npm run dev
```

In another terminal, run Godot:

```powershell
godot --path E:\AI-GPT\DogFight\godot-client
```

Expected: login screen appears. With an existing account, successful login clears the error label. With a wrong password, error label shows the server error.

- [ ] **Step 7: Commit**

```powershell
git add godot-client/scenes/LoginScreen.tscn godot-client/scripts/ui/LoginScreen.gd godot-client/scripts/state/GameSession.gd godot-client/scenes/Main.tscn
git commit -m "Add Godot login screen"
```

---

### Task 5: 跑局读取、创建与基础界面切换

**Files:**
- Create: `godot-client/scenes/RunScreen.tscn`
- Create: `godot-client/scripts/ui/RunScreen.gd`
- Modify: `godot-client/scripts/state/GameSession.gd`
- Modify: `godot-client/scenes/Main.tscn`
- Modify: `godot-client/scripts/ui/LoginScreen.gd`

- [ ] **Step 1: 给会话增加创建跑局方法**

Add to `GameSession.gd`:

```gdscript
func create_run(dog_type := "SHIBA", mode := "CASUAL", lucky_number: Variant = null) -> bool:
	var body := {"dogType": dog_type, "mode": mode}
	if lucky_number != null:
		body["luckyNumber"] = int(lucky_number)
	var response := await api.post_json("/runs", body)
	if not response.ok:
		error_raised.emit(str(response.error))
		return false
	var run := response.data.get("run", {})
	if run is Dictionary:
		set_current_run(run)
		return true
	error_raised.emit("创建跑局失败")
	return false
```

- [ ] **Step 2: 创建跑局界面场景**

Create `godot-client/scenes/RunScreen.tscn`:

```ini
[gd_scene load_steps=2 format=3 uid="uid://dogfight_run"]

[ext_resource type="Script" path="res://scripts/ui/RunScreen.gd" id="1_run_script"]

[node name="RunScreen" type="Control"]
layout_mode = 3
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
visible = false
script = ExtResource("1_run_script")

[node name="Root" type="VBoxContainer" parent="."]
layout_mode = 1
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
theme_override_constants/separation = 10

[node name="Header" type="HBoxContainer" parent="Root"]
layout_mode = 2
custom_minimum_size = Vector2(0, 56)

[node name="RunLabel" type="Label" parent="Root/Header"]
layout_mode = 2
size_flags_horizontal = 3
text = "未读取跑局"

[node name="CreateRunButton" type="Button" parent="Root/Header"]
layout_mode = 2
text = "创建柴犬跑局"

[node name="Body" type="HBoxContainer" parent="Root"]
layout_mode = 2
size_flags_vertical = 3
theme_override_constants/separation = 10

[node name="EquipmentPanel" type="PanelContainer" parent="Root/Body"]
layout_mode = 2
custom_minimum_size = Vector2(420, 0)

[node name="EquipmentList" type="VBoxContainer" parent="Root/Body/EquipmentPanel"]
layout_mode = 2

[node name="BagPanel" type="PanelContainer" parent="Root/Body"]
layout_mode = 2
custom_minimum_size = Vector2(360, 0)

[node name="BagList" type="VBoxContainer" parent="Root/Body/BagPanel"]
layout_mode = 2

[node name="ShopPanel" type="PanelContainer" parent="Root/Body"]
layout_mode = 2
size_flags_horizontal = 3

[node name="ShopList" type="VBoxContainer" parent="Root/Body/ShopPanel"]
layout_mode = 2

[node name="Footer" type="HBoxContainer" parent="Root"]
layout_mode = 2
custom_minimum_size = Vector2(0, 56)

[node name="ActionButton" type="Button" parent="Root/Footer"]
layout_mode = 2
text = "阶段操作"

[node name="ErrorLabel" type="Label" parent="Root/Footer"]
layout_mode = 2
size_flags_horizontal = 3
text = ""
autowrap_mode = 3
```

- [ ] **Step 3: 实现跑局界面基础渲染**

Create `godot-client/scripts/ui/RunScreen.gd`:

```gdscript
extends Control

@onready var run_label: Label = %RunLabel
@onready var create_run_button: Button = %CreateRunButton
@onready var equipment_list: VBoxContainer = %EquipmentList
@onready var bag_list: VBoxContainer = %BagList
@onready var shop_list: VBoxContainer = %ShopList
@onready var action_button: Button = %ActionButton
@onready var error_label: Label = %ErrorLabel

var session: Node

func bind_session(next_session: Node) -> void:
	session = next_session
	session.run_changed.connect(_on_run_changed)
	session.error_raised.connect(_on_error_raised)

func _ready() -> void:
	create_run_button.pressed.connect(_on_create_run_pressed)

func _on_create_run_pressed() -> void:
	await session.create_run("SHIBA", "CASUAL")

func _on_run_changed(_run: Dictionary) -> void:
	_render()

func _render() -> void:
	var store = session.run_store
	if not store.has_run():
		run_label.text = "未读取跑局"
		return
	run_label.text = "阶段 %s | 第 %d 轮 | 金币 %d | %d胜%d负" % [
		store.phase(),
		store.round_number(),
		store.gold(),
		store.wins(),
		store.losses(),
	]
	_render_items(equipment_list, store.items_in_area("EQUIPMENT"))
	_render_items(bag_list, store.items_in_area("BAG"))
	_render_shop(store.shop_offers())
	action_button.text = _action_label(store.phase())

func _render_items(container: VBoxContainer, items: Array[Dictionary]) -> void:
	_clear_children(container)
	for item in items:
		var def: Dictionary = item.get("def", {})
		var button := Button.new()
		button.custom_minimum_size = Vector2(0, 44)
		button.text = "%s | %s | x%d y%d" % [
			str(def.get("name", item.get("defId", "装备"))),
			str(item.get("quality", "")),
			int(item.get("x", 0)),
			int(item.get("y", 0)),
		]
		container.add_child(button)

func _render_shop(offers: Array[Dictionary]) -> void:
	_clear_children(shop_list)
	for offer in offers:
		var def: Dictionary = offer.get("def", {})
		var button := Button.new()
		button.custom_minimum_size = Vector2(0, 44)
		button.text = "%s | %d 金币" % [str(def.get("name", offer.get("defId", "商品"))), int(offer.get("price", 0))]
		shop_list.add_child(button)

func _action_label(phase: String) -> String:
	if phase == "PREP":
		return "匹配对手"
	if phase == "MATCH":
		return "开始战斗"
	if phase == "BATTLE":
		return "继续结算"
	return "等待阶段操作"

func _clear_children(container: Node) -> void:
	for child in container.get_children():
		child.queue_free()

func _on_error_raised(message: String) -> void:
	error_label.text = message
```

- [ ] **Step 4: Main 场景加入 RunScreen 并在登录后切换**

Modify `godot-client/scenes/Main.tscn`:

```ini
[gd_scene load_steps=4 format=3 uid="uid://dogfight_main"]

[ext_resource type="Script" path="res://scripts/state/GameSession.gd" id="1_session"]
[ext_resource type="PackedScene" path="res://scenes/LoginScreen.tscn" id="2_login"]
[ext_resource type="PackedScene" path="res://scenes/RunScreen.tscn" id="3_run"]

[node name="Main" type="Control"]
layout_mode = 3
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
script = ExtResource("1_session")

[node name="ScreenRoot" type="Control" parent="."]
layout_mode = 1
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2

[node name="LoginScreen" parent="ScreenRoot" instance=ExtResource("2_login")]

[node name="RunScreen" parent="ScreenRoot" instance=ExtResource("3_run")]
```

Modify `_ready()` in `GameSession.gd`:

```gdscript
	var login_screen := get_node_or_null("ScreenRoot/LoginScreen")
	var run_screen := get_node_or_null("ScreenRoot/RunScreen")
	if login_screen != null and login_screen.has_method("bind_session"):
		login_screen.bind_session(self)
		login_screen.login_succeeded.connect(_show_run_screen)
	if run_screen != null and run_screen.has_method("bind_session"):
		run_screen.bind_session(self)
```

Add to `GameSession.gd`:

```gdscript
func _show_run_screen() -> void:
	var login_screen := get_node_or_null("ScreenRoot/LoginScreen")
	var run_screen := get_node_or_null("ScreenRoot/RunScreen")
	if login_screen != null:
		login_screen.visible = false
	if run_screen != null:
		run_screen.visible = true
```

- [ ] **Step 5: Manual verification**

Run:

```powershell
npm run dev
godot --path E:\AI-GPT\DogFight\godot-client
```

Expected: after login, RunScreen appears. If `/api/me` returns an active run, it renders. If no active run exists, clicking `创建柴犬跑局` creates one and renders starter items.

- [ ] **Step 6: Commit**

```powershell
git add godot-client/scenes/RunScreen.tscn godot-client/scripts/ui/RunScreen.gd godot-client/scripts/state/GameSession.gd godot-client/scenes/Main.tscn godot-client/scripts/ui/LoginScreen.gd
git commit -m "Add Godot run screen"
```

---

### Task 6: 商店与装备最小可玩操作

**Files:**
- Modify: `godot-client/scripts/state/GameSession.gd`
- Modify: `godot-client/scripts/ui/RunScreen.gd`

- [ ] **Step 1: 给会话增加跑局操作 API**

Add to `GameSession.gd`:

```gdscript
func move_item(item_id: String, area: String, x: int, y: int) -> bool:
	return await _post_run_action("/items/move", {"itemId": item_id, "area": area, "x": x, "y": y})

func buy_offer(offer_id: String, area := "BAG") -> bool:
	return await _post_run_action("/shop/buy", {"offerId": offer_id, "area": area})

func sell_item(item_id: String) -> bool:
	return await _post_run_action("/shop/sell", {"itemId": item_id})

func reroll_shop() -> bool:
	return await _post_run_action("/shop/reroll", {})

func _post_run_action(suffix: String, body: Dictionary) -> bool:
	if not run_store.has_run():
		error_raised.emit("没有当前跑局")
		return false
	var response := await api.post_json("/runs/%s%s" % [run_store.run_id(), suffix], body)
	if not response.ok:
		error_raised.emit(str(response.error))
		return false
	var run := response.data.get("run", {})
	if run is Dictionary:
		set_current_run(run)
		return true
	error_raised.emit("服务器没有返回跑局")
	return false
```

- [ ] **Step 2: RunScreen 支持选中装备**

Add to `RunScreen.gd`:

```gdscript
var selected_item_id := ""
var selected_item_area := ""
```

Replace item button creation in `_render_items`:

```gdscript
		button.pressed.connect(func() -> void:
			selected_item_id = str(item.get("id", ""))
			selected_item_area = str(item.get("area", ""))
			error_label.text = "已选中 %s" % button.text
		)
```

- [ ] **Step 3: RunScreen 支持购买商品**

Replace shop button creation in `_render_shop`:

```gdscript
		button.pressed.connect(func() -> void:
			await session.buy_offer(str(offer.get("offerId", "")), "BAG")
		)
```

- [ ] **Step 4: RunScreen 增加出售、刷新和移动按钮**

Append buttons in `_ready()` after `create_run_button.pressed.connect(...)`:

```gdscript
	var sell_button := Button.new()
	sell_button.text = "出售选中"
	sell_button.custom_minimum_size = Vector2(120, 44)
	sell_button.pressed.connect(func() -> void:
		if selected_item_id.length() > 0:
			await session.sell_item(selected_item_id)
			selected_item_id = ""
	)
	%Footer.add_child(sell_button)

	var reroll_button := Button.new()
	reroll_button.text = "刷新商店"
	reroll_button.custom_minimum_size = Vector2(120, 44)
	reroll_button.pressed.connect(func() -> void:
		await session.reroll_shop()
	)
	%Footer.add_child(reroll_button)

	var move_to_bag_button := Button.new()
	move_to_bag_button.text = "移到背包0,0"
	move_to_bag_button.custom_minimum_size = Vector2(140, 44)
	move_to_bag_button.pressed.connect(func() -> void:
		if selected_item_id.length() > 0:
			await session.move_item(selected_item_id, "BAG", 0, 0)
	)
	%Footer.add_child(move_to_bag_button)

	var move_to_equipment_button := Button.new()
	move_to_equipment_button.text = "移到装备0,0"
	move_to_equipment_button.custom_minimum_size = Vector2(140, 44)
	move_to_equipment_button.pressed.connect(func() -> void:
		if selected_item_id.length() > 0:
			await session.move_item(selected_item_id, "EQUIPMENT", 0, 0)
	)
	%Footer.add_child(move_to_equipment_button)
```

- [ ] **Step 5: Manual verification**

Run:

```powershell
npm run dev
godot --path E:\AI-GPT\DogFight\godot-client
```

Expected:
- Clicking a shop offer buys it into bag when run phase is `SHOP`.
- Clicking `刷新商店` refreshes offers when phase is `SHOP` and gold is sufficient.
- Selecting an item then `出售选中` removes it and increases gold.
- Selecting an item then move buttons calls server placement rules; on invalid placement, server error is shown.

- [ ] **Step 6: Commit**

```powershell
git add godot-client/scripts/state/GameSession.gd godot-client/scripts/ui/RunScreen.gd
git commit -m "Add Godot shop and item actions"
```

---

### Task 7: 战斗匹配、回放和结算闭环

**Files:**
- Create: `godot-client/scenes/BattleReplayScreen.tscn`
- Create: `godot-client/scripts/ui/BattleReplayScreen.gd`
- Modify: `godot-client/scripts/state/GameSession.gd`
- Modify: `godot-client/scripts/ui/RunScreen.gd`
- Modify: `godot-client/scenes/Main.tscn`

- [ ] **Step 1: 给会话增加战斗 API**

Add signals and methods to `GameSession.gd`:

```gdscript
signal battle_started(battle: Dictionary)

func match_battle() -> bool:
	return await _post_run_action("/battle/match", {})

func start_battle() -> bool:
	if not run_store.has_run():
		error_raised.emit("没有当前跑局")
		return false
	var response := await api.post_json("/runs/%s/battle/start" % run_store.run_id(), {})
	if not response.ok:
		error_raised.emit(str(response.error))
		return false
	var run := response.data.get("run", {})
	if run is Dictionary:
		set_current_run(run)
	var battle := response.data.get("battle", {})
	if battle is Dictionary:
		battle_started.emit(battle)
		return true
	error_raised.emit("服务器没有返回战斗结果")
	return false

func finish_battle() -> bool:
	return await _post_run_action("/battle/finish", {})
```

- [ ] **Step 2: 创建战斗回放场景**

Create `godot-client/scenes/BattleReplayScreen.tscn`:

```ini
[gd_scene load_steps=2 format=3 uid="uid://dogfight_battle_replay"]

[ext_resource type="Script" path="res://scripts/ui/BattleReplayScreen.gd" id="1_battle_script"]

[node name="BattleReplayScreen" type="Control"]
layout_mode = 3
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
visible = false
script = ExtResource("1_battle_script")

[node name="Root" type="VBoxContainer" parent="."]
layout_mode = 1
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
theme_override_constants/separation = 12

[node name="Header" type="HBoxContainer" parent="Root"]
layout_mode = 2
custom_minimum_size = Vector2(0, 64)

[node name="PlayerHp" type="ProgressBar" parent="Root/Header"]
layout_mode = 2
size_flags_horizontal = 3
max_value = 100
value = 100

[node name="DiceLabel" type="Label" parent="Root/Header"]
layout_mode = 2
custom_minimum_size = Vector2(160, 0)
text = "骰点 -"
horizontal_alignment = 1

[node name="OpponentHp" type="ProgressBar" parent="Root/Header"]
layout_mode = 2
size_flags_horizontal = 3
max_value = 100
value = 100

[node name="Log" type="RichTextLabel" parent="Root"]
layout_mode = 2
size_flags_vertical = 3
bbcode_enabled = false
fit_content = false
scroll_following = true

[node name="Footer" type="HBoxContainer" parent="Root"]
layout_mode = 2
custom_minimum_size = Vector2(0, 56)

[node name="PlayButton" type="Button" parent="Root/Footer"]
layout_mode = 2
text = "播放"

[node name="SkipButton" type="Button" parent="Root/Footer"]
layout_mode = 2
text = "跳过"

[node name="FinishButton" type="Button" parent="Root/Footer"]
layout_mode = 2
text = "结算"
disabled = true
```

- [ ] **Step 3: 实现战斗回放脚本**

Create `godot-client/scripts/ui/BattleReplayScreen.gd`:

```gdscript
extends Control

signal replay_finished

@onready var player_hp: ProgressBar = %PlayerHp
@onready var opponent_hp: ProgressBar = %OpponentHp
@onready var dice_label: Label = %DiceLabel
@onready var log_view: RichTextLabel = %Log
@onready var play_button: Button = %PlayButton
@onready var skip_button: Button = %SkipButton
@onready var finish_button: Button = %FinishButton

var session: Node
var battle: Dictionary = {}
var events: Array = []
var event_index := 0
var playing := false

func bind_session(next_session: Node) -> void:
	session = next_session

func _ready() -> void:
	play_button.pressed.connect(_on_play_pressed)
	skip_button.pressed.connect(_on_skip_pressed)
	finish_button.pressed.connect(_on_finish_pressed)

func start_replay(next_battle: Dictionary) -> void:
	battle = next_battle
	events = battle.get("events", [])
	event_index = 0
	playing = false
	finish_button.disabled = true
	log_view.text = ""
	_render_initial_hp()

func _render_initial_hp() -> void:
	player_hp.max_value = int(battle.get("playerMaxHp", 100))
	opponent_hp.max_value = int(battle.get("opponentMaxHp", 100))
	player_hp.value = player_hp.max_value
	opponent_hp.value = opponent_hp.max_value
	dice_label.text = "骰点 -"

func _on_play_pressed() -> void:
	if playing:
		return
	playing = true
	while playing and event_index < events.size():
		var event: Dictionary = events[event_index]
		_apply_event(event)
		event_index += 1
		await get_tree().create_timer(0.24).timeout
	playing = false
	if event_index >= events.size():
		finish_button.disabled = false
		replay_finished.emit()

func _on_skip_pressed() -> void:
	playing = false
	while event_index < events.size():
		var event: Dictionary = events[event_index]
		_apply_event(event)
		event_index += 1
	finish_button.disabled = false
	replay_finished.emit()

func _on_finish_pressed() -> void:
	finish_button.disabled = true
	await session.finish_battle()

func _apply_event(event: Dictionary) -> void:
	player_hp.max_value = int(event.get("playerMaxHp", player_hp.max_value))
	opponent_hp.max_value = int(event.get("opponentMaxHp", opponent_hp.max_value))
	player_hp.value = int(event.get("playerHp", player_hp.value))
	opponent_hp.value = int(event.get("opponentHp", opponent_hp.value))
	if event.has("roll"):
		dice_label.text = "骰点 %s" % str(event.get("roll"))
	log_view.append_text("%ss | %s | %s\n" % [
		str(event.get("time", "0")),
		str(event.get("actor", "system")),
		str(event.get("text", "")),
	])
```

- [ ] **Step 4: RunScreen 阶段按钮接入战斗**

Modify `RunScreen.gd`:

```gdscript
func _ready() -> void:
	create_run_button.pressed.connect(_on_create_run_pressed)
	action_button.pressed.connect(_on_action_pressed)
```

Add:

```gdscript
func _on_action_pressed() -> void:
	var phase := session.run_store.phase()
	if phase == "PREP":
		await session.match_battle()
	elif phase == "MATCH":
		await session.start_battle()
	elif phase == "BATTLE":
		await session.finish_battle()
```

- [ ] **Step 5: Main 场景加入 BattleReplayScreen 并切换**

Modify `godot-client/scenes/Main.tscn`:

```ini
[gd_scene load_steps=5 format=3 uid="uid://dogfight_main"]

[ext_resource type="Script" path="res://scripts/state/GameSession.gd" id="1_session"]
[ext_resource type="PackedScene" path="res://scenes/LoginScreen.tscn" id="2_login"]
[ext_resource type="PackedScene" path="res://scenes/RunScreen.tscn" id="3_run"]
[ext_resource type="PackedScene" path="res://scenes/BattleReplayScreen.tscn" id="4_battle"]

[node name="Main" type="Control"]
layout_mode = 3
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
script = ExtResource("1_session")

[node name="ScreenRoot" type="Control" parent="."]
layout_mode = 1
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2

[node name="LoginScreen" parent="ScreenRoot" instance=ExtResource("2_login")]

[node name="RunScreen" parent="ScreenRoot" instance=ExtResource("3_run")]

[node name="BattleReplayScreen" parent="ScreenRoot" instance=ExtResource("4_battle")]
```

Modify `_ready()` in `GameSession.gd`:

```gdscript
	var battle_screen := get_node_or_null("ScreenRoot/BattleReplayScreen")
	if battle_screen != null and battle_screen.has_method("bind_session"):
		battle_screen.bind_session(self)
	battle_started.connect(_show_battle_screen)
	run_changed.connect(func(_run: Dictionary) -> void:
		if run_store.phase() != "BATTLE":
			_show_run_screen()
	)
```

Add:

```gdscript
func _show_battle_screen(battle: Dictionary) -> void:
	var run_screen := get_node_or_null("ScreenRoot/RunScreen")
	var battle_screen := get_node_or_null("ScreenRoot/BattleReplayScreen")
	if run_screen != null:
		run_screen.visible = false
	if battle_screen != null:
		battle_screen.visible = true
		battle_screen.start_replay(battle)
```

- [ ] **Step 6: Manual verification**

Run:

```powershell
npm run dev
godot --path E:\AI-GPT\DogFight\godot-client
```

Expected:
- In `PREP`, clicking stage button changes to `MATCH`.
- In `MATCH`, clicking stage button starts battle and opens BattleReplayScreen.
- `播放` appends events and updates HP bars.
- `跳过` reaches the final event.
- `结算` calls `/battle/finish`, refreshes run, and returns to RunScreen.

- [ ] **Step 7: Commit**

```powershell
git add godot-client/scenes/BattleReplayScreen.tscn godot-client/scripts/ui/BattleReplayScreen.gd godot-client/scripts/state/GameSession.gd godot-client/scripts/ui/RunScreen.gd godot-client/scenes/Main.tscn
git commit -m "Add Godot battle replay flow"
```

---

### Task 8: 文档、验证与交付

**Files:**
- Create: `godot-client/README.md`
- Modify: no Web or service files unless previous tasks exposed an API blocker

- [ ] **Step 1: 写 Godot 客户端 README**

Create `godot-client/README.md`:

```markdown
# Godot 客户端竖切 Demo

这是《狗骰乱斗》的 Godot 4.x 客户端竖切 Demo。它只负责客户端显示、输入和战斗事件回放；账号、跑局、装备、商店、匹配、战斗模拟和结算仍由现有 Fastify API 负责。

## 启动本地服务

在仓库根目录运行：

```powershell
npm run dev
```

默认 API 地址为：

```text
http://127.0.0.1:4000/api
```

## 启动 Godot 客户端

```powershell
godot --path E:\AI-GPT\DogFight\godot-client
```

如需连接其他 API：

```powershell
$env:DOGFIGHT_API_BASE_URL="https://www.torcharena.online/api"
godot --path E:\AI-GPT\DogFight\godot-client
```

## 当前覆盖范围

- 账号密码登录。
- 读取 `/api/me` 的 activeRun。
- 创建柴犬休闲跑局。
- 展示金币、阶段、装备栏、背包和普通商店商品。
- 最小购买、出售、刷新和装备移动操作。
- 匹配、开始战斗、播放 `BattleResult.events`、结算。

## 当前限制

- 不替换现有 Web 客户端。
- 不迁移 TypeScript 战斗规则。
- 不覆盖多人房间、排行榜、账号商店、成就、每日任务和 TapTap 登录。
- 第一版战斗表现以日志、血条、骰点为主，不复刻完整 Web 特效。
```

- [ ] **Step 2: Run Godot smoke tests**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/api_client_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/run_store_smoke.gd
```

Expected: both exit code `0`. If Godot CLI is unavailable, record exact error and run file existence checks:

```powershell
Test-Path E:\AI-GPT\DogFight\godot-client\project.godot
Test-Path E:\AI-GPT\DogFight\godot-client\scripts\api\ApiClient.gd
Test-Path E:\AI-GPT\DogFight\godot-client\scripts\state\RunStore.gd
Test-Path E:\AI-GPT\DogFight\godot-client\scenes\BattleReplayScreen.tscn
```

Expected: each command prints `True`.

- [ ] **Step 3: Run existing Web/service build because new client shares repo delivery**

Run:

```powershell
npm run build
```

Expected: `npm run guard:chains`, `tsc -b`, `vite build`, and `scripts/package-click-index.mjs` all complete successfully; `dist-click\DogFight-standalone.cmd` is regenerated.

- [ ] **Step 4: Manual vertical-slice verification**

Run:

```powershell
npm run dev
godot --path E:\AI-GPT\DogFight\godot-client
```

Expected:
- Login succeeds with an existing account.
- Active run loads from `/api/me` or a new SHIBA run is created.
- At least one equipment list renders.
- A normal shop offer can be bought when current phase is `SHOP`.
- Battle match/start/finish works after reaching `PREP` or `MATCH`.
- Replay screen displays logs and HP bars from `BattleResult.events`.

- [ ] **Step 5: Confirm no balance document update is required**

Run:

```powershell
git diff --name-only HEAD
```

Expected: changed files are Godot client files, `.gitignore`, and `godot-client/README.md`. If no equipment, relic, battle number, economy, trigger, quality multiplier, healing, shield, poison, weak, control, price, or balance model changed, do not update `C:\Users\User\Desktop\狗骰乱斗\狗骰乱斗.xlsx`.

- [ ] **Step 6: Commit**

```powershell
git add godot-client/README.md
git commit -m "Document Godot client demo"
```

- [ ] **Step 7: Final delivery push**

Run:

```powershell
git status --short --branch
git push origin main
```

Expected: branch `main` pushes successfully. Final response must include:

- Godot client path: `E:\AI-GPT\DogFight\godot-client`
- README link and storage path.
- Whether Godot CLI smoke tests passed or were blocked.
- `npm run build` result.
- Statement that the external balance Excel was not updated because no balance values changed.

---

## Self-Review Notes

- Spec coverage: the plan covers project creation, API base URL, login, active run, create run, equipment/shop minimum operations, battle events replay, settlement, README, smoke checks, build, and delivery.
- Scope control: no task migrates TypeScript battle logic, database, full Web UI, multiplayer room, leaderboard, account shop, achievements, daily tasks, TapTap login, or full VFX.
- Type consistency: `GameSession` owns `api`, `run_store`, `current_user`; `RunStore` owns `run`; UI scripts call `session.*` methods and react to `run_changed`, `error_raised`, and `battle_started`.
