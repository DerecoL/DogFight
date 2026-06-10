extends ShellBackedWebScreen

const ApiRoutes := preload("res://scripts/api/ApiRoutes.gd")
const WebUiTokens := preload("res://scripts/ui/web/WebUiTokens.gd")

var achievements_data: Dictionary = {}
var daily_data: Dictionary = {}
var selected_category := "全部"
var action_in_progress := false
var status_label: Label
var content_box: VBoxContainer
var action_buttons: Array[Button] = []

func bind_session(next_session: Node) -> void:
	super.bind_session(next_session)
	if visible:
		call_deferred("_refresh_achievements")

func _on_payload_changed() -> void:
	super._on_payload_changed()

func _notification(what: int) -> void:
	super._notification(what)
	if what == NOTIFICATION_VISIBILITY_CHANGED and visible:
		call_deferred("_refresh_achievements")

func _render_shell_content() -> void:
	_build_screen()
	_apply_payload_data()
	_render()

func _build_screen() -> void:
	var panel := PanelContainer.new()
	panel.name = "AchievementsPanel"
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.custom_minimum_size = Vector2(0, 420)
	panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	content_container().add_child(panel)

	var scroll := ScrollContainer.new()
	scroll.name = "AchievementsScroll"
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	panel.add_child(scroll)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_top", 22)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_bottom", 22)
	scroll.add_child(margin)

	content_box = VBoxContainer.new()
	content_box.name = "AchievementsScreen"
	content_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content_box.add_theme_constant_override("separation", 18)
	margin.add_child(content_box)

func _apply_payload_data() -> void:
	var achievements_value = payload.get("achievementsData", {})
	if achievements_value is Dictionary:
		achievements_data = achievements_value.duplicate(true)
	var daily_value = payload.get("dailyData", {})
	if daily_value is Dictionary:
		daily_data = daily_value.duplicate(true)

func _refresh_achievements() -> void:
	if action_in_progress:
		return
	if not visible or session == null or session.get("api") == null:
		return
	action_in_progress = true
	_set_actions_disabled(true)
	_set_status("加载中...")
	var api = session.get("api")
	var achievements_response: Dictionary = await api.get_json(ApiRoutes.achievements())
	if not bool(achievements_response.get("ok", false)):
		_finish_action_with_error(str(achievements_response.get("error", "加载失败")))
		return
	var daily_response: Dictionary = await api.get_json(ApiRoutes.daily_tasks())
	if not bool(daily_response.get("ok", false)):
		_finish_action_with_error(str(daily_response.get("error", "加载失败")))
		return
	achievements_data = _response_data(achievements_response)
	daily_data = _response_data(daily_response)
	action_in_progress = false
	_set_status("")
	_render()

func _render() -> void:
	if content_box == null:
		return
	for child in content_box.get_children():
		content_box.remove_child(child)
		child.queue_free()
	action_buttons = []

	_render_heading()
	_render_daily_task_panel()
	_render_achievement_tabs()
	_render_achievement_grid()
	_set_actions_disabled(action_in_progress)

func _render_heading() -> void:
	var heading := HBoxContainer.new()
	heading.name = "AchievementsHeading"
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_theme_constant_override("separation", 12)
	content_box.add_child(heading)

	var title_box := VBoxContainer.new()
	title_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_box.add_theme_constant_override("separation", 4)
	heading.add_child(title_box)
	_add_label(title_box, "AchievementsEyebrow", "长期目标")
	_add_label(title_box, "AchievementsTitle", "成就与每日任务")

	var wallet: Dictionary = _dict(achievements_data, "wallet")
	var currency := Label.new()
	currency.name = "AchievementsCurrencyPill"
	currency.text = str(int(wallet.get("balance", 0)))
	currency.custom_minimum_size = Vector2(108, 42)
	currency.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	currency.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	currency.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
	heading.add_child(currency)

	status_label = Label.new()
	status_label.name = "AchievementsStatus"
	status_label.custom_minimum_size = Vector2(0, 24)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	content_box.add_child(status_label)

func _render_daily_task_panel() -> void:
	var frame := PanelContainer.new()
	frame.name = "DailyTaskPanelFrame"
	frame.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	frame.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	content_box.add_child(frame)

	var panel := VBoxContainer.new()
	panel.name = "DailyTaskPanel"
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_constant_override("separation", 12)
	frame.add_child(panel)

	var title_row := HBoxContainer.new()
	title_row.name = "DailyTaskTitleRow"
	title_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_row.add_theme_constant_override("separation", 10)
	panel.add_child(title_row)
	_add_label(title_row, "DailyTaskTitle", "每日任务 %s" % str(daily_data.get("dateKey", "")))
	var refresh_used := bool(daily_data.get("refreshUsed", false))
	var refresh_button := _action_button("今日已刷新" if refresh_used else "刷新", _refresh_daily)
	refresh_button.name = "DailyTaskRefreshButton"
	refresh_button.disabled = refresh_used
	title_row.add_child(refresh_button)

	for task_value in _array(daily_data, "tasks"):
		if task_value is Dictionary:
			_render_daily_task_row(panel, task_value)

