# Godot UI Visual Rework Phase One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Godot 原生手绘 UI 底座，并完成登录、昵称、模式大厅三屏的 16:9 桌面视觉重构。

**Architecture:** 先扩展共享 token 和控件工厂，再让登录、昵称、大厅三屏复用同一套样式、尺寸和层级规则。测试先约束结构、默认折叠状态、固定尺寸和 16:9 容器，再改 GDScript 与场景节点。

**Tech Stack:** Godot 4.x、GDScript、Godot headless smoke tests、现有 Fastify API 状态模型、`npm run build` 单文件同步。

---

## 文件结构

本阶段只触碰第一阶段相关文件。

- 修改 `godot-client/scripts/ui/web/WebUiTokens.gd`：新增 16:9 布局常量、登录卡/大厅卡/输入框/调试折叠区样式。
- 修改 `godot-client/scripts/ui/shared/WebActionButton.gd`：补齐 loading 文案、禁用样式和稳定宽高约束。
- 修改 `godot-client/scripts/ui/shared/WebResourcePill.gd`：提高资源胶囊高度和溢出稳定性。
- 修改 `godot-client/scripts/ui/shell/WebShell.gd`：让顶部栏更接近手绘 HUD，固定高度、边距和主内容安全区。
- 修改 `godot-client/scenes/LoginScreen.tscn`：新增折叠调试入口按钮与调试区域容器，调整登录卡尺寸和层级。
- 修改 `godot-client/scripts/ui/LoginScreen.gd`：实现折叠区、登录卡样式和按钮 loading 文案。
- 修改 `godot-client/scripts/ui/screens/NicknameSetupScreen.gd`：重构为居中仪式感单卡，保留现有输入和提交行为。
- 修改 `godot-client/scripts/ui/screens/ModeLobbyScreen.gd`：改为主模式卡优先布局，保留现有屏幕入口和行为。
- 修改 `godot-client/scripts/tests/web_ui_tokens_smoke.gd`：约束新增 token。
- 修改 `godot-client/scripts/tests/web_shared_controls_smoke.gd`：约束按钮和资源胶囊稳定尺寸。
- 修改 `godot-client/scripts/tests/web_shell_smoke.gd`：约束顶部栏和内容安全区。
- 修改 `godot-client/scripts/tests/login_visual_shell_smoke.gd`：约束调试入口默认折叠。
- 修改 `godot-client/scripts/tests/nickname_setup_web_structure_smoke.gd`：约束昵称单卡结构。
- 修改 `godot-client/scripts/tests/mode_lobby_web_text_structure_smoke.gd`：约束大厅主模式卡优先结构。

## 任务

### Task 1: 扩展 Web UI Token 测试

**Files:**
- Modify: `godot-client/scripts/tests/web_ui_tokens_smoke.gd`
- Modify: `godot-client/scripts/ui/web/WebUiTokens.gd`

- [ ] **Step 1: 写失败测试**

在 `godot-client/scripts/tests/web_ui_tokens_smoke.gd` 的 `selected_slot` 检查之后追加：

```gdscript
	var screen_margin := int(tokens.screen_safe_margin())
	if screen_margin < 18:
		_fail("16:9 screen safe margin must stay at least 18")
		return

	var content_width := int(tokens.desktop_content_max_width())
	if content_width < 1080 or content_width > 1280:
		_fail("Desktop content max width must stay in the 1080-1280 range")
		return

	var auth_card = tokens.auth_card_style()
	if auth_card == null or not auth_card is StyleBoxFlat:
		_fail("auth_card_style must return StyleBoxFlat")
		return
	if (auth_card as StyleBoxFlat).border_width_left < 2:
		_fail("Auth card must keep a visible handdrawn border")
		return

	var input = tokens.input_style(false)
	var focus_input = tokens.input_style(true)
	if input == null or focus_input == null:
		_fail("input_style must return normal and focused styles")
		return
	if (input as StyleBoxFlat).border_color == (focus_input as StyleBoxFlat).border_color:
		_fail("Focused input style must visibly differ from normal input style")
		return

	var debug = tokens.debug_foldout_style()
	if debug == null or not debug is StyleBoxFlat:
		_fail("debug_foldout_style must return StyleBoxFlat")
		return
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_tokens_smoke.gd
```

