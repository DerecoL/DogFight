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
	if button == null:
		_fail("Player status detail button is missing")
		return
	button.pressed.emit()
	await process_frame
	var text := _collect_text(modal_layer)
	for expected in ["护盾", "中毒", "虚弱", "类型 护盾", "类型 中毒", "类型 虚弱"]:
		if not text.contains(expected):
			_fail("Battle status fallback label missing: %s" % expected)
			return
	for raw in ["SHIELD", "POISON", "WEAK"]:
		if text.contains(raw):
			_fail("Battle status fallback leaked raw type: %s" % raw)
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle status fallback labels smoke passed")
	quit(0)

func _event() -> Dictionary:
	return {
		"time": 1.0,
		"actor": "player",
		"kind": "ITEM",
		"text": "状态映射测试",
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
