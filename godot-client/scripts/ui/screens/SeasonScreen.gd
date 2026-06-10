extends BaseWebScreen

const WebShellScene := preload("res://scenes/shell/WebShell.tscn")
const WebUiTokens := preload("res://scripts/ui/web/WebUiTokens.gd")

var shell: WebShell
var content_box: VBoxContainer

func _ready() -> void:
	_build_screen()
	_render()

func _on_payload_changed() -> void:
	_render()

func _build_screen() -> void:
	for child in get_children():
		remove_child(child)
		child.queue_free()

	shell = WebShellScene.instantiate()
	shell.name = "WebShell"
	add_child(shell)
	shell.lobby_requested.connect(func() -> void:
		if session != null and session.has_method("open_screen"):
			session.call("open_screen", "mode_lobby")
	)
	shell.logout_requested.connect(func() -> void:
		if session != null and session.has_method("logout"):
			session.call("logout")
	)

	var shell_content := shell.content_container()

	var panel := PanelContainer.new()
	panel.name = "SeasonPanel"
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.custom_minimum_size = Vector2(0, 420)
	panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	shell_content.add_child(panel)

	var scroll := ScrollContainer.new()
	scroll.name = "SeasonScroll"
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
	content_box.name = "SeasonScreen"
	content_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content_box.add_theme_constant_override("separation", 14)
	margin.add_child(content_box)

func _render() -> void:
	if shell == null or content_box == null:
		return
	shell.set_user(_dict(payload, "user"))
	shell.set_run(_dict(payload, "run"))
	shell.set_error("")
	for child in content_box.get_children():
		content_box.remove_child(child)
		child.queue_free()
	_render_current_season()
	_render_season_history_list(_season_summaries())

func _render_current_season() -> void:
	var ladder_data := _ladder_data()
	var season: Dictionary = _dict(ladder_data, "season")
	var profile: Dictionary = _dict(ladder_data, "profile")
	var panel := _paper_panel("CurrentSeasonPanel")

	var heading := VBoxContainer.new()
	heading.name = "CurrentSeasonHeading"
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_theme_constant_override("separation", 4)
	panel.add_child(heading)
	_add_label(heading, "CurrentSeasonTitle", "当前赛季")
	_add_label(heading, "CurrentSeasonName", str(season.get("name", season.get("id", "读取中"))))
	_add_label(heading, "CurrentSeasonRange", "%s - %s" % [str(season.get("startsAt", "")), str(season.get("endsAt", ""))])

	var ladder_panel := VBoxContainer.new()
	ladder_panel.name = "SeasonLadderPanel"
	ladder_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ladder_panel.add_theme_constant_override("separation", 6)
	panel.add_child(ladder_panel)
	_add_label(ladder_panel, "SeasonLadderTitle", "我的天梯")
	_add_label(ladder_panel, "SeasonLadderRank", _tier_display_label(profile))
	_add_label(ladder_panel, "SeasonLadderScore", "%d 分" % int(profile.get("score", 0)))
	_add_label(ladder_panel, "SeasonLadderRecord", "胜负 %d/%d" % [int(profile.get("wins", 0)), int(profile.get("losses", 0))])

	var settlement_list := VBoxContainer.new()
	settlement_list.name = "SeasonSettlementList"
	settlement_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	settlement_list.add_theme_constant_override("separation", 8)
	panel.add_child(settlement_list)
	var settlements := _array(ladder_data, "recentSettlements")
	if settlements.is_empty():
		_add_label(settlement_list, "SeasonSettlementEmpty", "暂无最近结算")
	for settlement_value in settlements:
		if settlement_value is Dictionary:
			var settlement: Dictionary = settlement_value
			var button := _action_button("结算 %s -> %s  %+d" % [_tier_label(str(settlement.get("beforeTier", ""))), _tier_label(str(settlement.get("afterTier", ""))), int(settlement.get("delta", 0))])
			button.name = "SeasonSettlement_%s_%s" % [str(settlement.get("beforeTier", "")), str(settlement.get("afterTier", ""))]
			settlement_list.add_child(button)

