extends Control

signal replay_finished

@onready var player_hp: ProgressBar = %PlayerHp
@onready var opponent_hp: ProgressBar = %OpponentHp
@onready var dice_label: Label = %DiceLabel
@onready var log_view: RichTextLabel = %Log
@onready var play_button: Button = %PlayButton
@onready var skip_button: Button = %SkipButton
@onready var finish_button: Button = %FinishButton
@onready var error_label: Label = %ErrorLabel
@onready var root: VBoxContainer = $Root
@onready var footer: HBoxContainer = $Root/Footer

var session: Node
var battle: Dictionary = {}
var cosmetics_data: Dictionary = {}
var events: Array = []
var displayed_events: Array = []
var event_index := 0
var playing := false
var replay_complete := false
var finish_in_progress := false
var playback_speed := 1.0
var log_filter := "all"

var stage_label: Label
var player_name_label: Label
var opponent_name_label: Label
var player_equipment_grid: GridContainer
var opponent_equipment_grid: GridContainer
var player_relic_row: HBoxContainer
var opponent_relic_row: HBoxContainer
var player_avatar: TextureRect
var opponent_avatar: TextureRect
var player_shield_label: Label
var opponent_shield_label: Label
var player_status_label: Label
var opponent_status_label: Label
var player_reservoir_label: Label
var opponent_reservoir_label: Label
var player_item_buttons := {}
var opponent_item_buttons := {}
var speed_buttons := {}
var review_panel: PanelContainer
var review_title_label: Label
var player_review_label: Label
var opponent_review_label: Label
var system_review_label: Label
var restart_button: Button
var log_toggle_button: Button
var log_filter_row: HBoxContainer

func bind_session(next_session: Node) -> void:
	if session != null and session.has_signal("error_raised") and session.error_raised.is_connected(_on_error_raised):
		session.error_raised.disconnect(_on_error_raised)
	session = next_session
	if session != null and session.has_signal("error_raised") and not session.error_raised.is_connected(_on_error_raised):
		session.error_raised.connect(_on_error_raised)

func configure_cosmetics(next_cosmetics: Dictionary) -> void:
	cosmetics_data = next_cosmetics.duplicate(true)

func _ready() -> void:
	_build_battle_layout()
	_connect_button_once(play_button, _on_play_pressed)
	_connect_button_once(skip_button, _on_skip_pressed)
	_connect_button_once(finish_button, _on_finish_pressed)

func start_replay(next_battle: Dictionary) -> void:
	battle = next_battle.duplicate(true)
	var next_events = battle.get("events", [])
	events = next_events if next_events is Array else []
	displayed_events = []
	event_index = 0
	playing = false
	replay_complete = false
	finish_in_progress = false
	log_filter = "all"
	playback_speed = 1.0
	error_label.text = ""
	finish_button.disabled = true
	play_button.disabled = false
	skip_button.disabled = false
	if restart_button != null:
		restart_button.disabled = true
	log_view.visible = false
	log_view.text = ""
	if review_panel != null:
		review_panel.visible = false
	_render_initial_hp()
	_render_snapshots()
	_render_event_stage({})
	_update_log_filters()
	_update_speed_buttons()

func _render_initial_hp() -> void:
	player_hp.max_value = int(battle.get("playerMaxHp", 100))
	opponent_hp.max_value = int(battle.get("opponentMaxHp", 100))
	player_hp.value = player_hp.max_value
	opponent_hp.value = opponent_hp.max_value
	dice_label.text = "骰点 -%s" % _battle_effect_suffix()
	_update_battle_meta({})

func _on_play_pressed() -> void:
	if playing:
		return
	playing = true
	_update_playback_controls()
	while playing and event_index < events.size():
		var event = events[event_index]
		if event is Dictionary:
			_apply_event(event)
		event_index += 1
		await get_tree().create_timer(0.24 / playback_speed).timeout
	playing = false
	_update_playback_controls()
	if event_index >= events.size():
		_mark_replay_complete()

func _on_skip_pressed() -> void:
	playing = false
	while event_index < events.size():
		var event = events[event_index]
		if event is Dictionary:
			_apply_event(event)
		event_index += 1
	_mark_replay_complete()

func _on_finish_pressed() -> void:
	if finish_in_progress or session == null or not session.has_method("finish_battle"):
		return
	finish_in_progress = true
	finish_button.disabled = true
	var ok: bool = await session.finish_battle()
	finish_in_progress = false
	if not ok:
		finish_button.disabled = false

func _on_restart_pressed() -> void:
	playing = false
	displayed_events = []
	event_index = 0
	replay_complete = false
	finish_in_progress = false
	error_label.text = ""
	finish_button.disabled = true
	play_button.disabled = false
	skip_button.disabled = false
	if restart_button != null:
		restart_button.disabled = true
	log_view.text = ""
	log_view.visible = false
	if review_panel != null:
		review_panel.visible = false
	_render_initial_hp()
	_render_snapshots()
	_render_event_stage({})
	_update_log_filters()
	_update_speed_buttons()

