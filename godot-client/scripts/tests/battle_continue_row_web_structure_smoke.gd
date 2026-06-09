extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/BattleReplayScreen.tscn")
	if scene == null:
		_fail("BattleReplayScreen scene failed to load")
		return
	var screen = scene.instantiate()
	var fake_session := FakeSession.new()
	root.add_child(fake_session)
	root.add_child(screen)
	await process_frame
	if screen.has_method("bind_session"):
		screen.call("bind_session", fake_session)
	screen.call("start_replay", _battle())
	screen.call("_mark_replay_complete")
	await process_frame

	var continue_row := _find_by_name(screen, "BattleContinueRow")
	if continue_row == null:
		_fail("Finished battle replay must expose the Web battle continue row")
		return
	var continue_button := _find_by_name(screen, "BattleContinueButton") as Button
	if continue_button == null:
		_fail("Finished battle replay must expose BattleContinueButton")
		return
	if continue_button.disabled:
		_fail("BattleContinueButton must be enabled after replay completes")
		return
	continue_button.pressed.emit()
	await process_frame
	await process_frame
	if not fake_session.finish_called:
		_fail("BattleContinueButton must call finish_battle like the Web continue action")
		return

	screen.queue_free()
	fake_session.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle continue row Web structure smoke passed")
	quit(0)

class FakeSession:
	extends Node
	var finish_called := false

	func finish_battle() -> bool:
		finish_called = true
		return true

func _battle() -> Dictionary:
	return {
		"id": "battle-continue-row",
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"winner": "player",
		"events": [_event()],
		"playerSnapshot": _snapshot("player-bite", "Hero"),
		"opponentSnapshot": _snapshot("opponent-bite", "Rival"),
	}

func _event() -> Dictionary:
	return {
		"time": 1.0,
		"actor": "player",
		"kind": "ITEM",
		"text": "Bite deals 5 damage",
		"effectType": "DAMAGE",
		"target": "opponent",
		"roll": 1,
		"itemId": "player-bite",
		"playerHp": 100,
		"opponentHp": 95,
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
	}

func _snapshot(item_id: String, display_name: String) -> Dictionary:
	return {
		"name": display_name,
		"dogType": "SHIBA",
		"wins": 1,
		"losses": 0,
		"round": 2,
		"items": [
			{"id": item_id, "defId": "starter-1", "quality": "BRONZE", "area": "EQUIPMENT", "x": 0, "y": 0, "def": {"name": "Bite", "size": 1}},
		],
		"relics": [],
	}

func _find_by_name(node: Node, node_name: String) -> Node:
	if node.name == node_name:
		return node
	for child in node.get_children():
		var found := _find_by_name(child, node_name)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
