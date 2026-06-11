extends ShellBackedWebScreen

const ACTION_BUTTON := preload("res://scripts/ui/shared/WebActionButton.gd")

var account_label: Label
var run_label: Label
var status_label: Label
var casual_button: Button
var ladder_button: Button
var history_total_label: Label
var history_meta_label: Label
var history_rank_label: Label
var history_rank_meta_label: Label
var history_best_label: Label
var history_run_list: VBoxContainer
var season_history_list: VBoxContainer
var overlay_host: Control
var tutorial_guide_panel: PanelContainer
var action_buttons: Array[Button] = []
var action_in_progress := false
var tutorial_active := false

func _on_payload_changed() -> void:
	super._on_payload_changed()

func _render_shell_content() -> void:
	_build_lobby()
	_refresh_content()

func _build_lobby() -> void:
	action_buttons = []

	var panel := PanelContainer.new()
	panel.name = "ModeLobbyPanel"
	panel.custom_minimum_size = Vector2(960, 660)
	panel.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	content_container().add_child(panel)

	var scroll := ScrollContainer.new()
	scroll.name = "ModeLobbyScroll"
	scroll.custom_minimum_size = panel.custom_minimum_size
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

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	margin.add_child(box)

	var hero := VBoxContainer.new()
	hero.name = "ModeLobbyHero"
	hero.add_theme_constant_override("separation", 6)
	box.add_child(hero)

	var heading := VBoxContainer.new()
	heading.name = "ModeLobbyHeading"
	heading.add_theme_constant_override("separation", 6)
	hero.add_child(heading)

	var title := Label.new()
	title.name = "ModeLobbyTitle"
	title.text = "模式大厅"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	heading.add_child(title)

	var subtitle := Label.new()
	subtitle.name = "ModeLobbySubtitle"
	subtitle.text = "选择本次要进入的竞技方式。休闲或天梯完成后的狗可以送入巅峰竞技场。"
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.custom_minimum_size = Vector2(0, 42)
	heading.add_child(subtitle)

	var secondary_panel := VBoxContainer.new()
	secondary_panel.name = "ModeLobbySecondaryPanel"
	secondary_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	secondary_panel.add_theme_constant_override("separation", 10)

	var account_strip := HBoxContainer.new()
	account_strip.name = "ModeLobbyAccountStrip"
	account_strip.custom_minimum_size = Vector2(0, WebUiTokens.touch_target_height())
	account_strip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	account_strip.add_theme_constant_override("separation", 10)
	secondary_panel.add_child(account_strip)

	account_label = Label.new()
	account_label.name = "ModeLobbyAccountLabel"
	account_label.custom_minimum_size = Vector2(180, WebUiTokens.touch_target_height())
	account_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	account_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	account_label.clip_text = true
	account_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	account_strip.add_child(account_label)

	run_label = Label.new()
	run_label.name = "ModeLobbyRunLabel"
	run_label.custom_minimum_size = Vector2(360, WebUiTokens.touch_target_height())
	run_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	run_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	run_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	run_label.clip_text = true
	run_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	account_strip.add_child(run_label)

	var tutorial_button := Button.new()
	tutorial_button.name = "TutorialReplayButton"
	tutorial_button.text = "新手引导"
	tutorial_button.custom_minimum_size = Vector2(150, WebUiTokens.touch_target_height())
	tutorial_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	tutorial_button.clip_text = true
	tutorial_button.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	tutorial_button.autowrap_mode = TextServer.AUTOWRAP_OFF
	tutorial_button.add_theme_stylebox_override("normal", WebUiTokens.handdrawn_button_style())
	tutorial_button.add_theme_stylebox_override("hover", WebUiTokens.handdrawn_button_hover_style())
	tutorial_button.add_theme_stylebox_override("pressed", WebUiTokens.handdrawn_button_pressed_style())
	tutorial_button.pressed.connect(_replay_tutorial)
	account_strip.add_child(_track_action_button(tutorial_button))
	_clear_overlay_host()
	_build_tutorial_guide()

	var primary_modes := VBoxContainer.new()
	primary_modes.name = "ModeLobbyPrimaryModes"
	primary_modes.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	primary_modes.size_flags_vertical = Control.SIZE_EXPAND_FILL
	primary_modes.z_index = WebUiTokens.layer_card()
	box.add_child(primary_modes)

	var mode_entries := GridContainer.new()
	mode_entries.name = "ModeGrid"
	mode_entries.columns = 2
	mode_entries.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mode_entries.size_flags_vertical = Control.SIZE_EXPAND_FILL
	mode_entries.add_theme_constant_override("h_separation", 16)
	mode_entries.add_theme_constant_override("v_separation", 14)
	primary_modes.add_child(mode_entries)
	casual_button = _add_mode_button(mode_entries, "CasualModeButton", "休闲模式", "当前经典构筑、商店、匹配和自动战斗流程", "开始休闲模式", _enter_casual)
	ladder_button = _add_mode_button(mode_entries, "LadderModeButton", "天梯模式", "按整局表现结算积分，冲击大师与犬王排行榜", "进入天梯模式", _enter_ladder)
	_add_mode_button(mode_entries, "DogfightModeButton", "斗狗模式", "实时房间，8 狗同场淘汰", "进入斗狗模式", _open_screen.bind("dogfight_rooms"))
	_add_mode_button(mode_entries, "PeakModeButton", "巅峰模式", "战斗结束后的狗进入巅峰竞技场，自动挑战榜单冲击排名", "进入巅峰模式", _open_screen.bind("apex"))

	box.add_child(secondary_panel)
	_add_history_panel(secondary_panel)

	status_label = Label.new()
	status_label.name = "ModeLobbyStatus"
	status_label.custom_minimum_size = Vector2(0, 34)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.add_theme_color_override("font_color", WebUiTokens.danger_color())
	secondary_panel.add_child(status_label)