func _apply_event(event: Dictionary) -> void:
	player_hp.max_value = int(event.get("playerMaxHp", player_hp.max_value))
	opponent_hp.max_value = int(event.get("opponentMaxHp", opponent_hp.max_value))
	player_hp.value = int(event.get("playerHp", player_hp.value))
	opponent_hp.value = int(event.get("opponentHp", opponent_hp.value))
	if event.has("roll"):
		dice_label.text = "骰点 %s%s" % [str(event.get("roll")), _battle_effect_suffix()]
	displayed_events.append(event.duplicate(true))
	_render_event_stage(event)
	_update_battle_meta(event)
	_highlight_event_items(event)
	_refresh_log_view()
	_play_event_effect(event)
	_play_battle_sound(event)

func _mark_replay_complete() -> void:
	if replay_complete:
		return
	replay_complete = true
	play_button.disabled = true
	skip_button.disabled = true
	finish_button.disabled = false
	if restart_button != null:
		restart_button.disabled = false
	_render_battle_review()
	replay_finished.emit()

func _update_playback_controls() -> void:
	play_button.disabled = playing
	skip_button.disabled = false

func _build_battle_layout() -> void:
	if root == null or stage_label != null:
		return
	stage_label = Label.new()
	stage_label.name = "BattleStageSummary"
	stage_label.custom_minimum_size = Vector2(0, 64)
	stage_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stage_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	stage_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	root.add_child(stage_label)
	root.move_child(stage_label, 1)

	var opponent_panel := _snapshot_panel("对手装备栏")
	opponent_name_label = opponent_panel["name"]
	opponent_avatar = opponent_panel["avatar"]
	opponent_shield_label = opponent_panel["shield"]
	opponent_status_label = opponent_panel["statuses"]
	opponent_reservoir_label = opponent_panel["reservoirs"]
	opponent_equipment_grid = opponent_panel["grid"]
	opponent_relic_row = opponent_panel["relics"]
	root.add_child(opponent_panel["panel"])
	root.move_child(opponent_panel["panel"], 2)

	var player_panel := _snapshot_panel("你的装备栏")
	player_name_label = player_panel["name"]
	player_avatar = player_panel["avatar"]
	player_shield_label = player_panel["shield"]
	player_status_label = player_panel["statuses"]
	player_reservoir_label = player_panel["reservoirs"]
	player_equipment_grid = player_panel["grid"]
	player_relic_row = player_panel["relics"]
	root.add_child(player_panel["panel"])
	root.move_child(player_panel["panel"], 3)

	var review := _build_review_panel()
	review_panel = review["panel"]
	review_title_label = review["title"]
	player_review_label = review["player"]
	opponent_review_label = review["opponent"]
	system_review_label = review["system"]
	root.add_child(review_panel)
	root.move_child(review_panel, 4)

	var speed_label := Label.new()
	speed_label.text = "速度"
	speed_label.custom_minimum_size = Vector2(42, 44)
	speed_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	footer.add_child(speed_label)
	for speed in [1, 2, 4]:
		var button := Button.new()
		button.text = "%dx" % speed
		button.custom_minimum_size = Vector2(52, 44)
		button.toggle_mode = true
		button.pressed.connect(_set_speed.bind(float(speed)))
		footer.add_child(button)
		speed_buttons[speed] = button
	_update_speed_buttons()
	restart_button = Button.new()
	restart_button.text = "重播"
	restart_button.custom_minimum_size = Vector2(82, 44)
	restart_button.disabled = true
	restart_button.pressed.connect(_on_restart_pressed)
	footer.add_child(restart_button)
	log_toggle_button = Button.new()
	log_toggle_button.text = "日志"
	log_toggle_button.custom_minimum_size = Vector2(72, 44)
	log_toggle_button.pressed.connect(_toggle_log)
	footer.add_child(log_toggle_button)
	log_filter_row = HBoxContainer.new()
	log_filter_row.add_theme_constant_override("separation", 6)
	root.add_child(log_filter_row)
	root.move_child(log_filter_row, root.get_child_count() - 2)

func _build_review_panel() -> Dictionary:
	var panel := PanelContainer.new()
	panel.visible = false
	panel.custom_minimum_size = Vector2(0, 118)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	panel.add_child(box)
	var title := Label.new()
	title.text = "战斗数据看板"
	title.custom_minimum_size = Vector2(0, 26)
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	box.add_child(title)
	var rows := HBoxContainer.new()
	rows.add_theme_constant_override("separation", 8)
	box.add_child(rows)
	var player_label := _review_side_label("我方")
	rows.add_child(player_label)
	var opponent_label := _review_side_label("对手")
	rows.add_child(opponent_label)
	var system_label := Label.new()
	system_label.custom_minimum_size = Vector2(160, 64)
	system_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	system_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	rows.add_child(system_label)
	return {"panel": panel, "title": title, "player": player_label, "opponent": opponent_label, "system": system_label}

func _review_side_label(title: String) -> Label:
	var label := Label.new()
	label.text = title
	label.custom_minimum_size = Vector2(0, 64)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return label

