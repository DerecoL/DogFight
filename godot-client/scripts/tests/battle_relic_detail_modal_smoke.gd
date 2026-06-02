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
	battle_screen.start_replay({
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"winner": "player",
		"events": [],
		"playerSnapshot": _snapshot("player-relic", "战斗遗物"),
		"opponentSnapshot": _snapshot("opponent-relic", "对手遗物"),
	})
	await process_frame
	var relic_button := _find_button(battle_screen, "战斗遗物")
	if relic_button == null or relic_button.disabled:
		_fail("Battle relic button must be clickable")
		return
	relic_button.pressed.emit()
	await process_frame
	if modal_layer.get_child_count() != 1:
		_fail("Battle relic detail modal was not pushed")
		return
	var text := _collect_text(modal_layer)
	for part in ["战斗遗物详情", "我方", "战斗遗物", "GOLD", "额外装备槽", "EXTRA_EQUIPMENT_REDUCED_EFFECT"]:
		if not text.contains(str(part)):
			_fail("Battle relic detail missing: %s" % str(part))
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle relic detail modal smoke passed")
	quit(0)

func _snapshot(relic_id: String, relic_name: String) -> Dictionary:
	return {
		"name": relic_name,
		"dogType": "SHIBA",
		"wins": 0,
		"losses": 0,
		"round": 1,
		"items": [],
		"relics": [
			{
				"id": relic_id,
				"relicId": relic_id,
				"quality": "GOLD",
				"def": {"name": relic_name, "description": "额外装备槽", "effect": "EXTRA_EQUIPMENT_REDUCED_EFFECT"},
			},
		],
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
