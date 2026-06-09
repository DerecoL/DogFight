extends BaseWebScreen

const ApiRoutes := preload("res://scripts/api/ApiRoutes.gd")

var action_in_progress := false
var selected_room_id := ""
var error_message := ""
var join_button: Button

func _ready() -> void:
	_render()

func _on_payload_changed() -> void:
	_render()

func _render() -> void:
	for child in get_children():
		remove_child(child)
		child.queue_free()

	var screen := ScrollContainer.new()
	screen.name = "DogfightScreen"
	screen.set_anchors_preset(Control.PRESET_FULL_RECT)
	screen.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(screen)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_top", 22)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_bottom", 22)
	screen.add_child(margin)

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 18)
	margin.add_child(box)

	_render_heading(box)
	if not error_message.is_empty():
		_add_label(box, "DogfightError", error_message, HORIZONTAL_ALIGNMENT_CENTER)
	_render_layout(box)

func _render_heading(parent: VBoxContainer) -> void:
	var heading := VBoxContainer.new()
	heading.name = "DogfightHeading"
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_theme_constant_override("separation", 4)
	parent.add_child(heading)
	_add_label(heading, "DogfightHeadingTitle", "斗狗模式", HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(heading, "DogfightHeadingSubtitle", "房间内同步推进回合，前三回合发育，之后玩家两两对战。", HORIZONTAL_ALIGNMENT_CENTER)

func _render_layout(parent: VBoxContainer) -> void:
	var layout := GridContainer.new()
	layout.name = "DogfightLayout"
	layout.columns = 2
	layout.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	layout.add_theme_constant_override("h_separation", 18)
	layout.add_theme_constant_override("v_separation", 18)
	parent.add_child(layout)
	_render_actions(layout)
	_render_room_list(layout)

func _render_actions(parent: GridContainer) -> void:
	var actions := _paper_panel(parent, "DogfightActions")
	actions.custom_minimum_size = Vector2(360, 0)
	var create_button := _action_button("创建房间", _create_room)
	create_button.name = "CreateRoomButton"
	actions.add_child(create_button)
	join_button = _action_button("加入房间", _join_selected_room)
	join_button.name = "JoinRoomButton"
	join_button.disabled = selected_room_id.is_empty() or action_in_progress
	actions.add_child(join_button)
	var match_button := _action_button("随机匹配", _match_room)
	match_button.name = "MatchRoomButton"
	actions.add_child(match_button)
	_add_label(actions, "DogfightActionsNote", "玩家席位先进入房间，开局后统一 15 秒选择斗狗；不足 8 人由机器人补齐。")

func _render_room_list(parent: GridContainer) -> void:
	var room_list := _paper_panel(parent, "DogfightRoomList")
	var list_heading := HBoxContainer.new()
	list_heading.name = "DogfightRoomListHeading"
	list_heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list_heading.add_theme_constant_override("separation", 10)
	room_list.add_child(list_heading)
	var list_title := Label.new()
	list_title.name = "DogfightRoomListTitle"
	list_title.text = "房间列表"
	list_title.custom_minimum_size = Vector2(0, 38)
	list_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list_title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	list_heading.add_child(list_title)
	var refresh_button := _action_button("刷新", _refresh_rooms)
	refresh_button.name = "DogfightRefreshButton"
	refresh_button.disabled = action_in_progress
	list_heading.add_child(refresh_button)

	var rooms := _rooms()
	if rooms.is_empty():
		_add_label(room_list, "DogfightRoomsEmpty", "暂无房间，创建一个斗狗房间开始。")
		return
	for room_value in rooms:
		if room_value is Dictionary:
			_render_room_card(room_list, room_value)

func _render_room_card(parent: VBoxContainer, room: Dictionary) -> void:
	var room_id := str(room.get("id", ""))
	var panel := PanelContainer.new()
	panel.name = "DogfightRoomCard_%s" % room_id
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(panel)

	var card := HBoxContainer.new()
	card.name = "DogfightRoomCardRow_%s" % room_id
	card.custom_minimum_size = Vector2(0, 66)
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.add_theme_constant_override("separation", 12)
	panel.add_child(card)

	var info := VBoxContainer.new()
	info.name = "DogfightRoomInfo_%s" % room_id
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info.add_theme_constant_override("separation", 4)
	card.add_child(info)
	_add_label(info, "DogfightRoomHost_%s" % room_id, "%s 的房间" % str(room.get("hostName", "")))
	_add_label(info, "DogfightRoomMeta_%s" % room_id, "%s · 真人 %d/%d · 存活 %d/%d" % [
		_room_summary_label(room),
		int(room.get("memberCount", 0)),
		int(room.get("maxPlayers", 0)),
		int(room.get("aliveCount", 0)),
		int(room.get("targetPlayerCount", 0)),
	])

	var action := _action_button(_room_list_action_label(room), _enter_or_view_room.bind(room_id, str(room.get("status", ""))))
	action.name = "DogfightRoomAction_%s" % room_id
	action.disabled = action_in_progress
	card.add_child(action)

func _paper_panel(parent: Node, node_name: String) -> VBoxContainer:
	var panel := PanelContainer.new()
	panel.name = "%sPanel" % node_name
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(panel)
	var box := VBoxContainer.new()
	box.name = node_name
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_theme_constant_override("separation", 12)
	panel.add_child(box)
	return box

func _action_button(text: String, callback: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0, WebUiTokens.touch_target_height())
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button.add_theme_stylebox_override("normal", WebUiTokens.handdrawn_button_style())
	button.add_theme_stylebox_override("hover", WebUiTokens.handdrawn_button_hover_style())
	button.add_theme_stylebox_override("pressed", WebUiTokens.handdrawn_button_pressed_style())
	button.pressed.connect(callback)
	return button

func _add_label(parent: Node, node_name: String, text: String, align := HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var label := Label.new()
	label.name = node_name
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.horizontal_alignment = align
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(label)
	return label

func _refresh_rooms() -> void:
	if action_in_progress:
		return
	await _run_room_request(ApiRoutes.dogfight_rooms(), "GET", "")

func _create_room() -> void:
	if action_in_progress:
		return
	await _run_room_request(ApiRoutes.dogfight_rooms(), "POST", "create")

func _match_room() -> void:
	if action_in_progress:
		return
	await _run_room_request(ApiRoutes.dogfight_match(), "POST", "match")

func _join_selected_room() -> void:
	if selected_room_id.is_empty() or action_in_progress:
		return
	await _enter_or_view_room(selected_room_id, "WAITING")

func _enter_or_view_room(room_id: String, status: String) -> void:
	if room_id.is_empty() or action_in_progress:
		return
	selected_room_id = room_id
	var path := ApiRoutes.dogfight_room(room_id)
	var method := "GET"
	if status == "WAITING":
		path = ApiRoutes.dogfight_room_join(room_id)
		method = "POST"
	await _run_room_request(path, method, "enter")

func _run_room_request(path: String, method: String, success_action: String) -> void:
	if session == null or not session.has_method("dogfight_room_request"):
		return
	action_in_progress = true
	error_message = ""
	_render()
	var response: Dictionary = await session.call("dogfight_room_request", path, method, {})
	action_in_progress = false
	if bool(response.get("ok", false)):
		error_message = ""
		if success_action in ["create", "match", "enter"] and session.has_method("open_screen"):
			session.call("open_screen", "dogfight_room_detail")
			return
	else:
		error_message = str(response.get("error", "斗狗房间操作失败"))
	_render()

func _rooms() -> Array:
	var value = payload.get("dogfightRoomsData", {})
	if value is Dictionary:
		var rooms = value.get("rooms", [])
		return rooms if rooms is Array else []
	var direct_rooms = payload.get("rooms", [])
	return direct_rooms if direct_rooms is Array else []

func _room_summary_label(room: Dictionary) -> String:
	var status := str(room.get("status", ""))
	if status == "WAITING":
		return "等待中"
	if status == "ACTIVE":
		return "%s · 第 %d 回合" % [_room_phase_label(str(room.get("phase", ""))), int(room.get("currentRound", 0))]
	if status == "COMPLETE":
		return "已结束"
	return status

func _room_phase_label(phase: String) -> String:
	match phase:
		"LOBBY":
			return "房间大厅"
		"DOG_SELECT":
			return "选狗阶段"
		"SHOP":
			return "商店阶段"
		"BATTLE":
			return "战斗阶段"
		"COMPLETE":
			return "已结束"
		_:
			return phase

func _room_list_action_label(room: Dictionary) -> String:
	return "加入房间" if str(room.get("status", "")) == "WAITING" else "观战"