func _add_history_panel(parent: Node) -> void:
	var panel := PanelContainer.new()
	panel.name = "PlayerHistoryPanel"
	panel.custom_minimum_size = Vector2(0, 280)
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(panel)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 16)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_right", 16)
	margin.add_theme_constant_override("margin_bottom", 12)
	panel.add_child(margin)

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	margin.add_child(box)

	var summary := GridContainer.new()
	summary.name = "HistorySummary"
	summary.columns = 4
	summary.add_theme_constant_override("h_separation", 12)
	summary.add_theme_constant_override("v_separation", 6)
	box.add_child(summary)

	var total_box := _history_cell(summary, "个人战绩")
	history_total_label = Label.new()
	history_total_label.name = "HistoryTotalLabel"
	history_total_label.custom_minimum_size = Vector2(140, 24)
	_configure_stable_label(history_total_label, 24)
	total_box.add_child(history_total_label)
	history_meta_label = Label.new()
	history_meta_label.name = "HistoryMetaLabel"
	history_meta_label.custom_minimum_size = Vector2(140, 36)
	_configure_stable_label(history_meta_label, 36)
	total_box.add_child(history_meta_label)

	var rank_box := _history_cell(summary, "天梯段位")
	rank_box.name = "HistoryLadderSlot"
	history_rank_label = Label.new()
	history_rank_label.name = "HistoryRankLabel"
	history_rank_label.custom_minimum_size = Vector2(120, 24)
	_configure_stable_label(history_rank_label, 24)
	rank_box.add_child(history_rank_label)
	history_rank_meta_label = Label.new()
	history_rank_meta_label.name = "HistoryRankMeta"
	history_rank_meta_label.custom_minimum_size = Vector2(120, 36)
	_configure_stable_label(history_rank_meta_label, 36)
	rank_box.add_child(history_rank_meta_label)

	var best_box := _history_cell(summary, "最佳成绩")
	best_box.name = "HistoryBest"
	history_best_label = Label.new()
	history_best_label.name = "HistoryBestLabel"
	history_best_label.custom_minimum_size = Vector2(160, 60)
	_configure_stable_label(history_best_label, 60)
	best_box.add_child(history_best_label)

	var actions := GridContainer.new()
	actions.name = "AccountPanelActions"
	actions.columns = 2
	actions.custom_minimum_size = Vector2(170, 88)
	actions.add_theme_constant_override("h_separation", 6)
	actions.add_theme_constant_override("v_separation", 6)
	summary.add_child(actions)
	_add_history_shortcut(actions, "HistoryShopButton", "商城", "account_shop")
	_add_history_shortcut(actions, "HistoryAchievementsButton", "成就", "achievements")
	_add_history_shortcut(actions, "HistorySettingsButton", "个人设置", "account_settings")
	_add_history_shortcut(actions, "HistoryDetailButton", "查看详情和装备", "account")

	var lists_row := HBoxContainer.new()
	lists_row.name = "HistoryListsRow"
	lists_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lists_row.add_theme_constant_override("separation", 12)
	box.add_child(lists_row)

	var recent_column := VBoxContainer.new()
	recent_column.name = "HistoryRecentColumn"
	recent_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	recent_column.add_theme_constant_override("separation", 5)
	lists_row.add_child(recent_column)

	var recent_title := Label.new()
	recent_title.name = "HistoryRecentTitle"
	recent_title.text = "最近对局"
	recent_title.custom_minimum_size = Vector2(0, 22)
	recent_column.add_child(recent_title)

	var recent_scroll := ScrollContainer.new()
	recent_scroll.name = "HistoryRecentScroll"
	recent_scroll.custom_minimum_size = Vector2(0, 112)
	recent_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	recent_scroll.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	recent_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	recent_column.add_child(recent_scroll)

	history_run_list = VBoxContainer.new()
	history_run_list.name = "HistoryRunList"
	history_run_list.custom_minimum_size = Vector2(0, 112)
	history_run_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	history_run_list.add_theme_constant_override("separation", 4)
	recent_scroll.add_child(history_run_list)

	var season_column := VBoxContainer.new()
	season_column.name = "HistorySeasonColumn"
	season_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	season_column.add_theme_constant_override("separation", 5)
	lists_row.add_child(season_column)
	_add_season_history_list(season_column)