Expected: FAIL，错误包含 `screen_safe_margin`、`desktop_content_max_width`、`auth_card_style`、`input_style` 或 `debug_foldout_style` 缺失。

- [ ] **Step 3: 实现 token**

在 `godot-client/scripts/ui/web/WebUiTokens.gd` 中追加这些静态方法：

```gdscript
static func screen_safe_margin() -> int:
	return 22

static func desktop_content_max_width() -> int:
	return 1180

static func auth_card_min_size() -> Vector2:
	return Vector2(460, 520)

static func lobby_mode_card_min_size() -> Vector2:
	return Vector2(0, 150)

static func auth_card_style() -> StyleBoxFlat:
	return _style_box(Color(1.0, 0.96, 0.86, 0.96), ink_color(), 3, 8, 18)

static func mode_card_style() -> StyleBoxFlat:
	return _style_box(Color(1.0, 0.94, 0.78, 0.96), wood_color(), 3, 8, 14)

static func input_style(focused: bool) -> StyleBoxFlat:
	var border := accent_color() if focused else Color(0.46, 0.34, 0.24, 0.92)
	var width := 2 if focused else 1
	return _style_box(Color(1.0, 0.98, 0.93, 1.0), border, width, 8, 10)

static func debug_foldout_style() -> StyleBoxFlat:
	return _style_box(Color(0.96, 0.88, 0.70, 0.78), Color(0.42, 0.25, 0.13, 0.72), 1, 8, 10)
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_tokens_smoke.gd
```

Expected: PASS，输出 `Web UI tokens smoke passed`。

- [ ] **Step 5: 提交**

```powershell
git add -- godot-client/scripts/tests/web_ui_tokens_smoke.gd godot-client/scripts/ui/web/WebUiTokens.gd
git commit -m "test: cover godot ui visual tokens"
```

### Task 2: 加强共享按钮和资源胶囊

**Files:**
- Modify: `godot-client/scripts/tests/web_shared_controls_smoke.gd`
- Modify: `godot-client/scripts/ui/shared/WebActionButton.gd`
- Modify: `godot-client/scripts/ui/shared/WebResourcePill.gd`

- [ ] **Step 1: 写失败测试**

在 `web_shared_controls_smoke.gd` 的 `set_loading(false)` 检查后追加：

```gdscript
	if primary.get_meta("idle_label", "") != "Start":
		_fail("WebActionButton must remember its idle label for loading restoration")
		return
	button_factory.set_loading(primary, true, "")
	if primary.text != "处理中...":
		_fail("WebActionButton.set_loading must provide a stable default loading label")
		return
	button_factory.set_loading(primary, false, "")
	if primary.text != "Start":
		_fail("WebActionButton.set_loading(false, empty) must restore idle label")
		return
```

在资源胶囊高度检查后追加：

```gdscript
	if int(pill.custom_minimum_size.y) < 42:
		_fail("WebResourcePill height must match the topbar 16:9 touch footprint")
		return
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shared_controls_smoke.gd
```

Expected: FAIL，错误包含 idle label 或资源胶囊高度。

- [ ] **Step 3: 修改 WebActionButton**

在 `WebActionButton.create()` 设置 `button.text = label` 后追加：

```gdscript
	button.set_meta("idle_label", label)
```

替换 `set_loading()` 为：

```gdscript
static func set_loading(button: Button, loading: bool, label: String) -> void:
	if button == null:
		return
	if not button.has_meta("idle_label"):
		button.set_meta("idle_label", button.text)
	button.disabled = loading
	if loading:
		button.text = label if not label.strip_edges().is_empty() else "处理中..."
	else:
		button.text = label if not label.strip_edges().is_empty() else str(button.get_meta("idle_label", ""))
```

- [ ] **Step 4: 修改 WebResourcePill**

在 `WebResourcePill.create()` 中将：

```gdscript
	pill.custom_minimum_size = Vector2(110, 34)
```

替换为：

```gdscript
	pill.custom_minimum_size = Vector2(118, 42)
```

并将 `text.custom_minimum_size = Vector2(94, 34)` 替换为：

```gdscript
	text.custom_minimum_size = Vector2(100, 42)
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shared_controls_smoke.gd
```

Expected: PASS，输出 `Web shared controls smoke passed`。

- [ ] **Step 6: 提交**

```powershell
git add -- godot-client/scripts/tests/web_shared_controls_smoke.gd godot-client/scripts/ui/shared/WebActionButton.gd godot-client/scripts/ui/shared/WebResourcePill.gd
git commit -m "feat: stabilize godot shared web controls"
```

