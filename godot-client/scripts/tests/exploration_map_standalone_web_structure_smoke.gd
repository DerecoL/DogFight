extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/screens/ExplorationMapScreen.tscn")
	if scene == null:
		_fail("ExplorationMapScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame
	if screen.has_method("set_payload"):
		screen.call("set_payload", {"run": _map_run(true)})
	await process_frame

	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("ExplorationMapScreen must be standalone and must not redirect to LegacyRunScreen")
		return

	for node_name in [
		"ExplorationMapScreen",
		"ExplorationMapOverlay",
		"ExplorationMapShell",
		"ExplorationMapTopbar",
		"MapTitlePlacard",
		"MapRunStats",
		"ExplorationMapRouteBoard",
		"MapRouteCanvas",
		"MapLayerMarkerRow",
		"MapLayerMarker_0",
		"MapLayerMarker_1",
		"MapRouteLayer",
		"MapRouteSvg",
		"MapDrawingToolbar",
		"MapNodeButton_start-1",
		"MapNodeButton_monster-1",
		"MapNodeDetailPanel",
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
		_assert_has(screen, node_name)

	var shell = _find_by_name(screen, "ExplorationMapShell")
	if not shell is VBoxContainer:
		_fail("ExplorationMapShell must stack topbar and route board like the Web shell")
		return
	var route_board = _find_by_name(screen, "ExplorationMapRouteBoard")
	if not route_board is HBoxContainer:
		_fail("ExplorationMapRouteBoard must use the Web two-column map layout")
		return
	var text := _collect_text(screen)
	for part in [
		"探索地图",
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
			_fail("Standalone exploration map Web text missing: %s" % part)
			return

	if screen.has_method("set_payload"):
		screen.call("set_payload", {"run": _map_run(false)})
	await process_frame
	if _find_by_name(screen, "MapRewardInventory") != null:
		_fail("MapRewardInventory should only render when pending reward exists, matching Web")
		return

	screen.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot standalone exploration map Web structure smoke passed")
	quit(0)

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

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing standalone exploration map Web node: %s" % node_name)

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