func _render_season_history_list(summaries: Array) -> void:
	var list := VBoxContainer.new()
	list.name = "SeasonHistoryList"
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 10)
	content_box.add_child(list)

	var heading := HBoxContainer.new()
	heading.name = "SeasonHistoryHeading"
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_theme_constant_override("separation", 12)
	list.add_child(heading)
	var title := _add_label(heading, "SeasonHistoryTitle", "赛季历史")
	title.custom_minimum_size = Vector2(0, 32)
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var subtitle := _add_label(heading, "SeasonHistorySubtitle", "%d 个已结束赛季" % summaries.size() if summaries.size() > 0 else "赛季结束后会保存在这里", HORIZONTAL_ALIGNMENT_RIGHT)
	subtitle.custom_minimum_size = Vector2(180, 32)
	subtitle.vertical_alignment = VERTICAL_ALIGNMENT_CENTER

	if summaries.is_empty():
		var empty := _add_label(list, "SeasonHistoryEmpty", "暂无赛季历史")
		empty.custom_minimum_size = Vector2(0, 32)
		return
	for index in range(min(3, summaries.size())):
		var summary_value = summaries[index]
		if summary_value is Dictionary:
			_render_season_history_card(list, summary_value)

func _render_season_history_card(parent: VBoxContainer, summary: Dictionary) -> void:
	var summary_id := str(summary.get("id", summary.get("seasonId", "")))
	var panel := PanelContainer.new()
	panel.name = "SeasonHistoryCard_%s" % summary_id
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", _history_card_style())
	parent.add_child(panel)

	var row := HBoxContainer.new()
	row.name = "SeasonHistoryCardRow_%s" % summary_id
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.custom_minimum_size = Vector2(0, 78)
	row.add_theme_constant_override("separation", 12)
	panel.add_child(row)

	var text_box := VBoxContainer.new()
	text_box.name = "SeasonHistoryCardText_%s" % summary_id
	text_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text_box.add_theme_constant_override("separation", 4)
	row.add_child(text_box)
	_add_label(text_box, "SeasonHistoryName_%s" % summary_id, str(summary.get("seasonName", summary.get("seasonId", ""))))
	_add_label(text_box, "SeasonHistoryLadder_%s" % summary_id, _season_ladder_summary_text(summary))
	_add_label(text_box, "SeasonHistoryApex_%s" % summary_id, _season_apex_summary_text(summary))

	var snapshot: Dictionary = _dict(summary, "apexSnapshot")
	if not snapshot.is_empty():
		var snapshot_button := _action_button("巅峰配置快照")
		snapshot_button.name = "SeasonSnapshotAction_%s" % summary_id
		snapshot_button.pressed.connect(_show_snapshot.bind(snapshot))
		row.add_child(snapshot_button)

func _show_snapshot(snapshot: Dictionary) -> void:
	if session != null and session.has_method("_show_snapshot_modal"):
		session.call("_show_snapshot_modal", snapshot, "赛季巅峰快照")

func _paper_panel(node_name: String) -> VBoxContainer:
	var panel := PanelContainer.new()
	panel.name = "%sFrame" % node_name
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", WebUiTokens.resource_pill_style())
	content_box.add_child(panel)
	var box := VBoxContainer.new()
	box.name = node_name
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_theme_constant_override("separation", 10)
	panel.add_child(box)
	return box

func _history_card_style() -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(1.0, 0.96, 0.84, 0.72)
	style.border_color = Color(0.24, 0.16, 0.10, 0.22)
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	style.content_margin_left = 12
	style.content_margin_top = 10
	style.content_margin_right = 12
	style.content_margin_bottom = 10
	return style

func _action_button(text: String) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(150, WebUiTokens.touch_target_height())
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
	label.add_theme_color_override("font_color", WebUiTokens.ink_color())
	parent.add_child(label)
	return label

func _ladder_data() -> Dictionary:
	var value = payload.get("ladderData", {})
	if value is Dictionary and not value.is_empty():
		return value
	var season = payload.get("season", {})
	var profile = payload.get("ladderProfile", {})
	return {
		"season": season if season is Dictionary else {},
		"profile": profile if profile is Dictionary else {},
		"recentSettlements": [],
	}

func _season_summaries() -> Array:
	var history_value = payload.get("historyData", {})
	if history_value is Dictionary:
		var nested := _array(history_value, "seasonSummaries")
		if not nested.is_empty():
			return nested
	return _array(payload, "seasonSummaries")

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value = source.get(key, {})
	return value if value is Dictionary else {}

func _array(source: Dictionary, key: String) -> Array:
	var value = source.get(key, [])
	return value if value is Array else []

func _tier_display_label(profile: Dictionary) -> String:
	var label := str(profile.get("tierLabel", ""))
	return label if not label.is_empty() else _tier_label(str(profile.get("tier", "")))

func _tier_label(tier: String) -> String:
	match tier:
		"BRONZE":
			return "青铜"
		"SILVER":
			return "白银"
		"GOLD":
			return "黄金"
		"PLATINUM":
			return "铂金"
		"DIAMOND":
			return "钻石"
		"MASTER":
			return "大师"
		"DOG_KING":
			return "犬王"
		_:
			return tier

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