func _build_tutorial_guide() -> void:
	tutorial_guide_panel = PanelContainer.new()
	tutorial_guide_panel.name = "CasualTutorialGuide"
	tutorial_guide_panel.visible = false
	tutorial_guide_panel.z_index = WebUiTokens.layer_overlay()
	tutorial_guide_panel.custom_minimum_size = Vector2(360, 220)
	tutorial_guide_panel.anchor_left = 1.0
	tutorial_guide_panel.anchor_top = 1.0
	tutorial_guide_panel.anchor_right = 1.0
	tutorial_guide_panel.anchor_bottom = 1.0
	tutorial_guide_panel.offset_left = -388
	tutorial_guide_panel.offset_top = -248
	tutorial_guide_panel.offset_right = -28
	tutorial_guide_panel.offset_bottom = -28
	tutorial_guide_panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	_ensure_overlay_host().add_child(tutorial_guide_panel)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 16)
	margin.add_theme_constant_override("margin_top", 16)
	margin.add_theme_constant_override("margin_right", 16)
	margin.add_theme_constant_override("margin_bottom", 16)
	tutorial_guide_panel.add_child(margin)

	var card := VBoxContainer.new()
	card.name = "TutorialCoachCard"
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.add_theme_constant_override("separation", 10)
	margin.add_child(card)

	var tag := Label.new()
	tag.name = "TutorialTag"
	tag.text = "新手引导"
	card.add_child(tag)

	var title := Label.new()
	title.name = "TutorialTitle"
	title.text = "新手引导"
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	card.add_child(title)

	var body := Label.new()
	body.name = "TutorialBody"
	body.text = "先从休闲模式熟悉一局，不影响天梯。"
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	card.add_child(body)

	var task := Label.new()
	task.name = "TutorialTask"
	task.text = "点击开始休闲模式。"
	task.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	card.add_child(task)

	var skip := Button.new()
	skip.name = "TutorialSkipButton"
	skip.text = "跳过引导"
	skip.custom_minimum_size = Vector2(0, WebUiTokens.touch_target_height())
	skip.add_theme_stylebox_override("normal", WebUiTokens.handdrawn_button_style())
	skip.add_theme_stylebox_override("hover", WebUiTokens.handdrawn_button_hover_style())
	skip.add_theme_stylebox_override("pressed", WebUiTokens.handdrawn_button_pressed_style())
	skip.pressed.connect(_hide_tutorial_guide)
	card.add_child(skip)