func _snapshot_panel(title: String) -> Dictionary:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(0, 126)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	panel.add_child(box)
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	box.add_child(header)
	var avatar := TextureRect.new()
	avatar.custom_minimum_size = Vector2(58, 58)
	avatar.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	header.add_child(avatar)
	var name_label := Label.new()
	name_label.text = title
	name_label.custom_minimum_size = Vector2(0, 26)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	name_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	header.add_child(name_label)
	var shield_label := Label.new()
	shield_label.text = "护盾 0"
	shield_label.custom_minimum_size = Vector2(0, 24)
	shield_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	box.add_child(shield_label)
	var statuses := Label.new()
	statuses.text = "状态：无"
	statuses.custom_minimum_size = Vector2(0, 34)
	statuses.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(statuses)
	var reservoirs := Label.new()
	reservoirs.text = "蓄水池：无"
	reservoirs.custom_minimum_size = Vector2(0, 28)
	reservoirs.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(reservoirs)
	var grid := GridContainer.new()
	grid.columns = 12
	grid.add_theme_constant_override("h_separation", 4)
	grid.add_theme_constant_override("v_separation", 4)
	box.add_child(grid)
	var relics := HBoxContainer.new()
	relics.add_theme_constant_override("separation", 4)
	box.add_child(relics)
	return {"panel": panel, "name": name_label, "avatar": avatar, "shield": shield_label, "statuses": statuses, "reservoirs": reservoirs, "grid": grid, "relics": relics}

func _render_snapshots() -> void:
	var player: Dictionary = _dict(battle, "playerSnapshot")
	var opponent: Dictionary = _dict(battle, "opponentSnapshot")
	_render_snapshot(player_name_label, player_avatar, player_equipment_grid, player_relic_row, player, "你的狗狗", player_item_buttons, "player")
	_render_snapshot(opponent_name_label, opponent_avatar, opponent_equipment_grid, opponent_relic_row, opponent, "离线狗狗", opponent_item_buttons, "opponent")

func _render_snapshot(name_label: Label, avatar: TextureRect, grid: GridContainer, relic_row: HBoxContainer, snapshot: Dictionary, fallback_name: String, button_map: Dictionary, side: String) -> void:
	if name_label == null or grid == null or relic_row == null:
		return
	var dog_type := str(snapshot.get("dogType", ""))
	name_label.text = "%s · %s · %d胜 %d负 · 第%d回合" % [
		str(snapshot.get("name", fallback_name)),
		dog_type,
		int(snapshot.get("wins", 0)),
		int(snapshot.get("losses", 0)),
		int(snapshot.get("round", 0)),
	]
	if avatar != null:
		avatar.texture = _dog_texture(dog_type)
		avatar.modulate = _dog_skin_tint(dog_type, side)
	_clear_children(grid)
	button_map.clear()
	var items: Array = _array(snapshot, "items")
	for x in range(_battle_slot_count(snapshot)):
		var item: Dictionary = _item_at_slot(items, "EQUIPMENT", x)
		var button := Button.new()
		button.custom_minimum_size = Vector2(54, 42)
		button.clip_text = true
		button.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		button.text = str(x + 1) if item.is_empty() else _battle_item_label(item)
		button.disabled = item.is_empty()
		_apply_button_icon(button, _battle_item_texture(item))
		if not item.is_empty():
			button_map[str(item.get("id", ""))] = button
			button.pressed.connect(_show_battle_item_modal.bind(item, side))
		grid.add_child(button)
	_clear_children(relic_row)
	for relic in _array(snapshot, "relics").slice(0, 8):
		if relic is Dictionary:
			var relic_button := Button.new()
			var relic_def: Dictionary = _dict(relic, "def")
			relic_button.text = _fallback(str(relic_def.get("name", "")), str(relic.get("relicId", "")))
			relic_button.custom_minimum_size = Vector2(92, 32)
			relic_button.clip_text = true
			relic_button.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
			_apply_button_icon(relic_button, _battle_sticker_texture(str(relic.get("relicId", ""))))
			relic_button.pressed.connect(_show_battle_relic_modal.bind(relic, side))
			relic_row.add_child(relic_button)

func _render_event_stage(event: Dictionary) -> void:
	if stage_label == null:
		return
	if event.is_empty():
		stage_label.text = "自动战斗%s\n准备播放战斗结果" % _battle_effect_suffix()
		return
	stage_label.text = "%ss · %s · %s%s\n%s" % [
		str(event.get("time", "0")),
		str(event.get("actor", "system")),
		str(event.get("kind", "")),
		_battle_effect_suffix(),
		str(event.get("text", "")),
	]

func _set_speed(speed: float) -> void:
	playback_speed = speed
	_update_speed_buttons()
	error_label.text = "战斗速度 %.0fx" % playback_speed

func _update_speed_buttons() -> void:
	for speed in speed_buttons.keys():
		var button = speed_buttons[speed]
		if button is Button:
			(button as Button).button_pressed = int(speed) == int(playback_speed)

