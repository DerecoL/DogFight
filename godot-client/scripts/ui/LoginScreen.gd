extends Control

signal login_succeeded

const WebUiTokens := preload("res://scripts/ui/web/WebUiTokens.gd")

@onready var auth_panel: PanelContainer = %AuthPanel
@onready var account_input: LineEdit = %AccountInput
@onready var password_input: LineEdit = %PasswordInput
@onready var login_button: Button = %LoginButton
@onready var register_button: Button = %RegisterButton
@onready var debug_auth_toggle: Button = %DebugAuthToggle
@onready var debug_auth_group: Control = %DebugAuthGroup
@onready var quick_start_button: Button = %QuickStartButton
@onready var taptap_code_input: LineEdit = %TapTapCodeInput
@onready var taptap_button: Button = %TapTapButton
@onready var error_label: Label = %ErrorLabel

var session: Node
var auth_in_progress := false

func bind_session(next_session: Node) -> void:
	if session != null and session.has_signal("error_raised") and session.error_raised.is_connected(_on_error_raised):
		session.error_raised.disconnect(_on_error_raised)
	session = next_session
	if session != null and session.has_signal("error_raised") and not session.error_raised.is_connected(_on_error_raised):
		session.error_raised.connect(_on_error_raised)

func _ready() -> void:
	_apply_visual_style()
	_set_debug_auth_expanded(false)
	if not login_button.pressed.is_connected(_on_login_pressed):
		login_button.pressed.connect(_on_login_pressed)
	if not register_button.pressed.is_connected(_on_register_pressed):
		register_button.pressed.connect(_on_register_pressed)
	if not debug_auth_toggle.pressed.is_connected(_on_debug_auth_toggle_pressed):
		debug_auth_toggle.pressed.connect(_on_debug_auth_toggle_pressed)
	if not quick_start_button.pressed.is_connected(_on_quick_start_pressed):
		quick_start_button.pressed.connect(_on_quick_start_pressed)
	if not taptap_button.pressed.is_connected(_on_taptap_pressed):
		taptap_button.pressed.connect(_on_taptap_pressed)

func _on_login_pressed() -> void:
	await _submit_auth("login")

func _on_register_pressed() -> void:
	await _submit_auth("register")

func _on_debug_auth_toggle_pressed() -> void:
	if auth_in_progress:
		return
	_set_debug_auth_expanded(not debug_auth_group.visible)

func _set_debug_auth_expanded(expanded: bool) -> void:
	debug_auth_group.visible = expanded
	debug_auth_toggle.button_pressed = expanded

func _on_quick_start_pressed() -> void:
	if auth_in_progress:
		return
	error_label.text = ""
	if session == null or not session.has_method("register"):
		error_label.text = "登录会话未初始化"
		return
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	var account := "godot-%d-%d-%d" % [Time.get_unix_time_from_system(), Time.get_ticks_msec(), rng.randi_range(100000, 999999)]
	var password := "dogdice"
	account_input.text = account
	password_input.text = password
	auth_in_progress = true
	_set_busy(true)
	var ok: bool = await session.call("register", account, password)
	auth_in_progress = false
	_set_busy(false)
	if ok:
		login_succeeded.emit()

func _on_taptap_pressed() -> void:
	if auth_in_progress:
		return
	error_label.text = ""
	if session == null or not session.has_method("login_taptap"):
		error_label.text = "登录会话未初始化"
		return
	var code := taptap_code_input.text.strip_edges()
	if code.is_empty():
		error_label.text = "请输入 TapTap 授权码"
		return
	auth_in_progress = true
	_set_busy(true)
	var ok: bool = await session.call("login_taptap", code)
	auth_in_progress = false
	_set_busy(false)
	if ok:
		login_succeeded.emit()

func _submit_auth(action: String) -> void:
	if auth_in_progress:
		return
	error_label.text = ""
	if session == null or not session.has_method(action):
		error_label.text = "登录会话未初始化"
		return
	var account := account_input.text.strip_edges()
	if account.length() < 3:
		error_label.text = "账号至少 3 个字符"
		return
	if password_input.text.length() < 6:
		error_label.text = "密码至少 6 个字符"
		return
	auth_in_progress = true
	_set_busy(true)
	var ok: bool = await session.call(action, account, password_input.text)
	auth_in_progress = false
	_set_busy(false)
	if ok:
		login_succeeded.emit()

func _set_busy(busy: bool) -> void:
	login_button.disabled = busy
	register_button.disabled = busy
	debug_auth_toggle.disabled = busy
	quick_start_button.disabled = busy
	taptap_button.disabled = busy
	account_input.editable = not busy
	password_input.editable = not busy
	taptap_code_input.editable = not busy

