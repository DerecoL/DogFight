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
	if not battle_screen.has_method("_show_battle_relic_modal"):
		_fail("BattleReplayScreen must expose battle relic details")
		return
	var player_relic := _relic("player-relic", "Battle Relic", "player bonus slot")
	battle_screen.start_replay({
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"winner": "player",
		"events": [],
		"playerSnapshot": _snapshot("Hero", player_relic),
		"opponentSnapshot": _snapshot("Rival", _relic("opponent-relic", "Counter Relic", "opponent relic")),
	})
	await process_frame
	battle_screen.call("_show_battle_relic_modal", player_relic, "player")
	await process_frame
	if modal_layer.get_child_count() != 1:
		_fail("Battle relic detail modal was not pushed")
		return
	var text := _collect_text(modal_layer)
	for part in ["Battle Relic", "player bonus slot", "EXTRA_SLOT"]:
		if not text.contains(str(part)):
			_fail("Battle relic detail modal missing: %s" % str(part))
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle relic detail modal smoke passed")
	quit(0)

func _snapshot(display_name: String, relic: Dictionary) -> Dictionary:
	return {
		"name": display_name,
		"dogType": "SHIBA",
		"wins": 0,
		"losses": 0,
		"round": 1,
		"items": [],
		"relics": [relic],
	}

func _relic(relic_id: String, relic_name: String, description: String) -> Dictionary:
	return {
		"id": relic_id,
		"relicId": relic_id,
		"slot": 0,
		"quality": "TEST",
		"def": {
			"name": relic_name,
			"description": description,
			"effect": "EXTRA_SLOT",
			"tags": ["slot"],
		},
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
