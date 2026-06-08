extends BaseWebScreen

var account_label: Label
var run_label: Label
var status_label: Label
var casual_button: Button
var ladder_button: Button

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
	panel.custom_minimum_size = Vector2(860, 600)
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

	var subtitle := Label.new()
	subtitle.text = "选择本次要进入的竞技方式。休闲或天梯完成后的狗可以送入巅峰竞技场。"
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	subtitle.custom_minimum_size = Vector2(0, 46)
	title_box.add_child(subtitle)

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

	var tutorial_button := Button.new()
	tutorial_button.name = "TutorialReplayButton"
	tutorial_button.text = "新手引导"
	tutorial_button.custom_minimum_size = Vector2(150, 44)
	tutorial_button.pressed.connect(_replay_tutorial)
	box.add_child(tutorial_button)

	var mode_entries := GridContainer.new()
	mode_entries.columns = 2
	mode_entries.add_theme_constant_override("h_separation", 10)
	mode_entries.add_theme_constant_override("v_separation", 8)
	box.add_child(mode_entries)
	casual_button = _add_mode_button(mode_entries, "CasualModeButton", "休闲模式", "标准跑局，完成后的狗可提交巅峰竞技场。", "开始休闲模式", _enter_casual)
	ladder_button = _add_mode_button(mode_entries, "LadderModeButton", "天梯模式", "进入独立匹配池，整局结算赛季积分。", "进入天梯模式", _enter_ladder)
	_add_mode_button(mode_entries, "DogfightModeButton", "斗狗模式", "创建、匹配、加入房间", "进入斗狗模式", _open_screen.bind("dogfight_rooms"))
	_add_mode_button(mode_entries, "PeakModeButton", "巅峰模式", "提交完成狗并查看榜单", "进入巅峰模式", _open_screen.bind("apex"))

	var shortcuts := GridContainer.new()
	shortcuts.columns = 3
	shortcuts.add_theme_constant_override("h_separation", 10)
	shortcuts.add_theme_constant_override("v_separation", 8)
	box.add_child(shortcuts)
	_add_shortcut_button(shortcuts, "商城", "account_shop")
	_add_shortcut_button(shortcuts, "成就", "achievements")
	_add_shortcut_button(shortcuts, "排行", "leaderboards")
	_add_shortcut_button(shortcuts, "赛季", "season")
	_add_shortcut_button(shortcuts, "房间", "dogfight_rooms")
	_add_shortcut_button(shortcuts, "设置", "account_settings")

	status_label = Label.new()
	status_label.custom_minimum_size = Vector2(0, 34)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(status_label)

func _add_shortcut_button(parent: Node, text: String, screen_id: String) -> void:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0, 42)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(_open_screen.bind(screen_id))
	parent.add_child(button)

func _add_mode_button(parent: Node, node_name: String, title: String, detail: String, action_label: String, action: Callable) -> Button:
	var button := Button.new()
	button.name = node_name
	button.text = "%s\n%s\n%s" % [title, detail, action_label]
	button.custom_minimum_size = Vector2(0, 106)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button.pressed.connect(action)
	parent.add_child(button)
	return button

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
		run_label.text = "当前没有进行中的跑局。进入休闲模式后再选择狗狗并开始一局。"
	else:
		run_label.text = "当前跑局：%s · %d胜%d负 · 第%d回合" % [
			_dog_label(str(run.get("dogType", ""))),
			int(run.get("wins", 0)),
			int(run.get("losses", 0)),
			int(run.get("round", 0)),
		]
	if casual_button != null:
		casual_button.text = "%s\n%s\n%s" % [
			"休闲模式",
			"标准跑局，完成后的狗可提交巅峰竞技场。",
			"继续休闲模式" if str(run.get("mode", "")) == "CASUAL" else "开始休闲模式",
		]
	if ladder_button != null:
		ladder_button.text = "%s\n%s\n%s" % [
			"天梯模式",
			"进入独立匹配池，整局结算赛季积分。",
			"继续天梯模式" if str(run.get("mode", "")) == "LADDER" else "进入天梯模式",
		]

func _enter_casual() -> void:
	var run: Dictionary = payload.get("run", {})
	if not run.is_empty() and str(run.get("mode", "")) == "CASUAL":
		_continue_run()
		return
	if session != null and session.has_method("open_run_lobby"):
		session.call("open_run_lobby", "CASUAL")
		return
	_open_screen("legacy_run")

func _enter_ladder() -> void:
	var run: Dictionary = payload.get("run", {})
	if not run.is_empty() and str(run.get("mode", "")) == "LADDER":
		_continue_run()
		return
	_open_screen("leaderboards")

func _replay_tutorial() -> void:
	if session != null and session.has_method("replay_tutorial"):
		session.call("replay_tutorial")
		return
	if session != null and session.has_method("open_run_lobby"):
		session.call("open_run_lobby", "CASUAL")

func _continue_run() -> void:
	if session != null and session.has_method("set_current_run"):
		var run: Dictionary = payload.get("run", {})
		if not run.is_empty():
			session.call("set_current_run", run)

func _logout() -> void:
	if session != null and session.has_method("logout"):
		await session.call("logout")

func _open_screen(screen_id: String) -> void:
	if session != null and session.has_method("open_screen"):
		session.call("open_screen", screen_id)

func _dog_label(dog_type: String) -> String:
	match dog_type:
		"SHIBA":
			return "柴犬"
		"SAMOYED":
			return "萨摩耶"
		"MUTT":
			return "土狗"
		"BULLY":
			return "恶霸"
		"EMPEROR":
			return "狗皇帝"
		"FROG":
			return "祖灵"
		_:
			return dog_type
