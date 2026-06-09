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

	var buttons: Dictionary = screen.get("player_item_buttons")
	var button = buttons.get("player-bite", null)
	if not button is Button:
		_fail("Player battle item button is missing")
		return
	(button as Button).pressed.emit()
	await process_frame

	for node_name in [
		"FloatingTip",
		"BattleItemTip",
		"BattleItemTipTags",
		"BattleItemTipIdentity",
		"BattleItemTipSizePreview",
		"BattleItemTipDice",
		"BattleItemTipDescription",
		"BattleItemTipContribution",
		"BattleItemTipActions",
		"CloseBattleItemTipButton",
	]:
		_assert_has(screen, node_name)
	var text := _collect_text(screen)
	for part in ["player-bite", "Bite", "1", "5", "player"]:
		if not text.contains(part):
			_fail("Battle item FloatingTip text missing: %s" % part)
			return

	var close_button := _find_by_name(screen, "CloseBattleItemTipButton") as Button
	if close_button == null:
		_fail("CloseBattleItemTipButton is missing")
		return
	close_button.pressed.emit()
	await process_frame
	if _find_by_name(screen, "FloatingTip") != null:
		_fail("CloseBattleItemTipButton must close the battle item tip")
		return

	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle item FloatingTip Web structure smoke passed")
	quit(0)

func _battle() -> Dictionary:
	return {
		"id": "battle-item-floating-tip",
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"winner": "player",
		"events": [_event()],
		"playerSnapshot": _snapshot("player-bite", "Hero", "player"),
		"opponentSnapshot": _snapshot("opponent-bite", "Rival", "opponent"),
	}

func _event() -> Dictionary:
	return {
		"time": 1.0,
		"actor": "player",
		"kind": "ITEM",
		"text": "Bite deals 5 damage",
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

func _snapshot(item_id: String, display_name: String, side: String) -> Dictionary:
	return {
		"name": display_name,
		"dogType": "SHIBA",
		"wins": 1,
		"losses": 0,
		"round": 2,
		"items": [
			{
				"id": item_id,
				"defId": "starter-1",
				"quality": "SILVER",
				"area": "EQUIPMENT",
				"x": 0,
				"y": 0,
				"triggerDice": [1],
				"def": {"name": "Bite", "size": 1, "width": 1, "description": "%s item deals 5 damage" % side, "triggerDice": [1]},
			},
		],
		"relics": [],
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing battle item FloatingTip node: %s" % node_name)

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