func _toggle_log() -> void:
	log_view.visible = not log_view.visible

func _update_log_filters() -> void:
	if log_filter_row == null:
		return
	_clear_children(log_filter_row)
	for filter in ["all", "damage", "sustain", "status", "equipment"]:
		var button := Button.new()
		button.text = _log_filter_label(filter)
		button.toggle_mode = true
		button.button_pressed = filter == log_filter
		button.custom_minimum_size = Vector2(80, 34)
		button.pressed.connect(_set_log_filter.bind(filter))
		log_filter_row.add_child(button)

func _set_log_filter(filter: String) -> void:
	log_filter = filter
	_update_log_filters()
	_refresh_log_view()

func _refresh_log_view() -> void:
	log_view.text = ""
	for event in displayed_events:
		if event is Dictionary and _event_matches_filter(event, log_filter):
			log_view.append_text("%ss | %s | %s\n" % [
				str(event.get("time", "0")),
				str(event.get("actor", "system")),
				str(event.get("text", "")),
			])

func _event_matches_filter(event: Dictionary, filter: String) -> bool:
	if filter == "all":
		return true
	var kind := str(event.get("kind", "")).to_lower()
	var text := str(event.get("text", "")).to_lower()
	match filter:
		"damage":
			return kind.contains("damage") or text.contains("伤害") or text.contains("damage")
		"sustain":
			return text.contains("治疗") or text.contains("护盾") or text.contains("heal") or text.contains("shield")
		"status":
			return text.contains("中毒") or text.contains("虚弱") or text.contains("冻结") or text.contains("状态") or kind.contains("status")
		"equipment":
			return kind == "item" or not str(event.get("itemId", "")).is_empty()
		_:
			return true

func _log_filter_label(filter: String) -> String:
	match filter:
		"damage":
			return "伤害"
		"sustain":
			return "回复"
		"status":
			return "状态"
		"equipment":
			return "装备"
		_:
			return "全部"

func _update_battle_meta(event: Dictionary) -> void:
	if player_shield_label != null:
		player_shield_label.text = "护盾 %d" % int(event.get("playerShield", 0))
	if opponent_shield_label != null:
		opponent_shield_label.text = "护盾 %d" % int(event.get("opponentShield", 0))
	if player_status_label != null:
		player_status_label.text = "状态：%s" % _format_status_rows(_dict(event, "playerStatuses"))
	if opponent_status_label != null:
		opponent_status_label.text = "状态：%s" % _format_status_rows(_dict(event, "opponentStatuses"))
	var reservoirs: Dictionary = _dict(event, "reservoirs")
	if player_reservoir_label != null:
		player_reservoir_label.text = "蓄水池：%s" % _format_reservoirs(_array(reservoirs, "player"))
	if opponent_reservoir_label != null:
		opponent_reservoir_label.text = "蓄水池：%s" % _format_reservoirs(_array(reservoirs, "opponent"))

func _format_status_rows(rows: Dictionary) -> String:
	var parts: Array[String] = []
	for status in _array(rows, "positive"):
		if status is Dictionary:
			parts.append(_format_status_entry(status))
	for status in _array(rows, "negative"):
		if status is Dictionary:
			parts.append(_format_status_entry(status))
	if parts.is_empty():
		return "无"
	return " · ".join(parts.slice(0, 5))

func _format_status_entry(status: Dictionary) -> String:
	var text := str(status.get("label", status.get("type", "状态")))
	var amount := int(status.get("amount", 0))
	var stacks := int(status.get("stacks", 0))
	var remaining := int(status.get("remaining", 0))
	if amount > 0:
		text += " %d" % amount
	if stacks > 0:
		text += "x%d" % stacks
	if remaining > 0:
		text += "(%d)" % remaining
	return text

func _format_reservoirs(reservoirs: Array) -> String:
	if reservoirs.is_empty():
		return "无"
	var parts: Array[String] = []
	for reservoir in reservoirs.slice(0, 4):
		if reservoir is Dictionary:
			var progress := float(reservoir.get("progress", 0.0))
			var duration := float(reservoir.get("duration", 1.0))
			var ratio := progress
			if progress > 1.0 and duration > 0.0:
				ratio = progress / duration
			parts.append("%s %.0f%%" % [str(reservoir.get("itemId", "蓄水池")), clamp(ratio, 0.0, 1.0) * 100.0])
	return " · ".join(parts)

func _highlight_event_items(event: Dictionary) -> void:
	_reset_item_highlights(player_item_buttons)
	_reset_item_highlights(opponent_item_buttons)
	var item_id := str(event.get("itemId", ""))
	if item_id.is_empty():
		return
	var actor := str(event.get("actor", "")).to_lower()
	if actor == "player":
		_highlight_item_button(player_item_buttons, item_id, Color(1.0, 0.92, 0.38, 1.0))
	elif actor == "opponent":
		_highlight_item_button(opponent_item_buttons, item_id, Color(1.0, 0.55, 0.48, 1.0))

func _reset_item_highlights(button_map: Dictionary) -> void:
	for key in button_map.keys():
		var button = button_map[key]
		if button is Button:
			button.modulate = Color.WHITE