func _ensure_overlay_host() -> Control:
	if overlay_host != null and is_instance_valid(overlay_host):
		return overlay_host
	overlay_host = Control.new()
	overlay_host.name = "ModeLobbyOverlayHost"
	overlay_host.set_anchors_preset(Control.PRESET_TOP_LEFT)
	overlay_host.custom_minimum_size = Vector2(WebUiTokens.safe_content_size_16_9())
	overlay_host.size = overlay_host.custom_minimum_size
	overlay_host.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	overlay_host.size_flags_vertical = Control.SIZE_EXPAND_FILL
	overlay_host.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay_host.z_index = WebUiTokens.layer_overlay()
	shell.add_child(overlay_host)
	shell.move_child(overlay_host, shell.get_child_count() - 1)
	return overlay_host

func _clear_overlay_host() -> void:
	var host := _ensure_overlay_host()
	for child in host.get_children():
		host.remove_child(child)
		child.queue_free()

func _history_cell(parent: Node, title: String) -> VBoxContainer:
	var cell := VBoxContainer.new()
	cell.add_theme_constant_override("separation", 3)
	cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(cell)
	var label := Label.new()
	label.text = title
	_configure_stable_label(label, 20)
	cell.add_child(label)
	return cell

func _configure_stable_label(label: Label, height: int) -> void:
	label.custom_minimum_size.y = height
	label.autowrap_mode = TextServer.AUTOWRAP_OFF
	label.clip_text = true
	label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS

func _add_history_shortcut(parent: Node, node_name: String, text: String, screen_id: String) -> void:
	var button := ACTION_BUTTON.create(text, _open_screen.bind(screen_id), "secondary")
	button.name = node_name
	button.custom_minimum_size = Vector2(0, 34)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(_track_action_button(button))

func _add_mode_button(parent: Node, node_name: String, title: String, detail: String, action_label: String, action: Callable) -> Button:
	var mode_id := node_name.replace("ModeButton", "").to_upper()
	var card := PanelContainer.new()
	card.name = "ModeCard_%s" % mode_id
	card.custom_minimum_size = Vector2(WebUiTokens.lobby_mode_card_min_size())
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.size_flags_vertical = Control.SIZE_EXPAND_FILL
	card.add_theme_stylebox_override("panel", WebUiTokens.mode_card_style())
	parent.add_child(card)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_bottom", 10)
	card.add_child(margin)

	var content := VBoxContainer.new()
	content.name = "ModeCardContent_%s" % mode_id
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 8)
	margin.add_child(content)

	var icon := Label.new()
	icon.name = "ModeIcon_%s" % mode_id
	icon.text = _mode_icon_text(mode_id)
	icon.custom_minimum_size = Vector2(0, 30)
	icon.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	icon.clip_text = true
	content.add_child(icon)

	var copy := VBoxContainer.new()
	copy.name = "ModeCopy_%s" % mode_id
	copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	copy.size_flags_vertical = Control.SIZE_EXPAND_FILL
	copy.add_theme_constant_override("separation", 4)
	content.add_child(copy)

	var title_label := Label.new()
	title_label.name = "ModeTitle_%s" % mode_id
	title_label.text = title
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.clip_text = true
	title_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	copy.add_child(title_label)

	var detail_label := Label.new()
	detail_label.name = "ModeDescription_%s" % mode_id
	detail_label.text = detail
	detail_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	detail_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	detail_label.custom_minimum_size = Vector2(0, 58)
	detail_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail_label.clip_text = true
	detail_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	copy.add_child(detail_label)

	var button := ACTION_BUTTON.create(action_label, action)
	button.name = node_name
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_child(_track_action_button(button))
	return button

func _mode_icon_text(mode_id: String) -> String:
	match mode_id:
		"CASUAL":
			return "🎮"
		"LADDER":
			return "🏅"
		"DOGFIGHT":
			return "📡"
		"PEAK":
			return "👑"
		_:
			return "●"

func _track_action_button(button: Button) -> Button:
	action_buttons.append(button)
	button.disabled = action_in_progress
	return button

