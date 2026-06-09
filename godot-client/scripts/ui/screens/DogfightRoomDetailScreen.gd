extends BaseWebScreen

const ApiRoutes := preload("res://scripts/api/ApiRoutes.gd")
const DOGFIGHT_LOSS_LIMIT := 3

var action_in_progress := false
var error_message := ""

func _ready() -> void:
	_render()

func _on_payload_changed() -> void:
	_render()

func _render() -> void:
	for child in get_children():
		remove_child(child)
		child.queue_free()

	var scroll := ScrollContainer.new()
	scroll.name = "DogfightRoomDetailView"
	scroll.set_anchors_preset(Control.PRESET_FULL_RECT)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_top", 22)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_bottom", 22)
	scroll.add_child(margin)

	var screen := VBoxContainer.new()
	screen.name = "DogfightRoomDetailContent"
	screen.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	screen.add_theme_constant_override("separation", 16)
	margin.add_child(screen)

	var room := _room()
	_render_toolbar(screen, room)
	if not error_message.is_empty():
		_add_label(screen, "DogfightRoomError", error_message, HORIZONTAL_ALIGNMENT_CENTER)
	if room.is_empty():
		_add_label(screen, "DogfightRoomEmpty", "请先选择一个斗狗房间。", HORIZONTAL_ALIGNMENT_CENTER)
		return
	_render_room_status(screen, room)
	_render_room_columns(screen, room)

func _render_toolbar(parent: VBoxContainer, room: Dictionary) -> void:
	var toolbar := HBoxContainer.new()
	toolbar.name = "DogfightRoomToolbar"
	toolbar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	toolbar.add_theme_constant_override("separation", 10)
	parent.add_child(toolbar)
	var back_button := _action_button("返回房间列表", _leave_active_room)
	back_button.name = "DogfightRoomBackButton"
	toolbar.add_child(back_button)
	var refresh_button := _action_button("刷新房间", _refresh_room)
	refresh_button.name = "DogfightRoomRefreshButton"
	refresh_button.disabled = action_in_progress or str(room.get("id", "")).is_empty()
	toolbar.add_child(refresh_button)

func _render_room_status(parent: VBoxContainer, room: Dictionary) -> void:
	var panel := PanelContainer.new()
	panel.name = "DogfightRoomStatusPanel"
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(panel)

	var status := GridContainer.new()
	status.name = "DogfightRoomStatus"
	status.columns = 4
	status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status.add_theme_constant_override("h_separation", 12)
	status.add_theme_constant_override("v_separation", 8)
	panel.add_child(status)

	var summary := VBoxContainer.new()
	summary.name = "DogfightRoomSummary"
	summary.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	summary.add_theme_constant_override("separation", 4)
	status.add_child(summary)
	_add_label(summary, "DogfightRoomSummaryTitle", _room_summary_label(room))
	if str(room.get("phase", "")) == "LOBBY":
		_add_label(summary, "DogfightRoomSummarySubtitle", "玩家席位 %d/%d" % [_room_player_count(room), int(room.get("maxPlayers", 0))])
	else:
		_add_label(summary, "DogfightRoomSummarySubtitle", "阶段倒计时 %ds" % _room_deadline_seconds(room))

	var phase_track := HBoxContainer.new()
	phase_track.name = "DogfightPhaseTrack"
	phase_track.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	phase_track.add_theme_constant_override("separation", 8)
	status.add_child(phase_track)
	for phase in ["DOG_SELECT", "SHOP", "BATTLE"]:
		var phase_label := Label.new()
		phase_label.name = "DogfightPhase_%s" % phase
		phase_label.text = _room_phase_label(phase)
		phase_label.custom_minimum_size = Vector2(104, 34)
		phase_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		phase_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		phase_label.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
		phase_track.add_child(phase_label)

	var run: Dictionary = _dict(room, "currentRun")
	if not run.is_empty():
		_render_run_stats(status, room, run)
	var current_member := _current_room_member(room)
	if not current_member.is_empty():
		_add_label(status, "DogfightLivesPill", "剩余存活 %d" % _dogfight_lives(current_member))
	if _can_start_room_action(room):
		var start_button := _action_button("开始房间", _room_action.bind("start", {}))
		start_button.name = "DogfightStartButton"
		status.add_child(start_button)
	if _can_ready_room_action(room):
		var ready_button := _action_button("完成本回合", _room_action.bind("ready", {}))
		ready_button.name = "DogfightReadyButton"
		status.add_child(ready_button)

