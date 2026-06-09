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

	for node_name in [
		"BattlePanel",
		"BattleToolbar",
		"BattleStatus",
		"BattleSpeedRow",
		"BattleFxStage",
		"OpponentEquipmentRow",
		"BattleStage",
		"OpponentBattleDog",
		"BattleDice",
		"PlayerBattleDog",
		"PlayerEquipmentRow",
		"CollapsedBattleLog",
		"BattleLogFilters",
		"BattleLogBody",
	]:
		_assert_has(screen, node_name)

	var stage = _find_by_name(screen, "BattleStage")
	if not stage is GridContainer:
		_fail("BattleStage must be a grid matching the Web left/dice/right layout")
		return
	if int((stage as GridContainer).columns) != 3:
		_fail("BattleStage must keep three columns")
		return

	var opponent_row = _find_by_name(screen, "OpponentEquipmentRow")
	var player_row = _find_by_name(screen, "PlayerEquipmentRow")
	if not opponent_row is PanelContainer or not player_row is PanelContainer:
		_fail("Battle equipment rows must be framed Web rows")
		return
	if _find_by_name(opponent_row, "OpponentBattleSlotGrid") == null:
		_fail("Opponent equipment row must expose a slot grid")
		return
	if _find_by_name(player_row, "PlayerBattleSlotGrid") == null:
		_fail("Player equipment row must expose a slot grid")
		return

	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle replay Web structure smoke passed")
	quit(0)

func _battle() -> Dictionary:
	return {
		"id": "battle-web-structure",
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
		"sourceHpDelta": 0,
		"targetHpDelta": -5,
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

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing battle Web node: %s" % node_name)

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