### Task 3: 重做 WebShell 16:9 顶部栏和内容安全区

**Files:**
- Modify: `godot-client/scripts/tests/web_shell_smoke.gd`
- Modify: `godot-client/scripts/ui/shell/WebShell.gd`

- [ ] **Step 1: 写失败测试**

在 `web_shell_smoke.gd` 的 top bar 高度检查后追加：

```gdscript
	if top_bar.get_theme_stylebox("panel") == null:
		_fail("WebShell top bar must use a handdrawn panel style")
		return
	var content: VBoxContainer = shell.content_container()
	if int(content.get_theme_constant("separation")) < 14:
		_fail("WebShell content must keep roomy 16:9 spacing")
		return
	if int(content.custom_minimum_size.x) < 900:
		_fail("WebShell content must expose a stable desktop width floor")
		return
```

如果文件里已经有 `var content`，复用现有变量，不重复声明。

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shell_smoke.gd
```

Expected: FAIL，错误包含 top bar 样式、content spacing 或 desktop width floor。

- [ ] **Step 3: 修改 WebShell 顶部栏**

在 `WebShell._build_shell()` 中 `_top_bar` 创建后追加：

```gdscript
	_top_bar.add_theme_stylebox_override("panel", TOKENS.wood_panel_style())
	_top_bar.add_theme_constant_override("separation", 10)
```

将 `_top_bar.custom_minimum_size = Vector2(0, 64)` 替换为：

```gdscript
	_top_bar.custom_minimum_size = Vector2(0, 72)
```

- [ ] **Step 4: 修改内容安全区**

将 `_content` 的初始化段落改为：

```gdscript
	_content = VBoxContainer.new()
	_content.name = "Content"
	_content.custom_minimum_size = Vector2(960, 0)
	_content.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_content.add_theme_constant_override("separation", 16)
	_root.add_child(_content)
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shell_smoke.gd
```

Expected: PASS，输出 `Web shell smoke passed`。

- [ ] **Step 6: 提交**

```powershell
git add -- godot-client/scripts/tests/web_shell_smoke.gd godot-client/scripts/ui/shell/WebShell.gd
git commit -m "feat: refine godot web shell layout"
```

### Task 4: 登录页调试入口默认折叠

**Files:**
- Modify: `godot-client/scripts/tests/login_visual_shell_smoke.gd`
- Modify: `godot-client/scenes/LoginScreen.tscn`
- Modify: `godot-client/scripts/ui/LoginScreen.gd`

- [ ] **Step 1: 写失败测试**

在 `login_visual_shell_smoke.gd` 找到 `quick_start` 后，将快速开始可读性检查替换为：

```gdscript
	var debug_toggle = login.get_node_or_null("%DebugToggleButton")
	if not debug_toggle is Button:
		_fail("Login screen must expose DebugToggleButton for folded debug auth")
		return
	var debug_group = login.get_node_or_null("%DebugAuthGroup")
	if not debug_group is Control:
		_fail("Login screen must keep DebugAuthGroup for smoke-visible debug controls")
		return
	if (debug_group as Control).visible:
		_fail("DebugAuthGroup must be folded by default")
		return
	if not (debug_toggle as Button).text.contains("其他登录方式"):
		_fail("DebugToggleButton must describe the folded secondary login area")
		return
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/login_visual_shell_smoke.gd
```

Expected: FAIL，错误包含 `DebugToggleButton` 缺失或 `DebugAuthGroup` 默认可见。

- [ ] **Step 3: 修改 LoginScreen.tscn**

在 `AuthButtons` 节点后新增：

```ini
[node name="DebugToggleButton" type="Button" parent="AuthShell/AuthPanel/Margin/Form"]
unique_name_in_owner = true
custom_minimum_size = Vector2(0, 36)
layout_mode = 2
text = "其他登录方式 / 调试入口"
```

并在已有 `DebugAuthGroup` 节点上添加：

```ini
unique_name_in_owner = true
visible = false
```

将 `AuthPanel` 的 `custom_minimum_size` 调整为：

```ini
custom_minimum_size = Vector2(460, 520)
```

- [ ] **Step 4: 修改 LoginScreen.gd 变量和连接**

在 onready 区追加：

```gdscript
@onready var debug_toggle_button: Button = %DebugToggleButton
@onready var debug_auth_group: VBoxContainer = %DebugAuthGroup
```

在 `_ready()` 中追加：

```gdscript
	if not debug_toggle_button.pressed.is_connected(_on_debug_toggle_pressed):
		debug_toggle_button.pressed.connect(_on_debug_toggle_pressed)
	debug_auth_group.visible = false
