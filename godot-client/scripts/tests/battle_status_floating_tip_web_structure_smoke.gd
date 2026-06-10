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

	for node_name in [
		"FloatingTip",
		"BattleStatusTip",
		"BattleStatusTipTitle",
		"BattleStatusTipPolarityTag",
		"BattleStatusTipTags",
		"BattleStatusTipSideTag",
		"BattleStatusTipValueTag",
		"BattleStatusTipDescription",
		"BattleStatusTipTiming",
		"BattleStatusTipSource",
		"BattleStatusTipActions",
		"CloseBattleStatusTipButton",
	]:
		_assert_has(screen, node_name)
	var text := _collect_text(screen)
	for part in ["Shield", "positive effect", "player", "7", "exists during battle", "equipment"]:
		if not text.contains(part):
			_fail("Battle status FloatingTip text missing: %s" % part)
			return

	var close_button := _find_by_name(screen, "CloseBattleStatusTipButton") as Button
	if close_button == null:
		_fail("CloseBattleStatusTipButton is missing")
		return
	close_button.pressed.emit()
	await process_frame
	if _find_by_name(screen, "FloatingTip") != null:
		_fail("CloseBattleStatusTipButton must close the battle status tip")
		return

	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle status FloatingTip Web structure smoke passed")
	quit(0)

func _battle() -> Dictionary:
	return {
		"id": "battle-status-floating-tip",
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"winner": "player",
		"events": [_event()],
		"playerSnapshot": _snapshot("Hero"),
		"opponentSnapshot": _snapshot("Rival"),
	}

func _event() -> Dictionary:
	return {
		"time": 1.0,
		"actor": "player",
		"kind": "ITEM",
		"text": "status test",
		"effectType": "UTILITY",
		"playerHp": 100,
		"opponentHp": 100,
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"playerStatuses": {
			"positive": [{"type": "shield", "label": "Shield", "amount": 7}],
			"negative": [{"type": "poison", "label": "Poison", "stacks": 2, "remaining": 3}],
		},
		"opponentStatuses": {
			"positive": [],
			"negative": [{"type": "weak", "label": "Weak", "remaining": 2}],
		},
	}

func _snapshot(display_name: String) -> Dictionary:
	return {
		"name": display_name,
		"dogType": "SHIBA",
		"wins": 1,
		"losses": 0,
		"round": 2,
		"items": [],
		"relics": [],
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing battle status FloatingTip node: %s" % node_name)

func _find_by_name(node: Node, node_name: String) -> Node:
	if node.name == node_name:
		return node
	for child in node.get_children():
		var found := _find_by_name(child, node_name)
		if found != null:
			return found
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
