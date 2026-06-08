# Godot Web UI Exact Migration Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Godot 完全复刻 Web UI 的迁移基座，让后续屏幕可以按 Web 结构逐个替换当前工作台式 `RunScreen.gd`。

**Architecture:** 先不实现完整商店、地图、战斗和多人房间细节，而是建立稳定的屏幕清单、run phase 路由、Web 风格 UI token、Overlay 层级和主场景注册。旧 `RunScreen.gd` 保留为迁移期兼容入口，但不再是正式验收目标。

**Tech Stack:** Godot 4.x GDScript、Godot `.tscn` 场景、现有 Fastify API、现有 Godot headless smoke 测试、现有 React/Vite Web UI 作为 source of truth。

---

## 范围边界

本计划只覆盖规格的“阶段一：迁移基座重置”。完整 Web UI 复刻范围太大，必须拆成后续独立计划：

- 核心跑局：模式大厅、地图、商店、装备板、奖励选择。
- 战斗与结算：战斗回放、特效层、结算屏。
- 账号与长期系统：账号商城、成就、每日、排行、赛季、历史快照。
- 多人房间：房间列表、房间详情、轮询、选狗、准备、观战。

本计划完成后，代码库应具备这些基础能力：

- 统一声明 Web 对应的 Godot 屏幕 ID。
- 用单一函数把 `run.phase` 映射到目标屏幕。
- 主场景能注册所有 Web 对应屏幕的骨架场景。
- OverlayRoot 具备规格要求的层级。
- UI Kit 暴露 Web 复刻所需的基础尺寸、颜色、纸片、按钮、槽位和资源胶囊样式。
- 结构测试可以阻止回退到“单个 RunScreen 承载全部流程”。

## 文件结构

- Create: `godot-client/scripts/ui/web/WebUiScreenIds.gd`  
  负责声明 Web UI 复刻所需的屏幕 ID、屏幕节点名、run phase 到屏幕的映射。

- Create: `godot-client/scripts/ui/web/WebUiTokens.gd`  
  负责承载从 Web CSS 迁移来的基础视觉 token：纸片、按钮、槽位、资源胶囊、品质色、固定尺寸。

- Create: `godot-client/scripts/ui/web/BaseWebScreen.gd`  
  所有新 Web 复刻屏幕骨架的基类，提供 `bind_session()`、`set_payload()`、`clear_payload()`。

- Create: `godot-client/scripts/ui/screens/ModeLobbyScreen.gd`  
  模式大厅骨架，后续计划填充 Web 的模式卡和狗狗卡。

- Create: `godot-client/scripts/ui/screens/RunShellScreen.gd`  
  跑局壳骨架，后续承载顶栏、资源胶囊、音乐、返回大厅。

- Create: `godot-client/scripts/ui/screens/ExplorationMapScreen.gd`  
  地图屏骨架，后续复刻 Web 的 `ExplorationMapView`。

- Create: `godot-client/scripts/ui/screens/RunShopScreen.gd`  
  商店屏骨架，后续复刻 Web 的 `ShopShelf`。

- Create: `godot-client/scripts/ui/screens/RewardChoiceScreen.gd`  
  奖励选择骨架，后续承载商店三选一、职业、附魔、遗物、升级、药水。

- Create: `godot-client/scripts/ui/screens/RunSettlementScreen.gd`  
  跑局结算骨架。

- Create: `godot-client/scripts/ui/screens/AccountShopScreen.gd`  
  账号商城骨架。

- Create: `godot-client/scripts/ui/screens/AchievementsScreen.gd`  
  成就和每日任务骨架。

- Create: `godot-client/scripts/ui/screens/LeaderboardsScreen.gd`  
  排行与巅峰榜骨架。

- Create: `godot-client/scripts/ui/screens/SeasonScreen.gd`  
  赛季屏骨架。

- Create: `godot-client/scripts/ui/screens/DogfightRoomsScreen.gd`  
  多人房间列表骨架。

- Create: `godot-client/scripts/ui/screens/DogfightRoomDetailScreen.gd`  
  多人房间详情骨架。

- Create: `godot-client/scripts/ui/screens/AccountSettingsScreen.gd`  
  账号设置骨架。

- Create: `godot-client/scenes/screens/*.tscn`  
  为上述屏幕创建最小可实例化场景。

- Modify: `godot-client/scenes/Main.tscn`  
  注册新的 Web 对应屏幕骨架，并保留 `RunScreen` 为 `LegacyRunScreen` 迁移期兼容节点。

- Modify: `godot-client/scenes/overlays/OverlayRoot.tscn`  
  补齐背景阻塞、主浮层、拖拽层、战斗特效层、提示层、Toast、普通弹窗、阻塞确认、Loading 层的相对顺序。

- Modify: `godot-client/scripts/state/GameSession.gd`  
  使用 `WebUiScreenIds` 注册屏幕并根据 `run.phase` 切屏。

- Test: `godot-client/scripts/tests/web_ui_screen_manifest_smoke.gd`  
  验证屏幕清单、节点名和 phase 映射。

- Test: `godot-client/scripts/tests/web_ui_main_scene_smoke.gd`  
  验证主场景包含 Web 对应屏幕、旧 RunScreen 不再注册为正式 `run` 屏幕。

- Test: `godot-client/scripts/tests/web_ui_overlay_layers_smoke.gd`  
  验证 OverlayRoot 层级顺序。

- Test: `godot-client/scripts/tests/web_ui_tokens_smoke.gd`  
  验证 Web 复刻 token 的关键尺寸和样式存在。

---

### Task 1: Web UI 屏幕清单与 Phase 映射

**Files:**
- Create: `godot-client/scripts/ui/web/WebUiScreenIds.gd`
- Test: `godot-client/scripts/tests/web_ui_screen_manifest_smoke.gd`

- [ ] **Step 1: Write the failing test**

Create `godot-client/scripts/tests/web_ui_screen_manifest_smoke.gd`:

```gdscript
extends SceneTree

func _init() -> void:
	var manifest = load("res://scripts/ui/web/WebUiScreenIds.gd")
	if manifest == null:
		_fail("WebUiScreenIds.gd must exist")
		return

	var required_screens := [
		"login",
		"nickname_setup",
		"mode_lobby",
		"run_shell",
		"exploration_map",
		"run_shop",
		"reward_choice",
		"battle_replay",
		"run_settlement",
		"account_shop",
		"achievements",
		"leaderboards",
		"season",
		"dogfight_rooms",
		"dogfight_room_detail",
		"account_settings",
	]
	for screen_id in required_screens:
		if not manifest.screen_ids().has(screen_id):
			_fail("Missing Web UI screen id: %s" % screen_id)
			return
		var node_name := str(manifest.node_name_for(screen_id))
		if node_name.is_empty():
			_fail("Missing node name for screen id: %s" % screen_id)
			return

	var phase_expectations := {
		"MAP": "exploration_map",
		"CHOICE": "reward_choice",
		"CLASS_REWARD": "reward_choice",
		"ENCHANT_CHOICE": "reward_choice",
		"RELIC_CHOICE": "reward_choice",
		"UPGRADE_CHOICE": "reward_choice",
		"POTION_CHOICE": "reward_choice",
		"SHOP": "run_shop",
		"PREP": "run_shell",
		"MATCH": "run_shell",
		"BATTLE": "battle_replay",
		"COMPLETE": "run_settlement",
	}
	for phase in phase_expectations.keys():
		var actual := str(manifest.screen_for_run_phase(phase))
		var expected := str(phase_expectations[phase])
		if actual != expected:
			_fail("Phase %s should route to %s, got %s" % [phase, expected, actual])
			return

	if str(manifest.screen_for_run_phase("UNKNOWN_PHASE")) != "run_shell":
		_fail("Unknown run phase should fall back to run_shell")
		return

	print("Web UI screen manifest smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_screen_manifest_smoke.gd
```

Expected: FAIL with `WebUiScreenIds.gd must exist`.

- [ ] **Step 3: Write minimal implementation**

Create `godot-client/scripts/ui/web/WebUiScreenIds.gd`:

```gdscript
class_name WebUiScreenIds
extends RefCounted

const LOGIN := "login"
const NICKNAME_SETUP := "nickname_setup"
const MODE_LOBBY := "mode_lobby"
const RUN_SHELL := "run_shell"
const EXPLORATION_MAP := "exploration_map"
const RUN_SHOP := "run_shop"
const REWARD_CHOICE := "reward_choice"
const BATTLE_REPLAY := "battle_replay"
const RUN_SETTLEMENT := "run_settlement"
const ACCOUNT_SHOP := "account_shop"
const ACHIEVEMENTS := "achievements"
const LEADERBOARDS := "leaderboards"
const SEASON := "season"
const DOGFIGHT_ROOMS := "dogfight_rooms"
const DOGFIGHT_ROOM_DETAIL := "dogfight_room_detail"
const ACCOUNT_SETTINGS := "account_settings"

const SCREEN_NODES := {
	LOGIN: "LoginScreen",
	NICKNAME_SETUP: "NicknameSetupScreen",
	MODE_LOBBY: "ModeLobbyScreen",
	RUN_SHELL: "RunShellScreen",
	EXPLORATION_MAP: "ExplorationMapScreen",
	RUN_SHOP: "RunShopScreen",
	REWARD_CHOICE: "RewardChoiceScreen",
	BATTLE_REPLAY: "BattleReplayScreen",
	RUN_SETTLEMENT: "RunSettlementScreen",
	ACCOUNT_SHOP: "AccountShopScreen",
	ACHIEVEMENTS: "AchievementsScreen",
	LEADERBOARDS: "LeaderboardsScreen",
	SEASON: "SeasonScreen",
	DOGFIGHT_ROOMS: "DogfightRoomsScreen",
	DOGFIGHT_ROOM_DETAIL: "DogfightRoomDetailScreen",
	ACCOUNT_SETTINGS: "AccountSettingsScreen",
}

const RUN_PHASE_SCREENS := {
	"MAP": EXPLORATION_MAP,
	"CHOICE": REWARD_CHOICE,
	"CLASS_REWARD": REWARD_CHOICE,
	"ENCHANT_CHOICE": REWARD_CHOICE,
	"RELIC_CHOICE": REWARD_CHOICE,
	"UPGRADE_CHOICE": REWARD_CHOICE,
	"POTION_CHOICE": REWARD_CHOICE,
	"SHOP": RUN_SHOP,
	"PREP": RUN_SHELL,
	"MATCH": RUN_SHELL,
	"BATTLE": BATTLE_REPLAY,
	"COMPLETE": RUN_SETTLEMENT,
}

static func screen_ids() -> Array[String]:
	var ids: Array[String] = []
	for id in SCREEN_NODES.keys():
		ids.append(str(id))
	return ids

static func node_name_for(screen_id: String) -> String:
	return str(SCREEN_NODES.get(screen_id, ""))

static func screen_for_run_phase(phase: String) -> String:
	return str(RUN_PHASE_SCREENS.get(phase, RUN_SHELL))
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_screen_manifest_smoke.gd
```

Expected: PASS with `Web UI screen manifest smoke passed`.

- [ ] **Step 5: Commit**

```powershell
git add godot-client/scripts/ui/web/WebUiScreenIds.gd godot-client/scripts/tests/web_ui_screen_manifest_smoke.gd
git commit -m "Add Godot Web UI screen manifest"
```

---

### Task 2: Web UI Token 基座

**Files:**
- Create: `godot-client/scripts/ui/web/WebUiTokens.gd`
- Test: `godot-client/scripts/tests/web_ui_tokens_smoke.gd`

- [ ] **Step 1: Write the failing test**

Create `godot-client/scripts/tests/web_ui_tokens_smoke.gd`:

