extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var manifest = load("res://scripts/ui/web/WebUiScreenIds.gd")
	if manifest == null:
		_fail("WebUiScreenIds.gd must load")
		return
	if not manifest.screen_ids().has("account"):
		_fail("Web UI manifest must expose standalone account history screen")
		return
	if str(manifest.node_name_for("account")) != "AccountHistoryScreen":
		_fail("account screen must map to AccountHistoryScreen")
		return

	var screen_scene := load("res://scenes/screens/AccountHistoryScreen.tscn")
	if screen_scene == null:
		_fail("AccountHistoryScreen scene failed to load")
		return
	var screen = screen_scene.instantiate()
	root.add_child(screen)
	await process_frame
	screen.call("set_payload", {"history": _history_data()})
	await process_frame

	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("AccountHistoryScreen must render standalone UI instead of redirecting to playable shell")
		return

	for node_name in [
		"AccountHistoryScreen",
		"HistoryPageHeader",
		"HistoryPageBest",
		"HistoryModeTabs",
		"HistoryTab_ALL",
		"HistoryTab_CASUAL",
		"HistoryTab_LADDER",
		"HistoryDetailLayout",
		"HistoryRunBrowser",
		"HistoryDetailRow_run-1",
		"HistorySelectedRun",
		"HistoryRunDetails",
		"HistoryEquipmentPreview",
		"HistoryEquipmentSlots",
		"HistoryInventorySummary",
	]:
		_assert_has(screen, node_name)

	var layout = _find_by_name(screen, "HistoryDetailLayout")
	if not layout is GridContainer:
		_fail("HistoryDetailLayout must use a grid matching the Web history browser/detail layout")
		return
	if int((layout as GridContainer).columns) != 2:
		_fail("HistoryDetailLayout must keep two columns")
		return

	var text := _collect_text(screen)
	for part in ["个人战绩", "8胜 3败", "共 12 局", "进行中 1 局", "已完成 7 局", "最佳成绩", "休闲", "天梯", "历史装备栏", "点击查看装备", "遗物 1 个", "背包物品 1 个"]:
		if not text.contains(part):
			_fail("Account history Web text missing: %s" % part)
			return

	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot account history Web structure smoke passed")
	quit(0)

func _history_data() -> Dictionary:
	return {
		"totalRuns": 12,
		"activeRuns": 1,
		"completedRuns": 7,
		"abandonedRuns": 4,
		"totalWins": 8,
		"totalLosses": 3,
		"bestRun": {"id": "best", "dogType": "SHIBA", "wins": 5, "losses": 1, "round": 12},
		"recentRuns": [
			{
				"id": "run-1",
				"mode": "CASUAL",
				"dogType": "SHIBA",
				"wins": 5,
				"losses": 1,
				"round": 12,
				"status": "COMPLETE",
				"phase": "COMPLETE",
				"updatedAt": "2026-06-09T10:00:00.000Z",
				"luckyNumber": 4,
				"items": [
					{"id": "item-eq", "area": "EQUIPMENT", "defId": "starter-1", "name": "测试装备", "quality": "BRONZE", "x": 0, "y": 0, "width": 1, "height": 1},
					{"id": "item-bag", "area": "BAG", "defId": "starter-2", "name": "背包装备", "quality": "SILVER", "x": 0, "y": 0, "width": 1, "height": 1},
				],
				"relics": [{"id": "relic-1", "name": "测试遗物"}],
			},
			{
				"id": "run-2",
				"mode": "LADDER",
				"dogType": "SAMOYED",
				"wins": 3,
				"losses": 2,
				"round": 9,
				"status": "ABANDONED",
				"phase": "MAP",
				"updatedAt": "2026-06-09T11:00:00.000Z",
				"items": [],
				"relics": [],
			},
		],
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing account history Web node: %s" % node_name)

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
