extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/screens/RewardChoiceScreen.tscn")
	if scene == null:
		_fail("RewardChoiceScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame

	if screen.has_method("set_payload"):
		screen.call("set_payload", {"run": _run_payload("CHOICE")})
	await process_frame
	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("RewardChoiceScreen must be standalone and must not redirect to LegacyRunScreen")
		return
	for node_name in [
		"ShopChoiceScreen",
		"ScreenHeading",
		"ChoiceGrid",
		"ChoiceCard_GENERAL",
		"ChoiceSubmit",
	]:
		_assert_has(screen, node_name)

	if screen.has_method("set_payload"):
		screen.call("set_payload", {"run": _run_payload("CLASS_REWARD")})
	await process_frame
	for node_name in [
		"RewardWorkbench",
		"ClassRewardSelect",
		"RewardPanel",
		"ScreenHeading",
		"RewardChoiceGrid",
		"RewardChoice_class-1",
		"ChoiceSubmit",
		"InventoryBoard",
		"EquipmentBoard",
		"RelicRail",
		"BagBoard",
	]:
		_assert_has(screen, node_name)

	if screen.has_method("set_payload"):
		screen.call("set_payload", {"run": _run_payload("RELIC_CHOICE")})
	await process_frame
	for node_name in [
		"RelicChoiceSelect",
		"RewardPanel",
		"ScreenHeading",
		"ChoiceGrid",
		"RelicChoiceGrid",
		"RelicChoice_relic-1",
		"ChoiceSubmit",
	]:
		_assert_has(screen, node_name)

	for phase in ["UPGRADE_CHOICE", "ENCHANT_CHOICE", "POTION_CHOICE"]:
		if screen.has_method("set_payload"):
			screen.call("set_payload", {"run": _run_payload(phase)})
		await process_frame
		for node_name in [
			"RewardWorkbench",
			"RewardPanel",
			"ScreenHeading",
			"RewardChoiceGrid",
			"InventoryBoard",
			"EquipmentBoard",
			"RelicRail",
			"BagBoard",
		]:
			_assert_has(screen, node_name)
		if phase == "UPGRADE_CHOICE":
			_assert_has(screen, "UpgradeWorkbench")
			_assert_has(screen, "UpgradePanel")
			_assert_has(screen, "ChoiceSubmit")
		elif phase == "ENCHANT_CHOICE":
			_assert_has(screen, "EnchantWorkbench")
			_assert_has(screen, "EnchantPanel")
			_assert_has(screen, "RewardChoice_enchant-1")
		elif phase == "POTION_CHOICE":
			_assert_has(screen, "PotionWorkbench")
			_assert_has(screen, "PotionPanel")
			_assert_has(screen, "RewardChoice_potion-1")

	var text := _collect_text(screen)
	for part in ["选择药水", "药水奖励", "职业装备", "1点牙咬", "背包"]:
		if not text.contains(part):
			_fail("Standalone reward choice Web text missing: %s" % part)
			return

	screen.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot standalone reward choice Web structure smoke passed")
	quit(0)

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing standalone reward choice Web node: %s" % node_name)

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

func _run_payload(phase: String) -> Dictionary:
	return {
		"id": "reward-choice-%s" % phase.to_lower(),
		"mode": "CASUAL",
		"phase": phase,
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"luckyNumber": 1,
		"round": 4,
		"wins": 2,
		"losses": 0,
		"gold": 12,
		"refreshCost": 1,
		"shopType": "UPGRADE_GOLD",
		"choices": ["GENERAL", "RELIC", "UPGRADE"],
		"classRewardChoices": [_class_reward("class-1"), _class_reward("class-2")],
		"relicChoices": [_relic_choice("relic-1"), _relic_choice("relic-2")],
		"enchantChoices": [_enchant_choice("enchant-1"), _enchant_choice("enchant-2")],
		"potionChoices": [_potion_choice("potion-1"), _potion_choice("potion-2")],
		"items": [_item("item-1", "EQUIPMENT", 0), _item("item-2", "BAG", 0)],
		"relics": [],
		"shopItems": [],
		"mapState": {
			"nodes": [],
			"availableNodeIds": [],
			"completedNodeIds": [],
			"currentNodeId": "",
		},
	}

func _class_reward(def_id: String) -> Dictionary:
	return {
		"defId": def_id,
		"quality": "SILVER",
		"def": {"name": "职业装备", "size": 1, "description": "职业奖励", "triggerDice": [1]},
	}

func _relic_choice(relic_id: String) -> Dictionary:
	return {
		"relicId": relic_id,
		"quality": "GOLD",
		"def": {"name": "遗物", "description": "遗物奖励", "tags": ["奖励"]},
	}

func _enchant_choice(id: String) -> Dictionary:
	return {
		"id": id,
		"description": "附魔奖励",
		"enchant": {"label": "附魔"},
	}

func _potion_choice(id: String) -> Dictionary:
	return {
		"id": id,
		"description": "药水奖励",
		"potion": {"label": "药水"},
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