```gdscript
extends SceneTree

func _init() -> void:
	var tokens = load("res://scripts/ui/web/WebUiTokens.gd")
	if tokens == null:
		_fail("WebUiTokens.gd must exist")
		return

	if int(tokens.board_slot_size()) != 74:
		_fail("Web board slot size must match the 74px inspection target")
		return
	if int(tokens.compact_slot_size()) != 52:
		_fail("Web compact slot size must match the 52px inspection target")
		return
	if int(tokens.icon_slot_size()) != 30:
		_fail("Web icon slot size must match the 30px inspection target")
		return
	if int(tokens.touch_target_height()) < 44:
		_fail("Touch target must stay at least 44px")
		return

	var paper = tokens.paper_card_style()
	if paper == null or not paper is StyleBoxFlat:
		_fail("paper_card_style must return StyleBoxFlat")
		return
	if (paper as StyleBoxFlat).corner_radius_top_left > 8:
		_fail("Paper card radius must stay 8px or less")
		return

	var slot = tokens.slot_style(false, false)
	if slot == null or not slot is StyleBoxFlat:
		_fail("slot_style must return StyleBoxFlat")
		return

	var selected_slot = tokens.slot_style(true, false)
	if selected_slot == null or not selected_slot is StyleBoxFlat:
		_fail("selected slot_style must return StyleBoxFlat")
		return
	if (selected_slot as StyleBoxFlat).border_color == (slot as StyleBoxFlat).border_color:
		_fail("Selected slot must visibly differ from normal slot")
		return

	var gold := tokens.quality_color("GOLD")
	var bronze := tokens.quality_color("BRONZE")
	if gold == bronze:
		_fail("Quality colors must distinguish GOLD and BRONZE")
		return

	print("Web UI tokens smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_tokens_smoke.gd
```

Expected: FAIL with `WebUiTokens.gd must exist`.

- [ ] **Step 3: Write minimal implementation**

Create `godot-client/scripts/ui/web/WebUiTokens.gd`:

```gdscript
class_name WebUiTokens
extends RefCounted

static func board_slot_size() -> int:
	return 74

static func compact_slot_size() -> int:
	return 52

static func icon_slot_size() -> int:
	return 30

static func touch_target_height() -> int:
	return 48

static func paper_color() -> Color:
	return Color(0.98, 0.92, 0.76, 0.98)

static func ink_color() -> Color:
	return Color(0.16, 0.10, 0.07, 1.0)

static func wood_color() -> Color:
	return Color(0.39, 0.22, 0.12, 1.0)

static func accent_color() -> Color:
	return Color(0.86, 0.42, 0.18, 1.0)

static func safe_color() -> Color:
	return Color(0.22, 0.52, 0.34, 1.0)

static func danger_color() -> Color:
	return Color(0.72, 0.18, 0.13, 1.0)

static func quality_color(quality: String) -> Color:
	match quality:
		"BRONZE":
			return Color(0.70, 0.42, 0.22, 1.0)
		"SILVER":
			return Color(0.74, 0.78, 0.80, 1.0)
		"GOLD":
			return Color(0.92, 0.68, 0.18, 1.0)
		"DIAMOND":
			return Color(0.32, 0.78, 0.92, 1.0)
		_:
			return Color(0.55, 0.48, 0.40, 1.0)

static func paper_card_style() -> StyleBoxFlat:
	return _style_box(paper_color(), wood_color(), 2, 8, 14)

static func wood_panel_style() -> StyleBoxFlat:
	return _style_box(Color(0.50, 0.29, 0.15, 0.96), Color(0.20, 0.10, 0.05, 1.0), 2, 8, 12)

static func handdrawn_button_style() -> StyleBoxFlat:
	return _style_box(Color(0.96, 0.76, 0.34, 1.0), Color(0.28, 0.15, 0.07, 1.0), 2, 8, 10)

static func handdrawn_button_hover_style() -> StyleBoxFlat:
	return _style_box(Color(1.0, 0.84, 0.44, 1.0), Color(0.28, 0.15, 0.07, 1.0), 2, 8, 10)

static func handdrawn_button_pressed_style() -> StyleBoxFlat:
	return _style_box(Color(0.78, 0.50, 0.22, 1.0), Color(0.18, 0.09, 0.04, 1.0), 2, 8, 10)

static func resource_pill_style() -> StyleBoxFlat:
	return _style_box(Color(1.0, 0.93, 0.68, 0.96), Color(0.35, 0.20, 0.10, 1.0), 2, 8, 8)

static func slot_style(selected: bool, over: bool) -> StyleBoxFlat:
	var bg := Color(0.91, 0.79, 0.56, 0.92)
	var border := Color(0.42, 0.25, 0.13, 1.0)
	if selected:
		border = accent_color()
	if over:
		bg = Color(1.0, 0.88, 0.44, 0.98)
	return _style_box(bg, border, 2 if selected or over else 1, 6, 4)

static func _style_box(bg: Color, border: Color, border_width: int, radius: int, margin: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.set_border_width_all(border_width)
	style.set_corner_radius_all(radius)
	style.content_margin_left = margin
	style.content_margin_top = margin
	style.content_margin_right = margin
	style.content_margin_bottom = margin
	return style
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_tokens_smoke.gd
```

Expected: PASS with `Web UI tokens smoke passed`.

- [ ] **Step 5: Commit**

```powershell
git add godot-client/scripts/ui/web/WebUiTokens.gd godot-client/scripts/tests/web_ui_tokens_smoke.gd
git commit -m "Add Godot Web UI token foundation"
```

---

### Task 3: Web 屏幕骨架基类和首批场景

