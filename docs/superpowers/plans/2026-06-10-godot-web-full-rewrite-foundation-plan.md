# Godot Web Full Rewrite Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Godot 全量重写为 Web 等价 UI 的阶段 0/1 基座：功能矩阵、正式路由约束、共享 Shell、共享按钮/资源胶囊、Overlay 层级契约，以及一个低风险屏幕接入样例。

**Architecture:** 本阶段不删除 `LegacyRunScreen`，也不重写战斗、地图、商店和多人房间主体。先把“哪些功能要迁移、哪些正式路由不得走 Legacy、所有新屏幕应使用什么 Shell 与共享控件”固定下来，给后续逐域重写提供稳定边界。

**Tech Stack:** Godot 4.x GDScript、Godot `.tscn` 场景、现有 `GameSession.gd` / `ScreenRouter.gd` / `WebUiScreenIds.gd`、现有 Godot headless smoke 测试、现有 Fastify API 路由。

---

## Scope Boundary

本计划只覆盖规格文档 `docs/superpowers/specs/2026-06-10-godot-web-full-rewrite-parity-design.md` 中的阶段 0 和阶段 1。

本计划完成后应具备：

- 一份 Godot 可加载的 Web/Godot 功能矩阵 manifest。
- 一份明确的 Legacy 依赖清单，标记当前迁移期仍允许 Legacy 的场景。
- 一个正式路由策略工具，区分“正式 Web 等价屏幕”和“迁移期 Legacy fallback”。
- 一个可实例化、可测试的 `WebShell` 原生组件。
- 共享 `WebActionButton` 与 `WebResourcePill` 工厂。
- `SeasonScreen` 作为低风险样例接入 `WebShell`。
- Overlay 层级 smoke 扩展，覆盖 Tip、Toast、Modal、Confirm、Loading 的相对顺序。

本计划不处理：

- 删除 `LegacyRunScreen`。
- 重写战斗回放。
- 重写探索地图、商店、奖励选择、多人与完整跑局流程。
- 改动 TypeScript 服务端规则。
- 改动数值或外部 Excel。

## File Structure

- Create: `godot-client/scripts/ui/web/WebParityManifest.gd`  
  存放 Web 功能域、Godot 目标屏幕、源 Web 组件名、迁移阶段、当前状态、Legacy 允许原因。

- Create: `godot-client/scripts/tests/web_parity_manifest_smoke.gd`  
  验证 manifest 覆盖所有规格功能域，且每个功能域都有 source of truth、目标屏幕、阶段、状态。

- Create: `godot-client/scripts/ui/web/WebRoutePolicy.gd`  
  集中声明正式 Web 等价路由、迁移期允许的 Legacy fallback、run phase 到正式屏幕的映射。

- Create: `godot-client/scripts/tests/web_route_policy_smoke.gd`  
  验证正式路由不会把已迁移的 appScreen 或 run phase 映射到 `legacy_run`。

- Create: `godot-client/scripts/ui/shared/WebActionButton.gd`  
  工厂类，创建 Web 风格按钮并提供统一 disabled/loading 样式。

- Create: `godot-client/scripts/ui/shared/WebResourcePill.gd`  
  工厂类，创建金币、货币、胜负、回合、段位等资源胶囊。

- Create: `godot-client/scripts/tests/web_shared_controls_smoke.gd`  
  验证按钮和资源胶囊尺寸、文本、禁用态、圆角和鼠标过滤。

- Create: `godot-client/scripts/ui/shell/WebShell.gd`  
  统一登录后屏幕 Shell，包含顶栏、内容容器、错误区域、返回大厅、登出、音乐按钮、语言按钮占位接口。

- Create: `godot-client/scenes/shell/WebShell.tscn`  
  可实例化的 Shell 场景。

- Create: `godot-client/scripts/tests/web_shell_smoke.gd`  
  验证 Shell 场景加载、顶栏结构、资源胶囊、内容容器、按钮回调信号。

- Modify: `godot-client/scenes/screens/SeasonScreen.tscn`  
  将低风险的赛季屏幕根节点保留，内部由脚本构建 Shell。

- Modify: `godot-client/scripts/ui/screens/SeasonScreen.gd`  
  作为第一个接入 `WebShell` 的样例屏幕，保持现有功能但使用统一 Shell。

- Create: `godot-client/scripts/tests/season_web_shell_integration_smoke.gd`  
  验证 `SeasonScreen` 不显示 placeholder，不进入 Legacy，且包含统一 Shell 顶栏与赛季内容。

- Modify: `godot-client/scripts/tests/web_ui_overlay_layers_smoke.gd`  
  扩展层级检查，明确 Tip、Toast、Modal、Confirm、Loading 的顺序。

---

### Task 1: Web/Godot 功能矩阵 Manifest

**Files:**
- Create: `godot-client/scripts/ui/web/WebParityManifest.gd`
- Create: `godot-client/scripts/tests/web_parity_manifest_smoke.gd`

- [ ] **Step 1: Write the failing test**

Create `godot-client/scripts/tests/web_parity_manifest_smoke.gd`:

```gdscript
extends SceneTree

func _init() -> void:
	var manifest_script := load("res://scripts/ui/web/WebParityManifest.gd")
	if manifest_script == null:
		_fail("WebParityManifest.gd must exist")
		return

	var domains: Array = manifest_script.domains()
	var required := [
		"auth",
		"nickname",
		"shell",
		"mode_lobby",
		"dog_select",
		"exploration_map",
		"run_shop",
		"inventory",
		"reward_choice",
		"run_shell",
		"battle_replay",
		"run_settlement",
		"account_history",
		"account_shop",
		"achievements_daily",
		"account_settings",
		"leaderboards",
		"apex",
		"season",
		"dogfight_rooms",
		"dogfight_room_detail",
		"localization",
		"audio_assets",
	]
	for id in required:
		var entry := _find_domain(domains, id)
		if entry.is_empty():
			_fail("Missing parity domain: %s" % id)
			return
		for key in ["id", "webSource", "godotTarget", "phase", "status"]:
			if str(entry.get(key, "")).strip_edges().is_empty():
				_fail("Parity domain %s missing key %s" % [id, key])
				return
		if not ["baseline", "foundation", "run_core", "battle", "account", "dogfight", "final"].has(str(entry.get("phase", ""))):
			_fail("Parity domain %s has invalid phase: %s" % [id, str(entry.get("phase", ""))])
			return
		if not ["aligned", "partial", "gap", "legacy_only"].has(str(entry.get("status", ""))):
			_fail("Parity domain %s has invalid status: %s" % [id, str(entry.get("status", ""))])
			return

	var legacy_allowed: Array = manifest_script.legacy_allowed_domains()
	if not legacy_allowed.has("battle_replay"):
		_fail("Battle replay must be explicitly listed while migration still allows Legacy fallback")
		return
	if legacy_allowed.has("account_shop"):
		_fail("Account shop is already standalone and must not be listed as Legacy allowed")
		return

	print("Web parity manifest smoke passed")
	quit(0)

func _find_domain(domains: Array, id: String) -> Dictionary:
	for entry in domains:
		if entry is Dictionary and str(entry.get("id", "")) == id:
			return entry
	return {}

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_parity_manifest_smoke.gd
```

Expected: FAIL with `WebParityManifest.gd must exist`.

- [ ] **Step 3: Write minimal implementation**

Create `godot-client/scripts/ui/web/WebParityManifest.gd`:

```gdscript
class_name WebParityManifest
extends RefCounted

const DOMAINS := [
	{"id": "auth", "webSource": "GameApp auth-shell", "godotTarget": "LoginScreen", "phase": "foundation", "status": "partial", "legacyAllowed": false},
	{"id": "nickname", "webSource": "NicknameSetup", "godotTarget": "NicknameSetupScreen", "phase": "foundation", "status": "partial", "legacyAllowed": false},
	{"id": "shell", "webSource": "Shell / TopBar / FeedbackLayer", "godotTarget": "WebShell", "phase": "foundation", "status": "gap", "legacyAllowed": false},
	{"id": "mode_lobby", "webSource": "ModeLobby / PlayerRunHistoryPanel", "godotTarget": "ModeLobbyScreen", "phase": "foundation", "status": "partial", "legacyAllowed": false},
	{"id": "dog_select", "webSource": "DogSelect / LadderHome", "godotTarget": "DogSelectScreen", "phase": "foundation", "status": "partial", "legacyAllowed": false},
	{"id": "exploration_map", "webSource": "ExplorationMapView", "godotTarget": "ExplorationMapScreen", "phase": "run_core", "status": "partial", "legacyAllowed": true},
	{"id": "run_shop", "webSource": "ShopShelf / ShopCard", "godotTarget": "RunShopScreen", "phase": "run_core", "status": "partial", "legacyAllowed": true},
	{"id": "inventory", "webSource": "InventoryBoard / GridPanel / RelicRail / FloatingTip", "godotTarget": "shared inventory components", "phase": "run_core", "status": "partial", "legacyAllowed": true},
	{"id": "reward_choice", "webSource": "ShopChoiceSelect / ClassRewardSelect / EnchantChoiceSelect / RelicChoiceSelect / UpgradeChoiceSelect / PotionChoiceSelect", "godotTarget": "RewardChoiceScreen", "phase": "run_core", "status": "partial", "legacyAllowed": true},
	{"id": "run_shell", "webSource": "PREP/MATCH panels / ForfeitRunAction", "godotTarget": "RunShellScreen", "phase": "run_core", "status": "partial", "legacyAllowed": true},
	{"id": "battle_replay", "webSource": "BattleView / BattleStage / BattleEquipmentRow / BattleFxStage / CollapsedBattleLog", "godotTarget": "BattleReplayScreen", "phase": "battle", "status": "gap", "legacyAllowed": true},
	{"id": "run_settlement", "webSource": "SettlementView / BattleReviewDashboard", "godotTarget": "RunSettlementScreen", "phase": "run_core", "status": "partial", "legacyAllowed": true},
	{"id": "account_history", "webSource": "PlayerHistoryOverlay / HistoryRunDetails", "godotTarget": "AccountHistoryScreen", "phase": "account", "status": "partial", "legacyAllowed": true},
	{"id": "account_shop", "webSource": "AccountShopScreen / ShopCatalogSection", "godotTarget": "AccountShopScreen", "phase": "account", "status": "partial", "legacyAllowed": false},
	{"id": "achievements_daily", "webSource": "AchievementsScreen daily and achievements panels", "godotTarget": "AchievementsScreen", "phase": "account", "status": "partial", "legacyAllowed": false},
	{"id": "account_settings", "webSource": "AccountSettingsScreen", "godotTarget": "AccountSettingsScreen", "phase": "account", "status": "partial", "legacyAllowed": false},
	{"id": "leaderboards", "webSource": "LadderHome / ladder leaderboard panels", "godotTarget": "LeaderboardsScreen", "phase": "account", "status": "partial", "legacyAllowed": false},
	{"id": "apex", "webSource": "ApexArena / ApexSnapshotDetails", "godotTarget": "ApexScreen", "phase": "account", "status": "partial", "legacyAllowed": false},
	{"id": "season", "webSource": "SeasonHistoryList / season summary cards", "godotTarget": "SeasonScreen", "phase": "foundation", "status": "partial", "legacyAllowed": false},
	{"id": "dogfight_rooms", "webSource": "DogfightLobby", "godotTarget": "DogfightRoomsScreen", "phase": "dogfight", "status": "partial", "legacyAllowed": true},
	{"id": "dogfight_room_detail", "webSource": "DogfightRoomView / DogfightRunWorkbench", "godotTarget": "DogfightRoomDetailScreen", "phase": "dogfight", "status": "partial", "legacyAllowed": true},
	{"id": "localization", "webSource": "src/i18n and RuleText", "godotTarget": "future localization service", "phase": "final", "status": "gap", "legacyAllowed": false},
	{"id": "audio_assets", "webSource": "musicPreferenceKey / backgroundMusicSrc / sound feedback", "godotTarget": "FeedbackSoundBus and Godot audio assets", "phase": "foundation", "status": "partial", "legacyAllowed": false},
]

static func domains() -> Array:
	return DOMAINS.duplicate(true)

static func legacy_allowed_domains() -> Array[String]:
	var ids: Array[String] = []
	for entry in DOMAINS:
		if bool(entry.get("legacyAllowed", false)):
			ids.append(str(entry.get("id", "")))
	return ids
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_parity_manifest_smoke.gd
```

