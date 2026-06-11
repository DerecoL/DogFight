extends ShellBackedWebScreen

const ACTION_BUTTON := preload("res://scripts/ui/shared/WebActionButton.gd")

var nickname_input: LineEdit
var status_label: Label
var submit_button: Button
var action_in_progress := false

func _render_shell_content() -> void:
	_build_form()

func _build_form() -> void:
	var root := PanelContainer.new()
	root.name = "NicknameSetupRoot"
	root.custom_minimum_size = Vector2(520, 380)
	root.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	root.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	root.z_index = WebUiTokens.layer_card()
	root.add_theme_stylebox_override("panel", WebUiTokens.auth_card_style())
	content_container().add_child(root)

	var card := VBoxContainer.new()
	card.name = "NicknameCard"
	card.custom_minimum_size = Vector2(420, 0)
	card.add_theme_constant_override("separation", 18)
	root.add_child(card)

	var heading := VBoxContainer.new()
	heading.name = "ScreenHeadingCentered"
	heading.add_theme_constant_override("separation", 8)
	card.add_child(heading)

	var title := Label.new()
	title.name = "NicknameTitle"
	title.text = "设置昵称"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_color_override("font_color", WebUiTokens.ink_color())
	title.add_theme_font_size_override("font_size", 28)
	heading.add_child(title)

	var subtitle := Label.new()
	subtitle.name = "NicknameSubtitle"
	subtitle.text = "昵称会显示在匹配和战斗记录里。"
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.custom_minimum_size = Vector2(420, 44)
	subtitle.add_theme_color_override("font_color", WebUiTokens.ink_color())
	heading.add_child(subtitle)

	var body := VBoxContainer.new()
	body.name = "NicknameBody"
	body.custom_minimum_size = Vector2(420, 0)
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 10)
	card.add_child(body)

	var form := VBoxContainer.new()
	form.name = "NicknameForm"
	form.custom_minimum_size = Vector2(420, 0)
	form.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	form.add_theme_constant_override("separation", 10)
	body.add_child(form)

	var field := VBoxContainer.new()
	field.name = "NicknameField"
	field.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	field.add_theme_constant_override("separation", 7)
	form.add_child(field)

	var label := Label.new()
	label.name = "NicknameLabel"
	label.text = "昵称"
	label.add_theme_color_override("font_color", WebUiTokens.ink_color())
	field.add_child(label)

	nickname_input = LineEdit.new()
	nickname_input.name = "NicknameInput"
	nickname_input.placeholder_text = "输入昵称"
	nickname_input.max_length = 16
	nickname_input.custom_minimum_size = Vector2(420, WebUiTokens.touch_target_height())
	nickname_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nickname_input.text_changed.connect(_on_nickname_text_changed)
	nickname_input.text_submitted.connect(func(_text: String) -> void:
		_submit_nickname()
	)
	_apply_input_style(nickname_input)
	field.add_child(nickname_input)
	nickname_input.call_deferred("grab_focus")

	var hint := Label.new()
	hint.name = "NicknameHint"
	hint.text = "2-16 个字符，提交后会进入游戏大厅。"
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint.custom_minimum_size = Vector2(420, 34)
	hint.add_theme_color_override("font_color", Color(WebUiTokens.ink_color(), 0.72))
	form.add_child(hint)

	var actions := VBoxContainer.new()
	actions.name = "NicknameActions"
	actions.custom_minimum_size = Vector2(420, 0)
	actions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_theme_constant_override("separation", 10)
	card.add_child(actions)

	status_label = Label.new()
	status_label.name = "NicknameStatus"
	status_label.custom_minimum_size = Vector2(420, 46)
	status_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status_label.clip_text = true
	status_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.max_lines_visible = 2
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	status_label.add_theme_color_override("font_color", WebUiTokens.danger_color())
	actions.add_child(status_label)

	submit_button = ACTION_BUTTON.create("确认", _submit_nickname, "primary")
	submit_button.name = "NicknameSubmitButton"
	submit_button.custom_minimum_size = Vector2(420, WebUiTokens.touch_target_height())
	submit_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	submit_button.disabled = true
	actions.add_child(submit_button)

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

func _on_shell_logout_requested() -> void:
	if action_in_progress:
		return
	super._on_shell_logout_requested()

func _set_actions_disabled(disabled: bool) -> void:
	var busy := disabled or action_in_progress
	if nickname_input != null:
		nickname_input.editable = not busy
	if submit_button != null:
		submit_button.disabled = busy or nickname_input.text.strip_edges().length() < 2

func _update_submit_state() -> void:
	if submit_button != null and not action_in_progress:
		submit_button.disabled = nickname_input.text.strip_edges().length() < 2

func _apply_input_style(input: LineEdit) -> void:
	input.add_theme_stylebox_override("normal", WebUiTokens.input_style())
	input.add_theme_stylebox_override("focus", WebUiTokens.input_style())
	input.add_theme_color_override("font_color", WebUiTokens.ink_color())
	input.add_theme_color_override("font_placeholder_color", WebUiTokens.placeholder_text_color())
