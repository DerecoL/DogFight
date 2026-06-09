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
	if run_screen.has_method("bind_session"):
		run_screen.bind_session(main)
	if not main.has_method("set_current_run"):
		_fail("Main session does not expose set_current_run")
		return

	main.call("set_current_run", _shop_run())
	run_screen.set("current_tab", "跑局")
	run_screen.set("selected_item_id", "equip-1")
	run_screen.set("selected_item_label", "1点牙咬  青铜")
	run_screen.call("_render_current_tab")
	await process_frame

	for node_name in [
		"InventoryBoard",
		"InventoryToolbar",
		"InventorySelectedLine",
		"EquipmentBoard",
		"EquipmentGridPanel",
		"EquipmentGridHeading",
		"EquipmentSlotGrid",
		"EquipmentSlot_EQUIPMENT_0_0",
		"EquipmentItem_equip-1",
		"BagRelicRow",
		"RelicRail",
		"RelicGridHeading",
		"RelicSlotGrid",
		"RelicSlot_0",
		"RelicIconButton_relic-gold",
		"RelicQualityDot_relic-gold",
		"RelicEmptyMark_1",
		"BagBoard",
		"BagGridPanel",
		"BagGridHeading",
		"BagSlotGrid",
		"BagSlot_BAG_1_0",
		"BagItem_bag-1",
	]:
		_assert_has(run_screen, node_name)

	var text := _collect_text(run_screen)
	for part in [
		"装备栏",
		"12 格单行，从左向右触发",
		"遗物",
		"6槽，重复获得升级",
		"背包",
		"12 格单行，战斗中默认不生效",
		"1点牙咬",
		"青铜",
		"双面金牌",
		"黄金",
		"空遗物槽 2",
	]:
		if not text.contains(part):
			_fail("Inventory Web detail text missing: %s" % part)
			return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot inventory board Web detail structure smoke passed")
	quit(0)

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing inventory Web detail node: %s" % node_name)

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

func _shop_run() -> Dictionary:
	return {
		"id": "inventory-web-detail-run",
		"mode": "CASUAL",
		"phase": "SHOP",
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"round": 3,
		"wins": 1,
		"losses": 0,
		"gold": 12,
		"refreshCost": 1,
		"shopType": "GENERAL",
		"items": [
			_item("equip-1", "starter-1", "EQUIPMENT", 0),
			_item("bag-1", "starter-1", "BAG", 1),
		],
		"relics": [
			{
				"id": "relic-gold",
				"relicId": "v3-two-sided-gold-tag",
				"slot": 0,
				"quality": "GOLD",
				"def": {"name": "双面金牌", "description": "商店折扣提高"},
			},
			{
				"id": "relic-growth",
				"relicId": "v3-growth-badge",
				"slot": 3,
				"quality": "SILVER",
				"def": {"name": "成长徽章", "description": "每回合成长"},
			},
		],
		"shopItems": [],
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

func _item(id: String, def_id: String, area: String, x: int) -> Dictionary:
	return {
		"id": id,
		"defId": def_id,
		"quality": "BRONZE",
		"area": area,
		"x": x,
		"y": 0,
		"def": {"name": "1点牙咬", "size": 1, "description": "命中 1 点时造成伤害", "triggerDice": [1]},
	}

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
