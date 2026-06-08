extends SceneTree

class FinishSession:
	extends Node
	var normal_finish_called := false
	var room_finish_called := false
	var room_id := ""
	var battle_id := ""
	var mark_ready := false

	func finish_battle() -> bool:
		normal_finish_called = true
		return true

	func finish_dogfight_room_battle(next_room_id: String, next_battle_id: String, next_mark_ready := true) -> bool:
		room_finish_called = true
		room_id = next_room_id
		battle_id = next_battle_id
		mark_ready = bool(next_mark_ready)
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
	var battle := _battle()
	battle["_finishContext"] = {"kind": "DOGFIGHT_ROOM_READY", "roomId": "room-1", "battleId": "battle-1"}
	screen.start_replay(battle)
	screen.call("_apply_event", _event())
	screen.call("_mark_replay_complete")
	await process_frame
	screen.call("_on_finish_pressed")
	await process_frame
	if session.normal_finish_called:
		_fail("Room battle replay must not call normal finish_battle")
		return
	if not session.room_finish_called:
		_fail("Room battle replay must call finish_dogfight_room_battle")
		return
	if session.room_id != "room-1" or session.battle_id != "battle-1":
		_fail("Room battle replay passed wrong finish context")
		return
	if not session.mark_ready:
		_fail("Current room battle replay must mark the room member ready")
		return
	screen.queue_free()
	session.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot room battle finish context smoke passed")
	quit(0)

func _battle() -> Dictionary:
	return {
		"id": "battle-1",
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