func _set_actions_disabled(disabled: bool) -> void:
	for button in action_buttons:
		if button != null:
			button.disabled = disabled

func _refresh_content() -> void:
	if account_label == null:
		return
	var user: Dictionary = payload.get("user", {})
	var display_name = user.get("nickname", null)
	if display_name == null or str(display_name).strip_edges().is_empty():
		display_name = user.get("account", "未登录")
	account_label.text = "当前账号：%s" % str(display_name)
	var run: Dictionary = payload.get("run", {})
	if run.is_empty():
		run_label.text = "当前没有进行中的跑局。进入休闲模式后再选择狗狗并开始一局。"
	else:
		run_label.text = "当前跑局：%s · %d胜 %d败 · 第 %d 回合" % [
			_dog_label(str(run.get("dogType", ""))),
			int(run.get("wins", 0)),
			int(run.get("losses", 0)),
			int(run.get("round", 0)),
		]
	if casual_button != null:
		casual_button.text = "继续休闲模式" if str(run.get("mode", "")) == "CASUAL" else "开始休闲模式"
	if ladder_button != null:
		ladder_button.text = "继续天梯模式" if str(run.get("mode", "")) == "LADDER" else "进入天梯模式"
	_refresh_history_panel()

func _refresh_history_panel() -> void:
	if history_total_label == null:
		return
	var history_value = payload.get("history", {})
	var history: Dictionary = history_value if history_value is Dictionary else {}
	var total_runs := int(history.get("totalRuns", 0))
	var total_wins := int(history.get("totalWins", 0))
	var total_losses := int(history.get("totalLosses", 0))
	var completed_runs := int(history.get("completedRuns", 0))
	var played := total_wins + total_losses
	var win_rate := 0
	if played > 0:
		win_rate = int(round(float(total_wins) / float(played) * 100.0))
	history_total_label.text = "%d胜 %d败" % [total_wins, total_losses]
	history_meta_label.text = "共 %d 局 · 胜率 %d%% · 完成 %d 局" % [total_runs, win_rate, completed_runs]

	var ladder_profile_value = payload.get("ladderProfile", {})
	var ladder_profile: Dictionary = ladder_profile_value if ladder_profile_value is Dictionary else {}
	var season_value = payload.get("season", {})
	var season: Dictionary = season_value if season_value is Dictionary else {}
	history_rank_label.text = str(ladder_profile.get("tierLabel", "青铜"))
	history_rank_meta_label.text = "%s · %d 分" % [str(season.get("name", "当前赛季")), int(ladder_profile.get("score", 0))]

	var best_run_value = history.get("bestRun", {})
	var best_run: Dictionary = best_run_value if best_run_value is Dictionary else {}
	if best_run.is_empty():
		history_best_label.text = "暂无对局"
	else:
		history_best_label.text = "%s · %d胜 %d败 · 第 %d 回合" % [
			_dog_label(str(best_run.get("dogType", ""))),
			int(best_run.get("wins", 0)),
			int(best_run.get("losses", 0)),
			int(best_run.get("round", 0)),
	]
	_render_history_rows(history.get("recentRuns", []))
	_render_season_history_rows(_season_summaries())

func _render_history_rows(recent_runs: Variant) -> void:
	if history_run_list == null:
		return
	for child in history_run_list.get_children():
		history_run_list.remove_child(child)
		child.free()
	var runs: Array = recent_runs if recent_runs is Array else []
	if runs.is_empty():
		history_run_list.add_child(_history_run_row({"empty": true}))
		return
	for index in range(min(5, runs.size())):
		var entry: Dictionary = runs[index] if runs[index] is Dictionary else {}
		history_run_list.add_child(_history_run_row(entry, index))

func _add_season_history_list(parent: Node) -> void:
	var season_scroll := ScrollContainer.new()
	season_scroll.name = "SeasonHistoryScroll"
	season_scroll.custom_minimum_size = Vector2(0, 152)
	season_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	season_scroll.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	season_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	parent.add_child(season_scroll)

	season_history_list = VBoxContainer.new()
	season_history_list.name = "SeasonHistoryList"
	season_history_list.custom_minimum_size = Vector2(0, 152)
	season_history_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	season_history_list.add_theme_constant_override("separation", 8)
	season_scroll.add_child(season_history_list)
	_render_season_history_rows([])

