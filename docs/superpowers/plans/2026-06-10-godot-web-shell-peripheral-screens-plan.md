# Godot Web Shell 外围页面迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Godot 登录后的外围页面统一迁移到 `WebShell`，让大厅、账号、成就、设置、排行榜、巅峰与赛季页面共享同一顶栏、资源胶囊、返回大厅、登出、错误区和稳定尺寸约束。

**Architecture:** 本阶段建立一个 `ShellBackedWebScreen` 基类，避免每个独立屏幕重复手写 Shell 接线。随后按低风险到中风险顺序迁移 `SeasonScreen`、账号相关页面、排行/巅峰页面和 `ModeLobbyScreen`。本阶段不重写地图、跑局商店、奖励选择、备战、战斗和多人房间主体。

**Tech Stack:** Godot 4.x GDScript、现有 `BaseWebScreen.gd`、`WebShell.gd`、`WebActionButton.gd`、`WebResourcePill.gd`、现有 screen `.tscn`、Godot headless smoke 测试、`npm run build`。

---

## Scope Boundary

本计划覆盖规格中的阶段 1 后续工作：让已独立的外围页面真正复用统一 `WebShell`。它承接上一阶段已落地的文件：

- `godot-client/scripts/ui/shell/WebShell.gd`
- `godot-client/scenes/shell/WebShell.tscn`
- `godot-client/scripts/ui/shared/WebActionButton.gd`
- `godot-client/scripts/ui/shared/WebResourcePill.gd`
- `godot-client/scripts/ui/web/WebRoutePolicy.gd`
- `godot-client/scripts/ui/screens/SeasonScreen.gd`

本计划完成后应具备：

- 一个可复用的 `ShellBackedWebScreen` 基类。
- `SeasonScreen` 从手写 Shell 接线迁移到基类，作为模式样例。
- `AccountSettingsScreen`、`AccountShopScreen`、`AchievementsScreen` 使用统一 Shell。
- `LeaderboardsScreen`、`ApexScreen` 使用统一 Shell。
- `ModeLobbyScreen` 使用统一 Shell，并保持模式入口、历史面板与当前 run 入口可用。
- 对每个迁移屏幕都有“不显示 Placeholder、不嵌入 LegacyRunScreen、包含 WebShell 顶栏”的 smoke。
- 对长昵称、长资源值、按钮文案保持稳定尺寸的回归测试。

本计划不处理：

- 删除 `LegacyRunScreen`。
- 跑局核心屏幕：`ExplorationMapScreen`、`RunShopScreen`、`RewardChoiceScreen`、`RunShellScreen`、`BattleReplayScreen`、`RunSettlementScreen`。
- 多人房间主体：`DogfightRoomsScreen`、`DogfightRoomDetailScreen`。
- TypeScript 服务端规则。
- 数值或外部 Excel。

## File Structure

- Create: `godot-client/scripts/ui/web/ShellBackedWebScreen.gd`  
  统一 Shell 接线基类，负责实例化 `WebShell`、连接返回大厅/登出信号、把 `payload.user` 与 `payload.run` 同步到顶栏，并暴露 `shell_content` 给子类渲染正文。

- Create: `godot-client/scripts/tests/shell_backed_web_screen_smoke.gd`  
  验证基类可实例化、可接收 payload、可渲染用户/资源、可清理正文、可触发返回大厅/登出。

- Modify: `godot-client/scripts/ui/screens/SeasonScreen.gd`  
  改为继承 `ShellBackedWebScreen`，删除本地 Shell 接线重复代码，保留当前赛季和历史渲染 helper。

- Modify: `godot-client/scripts/ui/screens/AccountSettingsScreen.gd`  
  接入 `ShellBackedWebScreen`，正文保留外观设置、默认外观、拥有外观、装备/卸下逻辑。

- Modify: `godot-client/scripts/ui/screens/AccountShopScreen.gd`  
  接入 `ShellBackedWebScreen`，正文保留余额、商品分组、购买/装备、失败提示结构。

- Modify: `godot-client/scripts/ui/screens/AchievementsScreen.gd`  
  接入 `ShellBackedWebScreen`，正文保留每日任务、刷新、领取、成就分类、成就卡。