Expected: PASS with `Web parity manifest smoke passed`.

- [ ] **Step 5: Commit**

```powershell
git add godot-client/scripts/ui/web/WebParityManifest.gd godot-client/scripts/tests/web_parity_manifest_smoke.gd
git commit -m "Add Godot Web parity manifest"
```

---

### Task 2: Formal Route Policy

**Files:**
- Create: `godot-client/scripts/ui/web/WebRoutePolicy.gd`
- Create: `godot-client/scripts/tests/web_route_policy_smoke.gd`

- [ ] **Step 1: Write the failing test**

Create `godot-client/scripts/tests/web_route_policy_smoke.gd`:

```gdscript
extends SceneTree

func _init() -> void:
	var policy := load("res://scripts/ui/web/WebRoutePolicy.gd")
	if policy == null:
		_fail("WebRoutePolicy.gd must exist")
		return

	var formal_screens: Array = policy.formal_screen_ids()
	for required in ["login", "nickname_setup", "mode_lobby", "dog_select", "season", "account_shop", "achievements", "account_settings", "leaderboards", "apex"]:
		if not formal_screens.has(required):
			_fail("Formal screen missing: %s" % required)
			return
	if formal_screens.has("legacy_run"):
		_fail("legacy_run must never be a formal Web parity screen")
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
		var actual := str(policy.formal_screen_for_run_phase(phase))
		var expected := str(phase_expectations[phase])
		if actual != expected:
			_fail("Phase %s should route to %s, got %s" % [phase, expected, actual])
			return
	if str(policy.formal_screen_for_run_phase("UNKNOWN_PHASE")) != "mode_lobby":
		_fail("Unknown formal run phase should route to mode_lobby, not Legacy")
		return

	for phase in ["MAP", "SHOP", "BATTLE"]:
		if not policy.migration_allows_legacy_for_phase(phase):
			_fail("Migration policy should explicitly allow Legacy fallback for high-risk phase %s" % phase)
			return
	if policy.migration_allows_legacy_for_screen("account_shop"):
		_fail("account_shop must not allow Legacy fallback")
		return

	print("Web route policy smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_route_policy_smoke.gd
```

Expected: FAIL with `WebRoutePolicy.gd must exist`.

- [ ] **Step 3: Write minimal implementation**

Create `godot-client/scripts/ui/web/WebRoutePolicy.gd`:

```gdscript
class_name WebRoutePolicy
extends RefCounted

const WebUiScreenIds := preload("res://scripts/ui/web/WebUiScreenIds.gd")

const FORMAL_SCREENS := [
	WebUiScreenIds.LOGIN,
	WebUiScreenIds.NICKNAME_SETUP,
	WebUiScreenIds.MODE_LOBBY,
	WebUiScreenIds.DOG_SELECT,
	WebUiScreenIds.RUN_SHELL,
	WebUiScreenIds.EXPLORATION_MAP,
	WebUiScreenIds.RUN_SHOP,
	WebUiScreenIds.REWARD_CHOICE,
	WebUiScreenIds.BATTLE_REPLAY,
	WebUiScreenIds.RUN_SETTLEMENT,
	WebUiScreenIds.ACCOUNT,
	WebUiScreenIds.ACCOUNT_SHOP,
	WebUiScreenIds.ACHIEVEMENTS,
	WebUiScreenIds.LEADERBOARDS,
	WebUiScreenIds.APEX,
	WebUiScreenIds.SEASON,
	WebUiScreenIds.DOGFIGHT_ROOMS,
	WebUiScreenIds.DOGFIGHT_ROOM_DETAIL,
	WebUiScreenIds.ACCOUNT_SETTINGS,
]

const FORMAL_PHASE_ROUTES := {
	"MAP": WebUiScreenIds.EXPLORATION_MAP,
	"CHOICE": WebUiScreenIds.REWARD_CHOICE,
	"CLASS_REWARD": WebUiScreenIds.REWARD_CHOICE,
	"ENCHANT_CHOICE": WebUiScreenIds.REWARD_CHOICE,
	"RELIC_CHOICE": WebUiScreenIds.REWARD_CHOICE,
	"UPGRADE_CHOICE": WebUiScreenIds.REWARD_CHOICE,
	"POTION_CHOICE": WebUiScreenIds.REWARD_CHOICE,
	"SHOP": WebUiScreenIds.RUN_SHOP,
	"PREP": WebUiScreenIds.RUN_SHELL,
	"MATCH": WebUiScreenIds.RUN_SHELL,
	"BATTLE": WebUiScreenIds.BATTLE_REPLAY,
	"COMPLETE": WebUiScreenIds.RUN_SETTLEMENT,
}

const LEGACY_PHASE_FALLBACKS := ["MAP", "SHOP", "BATTLE", "MATCH", "PREP", "CHOICE", "CLASS_REWARD", "ENCHANT_CHOICE", "RELIC_CHOICE", "UPGRADE_CHOICE", "POTION_CHOICE", "COMPLETE"]
const LEGACY_SCREEN_FALLBACKS := [WebUiScreenIds.ACCOUNT, WebUiScreenIds.DOGFIGHT_ROOMS, WebUiScreenIds.DOGFIGHT_ROOM_DETAIL]

static func formal_screen_ids() -> Array:
	return FORMAL_SCREENS.duplicate(true)

static func formal_screen_for_run_phase(phase: String) -> String:
	return str(FORMAL_PHASE_ROUTES.get(phase, WebUiScreenIds.MODE_LOBBY))

static func migration_allows_legacy_for_phase(phase: String) -> bool:
	return LEGACY_PHASE_FALLBACKS.has(phase)

static func migration_allows_legacy_for_screen(screen_id: String) -> bool:
	return LEGACY_SCREEN_FALLBACKS.has(screen_id)
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_route_policy_smoke.gd
```

Expected: PASS with `Web route policy smoke passed`.

- [ ] **Step 5: Commit**

```powershell
git add godot-client/scripts/ui/web/WebRoutePolicy.gd godot-client/scripts/tests/web_route_policy_smoke.gd
git commit -m "Add Godot Web route policy"
```

---

### Task 3: Shared Web Controls

**Files:**
- Create: `godot-client/scripts/ui/shared/WebActionButton.gd`
- Create: `godot-client/scripts/ui/shared/WebResourcePill.gd`
- Create: `godot-client/scripts/tests/web_shared_controls_smoke.gd`

- [ ] **Step 1: Write the failing test**

Create `godot-client/scripts/tests/web_shared_controls_smoke.gd`:

```gdscript
extends SceneTree

func _init() -> void:
	var button_script := load("res://scripts/ui/shared/WebActionButton.gd")
	var pill_script := load("res://scripts/ui/shared/WebResourcePill.gd")
	if button_script == null:
		_fail("WebActionButton.gd must exist")
		return
	if pill_script == null:
		_fail("WebResourcePill.gd must exist")
		return

	var clicked := {"count": 0}
	var button: Button = button_script.create("返回大厅", func() -> void:
		clicked.count += 1
	)
	root.add_child(button)
	await process_frame
	if button.text != "返回大厅":
		_fail("Web action button text mismatch")
		return
	if button.custom_minimum_size.y < 44.0:
		_fail("Web action button must keep stable touch height")
		return
	button.pressed.emit()
	if clicked.count != 1:
		_fail("Web action button callback did not fire")
		return
	button_script.set_loading(button, true, "处理中")
	if not button.disabled or button.text != "处理中":
		_fail("Loading action button must be disabled and show loading text")
		return
	button_script.set_loading(button, false, "返回大厅")
	if button.disabled or button.text != "返回大厅":
		_fail("Action button must restore enabled state and label")
		return

	var pill: PanelContainer = pill_script.create("金币", "12", "gold")
	root.add_child(pill)
	await process_frame
	if pill.name != "ResourcePill_gold":
		_fail("Resource pill node name mismatch")
		return
	if pill.custom_minimum_size.y < 34.0:
		_fail("Resource pill must keep stable height")
		return
	var label := pill.find_child("ResourcePillText", true, false)
	if label == null or not str(label.get("text")).contains("金币 12"):
		_fail("Resource pill text mismatch")
		return

	button.queue_free()
	pill.queue_free()
	print("Web shared controls smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shared_controls_smoke.gd
```

Expected: FAIL with `WebActionButton.gd must exist`.

- [ ] **Step 3: Write minimal implementation**