func _on_error_raised(message: String) -> void:
	var normalized := message.to_lower()
	var is_auth_error := (message.contains("账号") and message.contains("密码")) or (normalized.contains("account") and normalized.contains("password"))
	if is_auth_error:
		error_label.text = "%s。新玩家请注册；也可以展开“其他登录方式”使用快速开始。" % message
	else:
		error_label.text = message

func _apply_visual_style() -> void:
	if auth_panel != null:
		auth_panel.add_theme_stylebox_override("panel", WebUiTokens.auth_card_style())
	if debug_auth_group is PanelContainer:
		(debug_auth_group as PanelContainer).add_theme_stylebox_override("panel", WebUiTokens.debug_foldout_style())
	for button in [login_button, register_button]:
		_apply_button_style(button)
	for button in [debug_auth_toggle, quick_start_button, taptap_button]:
		_apply_debug_button_style(button)
	for node_name in ["LanguageZhButton", "LanguageEnButton"]:
		var button := find_child(node_name, true, false) as Button
		if button != null:
			_apply_language_button_style(button)
	for input in [account_input, password_input, taptap_code_input]:
		_apply_input_style(input)
	error_label.add_theme_color_override("font_color", WebUiTokens.danger_color())

func _apply_button_style(button: Button) -> void:
	button.custom_minimum_size.y = max(button.custom_minimum_size.y, WebUiTokens.touch_target_height())
	button.add_theme_stylebox_override("normal", WebUiTokens.handdrawn_button_style())
	button.add_theme_stylebox_override("hover", WebUiTokens.handdrawn_button_hover_style())
	button.add_theme_stylebox_override("pressed", WebUiTokens.handdrawn_button_pressed_style())
	button.add_theme_stylebox_override("disabled", _style_box(Color(0.63, 0.57, 0.48, 0.82), Color(0.36, 0.31, 0.25, 0.75), 1, 8, 10))
	button.add_theme_color_override("font_color", WebUiTokens.ink_color())
	button.add_theme_color_override("font_hover_color", WebUiTokens.ink_color())
	button.add_theme_color_override("font_pressed_color", WebUiTokens.ink_color())

func _apply_debug_button_style(button: Button) -> void:
	var button_size := WebUiTokens.secondary_folded_entry_size() if button == debug_auth_toggle else WebUiTokens.debug_entry_button_size()
	var debug_style_token := WebUiTokens.debug_foldout_style_token()
	var debug_disabled_style_token := WebUiTokens.debug_foldout_disabled_style_token()
	button.custom_minimum_size = Vector2(button_size.x, button_size.y)
	button.add_theme_stylebox_override("normal", debug_style_token["style_box"])
	button.add_theme_stylebox_override("hover", debug_style_token["style_box"])
	button.add_theme_stylebox_override("pressed", debug_style_token["style_box"])
	button.add_theme_stylebox_override("disabled", debug_disabled_style_token["style_box"])
	button.add_theme_color_override("font_color", debug_style_token["text_color"])
	button.add_theme_color_override("font_hover_color", debug_style_token["text_color"])
	button.add_theme_color_override("font_pressed_color", debug_style_token["text_color"])
	button.add_theme_color_override("font_disabled_color", debug_disabled_style_token["text_color"])

func _apply_language_button_style(button: Button) -> void:
	button.custom_minimum_size = Vector2(70, 32)
	button.add_theme_stylebox_override("normal", _style_box(Color(1, 1, 1, 0.0), Color(1, 1, 1, 0.0), 0, 6, 8))
	button.add_theme_stylebox_override("hover", _style_box(Color(1.0, 0.93, 0.68, 0.96), Color(0.35, 0.20, 0.10, 1.0), 1, 6, 8))
	button.add_theme_stylebox_override("pressed", _style_box(Color(0.23, 0.45, 0.72, 1.0), Color(0.18, 0.32, 0.55, 1.0), 1, 6, 8))
	button.add_theme_color_override("font_color", WebUiTokens.ink_color())
	button.add_theme_color_override("font_pressed_color", Color.WHITE)

func _apply_input_style(input: LineEdit) -> void:
	input.custom_minimum_size.y = max(input.custom_minimum_size.y, WebUiTokens.touch_target_height())
	input.add_theme_stylebox_override("normal", WebUiTokens.input_style())
	input.add_theme_stylebox_override("focus", WebUiTokens.input_style())
	input.add_theme_color_override("font_color", WebUiTokens.ink_color())
	input.add_theme_color_override("font_placeholder_color", Color(0.44, 0.37, 0.31, 0.78))

func _style_box(bg: Color, border: Color, border_width: int, radius: int, margin: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.set_border_width_all(border_width)
	style.set_corner_radius_all(radius)
	style.content_margin_left = margin
	style.content_margin_top = max(6, margin - 2)
	style.content_margin_right = margin
	style.content_margin_bottom = max(6, margin - 2)
	return style