```

新增方法：

```gdscript
func _on_debug_toggle_pressed() -> void:
	debug_auth_group.visible = not debug_auth_group.visible
	debug_toggle_button.text = "收起其他登录方式" if debug_auth_group.visible else "其他登录方式 / 调试入口"
```

- [ ] **Step 5: 更新登录样式**

在 `_apply_visual_style()` 中将 `auth_panel` 样式替换为：

```gdscript
	if auth_panel != null:
		auth_panel.custom_minimum_size = WebUiTokens.auth_card_min_size()
		auth_panel.add_theme_stylebox_override("panel", WebUiTokens.auth_card_style())
	if debug_auth_group != null:
		debug_auth_group.add_theme_constant_override("separation", 8)
	if debug_toggle_button != null:
		_apply_button_style(debug_toggle_button)
```

在 `_apply_visual_style()` 的按钮数组里加入 `debug_toggle_button`，或保留上方单独调用，避免空引用。

- [ ] **Step 6: 运行登录相关测试**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/login_visual_shell_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/login_web_auth_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/login_action_guard_smoke.gd
```

Expected: 三个测试 PASS。

- [ ] **Step 7: 提交**

```powershell
git add -- godot-client/scripts/tests/login_visual_shell_smoke.gd godot-client/scenes/LoginScreen.tscn godot-client/scripts/ui/LoginScreen.gd
git commit -m "feat: fold godot login debug controls"
```

### Task 5: 昵称页改为仪式感单卡

**Files:**
- Modify: `godot-client/scripts/tests/nickname_setup_web_structure_smoke.gd`
- Modify: `godot-client/scripts/ui/screens/NicknameSetupScreen.gd`

- [ ] **Step 1: 写失败测试**

在 `nickname_setup_web_structure_smoke.gd` 的节点列表中追加：

```gdscript
		"NicknameCard",
		"NicknameBadge",
		"NicknameHintPanel",
```

在 `form.custom_minimum_size.x` 检查后追加：

```gdscript
	var card := screen.find_child("NicknameCard", true, false) as PanelContainer
	if card == null or card.get_theme_stylebox("panel") == null:
		_fail("NicknameCard must use a handdrawn panel style")
		return
	if int(card.custom_minimum_size.x) < 520 or int(card.custom_minimum_size.y) < 360:
		_fail("NicknameCard must keep a stable centered 16:9 footprint")
		return
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/nickname_setup_web_structure_smoke.gd
```

Expected: FAIL，错误包含 `NicknameCard`、`NicknameBadge` 或 `NicknameHintPanel` 缺失。

- [ ] **Step 3: 修改 _build_form 根结构**

在 `NicknameSetupScreen.gd` 的 `_build_form()` 中，将当前 `root` 直接承载标题和表单的结构改为：

```gdscript
	var root := CenterContainer.new()
	root.name = "NicknameSetupRoot"
	root.custom_minimum_size = Vector2(WebUiTokens.desktop_content_max_width(), 0)
	root.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	root.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content_container().add_child(root)

	var card := PanelContainer.new()
	card.name = "NicknameCard"
	card.custom_minimum_size = Vector2(560, 380)
	card.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	card.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	card.add_theme_stylebox_override("panel", WebUiTokens.auth_card_style())
	root.add_child(card)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 28)
	margin.add_theme_constant_override("margin_top", 26)
	margin.add_theme_constant_override("margin_right", 28)
	margin.add_theme_constant_override("margin_bottom", 26)
	card.add_child(margin)

	var box := VBoxContainer.new()
	box.name = "NicknameCardContent"
	box.add_theme_constant_override("separation", 16)
	margin.add_child(box)
```

随后把原先添加到 `root` 的 `heading` 和 `form` 改为添加到 `box`。

- [ ] **Step 4: 添加徽章和提示面板**

在创建 `heading` 前追加：

```gdscript
	var badge := Label.new()
	badge.name = "NicknameBadge"
	badge.text = "新玩家登记"
	badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	badge.custom_minimum_size = Vector2(0, 28)
	box.add_child(badge)
```