func _render_run_stats(parent: GridContainer, room: Dictionary, run: Dictionary) -> void:
	var stats := HBoxContainer.new()
	stats.name = "DogfightRunStats"
	stats.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	stats.add_theme_constant_override("separation", 8)
	parent.add_child(stats)
	_add_label(stats, "DogfightRunGold", "金币 %d" % int(run.get("gold", 0)))
	_add_label(stats, "DogfightRunRecord", "%d胜 %d败" % [int(run.get("wins", 0)), int(run.get("losses", 0))])
	_add_label(stats, "DogfightRunRound", "第 %d 回合" % int(run.get("round", 0)))
	var current_member := _current_room_member(room)
	if not current_member.is_empty():
		var ready := bool(current_member.get("ready", false))
		var phase := str(room.get("phase", ""))
		var state_text := "已完成" if ready and phase == "BATTLE" else "已准备" if ready else "回放中" if phase == "BATTLE" else "调整中"
		_add_label(stats, "DogfightRunState", state_text)

func _render_room_columns(parent: VBoxContainer, room: Dictionary) -> void:
	var columns := GridContainer.new()
	columns.name = "DogfightRoomColumns"
	columns.columns = 3
	columns.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	columns.add_theme_constant_override("h_separation", 14)
	columns.add_theme_constant_override("v_separation", 14)
	parent.add_child(columns)
	_render_survivor_board(columns, room)
	_render_play_area(columns, room)
	_render_battle_dock(columns, room)

func _render_survivor_board(parent: GridContainer, room: Dictionary) -> void:
	var board := _paper_panel(parent, "DogfightSurvivorBoard")
	board.custom_minimum_size = Vector2(300, 420)
	_add_label(board, "DogfightSurvivorTitle", "房间玩家")
	for member_value in _sorted_members(_array(room, "members")):
		if member_value is Dictionary:
			_render_member_card(board, member_value)

func _render_member_card(parent: VBoxContainer, member: Dictionary) -> void:
	var member_id := str(member.get("id", ""))
	var host_mark := " · 房主" if bool(member.get("isHost", false)) else ""
	var dog_type := str(member.get("dogType", ""))
	var dog_text := _dog_name(dog_type) if not dog_type.is_empty() else "等待选狗"
	var kind_text := "参赛者" if str(member.get("kind", "")) == "BOT" else "玩家"
	var button := _action_button("%s%s\n%s · %s · %d胜 %d败\n%d" % [
		str(member.get("nickname", member.get("kind", ""))),
		host_mark,
		dog_text,
		kind_text,
		int(member.get("wins", 0)),
		int(member.get("losses", 0)),
		_dogfight_lives(member),
	], _noop)
	button.name = "DogfightMember_%s" % member_id
	button.custom_minimum_size = Vector2(0, 88)
	parent.add_child(button)

func _render_play_area(parent: GridContainer, room: Dictionary) -> void:
	var play_area := _paper_panel(parent, "DogfightPlayArea")
	play_area.custom_minimum_size = Vector2(520, 420)
	var run: Dictionary = _dict(room, "currentRun")
	if str(room.get("phase", "")) == "DOG_SELECT" and run.is_empty():
		_add_label(play_area, "DogfightDogSelectTitle", "选择斗狗")
		_add_label(play_area, "DogfightDogSelectSubtitle", "15 秒内锁定狗狗；超时会自动随机。")
	elif not run.is_empty() and str(room.get("phase", "")) == "SHOP":
		_add_label(play_area, "DogfightCurrentRunTitle", "房间当前跑局")
		_add_label(play_area, "DogfightCurrentRunPhase", "阶段 %s / %s" % [_room_phase_label(str(run.get("phase", ""))), str(run.get("status", ""))])
		_add_label(play_area, "DogfightCurrentRunDog", "%s · %d胜 %d败 · 金币 %d" % [_dog_name(str(run.get("dogType", ""))), int(run.get("wins", 0)), int(run.get("losses", 0)), int(run.get("gold", 0))])
	else:
		var empty_text := "战斗生成中，可以点击左侧玩家框或右侧场次切换观战。" if str(room.get("phase", "")) == "BATTLE" else "你正在观战这个房间。可以查看房间战况和历史战报。"
		_add_label(play_area, "DogfightPlayAreaEmpty", empty_text, HORIZONTAL_ALIGNMENT_CENTER)

func _render_battle_dock(parent: GridContainer, room: Dictionary) -> void:
	var dock := _paper_panel(parent, "DogfightBattleDock")
	dock.custom_minimum_size = Vector2(300, 420)
	_add_label(dock, "DogfightBattleDockTitle", "本轮场次")
	var battles := _array(room, "battles")
	if battles.is_empty():
		_add_label(dock, "DogfightBattleDockEmpty", "暂无战报")
		return
	var reversed_battles := battles.duplicate()
	reversed_battles.reverse()
	for battle_value in reversed_battles:
		if battle_value is Dictionary:
			var battle: Dictionary = battle_value
			var battle_id := str(battle.get("id", ""))
			var opponent := "玩家对战" if str(battle.get("opponentKind", "")) == "PLAYER" else "离线训练"
			var row := _action_button("第 %d 回合 · %s · 回放" % [int(battle.get("round", 0)), opponent], _load_room_battle.bind(battle_id))
			row.name = "DogfightBattleRow_%s" % battle_id
			dock.add_child(row)

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

