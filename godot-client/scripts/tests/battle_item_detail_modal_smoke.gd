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
	battle_screen.start_replay({
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"winner": "player",
		"events": [_event()],
		"playerSnapshot": _snapshot("player-bite", "闪亮牙咬"),
		"opponentSnapshot": _snapshot("opponent-bite", "反击骨棒"),
	})
	battle_screen.call("_apply_event", _event())
	await process_frame
	var buttons: Dictionary = battle_screen.get("player_item_buttons")
	var button = buttons.get("player-bite", null)
	if not button is Button:
		_fail("Player battle item button is missing")
		return
	(button as Button).pressed.emit()
	await process_frame
	if modal_layer.get_child_count() != 1:
		_fail("Battle item detail modal was not pushed")
		return
	var text := _collect_text(modal_layer)
	for part in ["战斗装备详情", "我方", "闪亮牙咬", "白银", "触发点数", "造成 5 点伤害", "本场贡献 5"]:
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
		"text": "闪亮牙咬造成 5 点伤害",
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

func _snapshot(item_id: String, item_name: String) -> Dictionary:
	return {
		"name": item_id,
		"dogType": "SHIBA",
		"wins": 0,
		"losses": 0,
		"round": 1,
		"items": [
			{
				"id": item_id,
				"defId": "starter-1",
				"quality": "SILVER",
				"area": "EQUIPMENT",
				"x": 0,
				"y": 0,
				"triggerDice": 1,
				"def": {"name": item_name, "size": 1, "description": "造成 5 点伤害"},
			},
		],
		"relics": [],
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
