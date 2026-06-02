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
	var run_screen = main.get_node_or_null("ScreenRoot/RunScreen")
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if run_screen == null or modal_layer == null:
		_fail("RunScreen or ModalLayer is missing")
		return
	run_screen.set("history_data", _history())
	run_screen.call("_show_history_modal")
	await process_frame
	if modal_layer.get_child_count() != 1:
		_fail("History modal was not pushed")
		return
	var text := _collect_text(modal_layer)
	for part in ["个人战绩详情", "全部 2", "休闲 1", "天梯 1", "历史对局列表", "对局详情", "历史装备栏", "遗物 1 个", "背包物品 1 个", "历史牙咬"]:
		if not text.contains(str(part)):
			_fail("History browser missing: %s" % str(part))
			return
	var ladder_tab := _find_button(modal_layer, "天梯 1")
	if ladder_tab == null:
		_fail("Ladder history tab is missing")
		return
	ladder_tab.pressed.emit()
	await process_frame
	text = _collect_text(modal_layer)
	for part in ["天梯", "萨摩耶", "3胜 0败", "历史冰牙"]:
		if not text.contains(str(part)):
			_fail("History tab selection missing: %s" % str(part))
			return
	var item_button := _find_button(modal_layer, "历史冰牙")
	if item_button == null or item_button.disabled:
		_fail("History selected item button must be clickable")
		return
	item_button.pressed.emit()
	await process_frame
	text = _collect_text(modal_layer)
	for part in ["快照装备详情", "历史冰牙", "GOLD", "造成 8 点伤害"]:
		if not text.contains(str(part)):
			_fail("History item detail missing: %s" % str(part))
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot history detail browser smoke passed")
	quit(0)

func _history() -> Dictionary:
	return {
		"totalRuns": 2,
		"activeRuns": 0,
		"completedRuns": 2,
		"abandonedRuns": 0,
		"totalWins": 5,
		"totalLosses": 1,
		"bestRun": {"dogType": "SAMOYED", "wins": 3, "losses": 0, "round": 6},
		"recentRuns": [
			_run_entry("casual-run", "CASUAL", "SHIBA", 2, 1, "历史牙咬", "SILVER", "造成 5 点伤害"),
			_run_entry("ladder-run", "LADDER", "SAMOYED", 3, 0, "历史冰牙", "GOLD", "造成 8 点伤害"),
		],
	}

func _run_entry(id: String, mode: String, dog_type: String, wins: int, losses: int, item_name: String, quality: String, description: String) -> Dictionary:
	return {
		"id": id,
		"mode": mode,
		"dogType": dog_type,
		"luckyNumber": null,
		"wins": wins,
		"losses": losses,
		"round": 5,
		"status": "COMPLETE",
		"phase": "COMPLETE",
		"updatedAt": "2026-06-02T09:00:00.000Z",
		"items": [
			{
				"id": "%s-equipment" % id,
				"defId": "starter-1",
				"quality": quality,
				"area": "EQUIPMENT",
				"x": 0,
				"y": 0,
				"triggerDice": 1,
				"def": {"name": item_name, "size": 1, "description": description},
			},
			{
				"id": "%s-bag" % id,
				"defId": "starter-2",
				"quality": "BRONZE",
				"area": "BAG",
				"x": 0,
				"y": 0,
				"def": {"name": "历史背包", "size": 1, "description": "背包留存"},
			},
		],
		"relics": [
			{
				"id": "%s-relic" % id,
				"relicId": "extra-slot",
				"quality": "GOLD",
				"def": {"name": "历史遗物", "description": "额外装备槽", "effect": "EXTRA_EQUIPMENT_REDUCED_EFFECT"},
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