func _refresh_room() -> void:
	var room_id := str(_room().get("id", ""))
	if room_id.is_empty() or action_in_progress:
		return
	await _run_room_request(ApiRoutes.dogfight_room(room_id), "GET", "")

func _leave_active_room() -> void:
	var room_id := str(_room().get("id", ""))
	if not room_id.is_empty() and not action_in_progress:
		await _run_room_request(ApiRoutes.dogfight_room_leave(room_id), "POST", "leave")
	if session != null and session.has_method("open_screen"):
		session.call("open_screen", "dogfight_rooms")

func _room_action(action: String, body: Dictionary) -> void:
	var room_id := str(_room().get("id", ""))
	if room_id.is_empty() or action_in_progress:
		return
	var path := ""
	match action:
		"start":
			path = ApiRoutes.dogfight_room_start(room_id)
		"ready":
			path = ApiRoutes.dogfight_room_ready(room_id)
		"dog-choice":
			path = ApiRoutes.dogfight_room_dog_choice(room_id)
	if path.is_empty():
		return
	await _run_room_request(path, "POST", action)

func _load_room_battle(_battle_id: String) -> void:
	pass

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
		if success_action == "leave":
			return
	else:
		error_message = str(response.get("error", "斗狗房间操作失败"))
	_render()

func _room() -> Dictionary:
	var value = payload.get("dogfightRoomData", {})
	if value is Dictionary and not value.is_empty():
		return value.duplicate(true)
	var wrapper = payload.get("room", {})
	if wrapper is Dictionary:
		return wrapper.duplicate(true)
	return {}

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value = source.get(key, {})
	return value if value is Dictionary else {}

func _array(source: Dictionary, key: String) -> Array:
	var value = source.get(key, [])
	return value if value is Array else []

func _room_summary_label(room: Dictionary) -> String:
	return "%s · 第 %d 回合" % [_room_phase_label(str(room.get("phase", ""))), int(room.get("currentRound", 0))]

func _room_phase_label(phase: String) -> String:
	match phase:
		"LOBBY":
			return "等待开局"
		"DOG_SELECT":
			return "选狗阶段"
		"SHOP":
			return "商店阶段"
		"BATTLE":
			return "战斗阶段"
		"COMPLETE":
			return "房间结束"
		_:
			return phase

func _room_player_count(room: Dictionary) -> int:
	var count := 0
	for member_value in _array(room, "members"):
		if member_value is Dictionary and str(member_value.get("kind", "")) == "PLAYER":
			count += 1
	return count

func _room_deadline_seconds(room: Dictionary) -> int:
	var deadline := float(room.get("deadlineAt", Time.get_unix_time_from_system() + 30))
	return max(0, int(ceil(deadline - Time.get_unix_time_from_system())))

func _current_room_member(room: Dictionary) -> Dictionary:
	var current := _dict(room, "currentRunMember")
	if not current.is_empty():
		return current
	var run_id := str(_dict(room, "currentRun").get("id", ""))
	for member_value in _array(room, "members"):
		if member_value is Dictionary and str(member_value.get("runId", "")) == run_id:
			return member_value
	return {}

func _can_start_room_action(room: Dictionary) -> bool:
	return bool(room.get("isHost", false)) and str(room.get("status", "")) == "WAITING"

func _can_ready_room_action(room: Dictionary) -> bool:
	var run := _dict(room, "currentRun")
	var member := _current_room_member(room)
	var phase := str(room.get("phase", ""))
	return not run.is_empty() and phase in ["SHOP", "BATTLE"] and not bool(member.get("ready", false)) and not bool(member.get("eliminated", false))

func _dogfight_lives(member: Dictionary) -> int:
	return 0 if bool(member.get("eliminated", false)) else max(0, DOGFIGHT_LOSS_LIMIT - int(member.get("losses", 0)))

func _sorted_members(members: Array) -> Array:
	var result := members.duplicate()
	result.sort_custom(_compare_members)
	return result

func _compare_members(left: Variant, right: Variant) -> bool:
	var left_member: Dictionary = left if left is Dictionary else {}
	var right_member: Dictionary = right if right is Dictionary else {}
	var left_lives := _dogfight_lives(left_member)
	var right_lives := _dogfight_lives(right_member)
	if left_lives != right_lives:
		return left_lives > right_lives
	return int(left_member.get("wins", 0)) > int(right_member.get("wins", 0))

func _dog_name(dog_type: String) -> String:
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
			return "等待选狗"

func _noop() -> void:
	pass