在 `status_label` 前追加：

```gdscript
	var hint_panel := PanelContainer.new()
	hint_panel.name = "NicknameHintPanel"
	hint_panel.add_theme_stylebox_override("panel", WebUiTokens.debug_foldout_style())
	form.add_child(hint_panel)

	var hint := Label.new()
	hint.name = "NicknameHint"
	hint.text = "昵称会显示在匹配、战斗记录和排行榜摘要里。"
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint_panel.add_child(hint)
```

- [ ] **Step 5: 运行昵称相关测试**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/nickname_setup_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/nickname_action_guard_smoke.gd
```

Expected: 两个测试 PASS。

- [ ] **Step 6: 提交**

```powershell
git add -- godot-client/scripts/tests/nickname_setup_web_structure_smoke.gd godot-client/scripts/ui/screens/NicknameSetupScreen.gd
git commit -m "feat: redesign godot nickname setup card"
```

### Task 6: 大厅改为主模式卡优先

**Files:**
- Modify: `godot-client/scripts/tests/mode_lobby_web_text_structure_smoke.gd`
- Modify: `godot-client/scripts/tests/mode_lobby_interaction_smoke.gd`
- Modify: `godot-client/scripts/ui/screens/ModeLobbyScreen.gd`

- [ ] **Step 1: 写失败测试**

在 `mode_lobby_web_text_structure_smoke.gd` 的节点列表中追加：

```gdscript
		"ModeLobbyMainStage",
		"ModeGridPanel",
		"LobbySupportRow",
		"ContinueRunPanel",
		"AccountShortcutPanel",
```

在 `grid.columns != 2` 检查后追加：

```gdscript
	var main_stage := screen.find_child("ModeLobbyMainStage", true, false) as VBoxContainer
	if main_stage == null:
		_fail("ModeLobby must expose ModeLobbyMainStage")
		return
	if int(main_stage.custom_minimum_size.x) < 960:
		_fail("ModeLobbyMainStage must keep a stable 16:9 width")
		return
	var support_row := screen.find_child("LobbySupportRow", true, false) as HBoxContainer
	if support_row == null:
		_fail("ModeLobby must keep support panels below primary modes")
		return
```

在 `mode_lobby_interaction_smoke.gd` 的 `ModeLobbyPanel` 检查后追加：

```gdscript
	if screen.find_child("ModeLobbyMainStage", true, false) == null:
		_fail("ModeLobbyScreen must expose a primary mode-card stage")
		return
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_web_text_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_interaction_smoke.gd
```

Expected: FAIL，错误包含新节点缺失。

- [ ] **Step 3: 修改大厅根面板尺寸**

在 `_build_lobby()` 中将 `panel.custom_minimum_size = Vector2(960, 660)` 替换为：

```gdscript
	panel.custom_minimum_size = Vector2(WebUiTokens.desktop_content_max_width(), 620)
```

将 `scroll.custom_minimum_size = panel.custom_minimum_size` 保留，确保小窗口内部滚动。

- [ ] **Step 4: 增加主舞台和模式卡容器**

在创建 `box` 后，为现有 heading、account_label、run_label、tutorial_button、mode_entries、history panel 重新分组。核心结构为：

```gdscript
	var main_stage := VBoxContainer.new()
	main_stage.name = "ModeLobbyMainStage"
	main_stage.custom_minimum_size = Vector2(980, 0)
	main_stage.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	main_stage.add_theme_constant_override("separation", 14)
	box.add_child(main_stage)
```

把 `heading`、`account_label`、`run_label` 和 `mode_entries` 添加到 `main_stage`。

创建模式网格前新增：

```gdscript
	var mode_grid_panel := PanelContainer.new()
	mode_grid_panel.name = "ModeGridPanel"
	mode_grid_panel.add_theme_stylebox_override("panel", WebUiTokens.debug_foldout_style())
	main_stage.add_child(mode_grid_panel)

	var mode_grid_margin := MarginContainer.new()
	mode_grid_margin.add_theme_constant_override("margin_left", 14)
	mode_grid_margin.add_theme_constant_override("margin_top", 14)
	mode_grid_margin.add_theme_constant_override("margin_right", 14)
	mode_grid_margin.add_theme_constant_override("margin_bottom", 14)
	mode_grid_panel.add_child(mode_grid_margin)