**Files:**
- Create: `godot-client/scripts/ui/web/BaseWebScreen.gd`
- Create: `godot-client/scripts/ui/screens/ModeLobbyScreen.gd`
- Create: `godot-client/scripts/ui/screens/RunShellScreen.gd`
- Create: `godot-client/scripts/ui/screens/ExplorationMapScreen.gd`
- Create: `godot-client/scripts/ui/screens/RunShopScreen.gd`
- Create: `godot-client/scripts/ui/screens/RewardChoiceScreen.gd`
- Create: `godot-client/scripts/ui/screens/RunSettlementScreen.gd`
- Create: `godot-client/scripts/ui/screens/AccountShopScreen.gd`
- Create: `godot-client/scripts/ui/screens/AchievementsScreen.gd`
- Create: `godot-client/scripts/ui/screens/LeaderboardsScreen.gd`
- Create: `godot-client/scripts/ui/screens/SeasonScreen.gd`
- Create: `godot-client/scripts/ui/screens/DogfightRoomsScreen.gd`
- Create: `godot-client/scripts/ui/screens/DogfightRoomDetailScreen.gd`
- Create: `godot-client/scripts/ui/screens/AccountSettingsScreen.gd`
- Create: `godot-client/scenes/screens/ModeLobbyScreen.tscn`
- Create: `godot-client/scenes/screens/RunShellScreen.tscn`
- Create: `godot-client/scenes/screens/ExplorationMapScreen.tscn`
- Create: `godot-client/scenes/screens/RunShopScreen.tscn`
- Create: `godot-client/scenes/screens/RewardChoiceScreen.tscn`
- Create: `godot-client/scenes/screens/RunSettlementScreen.tscn`
- Create: `godot-client/scenes/screens/AccountShopScreen.tscn`
- Create: `godot-client/scenes/screens/AchievementsScreen.tscn`
- Create: `godot-client/scenes/screens/LeaderboardsScreen.tscn`
- Create: `godot-client/scenes/screens/SeasonScreen.tscn`
- Create: `godot-client/scenes/screens/DogfightRoomsScreen.tscn`
- Create: `godot-client/scenes/screens/DogfightRoomDetailScreen.tscn`
- Create: `godot-client/scenes/screens/AccountSettingsScreen.tscn`
- Test: `godot-client/scripts/tests/web_ui_main_scene_smoke.gd`

- [ ] **Step 1: Write the failing scene load test**

Create `godot-client/scripts/tests/web_ui_main_scene_smoke.gd`:

```gdscript
extends SceneTree

func _init() -> void:
	var manifest = load("res://scripts/ui/web/WebUiScreenIds.gd")
	if manifest == null:
		_fail("WebUiScreenIds.gd must load before main scene smoke")
		return

	var scene_paths := {
		"mode_lobby": "res://scenes/screens/ModeLobbyScreen.tscn",
		"run_shell": "res://scenes/screens/RunShellScreen.tscn",
		"exploration_map": "res://scenes/screens/ExplorationMapScreen.tscn",
		"run_shop": "res://scenes/screens/RunShopScreen.tscn",
		"reward_choice": "res://scenes/screens/RewardChoiceScreen.tscn",
		"run_settlement": "res://scenes/screens/RunSettlementScreen.tscn",
		"account_shop": "res://scenes/screens/AccountShopScreen.tscn",
		"achievements": "res://scenes/screens/AchievementsScreen.tscn",
		"leaderboards": "res://scenes/screens/LeaderboardsScreen.tscn",
		"season": "res://scenes/screens/SeasonScreen.tscn",
		"dogfight_rooms": "res://scenes/screens/DogfightRoomsScreen.tscn",
		"dogfight_room_detail": "res://scenes/screens/DogfightRoomDetailScreen.tscn",
		"account_settings": "res://scenes/screens/AccountSettingsScreen.tscn",
	}
	for screen_id in scene_paths.keys():
		var packed := load(str(scene_paths[screen_id]))
		if packed == null:
			_fail("Missing scene for %s at %s" % [screen_id, str(scene_paths[screen_id])])
			return
		var instance = packed.instantiate()
		if instance == null:
			_fail("Scene failed to instantiate for %s" % screen_id)
			return
		if not instance.has_method("bind_session"):
			_fail("Scene %s must expose bind_session" % screen_id)
			return
		instance.free()

	var main_scene := load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main.tscn must load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	var screen_root := main.get_node_or_null("ScreenRoot")
	if screen_root == null:
		_fail("Main.tscn must include ScreenRoot")
		return
	for screen_id in manifest.screen_ids():
		var node_name := str(manifest.node_name_for(screen_id))
		var node := screen_root.get_node_or_null(node_name)
		if node == null:
			_fail("Main ScreenRoot missing node %s for %s" % [node_name, screen_id])
			return
	if screen_root.get_node_or_null("LegacyRunScreen") == null:
		_fail("Legacy RunScreen must be renamed to LegacyRunScreen during migration")
		return
	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Web UI main scene smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_main_scene_smoke.gd
```

Expected: FAIL with a missing `res://scenes/screens/ModeLobbyScreen.tscn` scene.

- [ ] **Step 3: Create the shared base screen script**

Create `godot-client/scripts/ui/web/BaseWebScreen.gd`:

```gdscript
class_name BaseWebScreen
extends Control

var session: Node
var payload: Dictionary = {}

func bind_session(next_session: Node) -> void:
	session = next_session

func set_payload(next_payload: Dictionary) -> void:
	payload = next_payload.duplicate(true)
	_on_payload_changed()

func clear_payload() -> void:
	payload = {}
	_on_payload_changed()

func _on_payload_changed() -> void:
	pass

func _make_placeholder(title: String, subtitle: String) -> PanelContainer:
	var tokens = load("res://scripts/ui/web/WebUiTokens.gd")
	var panel := PanelContainer.new()
	panel.name = "PlaceholderPanel"
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.custom_minimum_size = Vector2(520, 220)
	if tokens != null:
		panel.add_theme_stylebox_override("panel", tokens.paper_card_style())
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 20)
	margin.add_theme_constant_override("margin_top", 18)
	margin.add_theme_constant_override("margin_right", 20)
	margin.add_theme_constant_override("margin_bottom", 18)
	panel.add_child(margin)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	margin.add_child(box)
	var title_label := Label.new()
	title_label.name = "Title"
	title_label.text = title
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title_label)
	var subtitle_label := Label.new()
	subtitle_label.name = "Subtitle"
	subtitle_label.text = subtitle
	subtitle_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(subtitle_label)
	return panel
```

- [ ] **Step 4: Create skeleton screen scripts**

Create each file below with the exact contents shown.

`godot-client/scripts/ui/screens/ModeLobbyScreen.gd`:

```gdscript
extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("模式大厅", "Web 对齐目标：模式卡、狗狗卡、当前账号摘要、继续跑局入口。"))
```

`godot-client/scripts/ui/screens/RunShellScreen.gd`:

```gdscript
extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("跑局壳", "Web 对齐目标：顶栏资源胶囊、返回大厅、音乐、当前阶段内容插槽。"))
```

`godot-client/scripts/ui/screens/ExplorationMapScreen.gd`:

