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
	await process_frame

	var button := _find_by_name(screen, "PlayerBattleRelicButton_player-relic") as Button
	if button == null:
		_fail("Player battle relic button is missing")
		return
	button.pressed.emit()
	await process_frame

	for node_name in [
		"FloatingTip",
		"BattleRelicTip",
		"BattleRelicTipTags",
		"BattleRelicTipIdentity",
		"BattleRelicTipDescription",
		"BattleRelicTipActions",
		"CloseBattleRelicTipButton",
	]:
		_assert_has(screen, node_name)
	var text := _collect_text(screen)
	for part in ["player-relic", "Battle Relic", "bonus slot", "EXTRA_SLOT", "player"]:
		if not text.contains(part):
			_fail("Battle relic FloatingTip text missing: %s" % part)
			return

	var close_button := _find_by_name(screen, "CloseBattleRelicTipButton") as Button
	if close_button == null:
		_fail("CloseBattleRelicTipButton is missing")
		return
	close_button.pressed.emit()
	await process_frame
	if _find_by_name(screen, "FloatingTip") != null:
		_fail("CloseBattleRelicTipButton must close the battle relic tip")
		return

	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle relic FloatingTip Web structure smoke passed")
	quit(0)

func _battle() -> Dictionary:
	return {
		"id": "battle-relic-floating-tip",
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"winner": "player",
		"events": [],
		"playerSnapshot": _snapshot("player-relic", "Hero", "Battle Relic", "player"),
		"opponentSnapshot": _snapshot("opponent-relic", "Rival", "Counter Relic", "opponent"),
	}

func _snapshot(relic_id: String, display_name: String, relic_name: String, side: String) -> Dictionary:
	return {
		"name": display_name,
		"dogType": "SHIBA",
		"wins": 1,
		"losses": 0,
		"round": 2,
		"items": [],
		"relics": [
			{
				"id": relic_id,
				"relicId": relic_id,
				"slot": 0,
				"quality": "TEST",
				"def": {
					"name": relic_name,
					"description": "%s bonus slot relic" % side,
					"effect": "EXTRA_SLOT",
					"tags": ["slot", side],
				},
			},
		],
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing battle relic FloatingTip node: %s" % node_name)

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