func _render_daily_task_row(parent: VBoxContainer, task: Dictionary) -> void:
	var task_id := str(task.get("taskId", ""))
	var row := HBoxContainer.new()
	row.name = "DailyTaskRow_%s" % task_id
	row.custom_minimum_size = Vector2(0, 68)
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 12)
	parent.add_child(row)

	var def := _dict(task, "def")
	var text_box := VBoxContainer.new()
	text_box.name = "DailyTaskInfo_%s" % task_id
	text_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text_box.add_theme_constant_override("separation", 4)
	row.add_child(text_box)
	_add_label(text_box, "DailyTaskTitle_%s" % task_id, _fallback(str(def.get("title", "")), task_id))
	_add_label(text_box, "DailyTaskDescription_%s" % task_id, str(def.get("description", "")))

	var progress := ProgressBar.new()
	progress.name = "DailyTaskProgress_%s" % task_id
	progress.custom_minimum_size = Vector2(140, 24)
	progress.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	progress.max_value = max(1, int(task.get("target", 0)))
	progress.value = clamp(int(task.get("progress", 0)), 0, int(progress.max_value))
	row.add_child(progress)

	var ready := int(task.get("progress", 0)) >= int(task.get("target", 0))
	var claimed := not str(task.get("claimedAt", "")).is_empty()
	if claimed:
		var claimed_button := _plain_button("已领取", 96)
		claimed_button.name = "DailyTaskAction_%s" % task_id
		claimed_button.disabled = true
		row.add_child(claimed_button)
	elif ready and not task_id.is_empty():
		var action := _action_button("领取 %d" % _reward_amount(task, def), _claim_daily.bind(task_id))
		action.name = "DailyTaskAction_%s" % task_id
		row.add_child(action)
	else:
		var state := Label.new()
		state.name = "DailyTaskAction_%s" % task_id
		state.text = "%d/%d" % [int(task.get("progress", 0)), int(task.get("target", 0))]
		state.custom_minimum_size = Vector2(96, WebUiTokens.touch_target_height())
		state.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		state.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		row.add_child(state)

func _render_achievement_tabs() -> void:
	var tabs := HBoxContainer.new()
	tabs.name = "AchievementTabs"
	tabs.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tabs.add_theme_constant_override("separation", 8)
	content_box.add_child(tabs)

	var all_tab := _category_button("全部")
	all_tab.name = "AchievementTab_all"
	tabs.add_child(all_tab)
	for category in _achievement_categories():
		var tab := _category_button(str(category))
		tab.name = "AchievementTab_%s" % _achievement_category_node_id(str(category))
		tabs.add_child(tab)

func _render_achievement_grid() -> void:
	var grid := GridContainer.new()
	grid.name = "AchievementGrid"
	grid.columns = 3
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	content_box.add_child(grid)

	for achievement_value in _array(achievements_data, "achievements"):
		if achievement_value is Dictionary:
			var achievement: Dictionary = achievement_value
			if selected_category == "全部" or str(achievement.get("category", "")) == selected_category:
				_render_achievement_card(grid, achievement)

func _render_achievement_card(parent: GridContainer, achievement: Dictionary) -> void:
	var achievement_id := str(achievement.get("id", ""))
	var panel := PanelContainer.new()
	panel.name = "AchievementCard_%s" % achievement_id
	panel.custom_minimum_size = Vector2(220, 166)
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", _achievement_card_style(achievement))
	parent.add_child(panel)

	var card := VBoxContainer.new()
	card.name = "AchievementCardBody_%s" % achievement_id
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.add_theme_constant_override("separation", 8)
	panel.add_child(card)

	var title_box := VBoxContainer.new()
	title_box.name = "AchievementCardHeader_%s" % achievement_id
	title_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_box.add_theme_constant_override("separation", 2)
	card.add_child(title_box)
	_add_label(title_box, "AchievementTitle_%s" % achievement_id, str(achievement.get("title", achievement_id)))
	_add_label(title_box, "AchievementCategory_%s" % achievement_id, str(achievement.get("category", "")))
	_add_label(card, "AchievementDescription_%s" % achievement_id, str(achievement.get("description", "")))

	var progress := ProgressBar.new()
	progress.name = "AchievementProgress_%s" % achievement_id
	progress.custom_minimum_size = Vector2(0, 24)
	progress.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	progress.max_value = max(1, int(achievement.get("target", 0)))
	progress.value = clamp(int(achievement.get("progress", 0)), 0, int(progress.max_value))
	card.add_child(progress)

	var action_row := HBoxContainer.new()
	action_row.name = "AchievementActions_%s" % achievement_id
	action_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	action_row.add_theme_constant_override("separation", 8)
	card.add_child(action_row)
	var state := Label.new()
	state.name = "AchievementState_%s" % achievement_id
	state.text = "%d/%d · %d" % [int(achievement.get("progress", 0)), int(achievement.get("target", 0)), int(achievement.get("reward", 0))]
	state.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	state.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	action_row.add_child(state)

	var action: Button
	if bool(achievement.get("claimed", false)):
		action = _plain_button("已领取", 96)
		action.disabled = true
	elif bool(achievement.get("claimable", false)) and not achievement_id.is_empty():
		action = _action_button("领取", _claim_achievement.bind(achievement_id))
	else:
		action = _plain_button("未完成", 96)
		action.disabled = true
	action.name = "AchievementAction_%s" % achievement_id
	action_row.add_child(action)