- Modify: `godot-client/scripts/ui/screens/LeaderboardsScreen.gd`  
  接入 `ShellBackedWebScreen`，正文保留天梯首页、段位、榜单、近期结算。

- Modify: `godot-client/scripts/ui/screens/ApexScreen.gd`  
  接入 `ShellBackedWebScreen`，正文保留候选配置、提交、排行、快照入口。

- Modify: `godot-client/scripts/ui/screens/ModeLobbyScreen.gd`  
  接入 `ShellBackedWebScreen`，正文保留模式卡、历史摘要、active run 入口、新手引导入口。

- Create: `godot-client/scripts/tests/peripheral_shell_integration_smoke.gd`  
  统一验证外围屏幕都包含 `WebShell`、不包含 `PlaceholderPanel`、不嵌入 `LegacyRunScreen`、能渲染用户昵称和资源胶囊。

- Modify existing tests:
  - `godot-client/scripts/tests/season_web_shell_integration_smoke.gd`
  - `godot-client/scripts/tests/account_settings_standalone_web_structure_smoke.gd`
  - `godot-client/scripts/tests/account_shop_standalone_screen_smoke.gd`
  - `godot-client/scripts/tests/achievements_standalone_web_structure_smoke.gd`
  - `godot-client/scripts/tests/leaderboards_standalone_ladder_web_structure_smoke.gd`
  - `godot-client/scripts/tests/apex_standalone_web_structure_smoke.gd`
  - `godot-client/scripts/tests/mode_lobby_standalone_after_auth_smoke.gd`

---

### Task 1: ShellBackedWebScreen Base Class

**Files:**
- Create: `godot-client/scripts/ui/web/ShellBackedWebScreen.gd`
- Create: `godot-client/scripts/tests/shell_backed_web_screen_smoke.gd`

- [ ] **Step 1: Write the failing test**

Create `godot-client/scripts/tests/shell_backed_web_screen_smoke.gd`:

```gdscript
extends SceneTree

const ShellBackedWebScreen := preload("res://scripts/ui/web/ShellBackedWebScreen.gd")

func _init() -> void:
	var screen := ShellBackedWebScreen.new()
	root.add_child(screen)
	await process_frame

	if screen.find_child("WebShell", true, false) == null:
		_fail("ShellBackedWebScreen must create WebShell")
		return
	if screen.call("content_container") == null:
		_fail("ShellBackedWebScreen must expose content_container")
		return
	if not screen.call("content_container") is VBoxContainer:
		_fail("ShellBackedWebScreen content_container must be VBoxContainer")
		return

	screen.call("set_payload", {
		"user": {"nickname": "外围玩家"},
		"run": {"gold": 33, "wins": 2, "losses": 1, "round": 4},
	})
	await process_frame

	var text := _collect_text(screen)
	for part in ["外围玩家", "金币 33", "胜负 2/1", "回合 4"]:
		if not text.contains(part):
			_fail("ShellBackedWebScreen missing shell text: %s" % part)
			return

	screen.call("clear_shell_content")
	var content: VBoxContainer = screen.call("content_container")
	var label := Label.new()
	label.name = "TemporaryContent"
	content.add_child(label)
	screen.call("clear_shell_content")
	await process_frame
	if screen.find_child("TemporaryContent", true, false) != null:
		_fail("ShellBackedWebScreen must clear shell content")
		return

	screen.queue_free()
	print("Shell backed Web screen smoke passed")
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
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/shell_backed_web_screen_smoke.gd
```

Expected: FAIL with `ShellBackedWebScreen.gd` missing or script load failure.

- [ ] **Step 3: Write minimal implementation**

Create `godot-client/scripts/ui/web/ShellBackedWebScreen.gd`:

```gdscript
class_name ShellBackedWebScreen
extends BaseWebScreen

const WebShellScene := preload("res://scenes/shell/WebShell.tscn")

var shell: WebShell
var shell_content: VBoxContainer

func _ready() -> void:
	_build_shell_screen()
	_render_shell()

func content_container() -> VBoxContainer:
	_ensure_shell()
	return shell_content

func clear_shell_content() -> void:
	_ensure_shell()
	shell.clear_content()

func _on_payload_changed() -> void:
	_render_shell()

func _build_shell_screen() -> void:
	if shell != null:
		return
	for child in get_children():
		remove_child(child)
		child.queue_free()
	shell = WebShellScene.instantiate()
	shell.name = "WebShell"
	add_child(shell)
	shell_content = shell.content_container()
	_connect_shell_actions()

func _connect_shell_actions() -> void:
	shell.lobby_requested.connect(func() -> void:
		if session != null and session.has_method("open_screen"):
			session.call("open_screen", "mode_lobby")
	)
	shell.logout_requested.connect(func() -> void:
		if session != null and session.has_method("logout"):
			session.call("logout")
	)

func _render_shell() -> void:
	_ensure_shell()
	shell.set_user(_dict(payload, "user"))
	shell.set_run(_dict(payload, "run"))
	shell.set_error(str(payload.get("error", "")))
	clear_shell_content()
	_render_shell_content()

func _render_shell_content() -> void:
	pass

func _ensure_shell() -> void:
	if shell == null:
		_build_shell_screen()

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value = source.get(key, {})
	return value if value is Dictionary else {}

func _array(source: Dictionary, key: String) -> Array:
	var value = source.get(key, [])
	return value if value is Array else []
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/shell_backed_web_screen_smoke.gd
```

Expected: PASS with `Shell backed Web screen smoke passed`.

- [ ] **Step 5: Commit**

```powershell
git add godot-client/scripts/ui/web/ShellBackedWebScreen.gd godot-client/scripts/tests/shell_backed_web_screen_smoke.gd
git commit -m "Add shell-backed Godot Web screen base"
```

---

### Task 2: SeasonScreen Refactor to ShellBackedWebScreen

**Files:**
- Modify: `godot-client/scripts/ui/screens/SeasonScreen.gd`
- Modify: `godot-client/scripts/tests/season_web_shell_integration_smoke.gd`

- [ ] **Step 1: Write the guarding test update**

Update `godot-client/scripts/tests/season_web_shell_integration_smoke.gd` to add these checks after the existing `WebShell` check:

```gdscript
if not screen is ShellBackedWebScreen:
	_fail("SeasonScreen must inherit ShellBackedWebScreen")
	return
var content = screen.call("content_container")
if content == null or not content is VBoxContainer:
	_fail("SeasonScreen must expose ShellBackedWebScreen content container")
	return
```

Add this preload at the top:

```gdscript
const ShellBackedWebScreen := preload("res://scripts/ui/web/ShellBackedWebScreen.gd")
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_web_shell_integration_smoke.gd
```

Expected: FAIL with `SeasonScreen must inherit ShellBackedWebScreen`.

- [ ] **Step 3: Refactor SeasonScreen**

Modify `godot-client/scripts/ui/screens/SeasonScreen.gd`:

```gdscript
extends ShellBackedWebScreen

const WebUiTokens := preload("res://scripts/ui/web/WebUiTokens.gd")

var content_box: VBoxContainer

func _render_shell_content() -> void:
	_build_content_frame()
	_render_current_season()
	_render_season_history_list(_season_summaries())

func _build_content_frame() -> void:
	var panel := PanelContainer.new()
	panel.name = "SeasonPanel"
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.custom_minimum_size = Vector2(0, 420)
	panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	content_container().add_child(panel)

	var scroll := ScrollContainer.new()
	scroll.name = "SeasonScroll"
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	panel.add_child(scroll)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_top", 22)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_bottom", 22)
	scroll.add_child(margin)

	content_box = VBoxContainer.new()
	content_box.name = "SeasonScreen"
	content_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content_box.add_theme_constant_override("separation", 14)
	margin.add_child(content_box)
```

Keep the existing helper methods below this block, but remove local `WebShellScene`, `shell` variable, `_ready()`, `_on_payload_changed()`, `_build_screen()`, and `_render()` because `ShellBackedWebScreen` now owns those.