```gdscript
extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("探索地图", "Web 对齐目标：路线板、节点详情、事件、掉落、怪物装备预览、路线草稿工具。"))
```

`godot-client/scripts/ui/screens/RunShopScreen.gd`:

```gdscript
extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("跑局商店", "Web 对齐目标：商店货架、商品卡、出售区、刷新、匹配入口。"))
```

`godot-client/scripts/ui/screens/RewardChoiceScreen.gd`:

```gdscript
extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("奖励选择", "Web 对齐目标：商店三选一、职业装备、附魔、遗物、升级、药水选择。"))
```

`godot-client/scripts/ui/screens/RunSettlementScreen.gd`:

```gdscript
extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("跑局结算", "Web 对齐目标：最终战绩、奖励、天梯结算、返回大厅。"))
```

`godot-client/scripts/ui/screens/AccountShopScreen.gd`:

```gdscript
extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("账号商城", "Web 对齐目标：外观商店、购买、拥有状态、装备状态。"))
```

`godot-client/scripts/ui/screens/AchievementsScreen.gd`:

```gdscript
extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("成就与每日", "Web 对齐目标：成就分类、进度、领取、每日任务刷新和领取。"))
```

`godot-client/scripts/ui/screens/LeaderboardsScreen.gd`:

```gdscript
extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("排行与巅峰", "Web 对齐目标：天梯榜、巅峰总榜、巅峰日榜、配置快照。"))
```

`godot-client/scripts/ui/screens/SeasonScreen.gd`:

```gdscript
extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("赛季", "Web 对齐目标：当前赛季、赛季历史、赛季结算和快照。"))
```

`godot-client/scripts/ui/screens/DogfightRoomsScreen.gd`:

```gdscript
extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("多人房间", "Web 对齐目标：房间列表、创建、加入、匹配。"))
```

`godot-client/scripts/ui/screens/DogfightRoomDetailScreen.gd`:

```gdscript
extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("房间详情", "Web 对齐目标：玩家席位、阶段、选狗、准备、观战、房间战报。"))
```

`godot-client/scripts/ui/screens/AccountSettingsScreen.gd`:

```gdscript
extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("个人设置", "Web 对齐目标：外观装备、音乐设置、账号操作。"))
```

- [ ] **Step 5: Create the skeleton scenes**

Create each `.tscn` with the exact pattern below, changing only `uid`, script path, and node name.

`godot-client/scenes/screens/ModeLobbyScreen.tscn`:

```text
[gd_scene load_steps=2 format=3 uid="uid://dogfight_mode_lobby_screen"]

[ext_resource type="Script" path="res://scripts/ui/screens/ModeLobbyScreen.gd" id="1_script"]

[node name="ModeLobbyScreen" type="Control"]
layout_mode = 3
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
script = ExtResource("1_script")
```

For the remaining scenes, use these pairs:

```text
uid://dogfight_run_shell_screen -> RunShellScreen -> res://scripts/ui/screens/RunShellScreen.gd
uid://dogfight_exploration_map_screen -> ExplorationMapScreen -> res://scripts/ui/screens/ExplorationMapScreen.gd
uid://dogfight_run_shop_screen -> RunShopScreen -> res://scripts/ui/screens/RunShopScreen.gd
uid://dogfight_reward_choice_screen -> RewardChoiceScreen -> res://scripts/ui/screens/RewardChoiceScreen.gd
uid://dogfight_run_settlement_screen -> RunSettlementScreen -> res://scripts/ui/screens/RunSettlementScreen.gd
uid://dogfight_account_shop_screen -> AccountShopScreen -> res://scripts/ui/screens/AccountShopScreen.gd
uid://dogfight_achievements_screen -> AchievementsScreen -> res://scripts/ui/screens/AchievementsScreen.gd
uid://dogfight_leaderboards_screen -> LeaderboardsScreen -> res://scripts/ui/screens/LeaderboardsScreen.gd
uid://dogfight_season_screen -> SeasonScreen -> res://scripts/ui/screens/SeasonScreen.gd
uid://dogfight_rooms_screen -> DogfightRoomsScreen -> res://scripts/ui/screens/DogfightRoomsScreen.gd
uid://dogfight_room_detail_screen -> DogfightRoomDetailScreen -> res://scripts/ui/screens/DogfightRoomDetailScreen.gd
uid://dogfight_account_settings_screen -> AccountSettingsScreen -> res://scripts/ui/screens/AccountSettingsScreen.gd
```

- [ ] **Step 6: Run test to verify scenes load before Main changes**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_main_scene_smoke.gd
```

Expected: FAIL with `Main ScreenRoot missing node ModeLobbyScreen for mode_lobby`.

- [ ] **Step 7: Commit**

```powershell
git add godot-client/scripts/ui/web/BaseWebScreen.gd godot-client/scripts/ui/screens godot-client/scenes/screens godot-client/scripts/tests/web_ui_main_scene_smoke.gd
git commit -m "Add Godot Web UI screen skeletons"
```

---

### Task 4: Main 场景注册 Web 屏幕并隔离 Legacy RunScreen

**Files:**
- Modify: `godot-client/scenes/Main.tscn`
- Modify: `godot-client/scripts/state/GameSession.gd`
- Test: `godot-client/scripts/tests/web_ui_main_scene_smoke.gd`
- Test: `godot-client/scripts/tests/router_smoke.gd`

- [ ] **Step 1: Add new scene resources to Main.tscn**

Modify `godot-client/scenes/Main.tscn` header to include all screen resources. Preserve existing `LoginScreen` and `BattleReplayScreen`.

```text
[gd_scene load_steps=19 format=3 uid="uid://dogfight_main"]

