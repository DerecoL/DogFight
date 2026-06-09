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
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	if not main.has_method("set_current_run"):
		_fail("Main session does not expose set_current_run")
		return

	main.call("set_current_run", _map_run(true))
	run_screen.set("current_tab", "跑局")
	run_screen.call("_render_current_tab")
	await process_frame
	for node_name in [
		"ExplorationMapScreen",
		"MapLayerMarkerRow",
		"MapLayerMarker_0",
		"MapLayerMarker_1",
		"MapRouteSvg",
		"MapNodeButton_start-1",
		"MapNodeButton_monster-1",
		"MapCurrentReward",
		"MapRewardCopy",
		"MapRewardActions",
		"ClaimMonsterRewardButton",
		"SkipMonsterRewardButton",
		"MapSelectedNodeDetail",
		"MapNodeDetailKicker",
		"MapRewardPreviewLinks",
		"MapRewardInventory",
		"InventoryBoard",
	]:
		_assert_has(run_screen, node_name)
	var text := _collect_text(run_screen)
	for part in [
		"第 1 张地图 · 第 1 / 2 层",
		"1",
		"2",
		"待领取掉落",
		"1点牙咬 · 白银",
		"第 2 层",
		"训练野狗",
		"预期掉落",
		"当前处理中",
	]:
		if not text.contains(part):
			_fail("Exploration map Web detail text missing: %s" % part)
			return

	main.call("set_current_run", _map_run(false))
	run_screen.call("_render_current_tab")
	await process_frame
	if _find_by_name(run_screen, "MapRewardInventory") != null:
		_fail("MapRewardInventory should only render when pending reward exists, matching Web")
		return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot exploration map Web detail structure smoke passed")
	quit(0)

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing exploration map Web detail node: %s" % node_name)

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

func _map_run(with_reward: bool) -> Dictionary:
	var pending := {"nodeId": "monster-1", "defId": "starter-1", "quality": "SILVER", "def": {"name": "1点牙咬"}} if with_reward else {}
	return {
		"id": "map-detail-run",
		"mode": "CASUAL",
		"phase": "MAP",
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"luckyNumber": 1,
		"round": 2,
		"wins": 1,
		"losses": 0,
		"gold": 8,
		"items": [_item("item-1", "EQUIPMENT", 0)],
		"relics": [],
		"shopItems": [],
		"choices": [],
		"classRewardChoices": [],
		"enchantChoices": [],
		"relicChoices": [],
		"upgradeChoices": [],
		"potionChoices": [],
		"mapState": {
			"mapIndex": 0,
			"nodes": [
				_node("start-1", "SHOP_FIXED", 0, 0, ["monster-1"]),
				_node("monster-1", "MONSTER_BATTLE", 1, 0, []),
			],
			"availableNodeIds": ["start-1"],
			"completedNodeIds": [],
			"currentNodeId": "monster-1",
			"pendingReward": pending,
		},
	}

func _node(id: String, kind: String, layer: int, column: int, next_ids: Array) -> Dictionary:
	return {
		"id": id,
		"layer": layer,
		"column": column,
		"kind": kind,
		"nextNodeIds": next_ids,
		"monster": {
			"name": "训练野狗",
			"dogType": "SHIBA",
			"round": 2,
			"equipment": [],
			"possibleRewards": [
				{"defId": "starter-1", "quality": "SILVER", "def": {"name": "1点牙咬"}},
			],
		} if kind == "MONSTER_BATTLE" else {},
	}

func _item(id: String, area: String, x: int) -> Dictionary:
	return {
		"id": id,
		"defId": "starter-1",
		"quality": "BRONZE",
		"area": area,
		"x": x,
		"y": 0,
		"def": {"name": "1点牙咬", "size": 1, "description": "造成 5 点伤害", "triggerDice": [1]},
	}

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