Create `godot-client/scripts/ui/shared/WebActionButton.gd`:

```gdscript
class_name WebActionButton
extends RefCounted

const WebUiTokens := preload("res://scripts/ui/web/WebUiTokens.gd")

static func create(label: String, callback: Callable, variant := "primary") -> Button:
	var button := Button.new()
	button.text = label
	button.custom_minimum_size = Vector2(128, WebUiTokens.touch_target_height())
	button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	button.mouse_filter = Control.MOUSE_FILTER_STOP
	button.add_theme_stylebox_override("normal", _style_for_variant(variant))
	button.add_theme_stylebox_override("hover", WebUiTokens.handdrawn_button_hover_style())
	button.add_theme_stylebox_override("pressed", WebUiTokens.handdrawn_button_pressed_style())
	button.add_theme_color_override("font_color", WebUiTokens.ink_color())
	if callback.is_valid():
		button.pressed.connect(callback)
	return button

static func set_loading(button: Button, loading: bool, label: String) -> void:
	button.disabled = loading
	button.text = label

static func _style_for_variant(variant: String) -> StyleBoxFlat:
	if variant == "danger":
		return WebUiTokens.danger_button_style() if WebUiTokens.has_method("danger_button_style") else WebUiTokens.handdrawn_button_style()
	if variant == "secondary":
		return WebUiTokens.secondary_button_style() if WebUiTokens.has_method("secondary_button_style") else WebUiTokens.handdrawn_button_style()
	return WebUiTokens.handdrawn_button_style()
```

Create `godot-client/scripts/ui/shared/WebResourcePill.gd`:

```gdscript
class_name WebResourcePill
extends RefCounted

const WebUiTokens := preload("res://scripts/ui/web/WebUiTokens.gd")

static func create(label: String, value: Variant, tone := "neutral") -> PanelContainer:
	var pill := PanelContainer.new()
	pill.name = "ResourcePill_%s" % tone
	pill.custom_minimum_size = Vector2(110, 34)
	pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pill.add_theme_stylebox_override("panel", WebUiTokens.resource_pill_style())
	var text := Label.new()
	text.name = "ResourcePillText"
	text.text = "%s %s" % [label, str(value)]
	text.custom_minimum_size = Vector2(0, 30)
	text.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	text.add_theme_color_override("font_color", WebUiTokens.ink_color())
	pill.add_child(text)
	return pill
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shared_controls_smoke.gd
```

Expected: PASS with `Web shared controls smoke passed`.

- [ ] **Step 5: Commit**

```powershell
git add godot-client/scripts/ui/shared/WebActionButton.gd godot-client/scripts/ui/shared/WebResourcePill.gd godot-client/scripts/tests/web_shared_controls_smoke.gd
git commit -m "Add Godot Web shared controls"
```

---

### Task 4: WebShell Scene and Script

**Files:**
- Create: `godot-client/scripts/ui/shell/WebShell.gd`
- Create: `godot-client/scenes/shell/WebShell.tscn`
- Create: `godot-client/scripts/tests/web_shell_smoke.gd`

- [ ] **Step 1: Write the failing test**

Create `godot-client/scripts/tests/web_shell_smoke.gd`:

```gdscript
extends SceneTree

func _init() -> void:
	var shell_scene := load("res://scenes/shell/WebShell.tscn")
	if shell_scene == null:
		_fail("WebShell scene must exist")
		return
	var shell = shell_scene.instantiate()
	root.add_child(shell)
	await process_frame

	if shell.get_node_or_null("Root/TopBar") == null:
		_fail("WebShell must include TopBar")
		return
	if shell.get_node_or_null("Root/Content") == null:
		_fail("WebShell must include Content container")
		return
	if shell.get_node_or_null("Root/ErrorLabel") == null:
		_fail("WebShell must include ErrorLabel")
		return
	if not shell.has_signal("lobby_requested"):
		_fail("WebShell must expose lobby_requested signal")
		return
	if not shell.has_signal("logout_requested"):
		_fail("WebShell must expose logout_requested signal")
		return

	shell.call("set_user", {"nickname": "测试玩家", "account": "tester"})
	shell.call("set_run", {"gold": 12, "wins": 2, "losses": 1, "round": 4})
	shell.call("set_error", "网络错误")
	await process_frame

	var user_label := shell.find_child("UserLabel", true, false)
	if user_label == null or not str(user_label.get("text")).contains("测试玩家"):
		_fail("WebShell user label did not render nickname")
		return
	var error_label := shell.get_node_or_null("Root/ErrorLabel")
	if error_label == null or not str(error_label.get("text")).contains("网络错误") or not error_label.visible:
		_fail("WebShell error label did not render visible error")
		return
	if shell.find_child("ResourcePill_gold", true, false) == null:
		_fail("WebShell must render gold resource pill when run exists")
		return

	var lobby_count := {"count": 0}
	var logout_count := {"count": 0}
	shell.lobby_requested.connect(func() -> void: lobby_count.count += 1)
	shell.logout_requested.connect(func() -> void: logout_count.count += 1)
	var lobby_button := shell.find_child("LobbyButton", true, false)
	var logout_button := shell.find_child("LogoutButton", true, false)
	if lobby_button == null or logout_button == null:
		_fail("WebShell must include lobby and logout buttons")
		return
	lobby_button.pressed.emit()
	logout_button.pressed.emit()
	if lobby_count.count != 1 or logout_count.count != 1:
		_fail("WebShell button signals did not fire")
		return

	shell.queue_free()
	print("Web shell smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shell_smoke.gd
```

