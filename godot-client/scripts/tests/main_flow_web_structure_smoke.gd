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
		"PlayableRunScreen",
		"RunSummaryTopbar",
		"ExplorationMapScreen",
		"ExplorationMapOverlay",
		"ExplorationMapShell",
		"ExplorationMapTopbar",
		"MapTitlePlacard",
		"MapRunStats",
		"ExplorationMapRouteBoard",
		"MapRouteCanvas",
		"MapRouteLayer",
		"MapDrawingToolbar",
		"MapNodeDetailPanel",
		"MapRewardInventory",
		"InventoryBoard",
		"EquipmentBoard",
		"RelicRail",
		"BagBoard",
	]:
		_assert_has(run_screen, node_name)

	main.call("set_current_run", _shop_run())
	run_screen.call("_render_current_tab")
	await process_frame
	for node_name in [
		"PlayableRunScreen",
		"RunSummaryTopbar",
		"ShopWorkbench",
		"ShopShelf",
		"ShopActions",
		"SellDropZone",
		"OfferRow",
		"ShopCard_offer-1",
		"MatchButton",
		"InventoryBoard",
		"EquipmentBoard",
		"RelicRail",
		"BagBoard",
	]:
		_assert_has(run_screen, node_name)

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot main flow Web structure smoke passed")
	quit(0)

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing Web main flow node: %s" % node_name)

func _find_by_name(node: Node, node_name: String) -> Node:
	if node.name == node_name:
		return node
	for child in node.get_children():
		var found := _find_by_name(child, node_name)
		if found != null:
			return found
	return null

func _map_run(with_reward: bool) -> Dictionary:
	var map_state := {
		"mapIndex": 0,
		"nodes": [
			_node("start-1", "SHOP_FIXED", 0, 0, ["monster-1"]),
			_node("monster-1", "MONSTER_BATTLE", 1, 0, []),
		],
		"availableNodeIds": ["start-1"],
		"completedNodeIds": [],
		"currentNodeId": "monster-1",
	}
	if with_reward:
		map_state["pendingReward"] = {"nodeId": "monster-1", "defId": "starter-1", "quality": "SILVER"}
	return {
		"id": "main-flow-map",
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
		"mapState": map_state,
	}

func _shop_run() -> Dictionary:
	return {
		"id": "main-flow-shop",
		"mode": "CASUAL",
		"phase": "SHOP",
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"luckyNumber": 1,
		"round": 3,
		"wins": 1,
		"losses": 0,
		"gold": 4,
		"refreshCost": 1,
		"shopType": "GENERAL",
		"items": [_item("item-1", "BAG", 0)],
		"relics": [],
		"shopItems": [
			{
				"offerId": "offer-1",
				"defId": "starter-1",
				"quality": "SILVER",
				"price": 7,
				"discount": 0.8,
				"def": {"name": "1点牙咬", "size": 1, "description": "造成 5 点伤害", "triggerDice": [1]},
			},
		],
		"choices": [],
		"classRewardChoices": [],
		"enchantChoices": [],
		"relicChoices": [],
		"upgradeChoices": [],
		"potionChoices": [],
		"mapState": {
			"nodes": [],
			"availableNodeIds": [],
			"completedNodeIds": [],
			"currentNodeId": "",
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
			"possibleRewards": [],
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
		"def": {"name": "1点牙咬", "size": 1, "description": "命中 1 点时造成伤害", "triggerDice": [1], "tags": ["伤害"]},
	}

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
