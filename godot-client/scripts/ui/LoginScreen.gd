extends PanelContainer

signal login_succeeded

const UiTokens := preload("res://scripts/ui/kit/UiTokens.gd")

@onready var account_input: LineEdit = %AccountInput
@onready var password_input: LineEdit = %PasswordInput
@onready var login_button: Button = %LoginButton
@onready var register_button: Button = %RegisterButton
@onready var quick_start_button: Button = %QuickStartButton
@onready var taptap_code_input: LineEdit = %TapTapCodeInput
@onready var taptap_button: Button = %TapTapButton
@onready var error_label: Label = %ErrorLabel

var session: Node

func bind_session(next_session: Node) -> void:
	if session != null and session.has_signal("error_raised") and session.error_raised.is_connected(_on_error_raised):
		session.error_raised.disconnect(_on_error_raised)
	session = next_session
	if session != null and session.has_signal("error_raised") and not session.error_raised.is_connected(_on_error_raised):
		session.error_raised.connect(_on_error_raised)

func _ready() -> void:
	_apply_visual_style()
	if not login_button.pressed.is_connected(_on_login_pressed):
		login_button.pressed.connect(_on_login_pressed)
	if not register_button.pressed.is_connected(_on_register_pressed):
		register_button.pressed.connect(_on_register_pressed)
	if not quick_start_button.pressed.is_connected(_on_quick_start_pressed):
		quick_start_button.pressed.connect(_on_quick_start_pressed)
	if not taptap_button.pressed.is_connected(_on_taptap_pressed):
		taptap_button.pressed.connect(_on_taptap_pressed)

func _on_login_pressed() -> void:
	await _submit_auth("login")

func _on_register_pressed() -> void:
	await _submit_auth("register")

func _on_quick_start_pressed() -> void:
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
	_set_busy(true)
	var ok: bool = await session.call("register", account, password)
	_set_busy(false)
	if ok:
		login_succeeded.emit()

func _on_taptap_pressed() -> void:
	error_label.text = ""
	if session == null or not session.has_method("login_taptap"):
		error_label.text = "登录会话未初始化"
		return
	var code := taptap_code_input.text.strip_edges()
	if code.is_empty():
		error_label.text = "请输入 TapTap 授权码"
		return
	_set_busy(true)
	var ok: bool = await session.call("login_taptap", code)
	_set_busy(false)
	if ok:
		login_succeeded.emit()

func _submit_auth(action: String) -> void:
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
	_set_busy(true)
	var ok: bool = await session.call(action, account, password_input.text)
	_set_busy(false)
	if ok:
		login_succeeded.emit()

func _set_busy(busy: bool) -> void:
	login_button.disabled = busy
	register_button.disabled = busy
	quick_start_button.disabled = busy
	taptap_button.disabled = busy

func _on_error_raised(message: String) -> void:
	if message.contains("账号") and message.contains("密码"):
		error_label.text = "%s。新玩家请注册，或点击快速开始直接进入。" % message
	else:
		error_label.text = message

func _apply_visual_style() -> void:
	add_theme_stylebox_override("panel", UiTokens.modal_panel_style())
	for button in [login_button, register_button, quick_start_button, taptap_button]:
		_apply_button_style(button)
	for input in [account_input, password_input, taptap_code_input]:
		_apply_input_style(input)
	error_label.add_theme_color_override("font_color", Color(0.95, 0.32, 0.18, 1.0))

func _apply_button_style(button: Button) -> void:
	button.custom_minimum_size.y = max(button.custom_minimum_size.y, UiTokens.touch_target_height())
	button.add_theme_stylebox_override("normal", UiTokens.button_style())
	button.add_theme_stylebox_override("hover", UiTokens.button_hover_style())
	button.add_theme_stylebox_override("pressed", UiTokens.button_pressed_style())
	button.add_theme_stylebox_override("disabled", UiTokens.button_disabled_style())
	button.add_theme_color_override("font_color", UiTokens.ink_color())
	button.add_theme_color_override("font_hover_color", UiTokens.ink_color())
	button.add_theme_color_override("font_pressed_color", UiTokens.ink_color())

func _apply_input_style(input: LineEdit) -> void:
	input.custom_minimum_size.y = max(input.custom_minimum_size.y, UiTokens.touch_target_height())
	input.add_theme_stylebox_override("normal", UiTokens.input_style())
	input.add_theme_stylebox_override("focus", UiTokens.input_focus_style())
	input.add_theme_color_override("font_color", Color(0.98, 0.92, 0.82, 1.0))
	input.add_theme_color_override("font_placeholder_color", Color(0.75, 0.66, 0.54, 0.90))
