extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var main_scene := load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame
	var battle_screen = main.get_node_or_null("ScreenRoot/BattleReplayScreen")
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if battle_screen == null or modal_layer == null:
		_fail("BattleReplayScreen or ModalLayer is missing")
		return
	if not battle_screen.has_method("_show_battle_item_modal"):
		_fail("BattleReplayScreen must expose battle item details")
		return
	var player_item := _item("player-bite", "Bite", "player item deals 5 damage")
	battle_screen.start_replay({
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"winner": "player",
		"events": [_event()],
		"playerSnapshot": _snapshot("player-bite", "Hero", player_item),
		"opponentSnapshot": _snapshot("opponent-bite", "Rival", _item("opponent-bite", "Counter", "opponent item")),
	})
	battle_screen.call("_apply_event", _event())
	await process_frame
	battle_screen.call("_show_battle_item_modal", player_item, "player")
	await process_frame
	if modal_layer.get_child_count() != 1:
		_fail("Battle item detail modal was not pushed")
		return
	var text := _collect_text(modal_layer)
	for part in ["Bite", "player item deals 5 damage", "5"]:
		if not text.contains(str(part)):
			_fail("Battle item detail modal missing: %s" % str(part))
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle item detail modal smoke passed")
	quit(0)

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

func _snapshot(id: String, display_name: String, item: Dictionary) -> Dictionary:
	return {
		"name": display_name,
		"dogType": "SHIBA",
		"wins": 0,
		"losses": 0,
		"round": 1,
		"items": [item],
		"relics": [],
	}

func _item(id: String, item_name: String, description: String) -> Dictionary:
	return {
		"id": id,
		"defId": "starter-1",
		"quality": "SILVER",
		"area": "EQUIPMENT",
		"x": 0,
		"y": 0,
		"triggerDice": [1],
		"def": {"name": item_name, "size": 1, "description": description},
	}

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
