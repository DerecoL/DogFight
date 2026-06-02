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

var session: Node
var battle: Dictionary = {}
var events: Array = []
var event_index := 0
var playing := false
var replay_complete := false
var finish_in_progress := false

func bind_session(next_session: Node) -> void:
	if session != null and session.has_signal("error_raised") and session.error_raised.is_connected(_on_error_raised):
		session.error_raised.disconnect(_on_error_raised)
	session = next_session
	if session != null and session.has_signal("error_raised") and not session.error_raised.is_connected(_on_error_raised):
		session.error_raised.connect(_on_error_raised)

func _ready() -> void:
	_connect_button_once(play_button, _on_play_pressed)
	_connect_button_once(skip_button, _on_skip_pressed)
	_connect_button_once(finish_button, _on_finish_pressed)

func start_replay(next_battle: Dictionary) -> void:
	battle = next_battle.duplicate(true)
	var next_events = battle.get("events", [])
	events = next_events if next_events is Array else []
	event_index = 0
	playing = false
	replay_complete = false
	finish_in_progress = false
	error_label.text = ""
	finish_button.disabled = true
	play_button.disabled = false
	skip_button.disabled = false
	log_view.text = ""
	_render_initial_hp()

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
		await get_tree().create_timer(0.24).timeout
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
	log_view.append_text("%ss | %s | %s\n" % [
		str(event.get("time", "0")),
		str(event.get("actor", "system")),
		str(event.get("text", "")),
	])

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

func _connect_button_once(button: Button, handler: Callable) -> void:
	if not button.pressed.is_connected(handler):
		button.pressed.connect(handler)

func _on_error_raised(message: String) -> void:
	if visible:
		error_label.text = message
