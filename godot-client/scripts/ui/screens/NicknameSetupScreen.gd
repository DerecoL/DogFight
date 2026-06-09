extends BaseWebScreen

var nickname_input: LineEdit
var status_label: Label
var submit_button: Button
var action_in_progress := false

func _ready() -> void:
	_build_form()

func _build_form() -> void:
	var root := VBoxContainer.new()
	root.name = "NicknameSetupRoot"
	root.set_anchors_preset(Control.PRESET_CENTER)
	root.custom_minimum_size = Vector2(520, 320)
	root.size = root.custom_minimum_size
	root.position = -root.custom_minimum_size / 2.0
	root.add_theme_constant_override("separation", 18)
	add_child(root)

	var heading := VBoxContainer.new()
	heading.name = "ScreenHeadingCentered"
	heading.add_theme_constant_override("separation", 8)
	root.add_child(heading)

	var title := Label.new()
	title.name = "NicknameTitle"
	title.text = "设置昵称"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	heading.add_child(title)

	var subtitle := Label.new()
	subtitle.name = "NicknameSubtitle"
	subtitle.text = "昵称会显示在匹配和战斗记录里。"
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.custom_minimum_size = Vector2(0, 42)
	heading.add_child(subtitle)

	var form := VBoxContainer.new()
	form.name = "NicknameForm"
	form.custom_minimum_size = Vector2(420, 0)
	form.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	form.add_theme_constant_override("separation", 12)
	root.add_child(form)

	var field := VBoxContainer.new()
	field.name = "NicknameField"
	field.add_theme_constant_override("separation", 7)
	form.add_child(field)

	var label := Label.new()
	label.name = "NicknameLabel"
	label.text = "昵称"
	field.add_child(label)

	nickname_input = LineEdit.new()
	nickname_input.name = "NicknameInput"
	nickname_input.placeholder_text = "输入昵称"
	nickname_input.max_length = 16
	nickname_input.custom_minimum_size = Vector2(320, 44)
	nickname_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nickname_input.text_changed.connect(_on_nickname_text_changed)
	nickname_input.text_submitted.connect(func(_text: String) -> void:
		_submit_nickname()
	)
	_apply_input_style(nickname_input)
	field.add_child(nickname_input)
	nickname_input.call_deferred("grab_focus")

	status_label = Label.new()
	status_label.name = "NicknameStatus"
	status_label.custom_minimum_size = Vector2(0, 34)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.add_theme_color_override("font_color", WebUiTokens.danger_color())
	form.add_child(status_label)

	submit_button = Button.new()
	submit_button.name = "NicknameSubmitButton"
	submit_button.text = "确认"
	submit_button.custom_minimum_size = Vector2(0, WebUiTokens.touch_target_height())
	submit_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	submit_button.disabled = true
	_apply_button_style(submit_button)
	submit_button.pressed.connect(_submit_nickname)
	form.add_child(submit_button)

func _on_nickname_text_changed(_text: String) -> void:
	_update_submit_state()

func _submit_nickname() -> void:
	if action_in_progress:
		return
	var nickname := nickname_input.text.strip_edges()
	if nickname.length() < 2 or nickname.length() > 16:
		status_label.text = "昵称需要 2-16 个字符"
		_update_submit_state()
		return
	if session == null or not session.has_method("update_nickname"):
		status_label.text = "登录会话未初始化"
		return
	action_in_progress = true
	_set_actions_disabled(true)
	status_label.text = ""
	var ok: bool = await session.call("update_nickname", nickname)
	action_in_progress = false
	_set_actions_disabled(false)
	if not ok:
		status_label.text = "昵称保存失败，请重试"

func _logout() -> void:
	if action_in_progress:
		return
	if session != null and session.has_method("logout"):
		await session.call("logout")

func _set_actions_disabled(disabled: bool) -> void:
	if nickname_input != null:
		nickname_input.editable = not disabled
	if submit_button != null:
		submit_button.disabled = disabled or nickname_input.text.strip_edges().length() < 2

func _update_submit_state() -> void:
	if submit_button != null and not action_in_progress:
		submit_button.disabled = nickname_input.text.strip_edges().length() < 2

func _apply_button_style(button: Button) -> void:
	button.add_theme_stylebox_override("normal", WebUiTokens.handdrawn_button_style())
	button.add_theme_stylebox_override("hover", WebUiTokens.handdrawn_button_hover_style())
	button.add_theme_stylebox_override("pressed", WebUiTokens.handdrawn_button_pressed_style())
	button.add_theme_stylebox_override("disabled", _style_box(Color(0.63, 0.57, 0.48, 0.82), Color(0.36, 0.31, 0.25, 0.75), 1, 8, 10))
	button.add_theme_color_override("font_color", WebUiTokens.ink_color())
	button.add_theme_color_override("font_hover_color", WebUiTokens.ink_color())
	button.add_theme_color_override("font_pressed_color", WebUiTokens.ink_color())

func _apply_input_style(input: LineEdit) -> void:
	input.add_theme_stylebox_override("normal", _style_box(Color.WHITE, Color(0.72, 0.65, 0.55, 1.0), 1, 8, 10))
	input.add_theme_stylebox_override("focus", _style_box(Color.WHITE, WebUiTokens.accent_color(), 2, 8, 10))
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
