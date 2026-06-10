extends ShellBackedWebScreen

const WebUiTokens := preload("res://scripts/ui/web/WebUiTokens.gd")
const DOG_ASSETS := {
	"SHIBA": "res://assets/dogs/shiba.webp",
	"SAMOYED": "res://assets/dogs/samoyed.webp",
	"MUTT": "res://assets/dogs/mutt.webp",
	"BULLY": "res://assets/dogs/bully.webp",
	"EMPEROR": "res://assets/dogs/emperor.webp",
	"FROG": "res://assets/dogs/zuling.jpg",
}

var apex_data: Dictionary = {}
var content_box: VBoxContainer
var action_buttons: Array[Button] = []
var active_board := "overall"

func _on_payload_changed() -> void:
	super._on_payload_changed()

func _render_shell_content() -> void:
	_build_screen()
	_apply_payload_data()
	_render()

func _build_screen() -> void:
	var panel := PanelContainer.new()
	panel.name = "ApexPanel"
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.custom_minimum_size = Vector2(0, 420)
	panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	content_container().add_child(panel)

	var scroll := ScrollContainer.new()
	scroll.name = "ApexScroll"
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
	content_box.name = "ApexScreen"
	content_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content_box.add_theme_constant_override("separation", 14)
	margin.add_child(content_box)

func _apply_payload_data() -> void:
	var value = payload.get("apexData", {})
	if value is Dictionary:
		apex_data = value.duplicate(true)

func _render() -> void:
	if content_box == null:
		return
	for child in content_box.get_children():
		content_box.remove_child(child)
		child.queue_free()
	action_buttons = []
	_render_heading()
	_render_submit_report()
	_render_layout()

func _render_heading() -> void:
	var heading := VBoxContainer.new()
	heading.name = "ApexHeading"
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_theme_constant_override("separation", 4)
	content_box.add_child(heading)
	var season: Dictionary = _dict(apex_data, "season")
	_add_label(heading, "ApexTitle", "巅峰竞技场", HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(heading, "ApexSubtitle", "巅峰赛季：%s · 保存战斗结束后的死数据，自动从榜尾向上挑战，失败后固定在当前名次。" % str(season.get("name", "读取中")), HORIZONTAL_ALIGNMENT_CENTER)

	var toolbar := HBoxContainer.new()
	toolbar.name = "ApexToolbar"
	toolbar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	toolbar.add_theme_constant_override("separation", 8)
	content_box.add_child(toolbar)
	var refresh_button := _action_button("刷新", _refresh_apex)
	refresh_button.name = "ApexRefreshButton"
	toolbar.add_child(refresh_button)

func _render_submit_report() -> void:
	var submitted_entries: Dictionary = _dict(apex_data, "entries")
	var reports: Dictionary = _dict(apex_data, "reports")
	var submitted_overall: Dictionary = _dict(submitted_entries, "overall")
	if submitted_overall.is_empty() or reports.is_empty():
		return
	var report := _paper_panel("ApexReport")
	_add_label(report, "ApexReportTitle", "%s 已投入巅峰榜" % str(submitted_overall.get("name", "巅峰记录")))
	_add_label(report, "ApexReportSummary", "总榜%s，当日榜%s。新记录防守连胜从 %d 开始" % [_apex_rank_text(_dict(reports, "overall").get("placementRank", null)), _apex_rank_text(_dict(reports, "daily").get("placementRank", null)), int(submitted_overall.get("challengeWins", 0))])

func _render_layout() -> void:
	var layout := GridContainer.new()
	layout.name = "ApexLayout"
	layout.columns = 2
	layout.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	layout.add_theme_constant_override("h_separation", 14)
	layout.add_theme_constant_override("v_separation", 14)
	content_box.add_child(layout)
	_render_candidates(layout)
	_render_leaderboard(layout)

func _render_candidates(parent: GridContainer) -> void:
	var panel := _paper_panel("ApexCandidates", parent)
	var candidates := _array(apex_data, "candidates")
	var candidate_hint := "暂无可提交的完成局。"
	if not candidates.is_empty():
		candidate_hint = "选择一只狗进入巅峰竞技场。每只完成局只能提交一次。"
	_add_label(panel, "ApexCandidatesTitle", "可投入的完成狗")
	_add_label(panel, "ApexCandidatesHint", candidate_hint)
	_add_label(panel, "ApexCandidateCount", str(candidates.size()) if not candidates.is_empty() else "先在休闲模式完成一局，再回来冲榜。")

	var candidate_list := VBoxContainer.new()
	candidate_list.name = "ApexCandidateList"
	candidate_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	candidate_list.add_theme_constant_override("separation", 8)
	panel.add_child(candidate_list)
	if candidates.is_empty():
		_add_label(candidate_list, "ApexCandidateEmpty", "先在休闲模式完成一局，再回来冲榜。")
		return
	for candidate_value in candidates:
		if candidate_value is Dictionary:
			_render_apex_candidate(candidate_list, candidate_value)

func _render_apex_candidate(parent: VBoxContainer, candidate: Dictionary) -> void:
	var run_id := str(candidate.get("id", ""))
	var row := HBoxContainer.new()
	row.name = "ApexCandidate_%s" % run_id
	row.custom_minimum_size = Vector2(0, 64)
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 10)
	parent.add_child(row)

	row.add_child(_dog_badge("ApexCandidate", run_id, str(candidate.get("dogType", ""))))

	var text_box := VBoxContainer.new()
	text_box.name = "ApexCandidateText_%s" % run_id
	text_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text_box.add_theme_constant_override("separation", 2)
	row.add_child(text_box)
	_add_label(text_box, "ApexCandidateName_%s" % run_id, "%s · %d胜%d负" % [_dog_name(str(candidate.get("dogType", ""))), int(candidate.get("wins", 0)), int(candidate.get("losses", 0))])
	_add_label(text_box, "ApexCandidateMeta_%s" % run_id, "第%d回合 · 遗物 %d · 装备 %d" % [int(candidate.get("round", 0)), _array(candidate, "relics").size(), _array(candidate, "items").size()])
	_add_label(text_box, "ApexCandidateSubmitLabel_%s" % run_id, "提交巅峰 " + _apex_run_summary_label(candidate))

	var submit_button := _action_button("投入巅峰", _submit_apex_candidate.bind(run_id))
	submit_button.name = "ApexSubmit_%s" % run_id
	row.add_child(submit_button)