Expected: FAIL with `WebShell scene must exist`.

- [ ] **Step 3: Write minimal implementation**

Create `godot-client/scripts/ui/shell/WebShell.gd`:

```gdscript
class_name WebShell
extends Control

signal lobby_requested
signal logout_requested
signal music_toggle_requested
signal language_toggle_requested

const WebUiTokens := preload("res://scripts/ui/web/WebUiTokens.gd")
const WebActionButton := preload("res://scripts/ui/shared/WebActionButton.gd")
const WebResourcePill := preload("res://scripts/ui/shared/WebResourcePill.gd")

@onready var top_bar: HBoxContainer = $Root/TopBar
@onready var resource_row: HBoxContainer = $Root/TopBar/ResourceRow
@onready var user_label: Label = $Root/TopBar/UserLabel
@onready var content: VBoxContainer = $Root/Content
@onready var error_label: Label = $Root/ErrorLabel

var user: Dictionary = {}
var run: Dictionary = {}

func _ready() -> void:
	_apply_style()
	_render_actions()
	set_error("")

func content_container() -> VBoxContainer:
	return content

func set_user(next_user: Dictionary) -> void:
	user = next_user.duplicate(true)
	var nickname := str(user.get("nickname", user.get("account", "玩家")))
	user_label.text = nickname if not nickname.strip_edges().is_empty() else "玩家"

func set_run(next_run: Dictionary) -> void:
	run = next_run.duplicate(true)
	_render_resources()

func set_error(message: String) -> void:
	error_label.text = message
	error_label.visible = not message.strip_edges().is_empty()

func clear_content() -> void:
	for child in content.get_children():
		child.queue_free()

func _render_actions() -> void:
	var lobby_button := WebActionButton.create("返回大厅", func() -> void: lobby_requested.emit(), "secondary")
	lobby_button.name = "LobbyButton"
	var music_button := WebActionButton.create("音乐", func() -> void: music_toggle_requested.emit(), "secondary")
	music_button.name = "MusicButton"
	var language_button := WebActionButton.create("语言", func() -> void: language_toggle_requested.emit(), "secondary")
	language_button.name = "LanguageButton"
	var logout_button := WebActionButton.create("登出", func() -> void: logout_requested.emit(), "danger")
	logout_button.name = "LogoutButton"
	top_bar.add_child(lobby_button)
	top_bar.add_child(music_button)
	top_bar.add_child(language_button)
	top_bar.add_child(logout_button)

func _render_resources() -> void:
	for child in resource_row.get_children():
		child.queue_free()
	if run.is_empty():
		return
	resource_row.add_child(WebResourcePill.create("金币", int(run.get("gold", 0)), "gold"))
	resource_row.add_child(WebResourcePill.create("胜负", "%s/%s" % [int(run.get("wins", 0)), int(run.get("losses", 0))], "record"))
	resource_row.add_child(WebResourcePill.create("回合", int(run.get("round", 0)), "round"))

func _apply_style() -> void:
	add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	error_label.add_theme_color_override("font_color", WebUiTokens.danger_color())
	user_label.add_theme_color_override("font_color", WebUiTokens.ink_color())
```

Create `godot-client/scenes/shell/WebShell.tscn`:

```text
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://scripts/ui/shell/WebShell.gd" id="1_shell"]

[node name="WebShell" type="Control"]
layout_mode = 3
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
script = ExtResource("1_shell")

[node name="Root" type="VBoxContainer" parent="."]
layout_mode = 1
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
theme_override_constants/separation = 10

[node name="TopBar" type="HBoxContainer" parent="Root"]
layout_mode = 2
custom_minimum_size = Vector2(0, 56)
theme_override_constants/separation = 8

[node name="UserLabel" type="Label" parent="Root/TopBar"]
layout_mode = 2
custom_minimum_size = Vector2(140, 44)
text = "玩家"
vertical_alignment = 1

[node name="ResourceRow" type="HBoxContainer" parent="Root/TopBar"]
layout_mode = 2
size_flags_horizontal = 3
theme_override_constants/separation = 8

[node name="ErrorLabel" type="Label" parent="Root"]
visible = false
layout_mode = 2
custom_minimum_size = Vector2(0, 28)
autowrap_mode = 3

[node name="Content" type="VBoxContainer" parent="Root"]
layout_mode = 2
size_flags_vertical = 3
theme_override_constants/separation = 10
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shell_smoke.gd
```

Expected: PASS with `Web shell smoke passed`.

- [ ] **Step 5: Commit**

```powershell
git add godot-client/scripts/ui/shell/WebShell.gd godot-client/scenes/shell/WebShell.tscn godot-client/scripts/tests/web_shell_smoke.gd
git commit -m "Add Godot Web shell foundation"
```

---

### Task 5: SeasonScreen WebShell Integration

**Files:**
- Modify: `godot-client/scripts/ui/screens/SeasonScreen.gd`
- Modify: `godot-client/scenes/screens/SeasonScreen.tscn`
- Create: `godot-client/scripts/tests/season_web_shell_integration_smoke.gd`