- [ ] **Step 4: Run Season regression tests**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_web_shell_integration_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_standalone_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_history_web_detail_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_history_labels_smoke.gd
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add godot-client/scripts/ui/screens/SeasonScreen.gd godot-client/scripts/tests/season_web_shell_integration_smoke.gd
git commit -m "Refactor season screen onto Web shell base"
```

---

### Task 3: Account Settings and Account Shop Shell Migration

**Files:**
- Modify: `godot-client/scripts/ui/screens/AccountSettingsScreen.gd`
- Modify: `godot-client/scripts/ui/screens/AccountShopScreen.gd`
- Modify: `godot-client/scripts/tests/account_settings_standalone_web_structure_smoke.gd`
- Modify: `godot-client/scripts/tests/account_shop_standalone_screen_smoke.gd`

- [ ] **Step 1: Write failing Shell assertions**

In `account_settings_standalone_web_structure_smoke.gd` and `account_shop_standalone_screen_smoke.gd`, add:

```gdscript
if screen.find_child("WebShell", true, false) == null:
	_fail("Screen must include WebShell")
	return
if screen.find_child("LegacyRunScreen", true, false) != null:
	_fail("Screen must not embed LegacyRunScreen")
	return
if screen.find_child("PlaceholderPanel", true, false) != null:
	_fail("Screen must not show PlaceholderPanel")
	return
```

For account shop, also assert the top bar receives wallet/user payload:

```gdscript
screen.call("set_payload", {
	"user": {"nickname": "商城玩家"},
	"run": {"gold": 7, "wins": 0, "losses": 0, "round": 1},
	"wallet": {"soft": 120},
	"items": [],
})
await process_frame
var text := _collect_text(screen)
for part in ["商城玩家", "金币 7"]:
	if not text.contains(part):
		_fail("Account shop missing WebShell text: %s" % part)
		return
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/account_settings_standalone_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/account_shop_standalone_screen_smoke.gd
```

Expected: FAIL with `Screen must include WebShell`.

- [ ] **Step 3: Modify AccountSettingsScreen**

Change the first line of `godot-client/scripts/ui/screens/AccountSettingsScreen.gd`:

```gdscript
extends ShellBackedWebScreen
```

Replace its current `_ready()` / `_on_payload_changed()` outer build pattern with:

```gdscript
func _render_shell_content() -> void:
	_build_settings_content(content_container())
```

If the file currently builds directly under `self`, move that root content into `_build_settings_content(parent: VBoxContainer)`. Keep existing node names and action callbacks.

- [ ] **Step 4: Modify AccountShopScreen**

Change the first line of `godot-client/scripts/ui/screens/AccountShopScreen.gd`:

```gdscript
extends ShellBackedWebScreen
```

Replace its current `_ready()` / `_on_payload_changed()` outer build pattern with:

```gdscript
func _render_shell_content() -> void:
	_build_shop_content(content_container())
```

If the file currently reads user/wallet from `payload`, keep that behavior. Do not move purchase/equip API calls; only move the visual root into Shell content.

- [ ] **Step 5: Run account regressions**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/account_settings_standalone_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/account_settings_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/account_settings_card_detail_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/account_shop_standalone_screen_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/account_shop_catalog_labels_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/account_shop_purchase_failure_ui_smoke.gd
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add godot-client/scripts/ui/screens/AccountSettingsScreen.gd godot-client/scripts/ui/screens/AccountShopScreen.gd godot-client/scripts/tests/account_settings_standalone_web_structure_smoke.gd godot-client/scripts/tests/account_shop_standalone_screen_smoke.gd
git commit -m "Migrate account screens to Web shell"
```

---

### Task 4: Achievements Shell Migration

**Files:**
- Modify: `godot-client/scripts/ui/screens/AchievementsScreen.gd`
- Modify: `godot-client/scripts/tests/achievements_standalone_web_structure_smoke.gd`

- [ ] **Step 1: Write failing Shell assertions**

Update `achievements_standalone_web_structure_smoke.gd`:

```gdscript
if achievements.find_child("WebShell", true, false) == null:
	_fail("AchievementsScreen must include WebShell")
	return
if achievements.find_child("LegacyRunScreen", true, false) != null:
	_fail("AchievementsScreen must not embed LegacyRunScreen")
	return
if achievements.find_child("PlaceholderPanel", true, false) != null:
	_fail("AchievementsScreen must not show PlaceholderPanel")
	return
```

Also ensure payload renders top-bar user:

```gdscript
achievements.call("set_payload", {
	"user": {"nickname": "成就玩家"},
	"run": {"gold": 5, "wins": 1, "losses": 1, "round": 2},
	"achievements": [],
	"dailyTasks": [],
})
await process_frame
var text := _collect_text(achievements)
for part in ["成就玩家", "金币 5"]:
	if not text.contains(part):
		_fail("AchievementsScreen missing WebShell text: %s" % part)
		return
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/achievements_standalone_web_structure_smoke.gd
```

Expected: FAIL with `AchievementsScreen must include WebShell`.

- [ ] **Step 3: Modify AchievementsScreen**

Change `godot-client/scripts/ui/screens/AchievementsScreen.gd`:

```gdscript
extends ShellBackedWebScreen

func _render_shell_content() -> void:
	_build_achievements_content(content_container())
```

Move the current body-building code into `_build_achievements_content(parent: VBoxContainer)`. Preserve existing node names for:

- Daily task panel.
- Refresh button.
- Claim buttons.
- Achievement category tabs.
- Achievement cards.
- Empty states.

- [ ] **Step 4: Run achievements regressions**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/achievements_standalone_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/achievements_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/achievement_card_web_detail_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/achievement_category_labels_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/daily_task_web_detail_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/daily_task_state_labels_smoke.gd
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add godot-client/scripts/ui/screens/AchievementsScreen.gd godot-client/scripts/tests/achievements_standalone_web_structure_smoke.gd
git commit -m "Migrate achievements screen to Web shell"
```

---

### Task 5: Leaderboards and Apex Shell Migration

**Files:**
- Modify: `godot-client/scripts/ui/screens/LeaderboardsScreen.gd`
- Modify: `godot-client/scripts/ui/screens/ApexScreen.gd`
- Modify: `godot-client/scripts/tests/leaderboards_standalone_ladder_web_structure_smoke.gd`
- Modify: `godot-client/scripts/tests/apex_standalone_web_structure_smoke.gd`

- [ ] **Step 1: Write failing Shell assertions**

In both standalone tests, add:

```gdscript
if screen.find_child("WebShell", true, false) == null:
	_fail("Screen must include WebShell")
	return
if screen.find_child("LegacyRunScreen", true, false) != null:
	_fail("Screen must not embed LegacyRunScreen")
	return
if screen.find_child("PlaceholderPanel", true, false) != null:
	_fail("Screen must not show PlaceholderPanel")
	return
```

Set a payload with user/run and assert top-bar text:

```gdscript
screen.call("set_payload", {
	"user": {"nickname": "榜单玩家"},
	"run": {"gold": 11, "wins": 3, "losses": 0, "round": 5},
})
await process_frame
var text := _collect_text(screen)
for part in ["榜单玩家", "金币 11"]:
	if not text.contains(part):
		_fail("Screen missing WebShell text: %s" % part)
		return
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/leaderboards_standalone_ladder_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/apex_standalone_web_structure_smoke.gd
```

Expected: FAIL with `Screen must include WebShell`.

- [ ] **Step 3: Modify LeaderboardsScreen**

Change `godot-client/scripts/ui/screens/LeaderboardsScreen.gd`:

```gdscript
extends ShellBackedWebScreen

func _render_shell_content() -> void:
	_build_leaderboards_content(content_container())
```

Move current body-building code into `_build_leaderboards_content(parent: VBoxContainer)`. Preserve node names used by leaderboard tests.

- [ ] **Step 4: Modify ApexScreen**

Change `godot-client/scripts/ui/screens/ApexScreen.gd`:

```gdscript
extends ShellBackedWebScreen

func _render_shell_content() -> void:
	_build_apex_content(content_container())
```

Move current body-building code into `_build_apex_content(parent: VBoxContainer)`. Preserve node names for candidate cards, submit action, leaderboard rows, and snapshot buttons.

- [ ] **Step 5: Run leaderboard and apex regressions**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/leaderboards_standalone_ladder_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/ladder_home_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/ladder_home_web_detail_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/ladder_leaderboard_labels_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/apex_standalone_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/apex_home_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/apex_candidate_labels_smoke.gd
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add godot-client/scripts/ui/screens/LeaderboardsScreen.gd godot-client/scripts/ui/screens/ApexScreen.gd godot-client/scripts/tests/leaderboards_standalone_ladder_web_structure_smoke.gd godot-client/scripts/tests/apex_standalone_web_structure_smoke.gd
git commit -m "Migrate leaderboard and apex screens to Web shell"
```