func _render_leaderboard(parent: GridContainer) -> void:
	var leaderboards: Dictionary = _dict(apex_data, "leaderboards")
	var panel := _paper_panel("ApexLeaderboard", parent)
	var tabs := HBoxContainer.new()
	tabs.name = "ApexTabs"
	tabs.add_theme_constant_override("separation", 8)
	panel.add_child(tabs)
	var overall_tab := _plain_button("总榜", 72)
	overall_tab.name = "ApexTab_overall"
	_configure_board_tab(overall_tab, "overall")
	tabs.add_child(overall_tab)
	var daily_tab := _plain_button("当日榜", 84)
	daily_tab.name = "ApexTab_daily"
	_configure_board_tab(daily_tab, "daily")
	tabs.add_child(daily_tab)
	_add_label(panel, "ApexOverallHint", "总榜：初始种子会随玩家提交逐步下移")
	_add_label(panel, "ApexDailyHint", "当日榜：每日 %02d:00 更新 · %s" % [int(apex_data.get("dailyResetHour", 5)), str(apex_data.get("dailyBoardKey", ""))])

	if active_board == "daily":
		var overall_hint := panel.get_node_or_null("ApexOverallHint")
		if overall_hint != null:
			overall_hint.queue_free()
	else:
		var daily_hint := panel.get_node_or_null("ApexDailyHint")
		if daily_hint != null:
			daily_hint.queue_free()

	var rank_list := VBoxContainer.new()
	rank_list.name = "ApexRankList"
	rank_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rank_list.add_theme_constant_override("separation", 8)
	panel.add_child(rank_list)
	for entry_value in _array(leaderboards, active_board).slice(0, 20):
		if entry_value is Dictionary:
			_render_apex_rank_entry(rank_list, entry_value)