func _render_season_history_rows(summaries: Array) -> void:
	if season_history_list == null:
		return
	for child in season_history_list.get_children():
		season_history_list.remove_child(child)
		child.free()

	var heading := HBoxContainer.new()
	heading.name = "SeasonHistoryHeading"
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_theme_constant_override("separation", 12)
	season_history_list.add_child(heading)

	var title := _season_history_label(heading, "SeasonHistoryTitle", "赛季历史")
	title.custom_minimum_size = Vector2(0, 24)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var subtitle_text := "%d 个已结束赛季" % summaries.size() if summaries.size() > 0 else "赛季结束后会保存在这里"
	var subtitle := _season_history_label(heading, "SeasonHistorySubtitle", subtitle_text, HORIZONTAL_ALIGNMENT_RIGHT)
	subtitle.custom_minimum_size = Vector2(180, 24)

	if summaries.is_empty():
		var empty := _season_history_label(season_history_list, "SeasonHistoryEmpty", "暂无赛季历史")
		empty.custom_minimum_size = Vector2(0, 28)
		return
	for index in range(min(3, summaries.size())):
		var summary_value = summaries[index]
		if summary_value is Dictionary:
			_render_season_history_card(summary_value)

func _render_season_history_card(summary: Dictionary) -> void:
	var summary_id := str(summary.get("id", summary.get("seasonId", "")))
	var panel := PanelContainer.new()
	panel.name = "SeasonHistoryCard_%s" % summary_id
	panel.custom_minimum_size = Vector2(0, 68)
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", _season_history_card_style())
	season_history_list.add_child(panel)

	var row := HBoxContainer.new()
	row.name = "SeasonHistoryCardRow_%s" % summary_id
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 10)
	panel.add_child(row)

	var text_box := VBoxContainer.new()
	text_box.name = "SeasonHistoryCardText_%s" % summary_id
	text_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text_box.add_theme_constant_override("separation", 3)
	row.add_child(text_box)

	_season_history_label(text_box, "SeasonHistoryName_%s" % summary_id, str(summary.get("seasonName", summary.get("seasonId", ""))))
	_season_history_label(text_box, "SeasonHistoryLadder_%s" % summary_id, _season_ladder_summary_text(summary))
	_season_history_label(text_box, "SeasonHistoryApex_%s" % summary_id, _season_apex_summary_text(summary))

	var snapshot_value = summary.get("apexSnapshot", {})
	var snapshot: Dictionary = snapshot_value if snapshot_value is Dictionary else {}
	if not snapshot.is_empty():
		var button := ACTION_BUTTON.create("巅峰配置快照", _show_snapshot.bind(snapshot), "secondary")
		button.name = "SeasonSnapshotAction_%s" % summary_id
		button.custom_minimum_size = Vector2(140, WebUiTokens.touch_target_height())
		button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(_track_action_button(button))