func _highlight_item_button(button_map: Dictionary, item_id: String, color: Color) -> void:
	var button = button_map.get(item_id, null)
	if button is Button:
		button.modulate = color

func _render_battle_review() -> void:
	if review_panel == null:
		return
	var review := _build_battle_review()
	var player: Dictionary = _dict(review, "player")
	var opponent: Dictionary = _dict(review, "opponent")
	review_panel.visible = true
	if review_title_label != null:
		review_title_label.text = "战斗数据看板"
	if player_review_label != null:
		player_review_label.text = _review_side_text("我方", player)
	if opponent_review_label != null:
		opponent_review_label.text = _review_side_text("对手", opponent)
	if system_review_label != null:
		system_review_label.text = "胜者：%s\n系统伤害 %d" % [str(review.get("winner", "")), int(review.get("systemDamage", 0))]

func _review_side_text(title: String, stats: Dictionary) -> String:
	var top_item: Dictionary = _dict(stats, "topItem")
	var top_text := "暂无明确装备贡献"
	if not top_item.is_empty():
		top_text = "%s · %d" % [str(top_item.get("name", top_item.get("itemId", ""))), int(top_item.get("contribution", 0))]
	return "%s\n总伤害 %d  治疗 %d  护盾 %d\n毒伤 %d  状态 %d\n最高贡献 %s" % [
		title,
		int(stats.get("damage", 0)),
		int(stats.get("healing", 0)),
		int(stats.get("shield", 0)),
		int(stats.get("poisonDamage", 0)),
		int(stats.get("statusEvents", 0)),
		top_text,
	]

func _build_battle_review() -> Dictionary:
	var player := _create_review_side("player", _dict(battle, "playerSnapshot"))
	var opponent := _create_review_side("opponent", _dict(battle, "opponentSnapshot"))
	var system_damage := 0
	for raw_event in events:
		if not raw_event is Dictionary:
			continue
		var event: Dictionary = raw_event
		var actor := _review_side(str(event.get("actor", "")))
		var kind := str(event.get("kind", ""))
		var effect_type := str(event.get("effectType", ""))
		if kind == "POISON" or effect_type == "POISON":
			if kind == "POISON":
				var target := str(event.get("target", ""))
				if target == "both":
					system_damage += abs(min(0, _hp_delta_for_side(event, "player")))
					system_damage += abs(min(0, _hp_delta_for_side(event, "opponent")))
				elif target == "player":
					opponent["poisonDamage"] = int(opponent.get("poisonDamage", 0)) + abs(min(0, _hp_delta_for_side(event, "player")))
				elif target == "opponent":
					player["poisonDamage"] = int(player.get("poisonDamage", 0)) + abs(min(0, _hp_delta_for_side(event, "opponent")))
			elif not actor.is_empty():
				var poison_stats: Dictionary = _stats_for_side(actor, player, opponent)
				poison_stats["statusEvents"] = int(poison_stats.get("statusEvents", 0)) + 1
			continue
		if actor.is_empty():
			continue
		var actor_stats: Dictionary = _stats_for_side(actor, player, opponent)
		var actor_delta: int = _hp_delta_for_side(event, actor)
		var target_side := str(event.get("target", ""))
		if target_side != "player" and target_side != "opponent":
			target_side = _opposite_side(actor)
		var target_delta: int = _hp_delta_for_side(event, target_side)
		if effect_type == "DAMAGE":
			var damage: int = abs(min(0, target_delta))
			actor_stats["damage"] = int(actor_stats.get("damage", 0)) + damage
			_add_review_item_contribution(actor_stats, event, damage)
			continue
		if effect_type == "HEAL":
			var healing: int = max(0, actor_delta)
			actor_stats["healing"] = int(actor_stats.get("healing", 0)) + healing
			_add_review_item_contribution(actor_stats, event, healing)
			continue
		if _is_shield_event(event):
			var shield: int = max(0, int(event.get("amount", 0)))
			actor_stats["shield"] = int(actor_stats.get("shield", 0)) + shield
			_add_review_item_contribution(actor_stats, event, shield)
			continue
		if _is_status_event(event):
			actor_stats["statusEvents"] = int(actor_stats.get("statusEvents", 0)) + 1
	return {
		"winner": str(battle.get("winner", "")),
		"systemDamage": system_damage,
		"player": _finalize_review_side(player),
		"opponent": _finalize_review_side(opponent),
	}

func _create_review_side(side: String, snapshot: Dictionary) -> Dictionary:
	var item_names := {}
	for item in _array(snapshot, "items"):
		if item is Dictionary:
			var item_def: Dictionary = _dict(item, "def")
			item_names[str(item.get("id", ""))] = _fallback(str(item_def.get("name", "")), str(item.get("defId", item.get("id", ""))))
	return {
		"side": side,
		"label": str(snapshot.get("name", "我方" if side == "player" else "对手")),
		"damage": 0,
		"healing": 0,
		"shield": 0,
		"poisonDamage": 0,
		"statusEvents": 0,
		"topItem": {},
		"itemContribution": {},
		"itemNames": item_names,
	}