func _render_apex_rank_entry(parent: VBoxContainer, entry: Dictionary) -> void:
	var entry_id := str(entry.get("id", ""))
	var row := HBoxContainer.new()
	row.name = "ApexRankEntry_%s" % entry_id
	row.custom_minimum_size = Vector2(0, 58)
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 10)
	parent.add_child(row)

	var rank_label := Label.new()
	rank_label.name = "ApexRank_%s" % entry_id
	rank_label.text = "#%s" % str(entry.get("rank", "未上榜"))
	rank_label.custom_minimum_size = Vector2(72, 0)
	rank_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(rank_label)

	row.add_child(_dog_badge("ApexRank", entry_id, str(entry.get("dogType", ""))))

	var text_box := VBoxContainer.new()
	text_box.name = "ApexRankText_%s" % entry_id
	text_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text_box.add_theme_constant_override("separation", 2)
	row.add_child(text_box)
	_add_label(text_box, "ApexRankName_%s" % entry_id, str(entry.get("name", "")))
	_add_label(text_box, "ApexRankMeta_%s" % entry_id, "%s · %d胜%d负 · 第%d回合" % [_dog_name(str(entry.get("dogType", ""))), int(entry.get("wins", 0)), int(entry.get("losses", 0)), int(entry.get("round", 0))])

	if bool(entry.get("isMine", false)):
		var self_label := Label.new()
		self_label.name = "ApexRankSelf_%s" % entry_id
		self_label.text = "我的记录"
		self_label.custom_minimum_size = Vector2(84, 0)
		self_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		row.add_child(self_label)
	var marker := "防守连胜 %d" % int(entry.get("challengeWins", 0))
	if bool(entry.get("isSeed", false)):
		marker = "种子"
	var marker_label := Label.new()
	marker_label.name = "ApexRankMarker_%s" % entry_id
	marker_label.text = marker
	marker_label.custom_minimum_size = Vector2(108, 0)
	marker_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(marker_label)
	var config_button := _action_button("查看配置", _show_config.bind(entry))
	config_button.name = "ApexConfig_%s" % entry_id
	row.add_child(config_button)

func _configure_board_tab(button: Button, board_name: String) -> void:
	button.toggle_mode = true
	button.button_pressed = active_board == board_name
	button.pressed.connect(func() -> void:
		active_board = board_name
		_render()
	)

func _paper_panel(node_name: String, parent: Node = null) -> VBoxContainer:
	var panel := VBoxContainer.new()
	panel.name = node_name
	panel.custom_minimum_size = Vector2(0, 150)
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_constant_override("separation", 10)
	if parent == null:
		content_box.add_child(panel)
	else:
		parent.add_child(panel)
	return panel

func _action_button(text: String, callback: Callable) -> Button:
	var button := _plain_button(text, 112)
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

func _dog_badge(prefix: String, id: String, dog_type: String) -> CenterContainer:
	var badge := CenterContainer.new()
	badge.name = "%sDogBadge_%s" % [prefix, id]
	badge.custom_minimum_size = Vector2(48, 48)
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var avatar := TextureRect.new()
	avatar.name = "%sAvatar_%s" % [prefix, id]
	avatar.custom_minimum_size = Vector2(44, 44)
	avatar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	avatar.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	avatar.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	avatar.texture = _dog_texture(dog_type)
	badge.add_child(avatar)
	return badge

func _add_label(parent: Node, node_name: String, text: String, align := HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var label := Label.new()
	label.name = node_name
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.horizontal_alignment = align
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.add_theme_color_override("font_color", WebUiTokens.ink_color())
	parent.add_child(label)
	return label

func _refresh_apex() -> void:
	if session != null and session.has_method("refresh_apex_payload"):
		await session.call("refresh_apex_payload")

func _submit_apex_candidate(run_id: String) -> void:
	if session != null and session.has_method("submit_apex_candidate"):
		await session.call("submit_apex_candidate", run_id)

func _show_config(entry: Dictionary) -> void:
	if session != null and session.has_method("_show_snapshot_modal"):
		session.call("_show_snapshot_modal", entry, "巅峰配置详情")

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value = source.get(key, {})
	return value if value is Dictionary else {}

func _array(source: Dictionary, key: String) -> Array:
	var value = source.get(key, [])
	return value if value is Array else []

func _apex_rank_text(rank_value) -> String:
	if rank_value == null:
		return "未上榜"
	return "第 %d 名" % int(rank_value)

func _apex_run_summary_label(run_like: Dictionary) -> String:
	return "%s  %d胜%d负 第%d回合 · 遗物 %d · 装备 %d" % [_dog_name(str(run_like.get("dogType", ""))), int(run_like.get("wins", 0)), int(run_like.get("losses", 0)), int(run_like.get("round", 0)), _array(run_like, "relics").size(), _array(run_like, "items").size()]

func _dog_texture(dog_type: String) -> Texture2D:
	var path := str(DOG_ASSETS.get(dog_type, ""))
	if path.is_empty():
		return null
	return load(path) as Texture2D

func _dog_name(dog_type: String) -> String:
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
