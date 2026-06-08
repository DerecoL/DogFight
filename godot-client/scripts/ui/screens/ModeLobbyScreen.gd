extends BaseWebScreen

const DOG_OPTIONS := [
	{"id": "SHIBA", "label": "柴犬"},
	{"id": "SAMOYED", "label": "萨摩耶"},
	{"id": "FROG", "label": "祖灵莲池"},
	{"id": "EMPEROR", "label": "帝王犬"},
]

var account_label: Label
var run_label: Label
var status_label: Label
var dog_select: OptionButton
var mode_select: OptionButton
var lucky_select: OptionButton
var start_button: Button

func _ready() -> void:
	_build_lobby()
	_refresh_content()

func _on_payload_changed() -> void:
	_refresh_content()

func _build_lobby() -> void:
	var tokens = load("res://scripts/ui/web/WebUiTokens.gd")
	var panel := PanelContainer.new()
	panel.name = "ModeLobbyPanel"
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.custom_minimum_size = Vector2(680, 440)
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

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 12)
	box.add_child(header)

	var title_box := VBoxContainer.new()
	title_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title_box)

	var title := Label.new()
	title.text = "模式大厅"
	title_box.add_child(title)

	account_label = Label.new()
	account_label.custom_minimum_size = Vector2(0, 28)
	title_box.add_child(account_label)

	var logout_button := Button.new()
	logout_button.text = "退出登录"
	logout_button.custom_minimum_size = Vector2(110, 44)
	logout_button.pressed.connect(_logout)
	header.add_child(logout_button)

	run_label = Label.new()
	run_label.custom_minimum_size = Vector2(0, 52)
	run_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(run_label)

	var form := GridContainer.new()
	form.columns = 2
	form.add_theme_constant_override("h_separation", 12)
	form.add_theme_constant_override("v_separation", 10)
	box.add_child(form)

	_add_form_label(form, "犬种")
	dog_select = OptionButton.new()
	dog_select.custom_minimum_size = Vector2(280, 44)
	for option in DOG_OPTIONS:
		dog_select.add_item(str(option["label"]))
		dog_select.set_item_metadata(dog_select.item_count - 1, str(option["id"]))
	dog_select.item_selected.connect(func(_index: int) -> void:
		_update_lucky_visibility()
	)
	form.add_child(dog_select)

	_add_form_label(form, "模式")
	mode_select = OptionButton.new()
	mode_select.custom_minimum_size = Vector2(280, 44)
	mode_select.add_item("休闲跑局")
	mode_select.set_item_metadata(0, "CASUAL")
	mode_select.add_item("天梯跑局")
	mode_select.set_item_metadata(1, "LADDER")
	form.add_child(mode_select)

	_add_form_label(form, "天命数字")
	lucky_select = OptionButton.new()
	lucky_select.custom_minimum_size = Vector2(280, 44)
	for number in range(1, 7):
		lucky_select.add_item(str(number))
		lucky_select.set_item_metadata(lucky_select.item_count - 1, number)
	form.add_child(lucky_select)

	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 10)
	box.add_child(actions)

	start_button = Button.new()
	start_button.name = "StartRunButton"
	start_button.text = "开始跑局"
	start_button.custom_minimum_size = Vector2(0, 48)
	start_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if tokens != null:
		start_button.add_theme_stylebox_override("normal", tokens.handdrawn_button_style())
		start_button.add_theme_stylebox_override("hover", tokens.handdrawn_button_hover_style())
		start_button.add_theme_stylebox_override("pressed", tokens.handdrawn_button_pressed_style())
	start_button.pressed.connect(_start_run)
	actions.add_child(start_button)

	var continue_button := Button.new()
	continue_button.text = "继续跑局"
	continue_button.custom_minimum_size = Vector2(0, 48)
	continue_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	continue_button.pressed.connect(_continue_run)
	actions.add_child(continue_button)

	status_label = Label.new()
	status_label.custom_minimum_size = Vector2(0, 34)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(status_label)
	_update_lucky_visibility()

func _add_form_label(parent: Node, text: String) -> void:
	var label := Label.new()
	label.text = text
	label.custom_minimum_size = Vector2(120, 44)
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	parent.add_child(label)

func _refresh_content() -> void:
	if account_label == null:
		return
	var user: Dictionary = payload.get("user", {})
	var display_name = user.get("nickname", null)
	if display_name == null or str(display_name).strip_edges().is_empty():
		display_name = user.get("account", "未登录")
	var account := str(display_name)
	account_label.text = "当前账号：%s" % account
	var run: Dictionary = payload.get("run", {})
	if run.is_empty():
		run_label.text = "选择犬种和模式开始新跑局。"
	else:
		run_label.text = "当前跑局：%s · %d胜%d负 · 第%d回合" % [
			_dog_label(str(run.get("dogType", ""))),
			int(run.get("wins", 0)),
			int(run.get("losses", 0)),
			int(run.get("round", 0)),
		]

func _selected_dog() -> String:
	var metadata = dog_select.get_item_metadata(dog_select.selected)
	return str(metadata) if metadata != null else "SHIBA"

func _selected_mode() -> String:
	var metadata = mode_select.get_item_metadata(mode_select.selected)
	return str(metadata) if metadata != null else "CASUAL"

func _selected_lucky_number() -> Variant:
	if _selected_dog() != "EMPEROR":
		return null
	var metadata = lucky_select.get_item_metadata(lucky_select.selected)
	return int(metadata) if metadata != null else 1

func _update_lucky_visibility() -> void:
	if lucky_select != null:
		lucky_select.disabled = _selected_dog() != "EMPEROR"

func _start_run() -> void:
	if session == null or not session.has_method("create_run"):
		status_label.text = "登录会话未初始化"
		return
	start_button.disabled = true
	status_label.text = ""
	var ok: bool = await session.call("create_run", _selected_dog(), _selected_mode(), _selected_lucky_number())
	start_button.disabled = false
	if not ok:
		status_label.text = "创建跑局失败，请重试"

func _continue_run() -> void:
	if session != null and session.has_method("set_current_run"):
		var run: Dictionary = payload.get("run", {})
		if not run.is_empty():
			session.call("set_current_run", run)

func _logout() -> void:
	if session != null and session.has_method("logout"):
		await session.call("logout")

func _dog_label(dog_type: String) -> String:
	for option in DOG_OPTIONS:
		if str(option["id"]) == dog_type:
			return str(option["label"])
	return dog_type
