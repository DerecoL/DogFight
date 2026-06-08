extends BaseWebScreen

var nickname_input: LineEdit
var status_label: Label
var submit_button: Button

func _ready() -> void:
	_build_form()

func _build_form() -> void:
	var tokens = load("res://scripts/ui/web/WebUiTokens.gd")
	var panel := PanelContainer.new()
	panel.name = "NicknameSetupPanel"
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.custom_minimum_size = Vector2(520, 320)
	panel.size = panel.custom_minimum_size
	panel.position = -panel.custom_minimum_size / 2.0
	if tokens != null:
		panel.add_theme_stylebox_override("panel", tokens.paper_card_style())
	add_child(panel)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_top", 22)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_bottom", 22)
	panel.add_child(margin)

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	margin.add_child(box)

	var title := Label.new()
	title.text = "设置昵称"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "第一次进入需要设置 2-16 字昵称，之后会进入大厅。"
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.custom_minimum_size = Vector2(0, 48)
	box.add_child(subtitle)

	nickname_input = LineEdit.new()
	nickname_input.placeholder_text = "输入 2-16 字昵称"
	nickname_input.max_length = 16
	nickname_input.custom_minimum_size = Vector2(320, 44)
	nickname_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nickname_input.text_submitted.connect(func(_text: String) -> void:
		_submit_nickname()
	)
	box.add_child(nickname_input)

	status_label = Label.new()
	status_label.custom_minimum_size = Vector2(0, 34)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(status_label)

	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 10)
	box.add_child(actions)

	submit_button = Button.new()
	submit_button.text = "保存昵称"
	submit_button.custom_minimum_size = Vector2(0, 44)
	submit_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if tokens != null:
		submit_button.add_theme_stylebox_override("normal", tokens.handdrawn_button_style())
		submit_button.add_theme_stylebox_override("hover", tokens.handdrawn_button_hover_style())
		submit_button.add_theme_stylebox_override("pressed", tokens.handdrawn_button_pressed_style())
	submit_button.pressed.connect(_submit_nickname)
	actions.add_child(submit_button)

	var logout_button := Button.new()
	logout_button.text = "退出登录"
	logout_button.custom_minimum_size = Vector2(0, 44)
	logout_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	logout_button.pressed.connect(_logout)
	actions.add_child(logout_button)

func _submit_nickname() -> void:
	var nickname := nickname_input.text.strip_edges()
	if nickname.length() < 2 or nickname.length() > 16:
		status_label.text = "昵称需要 2-16 个字符"
		return
	if session == null or not session.has_method("update_nickname"):
		status_label.text = "登录会话未初始化"
		return
	submit_button.disabled = true
	status_label.text = ""
	var ok: bool = await session.call("update_nickname", nickname)
	submit_button.disabled = false
	if not ok:
		status_label.text = "昵称保存失败，请重试"

func _logout() -> void:
	if session != null and session.has_method("logout"):
		await session.call("logout")
