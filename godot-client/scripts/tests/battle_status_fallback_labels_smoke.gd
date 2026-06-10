extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/BattleReplayScreen.tscn")
	if scene == null:
		_fail("BattleReplayScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame
	screen.start_replay(_battle())
	screen.call("_apply_event", _event())
	await process_frame

	var button := _find_by_name(screen, "PlayerBattleStatusButton") as Button
	if button == null:
		_fail("PlayerBattleStatusButton is missing")
		return
	button.pressed.emit()
	await process_frame
	if _find_by_name(screen, "FloatingTip") == null:
		_fail("Status fallback labels must render in the Web-style FloatingTip")
		return
	var text := _collect_text(screen)
	for expected in ["护盾", "护盾 7", "positive effect"]:
		if not text.contains(expected):
			_fail("Battle status fallback FloatingTip label missing: %s" % expected)
			return
	for raw in ["SHIELD", "POISON", "WEAK"]:
		if text.contains(raw):
			_fail("Battle status fallback FloatingTip leaked raw type: %s" % raw)
			return

	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle status fallback labels smoke passed")
	quit(0)

func _battle() -> Dictionary:
	return {
		"id": "battle-status-fallback-labels",
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"winner": "player",
		"events": [_event()],
		"playerSnapshot": _snapshot("player"),
		"opponentSnapshot": _snapshot("opponent"),
	}

func _event() -> Dictionary:
	return {
		"time": 1.0,
		"actor": "player",
		"kind": "ITEM",
		"text": "status fallback test",
		"effectType": "UTILITY",
		"playerHp": 100,
		"opponentHp": 100,
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"playerStatuses": {
			"positive": [{"type": "SHIELD", "amount": 7}],
			"negative": [{"type": "POISON", "stacks": 2, "remaining": 3}, {"type": "WEAK", "remaining": 2}],
		},
		"opponentStatuses": {
			"positive": [],
			"negative": [],
		},
	}

func _snapshot(name: String) -> Dictionary:
	return {
		"name": name,
		"dogType": "SHIBA",
		"wins": 0,
		"losses": 0,
		"round": 1,
		"items": [],
		"relics": [],
	}

func _find_by_name(node: Node, node_name: String) -> Node:
	if node.name == node_name:
		return node
	for child in node.get_children():
		var result := _find_by_name(child, node_name)
		if result != null:
			return result
	return null

func _collect_text(node: Node) -> String:
	var text := ""
	if node is Label:
		text += (node as Label).text + "\n"
	if node is Button:
		text += (node as Button).text + "\n"
	for child in node.get_children():
		text += _collect_text(child)
	return text

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
