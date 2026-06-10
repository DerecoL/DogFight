extends BaseWebScreen

const DOG_TYPES := ["SHIBA", "SAMOYED", "MUTT", "BULLY", "EMPEROR", "FROG"]
const DOG_SELECTION_SLOT_COUNT := 8
const DOG_ASSETS := {
	"SHIBA": "res://assets/dogs/shiba.webp",
	"SAMOYED": "res://assets/dogs/samoyed.webp",
	"MUTT": "res://assets/dogs/mutt.webp",
	"BULLY": "res://assets/dogs/bully.webp",
	"EMPEROR": "res://assets/dogs/emperor.webp",
	"FROG": "res://assets/dogs/zuling.jpg",
}

var selected_dog := "SHIBA"
var lucky_number := 1
var action_in_progress := false
var start_button: Button

func _ready() -> void:
	_render()

func _on_payload_changed() -> void:
	_render()

func _render() -> void:
	for child in get_children():
		remove_child(child)
		child.queue_free()

	var screen := ScrollContainer.new()
	screen.name = "LadderScreen"
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
	box.add_theme_constant_override("separation", 12)
	margin.add_child(box)

	_render_heading(box)
	_render_ladder_layout(box)
	_render_ladder_start(box)
	_render_recent_settlements(box)

func _render_heading(parent: VBoxContainer) -> void:
	var ladder_data := _ladder_data()
	var season: Dictionary = _dict(ladder_data, "season")
	var heading := VBoxContainer.new()
	heading.name = "LadderHeading"
	heading.add_theme_constant_override("separation", 6)
	parent.add_child(heading)
	_add_label(heading, "LadderHeadingTitle", "天梯模式", HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(heading, "LadderHeadingSubtitle", "当前赛季：%s · 12 胜或 5 败结算积分，低段位更宽松，高段位按犬王积分榜竞争。" % str(season.get("name", "读取中")), HORIZONTAL_ALIGNMENT_CENTER)

func _render_ladder_layout(parent: VBoxContainer) -> void:
	var layout := GridContainer.new()
	layout.name = "LadderLayout"
	layout.columns = 2
	layout.add_theme_constant_override("h_separation", 12)
	layout.add_theme_constant_override("v_separation", 10)
	parent.add_child(layout)
	_render_current_tier(layout)
	_render_dog_king_board(layout)

func _render_current_tier(parent: GridContainer) -> void:
	var ladder_data := _ladder_data()
	var profile: Dictionary = _dict(ladder_data, "profile")
	var panel := _paper_panel("CurrentTierPanel")
	parent.add_child(panel)
	var title := _section_title(panel)
	_add_label(title, "CurrentTierTitle", "当前段位")
	_add_label(title, "CurrentTierSubtitle", "%d 局 · %d胜 %d败" % [int(profile.get("gamesPlayed", 0)), int(profile.get("totalWins", 0)), int(profile.get("totalLosses", 0))])
	_add_label(panel, "LadderRank", str(profile.get("tierLabel", "青铜")))
	var progress := ProgressBar.new()
	progress.name = "LadderProgress"
	progress.min_value = 0
	progress.max_value = 100
	progress.value = _ladder_progress_value(profile)
	progress.custom_minimum_size = Vector2(0, 16)
	panel.add_child(progress)
	_add_label(panel, "LadderScoreText", _ladder_score_text(profile))

func _render_dog_king_board(parent: GridContainer) -> void:
	var leaderboard_data := _leaderboard_data()
	var panel := _paper_panel("DogKingLeaderboardPanel")
	parent.add_child(panel)
	var title := _section_title(panel)
	_add_label(title, "DogKingLeaderboardTitle", "犬王积分榜")
	var player_rank = leaderboard_data.get("playerRank", null)
	_add_label(title, "DogKingLeaderboardSubtitle", "你的犬王排名：第 %d 名" % int(player_rank) if player_rank != null else "进入犬王后参与排名")
	var board := VBoxContainer.new()
	board.name = "LadderBoard"
	board.add_theme_constant_override("separation", 6)
	panel.add_child(board)
	var entries := _array(leaderboard_data, "leaderboard")
	if entries.is_empty():
		_add_label(board, "LadderBoardEmpty", "还没有犬王，先冲上大师 500 分。")
		return
	for index in range(min(5, entries.size())):
		var entry: Dictionary = entries[index] if entries[index] is Dictionary else {}
		var profile: Dictionary = _dict(entry, "profile")
		_ladder_row(board, "LadderRow_%d" % int(entry.get("rank", index + 1)), str(entry.get("title", "")), str(entry.get("name", "")), str(int(profile.get("score", 0))))

func _render_ladder_start(parent: VBoxContainer) -> void:
	var panel := _paper_panel("LadderStart")
	parent.add_child(panel)
	var title := _section_title(panel)
	var run := _current_run()
	if str(run.get("mode", "")) == "LADDER":
		_add_label(title, "LadderStartTitle", "当前天梯")
		_add_label(title, "LadderStartSubtitle", "已有进行中的天梯跑局，继续当前跑局后再结算积分。")
		var continue_button := Button.new()
		continue_button.name = "ContinueLadderRunButton"
		continue_button.text = "继续天梯模式"
		continue_button.custom_minimum_size = Vector2(0, WebUiTokens.touch_target_height())
		continue_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		continue_button.pressed.connect(_continue_ladder_run)
		panel.add_child(continue_button)
		return
	_add_label(title, "LadderStartTitle", "选择天梯狗狗")
	_add_label(title, "LadderStartSubtitle", "开始天梯会进入独立匹配池，并按整局表现结算。")

	var dog_select := HBoxContainer.new()
	dog_select.name = "DogSelectScreen"
	dog_select.add_theme_constant_override("separation", 12)
	panel.add_child(dog_select)

	var grid := GridContainer.new()
	grid.name = "DogCardGrid"
	grid.columns = 4
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	dog_select.add_child(grid)
	for index in range(DOG_SELECTION_SLOT_COUNT):
		if index < DOG_TYPES.size():
			grid.add_child(_ladder_dog_card_button(str(DOG_TYPES[index])))
		else:
			grid.add_child(_ladder_dog_card_placeholder(index))

	var detail := VBoxContainer.new()
	detail.name = "DogDetailPanel"
	detail.custom_minimum_size = Vector2(260, 0)
	detail.add_theme_constant_override("separation", 8)
	dog_select.add_child(detail)
	var detail_art := PanelContainer.new()
	detail_art.name = "DogDetailArt"
	detail_art.custom_minimum_size = Vector2(0, 122)
	detail_art.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail_art.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	detail.add_child(detail_art)
	var detail_badge := CenterContainer.new()
	detail_badge.name = "DogDetailDogBadge"
	detail_badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	detail_art.add_child(detail_badge)
	var detail_avatar := TextureRect.new()
	detail_avatar.name = "DogDetailAvatar"
	detail_avatar.custom_minimum_size = Vector2(0, 108)
	detail_avatar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	detail_avatar.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	detail_avatar.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	detail_avatar.texture = _dog_texture(selected_dog)
	detail_badge.add_child(detail_avatar)
	_add_label(detail, "DogDetailName", _dog_label(selected_dog), HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(detail, "DogDetailStrategy", _dog_strategy(selected_dog), HORIZONTAL_ALIGNMENT_CENTER)
	if selected_dog == "EMPEROR":
		_add_label(detail, "LuckyNumberLabel", "幸运数字：%d" % lucky_number, HORIZONTAL_ALIGNMENT_CENTER)
	start_button = Button.new()
	start_button.name = "StartLadderRunButton"
	start_button.text = "开始天梯"
	start_button.custom_minimum_size = Vector2(0, WebUiTokens.touch_target_height())
	start_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	start_button.pressed.connect(_start_ladder_run)
	detail.add_child(start_button)

func _ladder_dog_card_button(dog_type: String) -> Button:
	var button := Button.new()
	button.name = "LadderDogCard_%s" % dog_type
	button.text = ""
	button.custom_minimum_size = Vector2(148, 150)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.toggle_mode = true
	button.button_pressed = dog_type == selected_dog
	button.add_theme_stylebox_override("normal", WebUiTokens.handdrawn_button_style())
	button.add_theme_stylebox_override("hover", WebUiTokens.handdrawn_button_hover_style())
	button.add_theme_stylebox_override("pressed", WebUiTokens.handdrawn_button_pressed_style())
	button.pressed.connect(_select_dog.bind(dog_type))

	var margin := MarginContainer.new()
	margin.name = "LadderDogCardContent_%s" % dog_type
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	margin.add_theme_constant_override("margin_left", 10)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_right", 10)
	margin.add_theme_constant_override("margin_bottom", 10)
	button.add_child(margin)

	var content := VBoxContainer.new()
	content.name = "LadderDogCardStack_%s" % dog_type
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.add_theme_constant_override("separation", 6)
	margin.add_child(content)

	var art_frame := PanelContainer.new()
	art_frame.name = "LadderDogCardArtFrame_%s" % dog_type
	art_frame.custom_minimum_size = Vector2(0, 50)
	art_frame.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	art_frame.size_flags_vertical = Control.SIZE_EXPAND_FILL
	art_frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art_frame.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	content.add_child(art_frame)

	var badge := CenterContainer.new()
	badge.name = "LadderDogCardDogBadge_%s" % dog_type
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art_frame.add_child(badge)

	var texture := _dog_texture(dog_type)
	var avatar := TextureRect.new()
	avatar.name = "LadderDogCardAvatar_%s" % dog_type
	avatar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	avatar.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	avatar.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	avatar.texture = texture
	badge.add_child(avatar)

	var art := TextureRect.new()
	art.name = "LadderDogCardArt_%s" % dog_type
	art.visible = false
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art.texture = texture
	badge.add_child(art)

	_add_label(content, "LadderDogCardName_%s" % dog_type, _dog_label(dog_type), HORIZONTAL_ALIGNMENT_CENTER).mouse_filter = Control.MOUSE_FILTER_IGNORE
	_add_label(content, "LadderDogCardCopy_%s" % dog_type, _dog_trait(dog_type), HORIZONTAL_ALIGNMENT_CENTER).mouse_filter = Control.MOUSE_FILTER_IGNORE
	return button

func _ladder_dog_card_placeholder(index: int) -> PanelContainer:
	var placeholder := PanelContainer.new()
	placeholder.name = "LadderDogCardPlaceholder_%d" % index
	placeholder.custom_minimum_size = Vector2(148, 150)
	placeholder.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	placeholder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	placeholder.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	return placeholder

func _render_recent_settlements(parent: VBoxContainer) -> void:
	var settlements := _array(_ladder_data(), "recentSettlements")
	if settlements.is_empty():
		return
	var panel := _paper_panel("RecentSettlementsPanel")
	parent.add_child(panel)
	var title := _section_title(panel)
	_add_label(title, "RecentSettlementsTitle", "最近结算")
	_add_label(title, "RecentSettlementsSubtitle", "积分变化按整局胜败统一计算。")
	var board := VBoxContainer.new()
	board.name = "RecentSettlementsBoard"
	board.add_theme_constant_override("separation", 6)
	panel.add_child(board)
	for settlement_value in settlements:
		var settlement: Dictionary = settlement_value if settlement_value is Dictionary else {}
		_ladder_row(board, "LadderSettlementLine_%s" % str(settlement.get("id", "")), "%d胜%d败" % [int(settlement.get("wins", 0)), int(settlement.get("losses", 0))], "%s %d -> %s %d" % [_tier_label(str(settlement.get("beforeTier", ""))), int(settlement.get("beforeScore", 0)), _tier_label(str(settlement.get("afterTier", ""))), int(settlement.get("afterScore", 0))], _signed_int(int(settlement.get("delta", 0))))

func _paper_panel(node_name: String) -> VBoxContainer:
	var panel := VBoxContainer.new()
	panel.name = node_name
	panel.custom_minimum_size = Vector2(0, 150)
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_constant_override("separation", 8)
	return panel

func _section_title(parent: VBoxContainer) -> VBoxContainer:
	var title := VBoxContainer.new()
	title.add_theme_constant_override("separation", 4)
	parent.add_child(title)
	return title

func _ladder_row(parent: VBoxContainer, node_name: String, left: String, center: String, right: String) -> void:
	var row := HBoxContainer.new()
	row.name = node_name
	row.add_theme_constant_override("separation", 8)
	parent.add_child(row)
	_add_label(row, "%s_Left" % node_name, left)
	_add_label(row, "%s_Center" % node_name, center)
	_add_label(row, "%s_Right" % node_name, right)

func _add_label(parent: Node, node_name: String, text: String, align := HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var label := Label.new()
	label.name = node_name
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.horizontal_alignment = align
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(label)
	return label

func _select_dog(dog: String) -> void:
	selected_dog = dog
	if dog != "EMPEROR":
		lucky_number = 1
	_render()

func _start_ladder_run() -> void:
	if action_in_progress:
		return
	if session == null or not session.has_method("create_run"):
		return
	action_in_progress = true
	if start_button != null:
		start_button.disabled = true
	var lucky: Variant = lucky_number if selected_dog == "EMPEROR" else null
	await session.call("create_run", selected_dog, "LADDER", lucky)
	action_in_progress = false
	if start_button != null:
		start_button.disabled = false

func _continue_ladder_run() -> void:
	if action_in_progress:
		return
	if session != null and session.has_method("set_current_run"):
		session.call("set_current_run", _current_run())

func _ladder_data() -> Dictionary:
	var value = payload.get("ladderData", {})
	if value is Dictionary and not value.is_empty():
		return value
	var profile = payload.get("ladderProfile", {})
	var season = payload.get("season", {})
	return {
		"season": season if season is Dictionary else {},
		"profile": profile if profile is Dictionary else {},
		"recentSettlements": [],
	}

func _leaderboard_data() -> Dictionary:
	var value = payload.get("leaderboardData", {})
	return value if value is Dictionary else {}

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value = source.get(key, {})
	return value if value is Dictionary else {}

func _array(source: Dictionary, key: String) -> Array:
	var value = source.get(key, [])
	return value if value is Array else []

func _current_run() -> Dictionary:
	var value = payload.get("run", {})
	return value if value is Dictionary else {}

func _ladder_progress_value(profile: Dictionary) -> float:
	var tier := str(profile.get("tier", ""))
	var score := int(profile.get("score", 0))
	if tier == "MASTER" or tier == "DOG_KING":
		return min(100.0, float(score) / 500.0 * 100.0)
	return min(100.0, float(score))

func _ladder_score_text(profile: Dictionary) -> String:
	var tier := str(profile.get("tier", ""))
	var score := int(profile.get("score", 0))
	if tier == "MASTER":
		return "%d 分 / 500 晋级犬王" % score
	if tier == "DOG_KING":
		return "%d 分 · 犬王积分" % score
	return "%d 分 / 100 LP" % score

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

func _signed_int(value: int) -> String:
	return "+%d" % value if value >= 0 else str(value)

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

func _dog_trait(dog_type: String) -> String:
	match dog_type:
		"SHIBA":
			return "稳定爆发"
		"SAMOYED":
			return "护盾反击"
		"MUTT":
			return "灵活成长"
		"BULLY":
			return "高压重击"
		"EMPEROR":
			return "天命数字"
		"FROG":
			return "遗物联动"
		_:
			return "构筑狗狗"

func _dog_texture(dog_type: String) -> Texture2D:
	var path := str(DOG_ASSETS.get(dog_type, ""))
	if path.is_empty():
		return null
	return load(path) as Texture2D

func _dog_strategy(dog_type: String) -> String:
	match dog_type:
		"SHIBA":
			return "适合用稳定触发快速打开局面。"
		"SAMOYED":
			return "适合围绕护盾和反击建立优势。"
		"MUTT":
			return "适合灵活调整装备和经济节奏。"
		"BULLY":
			return "适合追求高压进攻和重型装备。"
		"EMPEROR":
			return "选择幸运数字后围绕固定点数构筑。"
		"FROG":
			return "适合围绕遗物和特殊触发做长期收益。"
		_:
			return "选择一只狗开始天梯。"