[ext_resource type="Script" path="res://scripts/state/GameSession.gd" id="1_session"]
[ext_resource type="PackedScene" path="res://scenes/LoginScreen.tscn" id="2_login"]
[ext_resource type="PackedScene" path="res://scenes/RunScreen.tscn" id="3_run"]
[ext_resource type="PackedScene" path="res://scenes/BattleReplayScreen.tscn" id="4_battle"]
[ext_resource type="PackedScene" path="res://scenes/overlays/OverlayRoot.tscn" id="5_overlay"]
[ext_resource type="PackedScene" path="res://scenes/screens/ModeLobbyScreen.tscn" id="6_mode_lobby"]
[ext_resource type="PackedScene" path="res://scenes/screens/RunShellScreen.tscn" id="7_run_shell"]
[ext_resource type="PackedScene" path="res://scenes/screens/ExplorationMapScreen.tscn" id="8_exploration_map"]
[ext_resource type="PackedScene" path="res://scenes/screens/RunShopScreen.tscn" id="9_run_shop"]
[ext_resource type="PackedScene" path="res://scenes/screens/RewardChoiceScreen.tscn" id="10_reward_choice"]
[ext_resource type="PackedScene" path="res://scenes/screens/RunSettlementScreen.tscn" id="11_run_settlement"]
[ext_resource type="PackedScene" path="res://scenes/screens/AccountShopScreen.tscn" id="12_account_shop"]
[ext_resource type="PackedScene" path="res://scenes/screens/AchievementsScreen.tscn" id="13_achievements"]
[ext_resource type="PackedScene" path="res://scenes/screens/LeaderboardsScreen.tscn" id="14_leaderboards"]
[ext_resource type="PackedScene" path="res://scenes/screens/SeasonScreen.tscn" id="15_season"]
[ext_resource type="PackedScene" path="res://scenes/screens/DogfightRoomsScreen.tscn" id="16_rooms"]
[ext_resource type="PackedScene" path="res://scenes/screens/DogfightRoomDetailScreen.tscn" id="17_room_detail"]
[ext_resource type="PackedScene" path="res://scenes/screens/AccountSettingsScreen.tscn" id="18_settings"]
```

- [ ] **Step 2: Rename legacy node and add Web screen instances**

Inside `ScreenRoot`, rename the old `RunScreen` instance to `LegacyRunScreen` and add new nodes:

```text
[node name="LoginScreen" parent="ScreenRoot" instance=ExtResource("2_login")]
layout_mode = 1

[node name="LegacyRunScreen" parent="ScreenRoot" instance=ExtResource("3_run")]
layout_mode = 1

[node name="ModeLobbyScreen" parent="ScreenRoot" instance=ExtResource("6_mode_lobby")]
layout_mode = 1

[node name="RunShellScreen" parent="ScreenRoot" instance=ExtResource("7_run_shell")]
layout_mode = 1

[node name="ExplorationMapScreen" parent="ScreenRoot" instance=ExtResource("8_exploration_map")]
layout_mode = 1

[node name="RunShopScreen" parent="ScreenRoot" instance=ExtResource("9_run_shop")]
layout_mode = 1

[node name="RewardChoiceScreen" parent="ScreenRoot" instance=ExtResource("10_reward_choice")]
layout_mode = 1

[node name="BattleReplayScreen" parent="ScreenRoot" instance=ExtResource("4_battle")]
layout_mode = 1

[node name="RunSettlementScreen" parent="ScreenRoot" instance=ExtResource("11_run_settlement")]
layout_mode = 1

[node name="AccountShopScreen" parent="ScreenRoot" instance=ExtResource("12_account_shop")]
layout_mode = 1

[node name="AchievementsScreen" parent="ScreenRoot" instance=ExtResource("13_achievements")]
layout_mode = 1

[node name="LeaderboardsScreen" parent="ScreenRoot" instance=ExtResource("14_leaderboards")]
layout_mode = 1

[node name="SeasonScreen" parent="ScreenRoot" instance=ExtResource("15_season")]
layout_mode = 1

[node name="DogfightRoomsScreen" parent="ScreenRoot" instance=ExtResource("16_rooms")]
layout_mode = 1

[node name="DogfightRoomDetailScreen" parent="ScreenRoot" instance=ExtResource("17_room_detail")]
layout_mode = 1

[node name="AccountSettingsScreen" parent="ScreenRoot" instance=ExtResource("18_settings")]
layout_mode = 1
```

- [ ] **Step 3: Update GameSession imports**

At the top of `godot-client/scripts/state/GameSession.gd`, add:

```gdscript
const WebUiScreenIds := preload("res://scripts/ui/web/WebUiScreenIds.gd")
```

- [ ] **Step 4: Update GameSession screen registration**

Replace the current hard-coded registration block:

```gdscript
router.register_screen("login", "LoginScreen")
router.register_screen("run", "RunScreen")
router.register_screen("battle", "BattleReplayScreen")
router.show_screen("login", false)
```

with:

```gdscript
for screen_id in WebUiScreenIds.screen_ids():
	var node_name := WebUiScreenIds.node_name_for(screen_id)
	router.register_screen(screen_id, node_name)
router.show_screen(WebUiScreenIds.LOGIN, false)
```

- [ ] **Step 5: Bind all Web skeleton screens to the session**

Add this helper to `GameSession.gd`:

```gdscript
func _bind_screen_by_name(node_name: String) -> void:
	var screen := get_node_or_null("ScreenRoot/%s" % node_name)
	if screen != null and screen.has_method("bind_session"):
		screen.bind_session(self)
```

Then replace repeated individual binding for run and battle screens with:

```gdscript
for screen_id in WebUiScreenIds.screen_ids():
	_bind_screen_by_name(WebUiScreenIds.node_name_for(screen_id))
```

Keep the existing `LoginScreen` signal binding:

```gdscript
var login_screen := get_node_or_null("ScreenRoot/LoginScreen")
if login_screen != null and login_screen.has_signal("login_succeeded") and not login_screen.login_succeeded.is_connected(_show_run_screen):
	login_screen.login_succeeded.connect(_show_run_screen)
```

- [ ] **Step 6: Route run changes to Web phase screens**

Replace `_show_run_screen()` body with:

```gdscript
func _show_run_screen() -> void:
	if router == null:
		return
	var target_screen := WebUiScreenIds.MODE_LOBBY
	if run_store != null and run_store.has_run():
		target_screen = WebUiScreenIds.screen_for_run_phase(run_store.phase())
	router.show_screen(target_screen, false)
	var target_node_name := WebUiScreenIds.node_name_for(target_screen)
	var target_node := get_node_or_null("ScreenRoot/%s" % target_node_name)
	if target_node != null and target_node.has_method("set_payload"):
		target_node.call("set_payload", {"run": run_store.run.duplicate(true), "user": current_user.duplicate(true)})
	if needs_nickname_setup:
		router.show_screen(WebUiScreenIds.NICKNAME_SETUP, true)
