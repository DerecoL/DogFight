extends SceneTree

class FinishSession:
	extends Node
	var started := false
	var release_finish := false

	func finish_battle() -> bool:
		started = true
		while not release_finish:
			await get_tree().process_frame
		return true

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/BattleReplayScreen.tscn")
	if scene == null:
		_fail("BattleReplayScreen scene failed to load")
		return
	var session := FinishSession.new()
	root.add_child(session)
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame
	screen.bind_session(session)
	screen.start_replay(_battle())
	screen.call("_apply_event", _event())
	screen.call("_mark_replay_complete")
	screen.set("event_index", 1)
	await process_frame
	var finish_button: Button = screen.get("finish_button")
	var restart_button: Button = screen.get("restart_button")
	var continue_button: Button = screen.get("continue_button")
	var speed_buttons: Dictionary = screen.get("speed_buttons")
	if finish_button == null or restart_button == null or continue_button == null or speed_buttons.is_empty():
		_fail("Battle replay must expose finish, continue, restart, and speed controls")
		return
	screen.call("_on_finish_pressed")
	await process_frame
	if not session.started or not bool(screen.get("finish_in_progress")):
		_fail("Finish action must enter an in-flight state")
		return
	if not finish_button.disabled or not continue_button.disabled or not restart_button.disabled:
		_fail("Finish action must disable completion, continue, and restart controls while in flight")
		return
	for speed in speed_buttons.keys():
		var button = speed_buttons[speed]
		if button is Button and not (button as Button).disabled:
			_fail("Finish action must disable speed controls while in flight")
			return
	screen.call("_on_restart_pressed")
	await process_frame
	if int(screen.get("event_index")) != 1 or not bool(screen.get("replay_complete")):
		_fail("Restart must not mutate replay state while finish action is in flight")
		return
	session.release_finish = true
	for _frame in range(5):
		await process_frame
	screen.queue_free()
	session.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle finish guard smoke passed")
	quit(0)

func _battle() -> Dictionary:
	return {
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"winner": "player",
		"events": [_event()],
		"playerSnapshot": _snapshot("player-bite"),
		"opponentSnapshot": _snapshot("opponent-bite"),
	}

func _event() -> Dictionary:
	return {
		"time": 1.0,
		"actor": "player",
		"kind": "ITEM",
		"text": "bite deals 5 damage",
		"effectType": "DAMAGE",
		"target": "opponent",
		"sourceHpDelta": 0,
		"targetHpDelta": -5,
		"roll": 1,
		"itemId": "player-bite",
		"playerHp": 100,
		"opponentHp": 95,
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
	}

func _snapshot(item_id: String) -> Dictionary:
	return {
		"name": item_id,
		"dogType": "SHIBA",
		"wins": 0,
		"losses": 0,
		"round": 1,
		"items": [
			{"id": item_id, "defId": "starter-1", "quality": "BRONZE", "area": "EQUIPMENT", "x": 0, "y": 0, "def": {"name": "Bite"}},
		],
		"relics": [],
	}

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