func _finalize_review_side(stats: Dictionary) -> Dictionary:
	var top_item := {}
	var contributions: Dictionary = _dict(stats, "itemContribution")
	var item_names: Dictionary = _dict(stats, "itemNames")
	for item_id in contributions.keys():
		var contribution := int(contributions.get(item_id, 0))
		if top_item.is_empty() or contribution > int(top_item.get("contribution", 0)):
			top_item = {
				"itemId": str(item_id),
				"name": str(item_names.get(item_id, item_id)),
				"contribution": contribution,
			}
	stats["topItem"] = top_item
	return stats

func _show_battle_item_modal(item: Dictionary, side: String) -> void:
	var stack := _modal_stack()
	if stack == null:
		error_label.text = "弹窗层未初始化"
		return
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(540, 430)
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.offset_left = -270.0
	panel.offset_right = 270.0
	panel.offset_top = -215.0
	panel.offset_bottom = 215.0
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	panel.add_child(box)
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	box.add_child(header)
	var title := Label.new()
	title.text = "战斗装备详情"
	title.custom_minimum_size = Vector2(0, 36)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	header.add_child(title)
	var close_button := Button.new()
	close_button.text = "关闭"
	close_button.custom_minimum_size = Vector2(84, 36)
	close_button.pressed.connect(func() -> void:
		stack.call("pop_modal")
	)
	header.add_child(close_button)
	var body := HBoxContainer.new()
	body.add_theme_constant_override("separation", 10)
	box.add_child(body)
	var icon := TextureRect.new()
	icon.custom_minimum_size = Vector2(96, 96)
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.texture = _battle_item_texture(item)
	body.add_child(icon)
	var lines := VBoxContainer.new()
	lines.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lines.add_theme_constant_override("separation", 6)
	body.add_child(lines)
	var item_def: Dictionary = _dict(item, "def")
	var item_name := _fallback(str(item_def.get("name", "")), str(item.get("defId", item.get("id", ""))))
	_add_modal_line(lines, "归属", "我方" if side == "player" else "对手")
	_add_modal_line(lines, "名称", item_name)
	_add_modal_line(lines, "品质", str(item.get("quality", "")))
	_add_modal_line(lines, "占格", str(int(item_def.get("size", item.get("size", 1)))))
	_add_modal_line(lines, "触发点数", _item_trigger_text(item))
	_add_modal_line(lines, "位置", "%s (%d,%d)" % [str(item.get("area", "")), int(item.get("x", 0)), int(item.get("y", 0))])
	_add_modal_line(lines, "效果", _fallback(str(item_def.get("description", "")), str(item.get("description", ""))))
	var contribution := Label.new()
	contribution.custom_minimum_size = Vector2(0, 28)
	contribution.text = "本场贡献 %d" % _battle_item_contribution(str(item.get("id", "")), side)
	lines.add_child(contribution)
	stack.call("push_modal", panel, true)

func _add_modal_line(parent: VBoxContainer, label: String, value: String) -> void:
	var row := Label.new()
	row.custom_minimum_size = Vector2(0, 28)
	row.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	row.text = "%s：%s" % [label, value]
	parent.add_child(row)

func _item_trigger_text(item: Dictionary) -> String:
	if item.has("triggerDice"):
		return str(item.get("triggerDice"))
	var def: Dictionary = _dict(item, "def")
	if def.has("triggerDice"):
		return str(def.get("triggerDice"))
	return "无"

func _battle_item_contribution(item_id: String, side: String) -> int:
	if item_id.is_empty():
		return 0
	var total := 0
	for raw_event in displayed_events:
		if not raw_event is Dictionary:
			continue
		var event: Dictionary = raw_event
		if str(event.get("itemId", "")) != item_id:
			continue
		var actor_side := _review_side(str(event.get("actor", "")))
		if actor_side != side:
			continue
		var target_side := str(event.get("target", ""))
		if target_side != "player" and target_side != "opponent":
			target_side = _opposite_side(side)
		var effect_type := str(event.get("effectType", ""))
		if effect_type == "DAMAGE":
			total += abs(min(0, _hp_delta_for_side(event, target_side)))
		elif effect_type == "HEAL":
			total += max(0, _hp_delta_for_side(event, side))
		elif _is_shield_event(event):
			total += max(0, int(event.get("amount", 0)))
	return total

func _modal_stack() -> Object:
	if session == null:
		return null
	var stack = session.get("modal_stack")
	if stack is Object and (stack as Object).has_method("push_modal"):
		return stack
	return null

