extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/screens/RewardChoiceScreen.tscn")
	if scene == null:
		_fail("RewardChoiceScreen scene failed to load")
		return
	var screen = scene.instantiate()
	var fake_session := FakeSession.new()
	root.add_child(fake_session)
	root.add_child(screen)
	await process_frame
	if screen.has_method("bind_session"):
		screen.call("bind_session", fake_session)

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
		"ChoiceCard_RELIC",
		"ChoiceSubmit",
	]:
		_assert_has(screen, node_name)
	var relic_shop_card := _find_by_name(screen, "ChoiceCard_RELIC") as Button
	if relic_shop_card == null:
		_fail("Shop choice RELIC card is missing")
		return
	relic_shop_card.pressed.emit()
	await process_frame
	if fake_session.shop_type != "":
		_fail("Shop choice card click should only select locally, not call select_shop_choice")
		return
	var shop_submit := _find_by_name(screen, "ChoiceSubmit") as Button
	if shop_submit == null:
		_fail("Shop choice submit button is missing")
		return
	shop_submit.pressed.emit()
	await process_frame
	await process_frame
	if fake_session.shop_type != "RELIC":
		_fail("Shop choice submit should call select_shop_choice(RELIC), got %s" % fake_session.shop_type)
		return

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
		"BagRelicRow",
		"RelicRail",
		"BagBoard",
	]:
		_assert_has(screen, node_name)
	var class_card := _find_by_name(screen, "RewardChoice_class-2") as Button
	if class_card == null:
		_fail("Class reward second choice card is missing")
		return
	class_card.pressed.emit()
	await process_frame
	if fake_session.class_reward_id != "":
		_fail("Class reward card click should only select locally, not call select_class_reward")
		return
	var class_submit := _find_by_name(screen, "ChoiceSubmit") as Button
	if class_submit == null:
		_fail("Class reward submit button is missing")
		return
	class_submit.pressed.emit()
	await process_frame
	await process_frame
	if fake_session.class_reward_id != "class-2":
		_fail("Class reward submit should call select_class_reward(class-2), got %s" % fake_session.class_reward_id)
		return

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
	var relic_card := _find_by_name(screen, "RelicChoice_relic-2") as Button
	if relic_card == null:
		_fail("Relic second choice card is missing")
		return
	relic_card.pressed.emit()
	await process_frame
	if fake_session.relic_id != "":
		_fail("Relic choice card click should only select locally, not call select_relic")
		return
	var relic_submit := _find_by_name(screen, "ChoiceSubmit") as Button
	if relic_submit == null:
		_fail("Relic choice submit button is missing")
		return
	relic_submit.pressed.emit()
	await process_frame
	await process_frame
	if fake_session.relic_id != "relic-2":
		_fail("Relic choice submit should call select_relic(relic-2), got %s" % fake_session.relic_id)
		return

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
			"BagRelicRow",
			"RelicRail",
			"BagBoard",
		]:
			_assert_has(screen, node_name)
		if phase == "UPGRADE_CHOICE":
			_assert_has(screen, "UpgradeWorkbench")
			_assert_has(screen, "UpgradePanel")
			_assert_has(screen, "RewardChoiceIcon_upgrade")
			_assert_has(screen, "RewardChoiceName_upgrade")
			_assert_has(screen, "RewardChoiceTag_upgrade")
			_assert_has(screen, "RewardChoiceCopy_upgrade")
			_assert_has(screen, "ChoiceSubmit")
			var item_button := _find_by_name(screen, "EquipmentBoardItem_item-1") as Button
			if item_button == null:
				_fail("Upgrade reward inventory item button is missing")
				return
			item_button.pressed.emit()
			await process_frame
			if fake_session.upgrade_item_id != "":
				_fail("Upgrade reward item click should inspect first instead of immediately applying")
				return
			for tip_node in [
				"FloatingTip",
				"RewardItemTip",
				"RewardItemTipTags",
				"RewardItemTipIdentity",
				"RewardItemTipSizePreview",
				"RewardItemTipDice",
				"RewardItemTipDescription",
				"RewardItemTipActions",
				"ApplyRewardItemButton",
				"CloseRewardItemTipButton",
			]:
				_assert_has(screen, tip_node)
			var apply_button := _find_by_name(screen, "ApplyRewardItemButton") as Button
			if apply_button == null or apply_button.disabled:
				_fail("Upgrade reward selected item tip should expose an enabled apply button")
				return
			apply_button.pressed.emit()
			await process_frame
			await process_frame
			if fake_session.upgrade_item_id != "item-1":
				_fail("Upgrade reward apply button must call select_upgrade_item(item-1)")
				return
			var relic_button := _find_by_name(screen, "RelicSlot_0") as Button
			if relic_button == null:
				_fail("Upgrade reward relic slot button is missing")
				return
			relic_button.pressed.emit()
			await process_frame
			for relic_tip_node in [
				"FloatingTip",
				"RewardRelicTip",
				"RewardRelicTipTags",
				"RewardRelicTipIdentity",
				"RewardRelicTipDescription",
				"RewardRelicTipActions",
				"CloseRewardRelicTipButton",
			]:
				_assert_has(screen, relic_tip_node)
			var relic_tip_text := _collect_text(screen)
			for relic_tip_part in ["reward-owned-relic", "REWARD_RELIC", "reward-tag"]:
				if not relic_tip_text.contains(relic_tip_part):
					_fail("Reward relic tip text missing: %s" % relic_tip_part)
					return
			var close_relic_tip := _find_by_name(screen, "CloseRewardRelicTipButton") as Button
			if close_relic_tip == null:
				_fail("Reward relic tip close button is missing")
				return
			close_relic_tip.pressed.emit()
			await process_frame
			if _find_by_name(screen, "FloatingTip") != null:
				_fail("Reward relic tip should close from its close button")
				return
		elif phase == "ENCHANT_CHOICE":
			_assert_has(screen, "EnchantWorkbench")
			_assert_has(screen, "EnchantPanel")
			_assert_has(screen, "RewardChoice_enchant-1")
			_assert_has(screen, "RewardChoiceIcon_enchant-1")
			_assert_has(screen, "RewardChoiceName_enchant-1")
			_assert_has(screen, "RewardChoiceTag_enchant-1")
			_assert_has(screen, "RewardChoiceCopy_enchant-1")
			_assert_has(screen, "RewardDisabledReason")
		elif phase == "POTION_CHOICE":
			_assert_has(screen, "PotionWorkbench")
			_assert_has(screen, "PotionPanel")
			_assert_has(screen, "RewardChoice_potion-1")
			_assert_has(screen, "RewardChoiceIcon_potion-1")
			_assert_has(screen, "RewardChoiceName_potion-1")
			_assert_has(screen, "RewardChoiceTag_potion-1")
			_assert_has(screen, "RewardChoiceCopy_potion-1")
			_assert_has(screen, "RewardDisabledReason")
		var bag_relic_row = _find_by_name(screen, "BagRelicRow")
		if not bag_relic_row is HBoxContainer:
			_fail("%s BagRelicRow must lay out relic rail and bag board side by side like Web InventoryBoard" % phase)
			return

	var text := _collect_text(screen)
	for part in ["选择药水", "药水奖励", "职业装备", "1点牙咬", "背包"]:
		if not text.contains(part):
			_fail("Standalone reward choice Web text missing: %s" % part)
			return

	screen.queue_free()
	fake_session.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot standalone reward choice Web structure smoke passed")
	quit(0)

class FakeSession:
	extends Node
	var shop_type := ""
	var class_reward_id := ""
	var relic_id := ""
	var upgrade_item_id := ""

	func select_shop_choice(next_shop_type: String) -> bool:
		shop_type = next_shop_type
		return true

	func select_class_reward(def_id: String) -> bool:
		class_reward_id = def_id
		return true

	func select_relic(next_relic_id: String) -> bool:
		relic_id = next_relic_id
		return true

	func select_upgrade_item(item_id: String) -> bool:
		upgrade_item_id = item_id
		return true

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
		"relics": [_owned_relic("owned-relic-1")],
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

func _owned_relic(id: String) -> Dictionary:
	return {
		"id": id,
		"relicId": "reward-owned-relic",
		"quality": "GOLD",
		"slot": 0,
		"def": {"name": "reward-owned-relic", "description": "REWARD_RELIC", "effect": "REWARD_RELIC", "tags": ["reward-tag"]},
	}

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