```

- [ ] **Step 7: Update battle route id**

In `_show_battle_screen(battle: Dictionary)`, replace:

```gdscript
router.show_screen("battle")
```

with:

```gdscript
router.show_screen(WebUiScreenIds.BATTLE_REPLAY)
```

- [ ] **Step 8: Run tests**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_main_scene_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/router_smoke.gd
```

Expected:

```text
Web UI main scene smoke passed
```

and existing router smoke passes.

- [ ] **Step 9: Commit**

```powershell
git add godot-client/scenes/Main.tscn godot-client/scripts/state/GameSession.gd godot-client/scripts/tests/web_ui_main_scene_smoke.gd
git commit -m "Register Godot Web UI screen skeletons"
```

---

### Task 5: OverlayRoot 层级补齐

**Files:**
- Modify: `godot-client/scenes/overlays/OverlayRoot.tscn`
- Test: `godot-client/scripts/tests/web_ui_overlay_layers_smoke.gd`
- Test: `godot-client/scripts/tests/router_smoke.gd`

- [ ] **Step 1: Write the failing overlay layer test**

Create `godot-client/scripts/tests/web_ui_overlay_layers_smoke.gd`:

```gdscript
extends SceneTree

func _init() -> void:
	var overlay_scene := load("res://scenes/overlays/OverlayRoot.tscn")
	if overlay_scene == null:
		_fail("OverlayRoot scene must load")
		return
	var overlay = overlay_scene.instantiate()
	root.add_child(overlay)
	await process_frame

	var expected_order := [
		"BlockingLayer",
		"DragLayer",
		"BattleFxLayer",
		"TipLayer",
		"ToastLayer",
		"ModalLayer",
		"ConfirmLayer",
		"LoadingLayer",
	]
	var previous_index := -1
	for layer_name in expected_order:
		var layer := overlay.get_node_or_null(layer_name)
		if layer == null:
			_fail("OverlayRoot missing layer: %s" % layer_name)
			return
		if not layer is Control:
			_fail("Overlay layer must be Control: %s" % layer_name)
			return
		var index := layer.get_index()
		if index <= previous_index:
			_fail("Overlay layer order is wrong at %s" % layer_name)
			return
		previous_index = index

	var blocking := overlay.get_node_or_null("BlockingLayer") as Control
	var drag := overlay.get_node_or_null("DragLayer") as Control
	var fx := overlay.get_node_or_null("BattleFxLayer") as Control
	var tips := overlay.get_node_or_null("TipLayer") as Control
	var loading := overlay.get_node_or_null("LoadingLayer") as Control
	if blocking.mouse_filter != Control.MOUSE_FILTER_STOP:
		_fail("BlockingLayer must stop input when visible")
		return
	if drag.mouse_filter != Control.MOUSE_FILTER_IGNORE:
		_fail("DragLayer must ignore input by default")
		return
	if fx.mouse_filter != Control.MOUSE_FILTER_IGNORE:
		_fail("BattleFxLayer must ignore input by default")
		return
	if tips.mouse_filter != Control.MOUSE_FILTER_IGNORE:
		_fail("TipLayer must ignore input by default")
		return
	if loading.mouse_filter != Control.MOUSE_FILTER_STOP:
		_fail("LoadingLayer must stop input when visible")
		return

	overlay.queue_free()
	for _frame in range(2):
		await process_frame
	print("Web UI overlay layers smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_overlay_layers_smoke.gd
```

Expected: FAIL with `OverlayRoot missing layer: DragLayer`.

- [ ] **Step 3: Update OverlayRoot.tscn**

Replace `godot-client/scenes/overlays/OverlayRoot.tscn` content with:

```text
[gd_scene format=3 uid="uid://dogfight_overlay_root"]

[node name="OverlayRoot" type="CanvasLayer"]
layer = 20

[node name="BlockingLayer" type="ColorRect" parent="."]
visible = false
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
mouse_filter = 0
color = Color(0, 0, 0, 0.48)

[node name="DragLayer" type="Control" parent="."]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
mouse_filter = 2

[node name="BattleFxLayer" type="Control" parent="."]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
mouse_filter = 2

[node name="TipLayer" type="Control" parent="."]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
mouse_filter = 2

[node name="ToastLayer" type="Control" parent="."]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
mouse_filter = 2

[node name="ModalLayer" type="Control" parent="."]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
mouse_filter = 2

[node name="ConfirmLayer" type="Control" parent="."]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
mouse_filter = 2

[node name="LoadingLayer" type="ColorRect" parent="."]
visible = false
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
mouse_filter = 0
color = Color(0.06, 0.04, 0.03, 0.42)
```

- [ ] **Step 4: Update router smoke layer expectations**

In `godot-client/scripts/tests/router_smoke.gd`, replace:

```gdscript
if blocking_layer.get_index() >= modal_layer.get_index():
	push_error("OverlayRoot BlockingLayer must render below ModalLayer")
	quit(1)
	return
if toast_layer.get_index() <= modal_layer.get_index():
	push_error("OverlayRoot ToastLayer must render above ModalLayer")
	quit(1)
	return
```

with:

```gdscript
if blocking_layer.get_index() >= modal_layer.get_index():
	push_error("OverlayRoot BlockingLayer must render below ModalLayer")
	quit(1)
	return
if toast_layer.get_index() >= modal_layer.get_index():
	push_error("OverlayRoot ToastLayer must render below ModalLayer and above tips")
	quit(1)
	return
var drag_layer = overlay_root.get_node_or_null("DragLayer")
var fx_layer = overlay_root.get_node_or_null("BattleFxLayer")
var tip_layer = overlay_root.get_node_or_null("TipLayer")
var confirm_layer = overlay_root.get_node_or_null("ConfirmLayer")
var loading_layer = overlay_root.get_node_or_null("LoadingLayer")
if drag_layer == null or fx_layer == null or tip_layer == null or confirm_layer == null or loading_layer == null:
	push_error("OverlayRoot must include drag, fx, tip, confirm, and loading layers")
	quit(1)
	return
if drag_layer.get_index() <= blocking_layer.get_index() or fx_layer.get_index() <= drag_layer.get_index() or tip_layer.get_index() <= fx_layer.get_index():
	push_error("OverlayRoot interactive visual layers are not ordered correctly")
	quit(1)
	return
if confirm_layer.get_index() <= modal_layer.get_index() or loading_layer.get_index() <= confirm_layer.get_index():
	push_error("OverlayRoot blocking layers are not ordered correctly")
	quit(1)
	return
```

- [ ] **Step 5: Run tests**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_overlay_layers_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/router_smoke.gd
```

Expected:

```text
Web UI overlay layers smoke passed
```

and existing router smoke passes.

- [ ] **Step 6: Commit**

```powershell
git add godot-client/scenes/overlays/OverlayRoot.tscn godot-client/scripts/tests/web_ui_overlay_layers_smoke.gd godot-client/scripts/tests/router_smoke.gd
git commit -m "Expand Godot Web UI overlay layers"
```

---

### Task 6: Route Smoke for Web Phase Navigation

**Files:**
- Create: `godot-client/scripts/tests/web_ui_phase_routing_smoke.gd`
- Modify: `godot-client/scripts/state/GameSession.gd`

- [ ] **Step 1: Write the failing phase routing test**

Create `godot-client/scripts/tests/web_ui_phase_routing_smoke.gd`:

```gdscript
extends SceneTree

func _init() -> void:
	var main_scene := load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame
	var router = main.get("router")
	if router == null:
		_fail("Main session must expose router")
		return
	var cases := {
		"MAP": "exploration_map",
		"SHOP": "run_shop",
		"CHOICE": "reward_choice",
		"CLASS_REWARD": "reward_choice",
		"ENCHANT_CHOICE": "reward_choice",
		"RELIC_CHOICE": "reward_choice",
		"UPGRADE_CHOICE": "reward_choice",
		"POTION_CHOICE": "reward_choice",
		"PREP": "run_shell",
		"MATCH": "run_shell",
		"BATTLE": "battle_replay",
		"COMPLETE": "run_settlement",
	}
	for phase in cases.keys():
		main.call("set_current_run", {
			"id": "route-smoke",
			"phase": phase,
			"status": "ACTIVE",
			"items": [],
			"relics": [],
			"shopItems": [],
		})
		await process_frame
		var expected := str(cases[phase])
		var actual := str(router.get("current_screen_id"))
		if actual != expected:
			_fail("Phase %s should route to %s, got %s" % [phase, expected, actual])
			return
	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Web UI phase routing smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
```

- [ ] **Step 2: Run test to verify it fails before `set_current_run` routes**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_phase_routing_smoke.gd
```

Expected: FAIL on at least one phase because the current implementation routes to the old run screen.

- [ ] **Step 3: Ensure set_current_run emits route changes**

In `godot-client/scripts/state/GameSession.gd`, make `set_current_run` call `_show_run_screen()` after emitting `run_changed`:

```gdscript
func set_current_run(run: Dictionary) -> void:
	store.set_current_run(run)
	run_changed.emit(run)
	_show_run_screen()
```

If `set_current_run` already exists with additional logic, preserve that logic and append `_show_run_screen()` after the state mutation and signal emit.

- [ ] **Step 4: Run phase routing test**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_phase_routing_smoke.gd
```

Expected: PASS with `Web UI phase routing smoke passed`.

- [ ] **Step 5: Run all foundation smoke tests**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_screen_manifest_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_tokens_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_main_scene_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_overlay_layers_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_phase_routing_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/router_smoke.gd
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add godot-client/scripts/tests/web_ui_phase_routing_smoke.gd godot-client/scripts/state/GameSession.gd
git commit -m "Route Godot run phases to Web UI screens"
```

---

### Task 7: Build and Delivery Check

**Files:**
- Modify only if previous tasks changed code or scenes.

- [ ] **Step 1: Run required Godot foundation tests**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_screen_manifest_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_tokens_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_main_scene_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_overlay_layers_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_phase_routing_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/router_smoke.gd
```

Expected: all commands exit 0.

- [ ] **Step 2: Run Web/package build because Godot UI code and scenes changed**

Run:

```powershell
npm run build
```

Expected: command exits 0 and regenerates:

```text
E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd
```

- [ ] **Step 3: Check working tree**

Run:

```powershell
git status --short
```

Expected: only intentional files from the current task are changed. Existing unrelated untracked `.uid` files may remain untracked; do not stage them unless they were produced by this task and are required for Godot scene/script identity.

- [ ] **Step 4: Final commit if build generated tracked outputs**

If `npm run build` changes tracked files, commit them:

```powershell
git add dist dist-click
git commit -m "Build standalone after Godot Web UI foundation"
```

If `npm run build` does not change tracked files, do not create an empty commit.

- [ ] **Step 5: Merge and push delivery branch**

If implementation happens on `main`, push:

```powershell
git push origin main
```

If implementation happens on a non-main branch:

```powershell
git switch main
git pull --ff-only origin main
git merge --no-ff <implementation-branch>
npm run build
git push origin main
```

Expected: `main` contains the implementation and the remote push succeeds.

---

## Plan Self-Review

- Spec coverage: this plan covers the foundation requirements from the exact Web UI migration spec: screen manifest, phase routing, UI token base, overlay layers, main scene registration, legacy workbench isolation, and tests. It intentionally does not implement full map/shop/battle/account/multiplayer UI bodies; those are separate subsystem plans.
- Placeholder scan: the plan contains no unfinished placeholder markers, no undefined “write tests later” steps, and every code-changing task includes concrete code or exact edit blocks.
- Type consistency: `WebUiScreenIds.screen_ids()`, `node_name_for()`, and `screen_for_run_phase()` are defined in Task 1 and reused consistently in later tasks. `BaseWebScreen.bind_session()` and `set_payload()` are defined in Task 3 and used by Task 4.