func _show_battle_relic_modal(relic: Dictionary, side: String) -> void:
	var stack := _modal_stack()
	if stack == null:
		error_label.text = "弹窗层未初始化"
		return
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(500, 380)
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.offset_left = -250.0
	panel.offset_right = 250.0
	panel.offset_top = -190.0
	panel.offset_bottom = 190.0
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	panel.add_child(box)
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	box.add_child(header)
	var title := Label.new()
	title.text = "战斗遗物详情"
	title.custom_minimum_size = Vector2(0, 36)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	header.add_child(title)
	var close_button := Button.new()
	close_button.text = "关闭"
	close_button.custom_minimum_size = Vector2(84, 36)
	close_button.pressed.connect(func() -> void:
		stack.call("pop_modal")
	)
	header.add_child(close_button)
	var body := HBoxContainer.new()
	body.add_theme_constant_override("separation", 10)
	box.add_child(body)
	var icon := TextureRect.new()
	icon.custom_minimum_size = Vector2(82, 82)
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.texture = _battle_sticker_texture(str(relic.get("relicId", "")))
	body.add_child(icon)
	var lines := VBoxContainer.new()
	lines.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lines.add_theme_constant_override("separation", 6)
	body.add_child(lines)
	var def: Dictionary = _dict(relic, "def")
	var relic_name := _fallback(str(def.get("name", "")), str(relic.get("relicId", relic.get("id", ""))))
	_add_modal_line(lines, "归属", "我方" if side == "player" else "对手")
	_add_modal_line(lines, "名称", relic_name)
	_add_modal_line(lines, "品质", str(relic.get("quality", "")))
	var description := str(def.get("description", ""))
	if not description.is_empty():
		_add_modal_line(lines, "说明", description)
	var effect := str(def.get("effect", ""))
	if not effect.is_empty():
		_add_modal_line(lines, "效果", effect)
	stack.call("push_modal", panel, true)

func _stats_for_side(side: String, player: Dictionary, opponent: Dictionary) -> Dictionary:
	return player if side == "player" else opponent

func _add_review_item_contribution(stats: Dictionary, event: Dictionary, amount: int) -> void:
	var item_id := str(event.get("itemId", ""))
	if item_id.is_empty() or amount <= 0:
		return
	var contributions: Dictionary = _dict(stats, "itemContribution")
	contributions[item_id] = int(contributions.get(item_id, 0)) + amount
	stats["itemContribution"] = contributions

func _hp_delta_for_side(event: Dictionary, side: String) -> int:
	if str(event.get("target", "")) == "both":
		return int(event.get("sourceHpDelta", 0)) if side == "player" else int(event.get("targetHpDelta", 0))
	if str(event.get("actor", "")) == "system":
		if str(event.get("target", "")) == side:
			return int(event.get("sourceHpDelta", 0)) if side == "player" else int(event.get("targetHpDelta", 0))
		return 0
	if str(event.get("actor", "")) == side:
		return int(event.get("sourceHpDelta", 0))
	if str(event.get("target", "")) == side:
		return int(event.get("targetHpDelta", 0))
	return 0

func _is_shield_event(event: Dictionary) -> bool:
	var text := str(event.get("text", "")).to_lower()
	return str(event.get("effectType", "")) == "UTILITY" and (_variant_array(event.get("statusChanged", [])).has("shield") or text.contains("护盾") or text.contains("shield"))

func _is_status_event(event: Dictionary) -> bool:
	var text := str(event.get("text", "")).to_lower()
	return not _variant_array(event.get("statusChanged", [])).is_empty() or str(event.get("effectType", "")) == "POISON" or text.contains("中毒") or text.contains("虚弱") or text.contains("冻结") or text.contains("poison") or text.contains("weak") or text.contains("freeze")

func _review_side(side: String) -> String:
	return side if side == "player" or side == "opponent" else ""

func _opposite_side(side: String) -> String:
	return "opponent" if side == "player" else "player"

func _variant_array(value: Variant) -> Array:
	return value if value is Array else []

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value: Variant = source.get(key, {})
	return value if value is Dictionary else {}

func _array(source: Dictionary, key: String) -> Array:
	var value: Variant = source.get(key, [])
	return value if value is Array else []

func _cosmetic_item(raw_item: Dictionary) -> Dictionary:
	var nested: Dictionary = _dict(raw_item, "item")
	if nested.is_empty():
		return raw_item
	var merged := nested.duplicate(true)
	for key in ["catalogItemId", "owned", "equipped"]:
		if raw_item.has(key) and not merged.has(key):
			merged[key] = raw_item.get(key)
	return merged

func _cosmetic_catalog_id(raw_item: Dictionary) -> String:
	var item := _cosmetic_item(raw_item)
	return _fallback(str(item.get("id", "")), str(raw_item.get("catalogItemId", "")))

func _cosmetic_display_name(raw_item: Dictionary) -> String:
	var item := _cosmetic_item(raw_item)
	return _fallback(str(item.get("name", "")), _cosmetic_catalog_id(raw_item))

func _equipped_cosmetic(cosmetic_type: String) -> Dictionary:
	for entry in _array(cosmetics_data, "equipped"):
		if entry is Dictionary and str(entry.get("slot", entry.get("cosmeticType", ""))) == cosmetic_type:
			return _cosmetic_item(entry)
	return {}

func _battle_effect_suffix() -> String:
	var effect := _equipped_cosmetic("BATTLE_EFFECT")
	if effect.is_empty():
		return ""
	return " · %s" % _cosmetic_display_name(effect)

