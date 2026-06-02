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
	if not battle_screen.has_method("_show_battle_status_modal"):
		_fail("BattleReplayScreen must expose battle status details")
		return
	battle_screen.start_replay({
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"winner": "player",
		"events": [_event()],
		"playerSnapshot": _snapshot("player"),
		"opponentSnapshot": _snapshot("opponent"),
	})
	battle_screen.call("_apply_event", _event())
	await process_frame
	var button := _find_button(battle_screen, "我方状态详情")
	if button == null or button.disabled:
		_fail("Player status detail button must be clickable")
		return
	button.pressed.emit()
	await process_frame
	if modal_layer.get_child_count() != 1:
		_fail("Battle status detail modal was not pushed")
		return
	var text := _collect_text(modal_layer)
	for part in ["战斗状态详情", "我方", "护盾", "7", "中毒", "x2", "剩余 3"]:
		if not text.contains(str(part)):
			_fail("Battle status detail missing: %s" % str(part))
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle status detail modal smoke passed")
	quit(0)

func _event() -> Dictionary:
	return {
		"time": 1.0,
		"actor": "player",
		"kind": "ITEM",
		"text": "状态测试",
		"effectType": "UTILITY",
		"playerHp": 100,
		"opponentHp": 100,
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"playerStatuses": {
			"positive": [{"type": "shield", "label": "护盾", "amount": 7}],
			"negative": [{"type": "poison", "label": "中毒", "stacks": 2, "remaining": 3}],
		},
		"opponentStatuses": {
			"positive": [],
			"negative": [{"type": "weak", "label": "虚弱", "remaining": 2}],
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

func _find_button(node: Node, text_part: String) -> Button:
	if node is Button and (node as Button).text.contains(text_part):
		return node as Button
	for child in node.get_children():
		var result := _find_button(child, text_part)
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