- [ ] **Step 1: Write the failing integration test**

Create `godot-client/scripts/tests/season_web_shell_integration_smoke.gd`:

```gdscript
extends SceneTree

func _init() -> void:
	var scene := load("res://scenes/screens/SeasonScreen.tscn")
	if scene == null:
		_fail("SeasonScreen scene must load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame

	if screen.find_child("WebShell", true, false) == null:
		_fail("SeasonScreen must include WebShell")
		return
	if screen.find_child("LegacyRunScreen", true, false) != null:
		_fail("SeasonScreen must not embed LegacyRunScreen")
		return
	if screen.find_child("PlaceholderPanel", true, false) != null:
		_fail("SeasonScreen must not show placeholder content")
		return

	screen.call("set_payload", {
		"user": {"nickname": "赛季玩家"},
		"run": {"gold": 9, "wins": 1, "losses": 0, "round": 2},
		"season": {"id": "season-1", "name": "第一赛季", "status": "ACTIVE"},
		"seasonSummaries": [
			{"id": "summary-1", "seasonName": "测试赛季", "ladderTier": "SILVER", "ladderScore": 120, "apexRank": 3}
		],
	})
	await process_frame

	var text := _collect_text(screen)
	for part in ["赛季玩家", "金币 9", "第一赛季", "测试赛季", "SILVER", "120"]:
		if not text.contains(part):
			_fail("SeasonScreen missing WebShell or season text: %s" % part)
			return

	screen.queue_free()
	print("Season WebShell integration smoke passed")
	quit(0)

func _collect_text(node: Node) -> String:
	var parts: Array[String] = []
	_collect_text_into(node, parts)
	return "\n".join(parts)

func _collect_text_into(node: Node, parts: Array[String]) -> void:
	if node is Label or node is Button:
		parts.append(str(node.get("text")))
	for child in node.get_children():
		_collect_text_into(child, parts)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_web_shell_integration_smoke.gd
```

Expected: FAIL with `SeasonScreen must include WebShell`.

- [ ] **Step 3: Modify SeasonScreen to use WebShell**

Update `godot-client/scenes/screens/SeasonScreen.tscn` so it still instantiates `SeasonScreen.gd` on the root node. The root can remain a `Control`; no scene-level child nodes are required because the script builds the content.

In `godot-client/scripts/ui/screens/SeasonScreen.gd`, add a WebShell preload and replace the screen root build with a shell-backed layout. Preserve existing helper methods where possible.

Use this structure:

```gdscript
extends BaseWebScreen

const WebShellScene := preload("res://scenes/shell/WebShell.tscn")
const WebUiTokens := preload("res://scripts/ui/web/WebUiTokens.gd")

var shell: WebShell
var content: VBoxContainer

func _ready() -> void:
	_build_screen()

func _on_payload_changed() -> void:
	_render()

func _build_screen() -> void:
	for child in get_children():
		child.queue_free()
	shell = WebShellScene.instantiate()
	shell.name = "WebShell"
	add_child(shell)
	shell.lobby_requested.connect(func() -> void:
		if session != null and session.has_method("open_screen"):
			session.call("open_screen", "mode_lobby")
	)
	shell.logout_requested.connect(func() -> void:
		if session != null and session.has_method("logout"):
			session.call("logout")
	)
	content = shell.content_container()
	_render()

func _render() -> void:
	if shell == null:
		return
	shell.set_user(_dict(payload, "user"))
	shell.set_run(_dict(payload, "run"))
	shell.set_error("")
	shell.clear_content()
	var season := _dict(payload, "season")
	var summaries := _array(payload, "seasonSummaries")
	_render_current_season(season)
	_render_season_history_list(summaries)
```

Keep or adapt the existing `_render_current_season`, `_render_season_history_list`, `_render_season_history_card`, `_show_snapshot`, `_action_button`, `_add_label`, `_dict`, `_array`, and label formatting helpers so they append to `content` rather than an old root container. Ensure no node is named `PlaceholderPanel`.

- [ ] **Step 4: Run the integration test**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_web_shell_integration_smoke.gd
```

Expected: PASS with `Season WebShell integration smoke passed`.

- [ ] **Step 5: Run existing Season smoke tests**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_standalone_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_history_web_detail_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_history_labels_smoke.gd
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add godot-client/scripts/ui/screens/SeasonScreen.gd godot-client/scenes/screens/SeasonScreen.tscn godot-client/scripts/tests/season_web_shell_integration_smoke.gd
git commit -m "Migrate Godot season screen to Web shell"
```

---

### Task 6: Overlay Layer Contract Expansion

**Files:**
- Modify: `godot-client/scripts/tests/web_ui_overlay_layers_smoke.gd`
- Modify only if failing: `godot-client/scenes/overlays/OverlayRoot.tscn`

- [ ] **Step 1: Extend the failing/guarding overlay test**

Modify `godot-client/scripts/tests/web_ui_overlay_layers_smoke.gd` to require this exact render order:

```gdscript
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
```

Add these checks after the existing order checks:

```gdscript
var tip_layer := overlay.get_node_or_null("TipLayer") as Control
var toast_layer := overlay.get_node_or_null("ToastLayer") as Control
var modal_layer := overlay.get_node_or_null("ModalLayer") as Control
var confirm_layer := overlay.get_node_or_null("ConfirmLayer") as Control
var loading_layer := overlay.get_node_or_null("LoadingLayer") as Control
if tip_layer.get_index() >= toast_layer.get_index():
	_fail("TipLayer must render below ToastLayer")
	return
if toast_layer.get_index() >= modal_layer.get_index():
	_fail("ToastLayer must render below ModalLayer")
	return
if modal_layer.get_index() >= confirm_layer.get_index():
	_fail("ModalLayer must render below ConfirmLayer")
	return
if confirm_layer.get_index() >= loading_layer.get_index():
	_fail("ConfirmLayer must render below LoadingLayer")
	return
```

- [ ] **Step 2: Run the test**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_overlay_layers_smoke.gd
```

Expected if current scene is already correct: PASS with `Web UI overlay layers smoke passed`.  
Expected if scene is not correct: FAIL with a layer ordering message from the added checks.

- [ ] **Step 3: Fix OverlayRoot only if needed**

If Step 2 fails, update `godot-client/scenes/overlays/OverlayRoot.tscn` so children under `OverlayRoot` appear in this exact order:

```text
BlockingLayer
DragLayer
BattleFxLayer
TipLayer
ToastLayer
ModalLayer
ConfirmLayer
LoadingLayer
```

Use `mouse_filter = 2` for non-blocking visual layers and `mouse_filter = 0` for `BlockingLayer` and `LoadingLayer`.

- [ ] **Step 4: Run overlay and router smoke tests**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_overlay_layers_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/router_smoke.gd
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

If only the test changed:

```powershell
git add godot-client/scripts/tests/web_ui_overlay_layers_smoke.gd
git commit -m "Tighten Godot Web overlay layer contract"
```

If the scene also changed:

```powershell
git add godot-client/scripts/tests/web_ui_overlay_layers_smoke.gd godot-client/scenes/overlays/OverlayRoot.tscn
git commit -m "Tighten Godot Web overlay layer contract"
```

---

### Task 7: Foundation Verification and Delivery

**Files:**
- No new files unless verification reveals required fixes.

- [ ] **Step 1: Run all new foundation tests**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_parity_manifest_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_route_policy_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shared_controls_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shell_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_web_shell_integration_smoke.gd
```

Expected: all commands exit 0.

- [ ] **Step 2: Run regression smoke tests for touched areas**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_screen_manifest_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_main_scene_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_overlay_layers_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/router_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_standalone_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_history_web_detail_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_history_labels_smoke.gd
```

Expected: all commands exit 0.

- [ ] **Step 3: Run required build**

Because this plan changes Godot UI, shared UI code, scenes, and frontend-facing playable behavior, run:

```powershell
npm run build
```

Expected: command exits 0 and regenerates:

```text
E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd
```

- [ ] **Step 4: Check working tree**

Run:

```powershell
git status --short
```

Expected:

- Only intentional files from this foundation work are staged or modified.
- Existing unrelated Godot `.uid` files from before this work are not staged unless the implementation explicitly created and requires them.
- Existing unrelated worktree changes are not reverted.

- [ ] **Step 5: Commit build artifacts only if tracked files changed**

If `npm run build` changed tracked build outputs, commit them:

```powershell
git add dist dist-click
git commit -m "Build standalone after Godot Web shell foundation"
```

If no tracked build output changed, do not create an empty commit.

- [ ] **Step 6: Push main after final verification**

If implementation was done on `main`:

```powershell
git push origin main
```

If implementation was done on a feature branch:

```powershell
git switch main
git pull --ff-only origin main
git merge --no-ff <implementation-branch>
npm run build
git push origin main
```

Expected: remote `main` contains the foundation work.

---

## Plan Self-Review

### Spec coverage

This plan covers the first executable slice of the approved full rewrite spec:

- Stage 0 baseline matrix: Task 1.
- Formal route and Legacy boundary: Task 2.
- Shared controls for the future Shell and stable dimensions: Task 3.
- Web Shell foundation: Task 4.
- First low-risk screen integration: Task 5.
- UI layer contract: Task 6.
- Required verification and build: Task 7.

This plan intentionally does not implement the later spec sections for map, shop, rewards, battle, settlement, account systems, dogfight, localization, and asset sync. Those require separate plans after this foundation lands.

### Placeholder scan

The plan contains no `TBD`, no `TODO`, and no “write tests later” steps. Each code-changing task includes a concrete failing test, expected failure, implementation sketch, pass command, and commit command.

### Type consistency

The plan uses these stable names consistently:

- `WebParityManifest.domains()`
- `WebParityManifest.legacy_allowed_domains()`
- `WebRoutePolicy.formal_screen_ids()`
- `WebRoutePolicy.formal_screen_for_run_phase(phase)`
- `WebRoutePolicy.migration_allows_legacy_for_phase(phase)`
- `WebRoutePolicy.migration_allows_legacy_for_screen(screen_id)`
- `WebActionButton.create(label, callback, variant)`
- `WebActionButton.set_loading(button, loading, label)`
- `WebResourcePill.create(label, value, tone)`
- `WebShell.content_container()`
- `WebShell.set_user(user)`
- `WebShell.set_run(run)`
- `WebShell.set_error(message)`
- `WebShell.clear_content()`