func _battle_effect_color() -> Color:
	match _cosmetic_catalog_id(_equipped_cosmetic("BATTLE_EFFECT")):
		"fx-aurora-roll":
			return Color(0.58, 0.82, 1.0, 1.0)
		"fx-gold-dice":
			return Color(1.0, 0.82, 0.24, 1.0)
		_:
			return Color(1.0, 0.92, 0.42, 1.0)

func _dog_skin_tint(dog_type: String, side: String) -> Color:
	if side != "player":
		return Color.WHITE
	match _cosmetic_catalog_id(_equipped_cosmetic("DOG_SKIN")):
		"skin-shiba-scarf":
			return Color(1.0, 0.82, 0.66, 1.0) if dog_type == "SHIBA" else Color.WHITE
		"skin-samoyed-snow":
			return Color(0.74, 0.92, 1.0, 1.0) if dog_type == "SAMOYED" else Color.WHITE
		_:
			return Color.WHITE

func _clear_children(container: Node) -> void:
	for child in container.get_children():
		container.remove_child(child)
		child.queue_free()

func _item_at_slot(items: Array, area: String, x: int) -> Dictionary:
	for item in items:
		if item is Dictionary and str(item.get("area", "")) == area and int(item.get("x", 0)) == x:
			return item
	return {}

func _battle_slot_count(snapshot: Dictionary) -> int:
	for relic in _array(snapshot, "relics"):
		if relic is Dictionary:
			var def: Dictionary = _dict(relic, "def")
			if str(def.get("effect", "")) == "EXTRA_EQUIPMENT_REDUCED_EFFECT":
				return 18
	return 12

func _battle_item_label(item: Dictionary) -> String:
	var def: Dictionary = _dict(item, "def")
	return "%s\n%s" % [
		str(item.get("quality", "")),
		_fallback(str(def.get("name", "")), str(item.get("defId", item.get("id", "")))),
	]

func _battle_item_texture(item: Dictionary) -> Texture2D:
	if item.is_empty():
		return null
	var def_id := str(item.get("defId", ""))
	var art := _battle_item_art_texture(def_id)
	return art if art != null else _battle_sticker_texture(def_id)

func _battle_item_art_texture(def_id: String) -> Texture2D:
	if def_id.is_empty():
		return null
	var path := "res://assets/item-card-art/%s.webp" % def_id
	if not ResourceLoader.exists(path) and not FileAccess.file_exists(path):
		return null
	return _texture(path)

func _battle_sticker_texture(asset_id: String) -> Texture2D:
	if asset_id.is_empty():
		return null
	var path := "res://assets/sticker-icons/%s.webp" % asset_id
	if not ResourceLoader.exists(path) and not FileAccess.file_exists(path):
		return _texture("res://assets/sticker-icons/starter-1.webp")
	var texture := _texture(path)
	return texture if texture != null else _texture("res://assets/sticker-icons/starter-1.webp")

func _dog_texture(dog_type: String) -> Texture2D:
	if dog_type == "FROG":
		return _texture("res://assets/dogs/zuling.jpg")
	return _texture("res://assets/dogs/%s.webp" % dog_type.to_lower())

func _texture(path: String) -> Texture2D:
	var imported := ResourceLoader.load(path)
	if imported is Texture2D:
		return imported
	if not FileAccess.file_exists(path):
		return null
	var image := Image.new()
	if image.load(path) != OK:
		return null
	return ImageTexture.create_from_image(image)

func _apply_button_icon(button: Button, texture: Texture2D) -> void:
	if texture == null:
		return
	button.icon = texture
	button.expand_icon = true

func _fallback(value: String, fallback: String) -> String:
	return fallback if value.is_empty() or value == "<null>" else value

func _connect_button_once(button: Button, handler: Callable) -> void:
	if not button.pressed.is_connected(handler):
		button.pressed.connect(handler)

func _play_event_effect(event: Dictionary) -> void:
	var actor := str(event.get("actor", "system")).to_lower()
	dice_label.pivot_offset = dice_label.size / 2.0
	dice_label.scale = Vector2(1.12, 1.12)
	dice_label.modulate = _battle_effect_color()
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(dice_label, "scale", Vector2.ONE, 0.18)
	tween.tween_property(dice_label, "modulate", Color.WHITE, 0.18)
	var target_bar := player_hp if actor.contains("opponent") else opponent_hp
	target_bar.modulate = Color(1.0, 0.55, 0.48, 1.0)
	var hp_tween := create_tween()
	hp_tween.tween_property(target_bar, "modulate", Color.WHITE, 0.22)

func _play_battle_sound(event: Dictionary) -> void:
	if session == null:
		return
	var feedback_sound_bus: Object = session.get("feedback_sound_bus") as Object
	if feedback_sound_bus != null and feedback_sound_bus.has_method("play_battle_event"):
		feedback_sound_bus.play_battle_event(event)

func _on_error_raised(message: String) -> void:
	if visible:
		error_label.text = message