func _season_history_label(parent: Node, node_name: String, text: String, align := HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var label := Label.new()
	label.name = node_name
	label.text = text
	label.horizontal_alignment = align
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_configure_stable_label(label, 20)
	parent.add_child(label)
	return label

func _season_history_card_style() -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(1.0, 0.96, 0.84, 0.72)
	style.border_color = Color(0.24, 0.16, 0.10, 0.22)
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	style.content_margin_left = 12
	style.content_margin_top = 9
	style.content_margin_right = 12
	style.content_margin_bottom = 9
	return style

func _season_summaries() -> Array:
	var history_value = payload.get("historyData", {})
	if history_value is Dictionary:
		var nested := _array(history_value, "seasonSummaries")
		if not nested.is_empty():
			return nested
	return _array(payload, "seasonSummaries")

func _array(source: Dictionary, key: String) -> Array:
	var value = source.get(key, [])
	return value if value is Array else []

func _season_ladder_summary_text(summary: Dictionary) -> String:
	var tier := str(summary.get("ladderTierLabel", ""))
	if tier.is_empty():
		tier = "未参赛"
	var text := "天梯 %s" % tier
	if summary.has("ladderScore") and str(summary.get("ladderScore", "")).length() > 0:
		text += " · %d 分" % int(summary.get("ladderScore", 0))
	var dog_king_rank := int(summary.get("dogKingRank", 0))
	if dog_king_rank > 0:
		text += " · 犬王第 %d 名" % dog_king_rank
	return text

func _season_apex_summary_text(summary: Dictionary) -> String:
	var apex_rank := int(summary.get("apexRank", 0))
	if apex_rank <= 0:
		return "巅峰未入榜"
	return "巅峰第 %d 名 · %d胜%d败" % [apex_rank, int(summary.get("apexWins", 0)), int(summary.get("apexLosses", 0))]

func _show_snapshot(snapshot: Dictionary) -> void:
	if session != null and session.has_method("_show_snapshot_modal"):
		session.call("_show_snapshot_modal", snapshot, "赛季巅峰快照")

func _history_run_row(entry: Dictionary, row_index := 0) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.name = "HistoryRunRow%d" % row_index
	row.custom_minimum_size = Vector2(0, 22)
	row.add_theme_constant_override("separation", 8)
	if bool(entry.get("empty", false)):
		_add_row_label(row, "最近对局", 120)
		_add_row_label(row, "还没有记录", 120)
		_add_row_label(row, "开始一局后会自动统计", 220)
		return row
	_add_row_label(row, _dog_label(str(entry.get("dogType", ""))), 120)
	_add_row_label(row, "%d胜 %d败" % [int(entry.get("wins", 0)), int(entry.get("losses", 0))], 90)
	_add_row_label(row, "%s · 第 %d 回合" % [_run_status_text(str(entry.get("status", ""))), int(entry.get("round", 0))], 220)
	return row

func _add_row_label(parent: Node, text: String, width: int) -> void:
	var label := Label.new()
	label.text = text
	label.custom_minimum_size = Vector2(width, 20)
	label.clip_text = true
	label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	parent.add_child(label)

func _run_status_text(status: String) -> String:
	match status:
		"ACTIVE":
			return "进行中"
		"COMPLETED":
			return "已完成"
		"FAILED":
			return "已失败"
		_:
			return "未知"

func _enter_casual() -> void:
	if action_in_progress:
		return
	var run: Dictionary = payload.get("run", {})
	if not run.is_empty() and str(run.get("mode", "")) == "CASUAL":
		_continue_run()
		return
	if session != null and session.has_method("open_run_lobby"):
		session.call("open_run_lobby", "CASUAL")
		return
	_open_screen("legacy_run")

func _enter_ladder() -> void:
	if action_in_progress:
		return
	var run: Dictionary = payload.get("run", {})
	if not run.is_empty() and str(run.get("mode", "")) == "LADDER":
		_continue_run()
		return
	_open_screen("leaderboards")

func _replay_tutorial() -> void:
	if action_in_progress:
		return
	_show_tutorial_guide()

func _show_tutorial_guide() -> void:
	tutorial_active = true
	if tutorial_guide_panel != null:
		tutorial_guide_panel.visible = true
	if casual_button != null:
		casual_button.add_theme_stylebox_override("normal", WebUiTokens.handdrawn_button_pressed_style())

func _hide_tutorial_guide() -> void:
	tutorial_active = false
	if tutorial_guide_panel != null:
		tutorial_guide_panel.visible = false
	if casual_button != null:
		casual_button.add_theme_stylebox_override("normal", WebUiTokens.handdrawn_button_style())

func _continue_run() -> void:
	if action_in_progress:
		return
	if session != null and session.has_method("set_current_run"):
		var run: Dictionary = payload.get("run", {})
		if not run.is_empty():
			session.call("set_current_run", run)

func _logout() -> void:
	if action_in_progress:
		return
	if session != null and session.has_method("logout"):
		action_in_progress = true
		_set_actions_disabled(true)
		await session.call("logout")
		action_in_progress = false
		_set_actions_disabled(false)

func _open_screen(screen_id: String) -> void:
	if action_in_progress:
		return
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
			return "恶霸犬"
		"EMPEROR":
			return "狗皇帝"
		"FROG":
			return "祖灵"
		_:
			return dog_type
