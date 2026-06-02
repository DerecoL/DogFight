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
var log_toggle_button: Button
var log_filter_row: HBoxContainer

func bind_session(next_session: Node) -> void:
	if session != null and session.has_signal("error_raised") and session.error_raised.is_connected(_on_error_raised):
		session.error_raised.disconnect(_on_error_raised)
	session = next_session
	if session != null and session.has_signal("error_raised") and not session.error_raised.is_connected(_on_error_raised):
		session.error_raised.connect(_on_error_raised)

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
	error_label.text = ""
	finish_button.disabled = true
	play_button.disabled = false
	skip_button.disabled = false
	log_view.visible = false
	log_view.text = ""
	_render_initial_hp()
	_render_snapshots()
	_render_event_stage({})
	_update_log_filters()

func _render_initial_hp() -> void:
	player_hp.max_value = int(battle.get("playerMaxHp", 100))
	opponent_hp.max_value = int(battle.get("opponentMaxHp", 100))
	player_hp.value = player_hp.max_value
	opponent_hp.value = opponent_hp.max_value
	dice_label.text = "骰点 -"

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

func _apply_event(event: Dictionary) -> void:
	player_hp.max_value = int(event.get("playerMaxHp", player_hp.max_value))
	opponent_hp.max_value = int(event.get("opponentMaxHp", opponent_hp.max_value))
	player_hp.value = int(event.get("playerHp", player_hp.value))
	opponent_hp.value = int(event.get("opponentHp", opponent_hp.value))
	if event.has("roll"):
		dice_label.text = "骰点 %s" % str(event.get("roll"))
	displayed_events.append(event.duplicate(true))
	_render_event_stage(event)
	_refresh_log_view()
	_play_event_effect(event)

func _mark_replay_complete() -> void:
	if replay_complete:
		return
	replay_complete = true
	play_button.disabled = true
	skip_button.disabled = true
	finish_button.disabled = false
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
	opponent_equipment_grid = opponent_panel["grid"]
	opponent_relic_row = opponent_panel["relics"]
	root.add_child(opponent_panel["panel"])
	root.move_child(opponent_panel["panel"], 2)

	var player_panel := _snapshot_panel("你的装备栏")
	player_name_label = player_panel["name"]
	player_equipment_grid = player_panel["grid"]
	player_relic_row = player_panel["relics"]
	root.add_child(player_panel["panel"])
	root.move_child(player_panel["panel"], 3)

	var speed_label := Label.new()
	speed_label.text = "速度"
	speed_label.custom_minimum_size = Vector2(42, 44)
	speed_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	footer.add_child(speed_label)
	for speed in [1, 2, 4]:
		var button := Button.new()
		button.text = "%dx" % speed
		button.custom_minimum_size = Vector2(52, 44)
		button.pressed.connect(_set_speed.bind(float(speed)))
		footer.add_child(button)
	log_toggle_button = Button.new()
	log_toggle_button.text = "日志"
	log_toggle_button.custom_minimum_size = Vector2(72, 44)
	log_toggle_button.pressed.connect(_toggle_log)
	footer.add_child(log_toggle_button)
	log_filter_row = HBoxContainer.new()
	log_filter_row.add_theme_constant_override("separation", 6)
	root.add_child(log_filter_row)
	root.move_child(log_filter_row, root.get_child_count() - 2)

func _snapshot_panel(title: String) -> Dictionary:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(0, 126)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	panel.add_child(box)
	var name_label := Label.new()
	name_label.text = title
	name_label.custom_minimum_size = Vector2(0, 26)
	name_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	box.add_child(name_label)
	var grid := GridContainer.new()
	grid.columns = 12
	grid.add_theme_constant_override("h_separation", 4)
	grid.add_theme_constant_override("v_separation", 4)
	box.add_child(grid)
	var relics := HBoxContainer.new()
	relics.add_theme_constant_override("separation", 4)
	box.add_child(relics)
	return {"panel": panel, "name": name_label, "grid": grid, "relics": relics}

func _render_snapshots() -> void:
	var player: Dictionary = _dict(battle, "playerSnapshot")
	var opponent: Dictionary = _dict(battle, "opponentSnapshot")
	_render_snapshot(player_name_label, player_equipment_grid, player_relic_row, player, "你的狗狗")
	_render_snapshot(opponent_name_label, opponent_equipment_grid, opponent_relic_row, opponent, "离线狗狗")

func _render_snapshot(name_label: Label, grid: GridContainer, relic_row: HBoxContainer, snapshot: Dictionary, fallback_name: String) -> void:
	if name_label == null or grid == null or relic_row == null:
		return
	name_label.text = "%s · %s · %d胜 %d负 · 第%d回合" % [
		str(snapshot.get("name", fallback_name)),
		str(snapshot.get("dogType", "")),
		int(snapshot.get("wins", 0)),
		int(snapshot.get("losses", 0)),
		int(snapshot.get("round", 0)),
	]
	_clear_children(grid)
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
			relic_row.add_child(relic_button)

func _render_event_stage(event: Dictionary) -> void:
	if stage_label == null:
		return
	if event.is_empty():
		stage_label.text = "自动战斗\n准备播放战斗结果"
		return
	stage_label.text = "%ss · %s · %s\n%s" % [
		str(event.get("time", "0")),
		str(event.get("actor", "system")),
		str(event.get("kind", "")),
		str(event.get("text", "")),
	]

func _set_speed(speed: float) -> void:
	playback_speed = speed
	error_label.text = "战斗速度 %.0fx" % playback_speed

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

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value: Variant = source.get(key, {})
	return value if value is Dictionary else {}

func _array(source: Dictionary, key: String) -> Array:
	var value: Variant = source.get(key, [])
	return value if value is Array else []

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
	return _battle_sticker_texture(str(item.get("defId", "")))

func _battle_sticker_texture(asset_id: String) -> Texture2D:
	if asset_id.is_empty():
		return null
	var texture := _texture("res://assets/sticker-icons/%s.webp" % asset_id)
	return texture if texture != null else _texture("res://assets/sticker-icons/starter-1.webp")

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
	dice_label.modulate = Color(1.0, 0.92, 0.42, 1.0)
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(dice_label, "scale", Vector2.ONE, 0.18)
	tween.tween_property(dice_label, "modulate", Color.WHITE, 0.18)
	var target_bar := player_hp if actor.contains("opponent") else opponent_hp
	target_bar.modulate = Color(1.0, 0.55, 0.48, 1.0)
	var hp_tween := create_tween()
	hp_tween.tween_property(target_bar, "modulate", Color.WHITE, 0.22)

func _on_error_raised(message: String) -> void:
	if visible:
		error_label.text = message