---

### Task 6: ModeLobby Shell Migration

**Files:**
- Modify: `godot-client/scripts/ui/screens/ModeLobbyScreen.gd`
- Modify: `godot-client/scripts/tests/mode_lobby_standalone_after_auth_smoke.gd`
- Modify: `godot-client/scripts/tests/mode_lobby_web_text_structure_smoke.gd`

- [ ] **Step 1: Write failing Shell assertions**

Update `mode_lobby_standalone_after_auth_smoke.gd`:

```gdscript
if mode_lobby.find_child("WebShell", true, false) == null:
	_fail("ModeLobbyScreen must include WebShell")
	return
if mode_lobby.find_child("LegacyRunScreen", true, false) != null:
	_fail("ModeLobbyScreen must not embed LegacyRunScreen")
	return
if mode_lobby.find_child("PlaceholderPanel", true, false) != null:
	_fail("ModeLobbyScreen must not show PlaceholderPanel")
	return
```

Update `mode_lobby_web_text_structure_smoke.gd` to include top-bar text:

```gdscript
screen.call("set_payload", {
	"user": {"nickname": "大厅玩家"},
	"run": {"gold": 19, "wins": 4, "losses": 1, "round": 6},
	"history": {},
	"seasonSummaries": [],
})
await process_frame
var text := _collect_text(screen)
for part in ["大厅玩家", "金币 19"]:
	if not text.contains(part):
		_fail("ModeLobbyScreen missing WebShell text: %s" % part)
		return
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_standalone_after_auth_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_web_text_structure_smoke.gd
```

Expected: FAIL with `ModeLobbyScreen must include WebShell`.

- [ ] **Step 3: Modify ModeLobbyScreen**

Change `godot-client/scripts/ui/screens/ModeLobbyScreen.gd`:

```gdscript
extends ShellBackedWebScreen

func _render_shell_content() -> void:
	_build_mode_lobby_content(content_container())
```

Move the existing lobby body into `_build_mode_lobby_content(parent: VBoxContainer)`. Preserve:

- Casual mode entry.
- Ladder entry.
- Dogfight entry.
- Apex entry.
- Tutorial replay entry.
- Active run continuation entry.
- Account/history/settings/achievements/shop navigation entries.
- Existing node names used by smoke tests.

- [ ] **Step 4: Run lobby regressions**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_standalone_after_auth_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_web_text_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_action_guard_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_history_entry_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_ladder_entry_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_rooms_entry_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_peak_entry_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_tutorial_entry_smoke.gd
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add godot-client/scripts/ui/screens/ModeLobbyScreen.gd godot-client/scripts/tests/mode_lobby_standalone_after_auth_smoke.gd godot-client/scripts/tests/mode_lobby_web_text_structure_smoke.gd
git commit -m "Migrate mode lobby to Web shell"
```

---

### Task 7: Unified Peripheral Shell Integration Guard

**Files:**
- Create: `godot-client/scripts/tests/peripheral_shell_integration_smoke.gd`

- [ ] **Step 1: Write the integration guard**

Create `godot-client/scripts/tests/peripheral_shell_integration_smoke.gd`:

```gdscript
extends SceneTree

const CASES := [
	{"scene": "res://scenes/screens/ModeLobbyScreen.tscn", "name": "ModeLobbyScreen"},
	{"scene": "res://scenes/screens/SeasonScreen.tscn", "name": "SeasonScreen"},
	{"scene": "res://scenes/screens/AccountSettingsScreen.tscn", "name": "AccountSettingsScreen"},
	{"scene": "res://scenes/screens/AccountShopScreen.tscn", "name": "AccountShopScreen"},
	{"scene": "res://scenes/screens/AchievementsScreen.tscn", "name": "AchievementsScreen"},
	{"scene": "res://scenes/screens/LeaderboardsScreen.tscn", "name": "LeaderboardsScreen"},
	{"scene": "res://scenes/screens/ApexScreen.tscn", "name": "ApexScreen"},
]

