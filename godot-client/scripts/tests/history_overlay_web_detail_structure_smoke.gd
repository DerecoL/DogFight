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
	var run_screen = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if run_screen == null or modal_layer == null:
		_fail("RunScreen or ModalLayer is missing")
		return
	if run_screen.has_method("bind_session"):
		run_screen.bind_session(main)
	run_screen.set("history_data", _history())
	run_screen.call("_show_history_modal")
	await process_frame
	if modal_layer.get_child_count() != 1:
		_fail("History overlay should push exactly one modal")
		return

	_assert_label_text(modal_layer, "HistoryHeaderKicker", "个人战绩")
	_assert_label_text(modal_layer, "HistoryHeaderTitle", "5胜 1败")
	_assert_label_text(modal_layer, "HistoryHeaderSubtitle", "共 2 局 · 进行中 0 局 · 已完成 2 局")
	_assert_label_text(modal_layer, "HistoryBestLabel", "最佳成绩")
	_assert_label_text(modal_layer, "HistoryBestValue", "萨摩耶 · 3胜 0败")
	_assert_has(modal_layer, "HistoryModeTabs")
	_assert_button_text(modal_layer, "HistoryTab_ALL", "全部 2", true)
	_assert_button_text(modal_layer, "HistoryTab_CASUAL", "休闲 1", false)
	_assert_button_text(modal_layer, "HistoryTab_LADDER", "天梯 1", false)
	_assert_has(modal_layer, "HistoryDetailLayout")
	_assert_has(modal_layer, "HistoryRunBrowser")
	_assert_has(modal_layer, "HistorySelectedRun")
	_assert_button_text(modal_layer, "HistoryDetailRow_casual-run", "柴犬 2胜 1败 已完成 · 第 5 回合 · 装备 2", true)
	_assert_button_text(modal_layer, "HistoryDetailRow_ladder-run", "萨摩耶 3胜 0败 已完成 · 第 5 回合 · 装备 2", false)
	_assert_label_text(modal_layer, "HistoryRunMode", "休闲")
	_assert_label_text(modal_layer, "HistoryRunTitle", "柴犬 · 2胜 1败")
	_assert_label_text(modal_layer, "HistoryRunMeta", "已完成 · 第 5 回合 · 2026-06-02T09:00:00.000Z")
	_assert_label_text(modal_layer, "HistoryEquipmentTitle", "历史装备栏")
	_assert_label_text(modal_layer, "HistoryEquipmentHint", "点击查看装备")
	_assert_label_text(modal_layer, "HistoryInventorySummary", "遗物 1 个 · 背包物品 1 个")

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot history overlay Web detail structure smoke passed")
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
			{"id": "%s-equipment" % id, "defId": "starter-1", "quality": quality, "area": "EQUIPMENT", "x": 0, "y": 0, "triggerDice": 1, "def": {"name": item_name, "size": 1, "description": description}},
			{"id": "%s-bag" % id, "defId": "starter-2", "quality": "BRONZE", "area": "BAG", "x": 0, "y": 0, "def": {"name": "历史背包", "size": 1, "description": "背包留存"}},
		],
		"relics": [
			{"id": "%s-relic" % id, "relicId": "extra-slot", "quality": "GOLD", "def": {"name": "历史遗物", "description": "额外装备槽", "effect": "EXTRA_EQUIPMENT_REDUCED_EFFECT"}},
		],
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing history overlay Web detail node: %s" % node_name)

func _assert_label_text(root_node: Node, node_name: String, expected: String) -> void:
	var label := _find_by_name(root_node, node_name) as Label
	if label == null:
		_fail("Missing label: %s" % node_name)
		return
	if label.text != expected:
		_fail("Label %s should be %s, got %s" % [node_name, expected, label.text])

func _assert_button_text(root_node: Node, node_name: String, expected: String, expected_pressed: bool) -> void:
	var button := _find_by_name(root_node, node_name) as Button
	if button == null:
		_fail("Missing button: %s" % node_name)
		return
	if button.text != expected:
		_fail("Button %s should be %s, got %s" % [node_name, expected, button.text])
	if button.toggle_mode and button.button_pressed != expected_pressed:
		_fail("Button %s pressed should be %s" % [node_name, str(expected_pressed)])

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