func _category_button(category: String) -> Button:
	var button := _plain_button(category, 84)
	button.toggle_mode = true
	button.button_pressed = selected_category == category
	button.pressed.connect(func() -> void:
		selected_category = category
		_render()
	)
	return button

func _action_button(text: String, callback: Callable) -> Button:
	var button := _plain_button(text, 96)
	button.add_theme_stylebox_override("normal", WebUiTokens.handdrawn_button_style())
	button.add_theme_stylebox_override("hover", WebUiTokens.handdrawn_button_hover_style())
	button.add_theme_stylebox_override("pressed", WebUiTokens.handdrawn_button_pressed_style())
	button.pressed.connect(callback)
	action_buttons.append(button)
	return button

func _plain_button(text: String, width: int) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(width, WebUiTokens.touch_target_height())
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button.add_theme_stylebox_override("normal", WebUiTokens.handdrawn_button_style())
	button.add_theme_stylebox_override("hover", WebUiTokens.handdrawn_button_hover_style())
	button.add_theme_stylebox_override("pressed", WebUiTokens.handdrawn_button_pressed_style())
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

func _claim_achievement(achievement_id: String) -> void:
	await _post_account_action(ApiRoutes.achievement_claim(achievement_id), {}, "claim_achievement")

func _refresh_daily() -> void:
	await _post_account_action(ApiRoutes.daily_tasks_refresh(), {}, "refresh_daily")

func _claim_daily(task_id: String) -> void:
	await _post_account_action(ApiRoutes.daily_task_claim(task_id), {}, "claim_daily")

func _post_account_action(path: String, body: Dictionary, target: String) -> void:
	if action_in_progress or session == null or session.get("api") == null:
		return
	action_in_progress = true
	_set_actions_disabled(true)
	var api = session.get("api")
	var response: Dictionary = await api.post_json(path, body)
	if not bool(response.get("ok", false)):
		_finish_action_with_error(str(response.get("error", "操作失败")))
		return
	var data := _response_data(response)
	if target == "claim_achievement":
		achievements_data = data
	elif target == "refresh_daily" or target == "claim_daily":
		daily_data = data
	action_in_progress = false
	_set_status("")
	_render()

func _finish_action_with_error(message: String) -> void:
	action_in_progress = false
	_set_status(message)
	_set_actions_disabled(false)

func _set_status(text: String) -> void:
	if status_label != null:
		status_label.text = text

func _set_actions_disabled(disabled: bool) -> void:
	for button in action_buttons:
		if button != null:
			button.disabled = disabled

func _response_data(response: Dictionary) -> Dictionary:
	var value = response.get("data", {})
	return value if value is Dictionary else {}

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value = source.get(key, {})
	return value if value is Dictionary else {}

func _array(source: Dictionary, key: String) -> Array:
	var value = source.get(key, [])
	return value if value is Array else []

func _fallback(value: String, fallback: String) -> String:
	return fallback if value.strip_edges().is_empty() else value

func _reward_amount(task: Dictionary, def: Dictionary) -> int:
	if task.has("reward"):
		return int(task.get("reward", 0))
	return int(def.get("reward", 0))

func _achievement_categories() -> Array:
	var categories: Array[String] = []
	for achievement_value in _array(achievements_data, "achievements"):
		if achievement_value is Dictionary:
			var category := str((achievement_value as Dictionary).get("category", ""))
			if not category.is_empty() and not categories.has(category):
				categories.append(category)
	return categories

func _achievement_category_node_id(category: String) -> String:
	var key := category.to_lower()
	match category:
		"战斗":
			return "combat"
		"收藏":
			return "collection"
		"任务":
			return "task"
	for part in [" ", "/", "\\", ".", ":", "\n", "\t"]:
		key = key.replace(part, "_")
	return key

func _achievement_card_style(achievement: Dictionary) -> StyleBoxFlat:
	var style := WebUiTokens.paper_card_style()
	if bool(achievement.get("claimable", false)):
		style.border_color = WebUiTokens.safe_color()
	elif bool(achievement.get("hidden", false)):
		style.border_color = Color(0.32, 0.30, 0.28, 1.0)
	return style