func _init() -> void:
	for case in CASES:
		await _assert_shell_case(case)
	print("Peripheral shell integration smoke passed")
	quit(0)

func _assert_shell_case(case: Dictionary) -> void:
	var packed = load(str(case.scene))
	if packed == null:
		_fail("%s scene must load" % str(case.name))
		return
	var screen = packed.instantiate()
	root.add_child(screen)
	await process_frame
	if screen.find_child("WebShell", true, false) == null:
		_fail("%s must include WebShell" % str(case.name))
		return
	if screen.find_child("LegacyRunScreen", true, false) != null:
		_fail("%s must not embed LegacyRunScreen" % str(case.name))
		return
	if screen.find_child("PlaceholderPanel", true, false) != null:
		_fail("%s must not show PlaceholderPanel" % str(case.name))
		return
	if screen.has_method("set_payload"):
		screen.call("set_payload", {
			"user": {"nickname": "统一玩家"},
			"run": {"gold": 21, "wins": 2, "losses": 2, "round": 8},
		})
		await process_frame
		var text := _collect_text(screen)
		if not text.contains("统一玩家") or not text.contains("金币 21"):
			_fail("%s must render shared shell user and resource text" % str(case.name))
			return
	screen.queue_free()
	await process_frame

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

- [ ] **Step 2: Run the integration guard**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/peripheral_shell_integration_smoke.gd
```

Expected: PASS with `Peripheral shell integration smoke passed`.

- [ ] **Step 3: Commit**

```powershell
git add godot-client/scripts/tests/peripheral_shell_integration_smoke.gd
git commit -m "Guard peripheral screens use Web shell"
```

---

### Task 8: Final Verification and Delivery

**Files:**
- No new files unless verification reveals required fixes.

- [ ] **Step 1: Run foundation and peripheral Shell tests**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shell_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shared_controls_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/shell_backed_web_screen_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/peripheral_shell_integration_smoke.gd
```

Expected: all commands exit 0.

- [ ] **Step 2: Run migrated screen regressions**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_web_shell_integration_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/season_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/account_settings_standalone_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/account_shop_standalone_screen_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/achievements_standalone_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/leaderboards_standalone_ladder_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/apex_standalone_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_standalone_after_auth_smoke.gd
```

Expected: all commands exit 0.

- [ ] **Step 3: Run router and overlay regressions**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_route_policy_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_main_scene_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_overlay_layers_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/router_smoke.gd
```

Expected: all commands exit 0.

- [ ] **Step 4: Run required build**

Because this plan changes Godot UI and playable packaging, run:

```powershell
npm run build
```

Expected: command exits 0 and regenerates:

```text
E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd
```

- [ ] **Step 5: Check working tree**

Run:

```powershell
git status --short
```

Expected:

- Only intentional files from this Shell migration are modified or staged.
- Existing unrelated user changes are not reverted.
- Godot `.uid` files are not staged unless implementation explicitly requires them.

- [ ] **Step 6: Push main after final verification**

If implementation was done on a feature branch:

```powershell
git switch main
git pull --ff-only origin main
git merge --no-ff <implementation-branch>
npm run build
git push origin main
```

Expected: remote `main` contains the peripheral Shell migration.

---

## Plan Self-Review

### Spec coverage

This plan covers the next safe slice of the approved full rewrite spec:

- Stage 1 Shell reuse across low-risk logged-in screens.
- Shared top-bar behavior across Season, account, achievements, leaderboard, apex, and lobby.
- Stable dimensions and no placeholder/Legacy embedding checks for migrated peripheral screens.
- It deliberately does not touch run-core, battle, settlement, or multiplayer room internals.

### Placeholder scan

本计划没有开放式占位、延后补测试或缺少执行细节的步骤。每个任务都有具体文件路径、smoke 增量、精确命令、预期结果和提交命令。

### Type consistency

The plan consistently uses:

- `ShellBackedWebScreen`
- `content_container() -> VBoxContainer`
- `clear_shell_content()`
- `_render_shell_content()`
- `WebShell`
- `PlaceholderPanel`
- `LegacyRunScreen`