```

把 `mode_entries` 添加到 `mode_grid_margin`。

- [ ] **Step 5: 重排辅助区**

在模式网格后创建：

```gdscript
	var support_row := HBoxContainer.new()
	support_row.name = "LobbySupportRow"
	support_row.custom_minimum_size = Vector2(0, 124)
	support_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	support_row.add_theme_constant_override("separation", 12)
	main_stage.add_child(support_row)

	var continue_panel := PanelContainer.new()
	continue_panel.name = "ContinueRunPanel"
	continue_panel.custom_minimum_size = Vector2(0, 112)
	continue_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	continue_panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	support_row.add_child(continue_panel)

	var account_panel := PanelContainer.new()
	account_panel.name = "AccountShortcutPanel"
	account_panel.custom_minimum_size = Vector2(340, 112)
	account_panel.size_flags_horizontal = Control.SIZE_SHRINK_END
	account_panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	support_row.add_child(account_panel)
```

把新手引导和继续跑局提示放入 `ContinueRunPanel`，把账号快捷按钮放入 `AccountShortcutPanel`。保留 `PlayerHistoryPanel` 节点，但让它位于辅助区下方或内部滚动区，不抢主模式卡。

- [ ] **Step 6: 修改模式卡样式**

在 `_add_mode_button()` 中将：

```gdscript
	card.custom_minimum_size = Vector2(0, 128)
	card.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
```

替换为：

```gdscript
	card.custom_minimum_size = WebUiTokens.lobby_mode_card_min_size()
	card.add_theme_stylebox_override("panel", WebUiTokens.mode_card_style())
```

- [ ] **Step 7: 运行大厅测试**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_web_text_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_interaction_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_tutorial_entry_smoke.gd
```

Expected: 三个测试 PASS。

- [ ] **Step 8: 提交**

```powershell
git add -- godot-client/scripts/tests/mode_lobby_web_text_structure_smoke.gd godot-client/scripts/tests/mode_lobby_interaction_smoke.gd godot-client/scripts/ui/screens/ModeLobbyScreen.gd
git commit -m "feat: prioritize godot lobby mode cards"
```

### Task 7: 最终验证和构建

**Files:**
- No source edits expected.

- [ ] **Step 1: 运行第一阶段 Godot smoke**

Run:

```powershell
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_ui_tokens_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shared_controls_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/web_shell_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/login_visual_shell_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/login_web_auth_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/login_action_guard_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/nickname_setup_web_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/nickname_action_guard_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_web_text_structure_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_interaction_smoke.gd
godot --headless --path E:\AI-GPT\DogFight\godot-client --script res://scripts/tests/mode_lobby_tutorial_entry_smoke.gd
```

Expected: 每条命令退出码为 0，并输出对应 passed 文案。

- [ ] **Step 2: 运行构建**

Run:

```powershell
npm run build
```

Expected: build 成功，并重新生成：

```text
E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd
```

- [ ] **Step 3: 检查工作区**

Run:

```powershell
git status --short
```

Expected: 只出现本阶段预期文件；不要把无关 `.uid` 本地产物纳入提交。

- [ ] **Step 4: 处理验证后的工作区**

如果 `npm run build` 只更新被 `.gitignore` 忽略的 `dist-click/` 产物，且 `git status --short` 没有新的跟踪文件变更，不创建空提交。

如果 `git status --short` 显示第一阶段跟踪文件仍有未提交变更，先回到对应任务补提交；不要在最终验证步骤里把多个任务的源码变更混成一个提交。

- [ ] **Step 5: 合并和推送**

本仓库当前工作分支是 `main`。如果实现发生在其他分支，先合并到 `main`。最终推送：

```powershell
git push origin main
```

Expected: `main -> main` 推送成功。

## 自查清单

- 规格中的“Godot 可按引擎窗口重排，但保持网页版风格、信息层级、操作入口和状态反馈”由 Task 1-6 覆盖。
- 登录调试入口折叠由 Task 4 覆盖。
- 16:9 桌面优先由 Task 1、3、5、6 的尺寸测试覆盖。
- 主模式卡优先由 Task 6 覆盖。
- 第一阶段不触碰地图、商店、奖励、战斗、外围和多人房间，任务列表未包含这些文件。
- 实现阶段需要 `npm run build`，由 Task 7 覆盖。
