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
	run_screen.set("current_tab", "跑局")

	main.call("set_current_run", _run_payload("CLASS_REWARD"))
	run_screen.call("_render_current_tab")
	await process_frame
	for node_name in [
		"RewardChoice_class-1",
		"RewardChoiceName_class-1",
		"RewardChoiceTag_class-1",
		"RewardChoiceMeta_class-1",
		"RewardChoiceCopy_class-1",
		"ChoiceSubmit",
	]:
		_assert_has(run_screen, node_name)
	var text := _collect_text(run_screen)
	for part in ["选择职业装备", "职业装备", "白银", "1格 · 1", "职业奖励"]:
		if not text.contains(part):
			_fail("Class reward Web detail text missing: %s" % part)
			return

	main.call("set_current_run", _run_payload("RELIC_CHOICE"))
	run_screen.call("_render_current_tab")
	await process_frame
	for node_name in [
		"RelicChoice_relic-1",
		"RelicGlyph_relic-1",
		"RelicChoiceName_relic-1",
		"RelicChoiceTag_relic-1",
		"RelicChoiceCopy_relic-1",
		"ChoiceSubmit",
	]:
		_assert_has(run_screen, node_name)
	text = _collect_text(run_screen)
	for part in ["选择遗物", "遗物", "黄金", "遗物奖励", "获得遗物"]:
		if not text.contains(part):
			_fail("Relic reward Web detail text missing: %s" % part)
			return

	main.call("set_current_run", _run_payload("UPGRADE_CHOICE"))
	run_screen.call("_render_current_tab")
	await process_frame
	for node_name in [
		"RewardChoice_upgrade",
		"RewardChoiceIcon_upgrade",
		"RewardChoiceName_upgrade",
		"RewardChoiceTag_upgrade",
		"RewardChoiceCopy_upgrade",
		"ChoiceSubmit",
	]:
		_assert_has(run_screen, node_name)
	text = _collect_text(run_screen)
	for part in ["选择升级装备", "黄金升级店", "可升级 2 件", "黄金及以上品质不能在本商店继续提升。", "放弃升级"]:
		if not text.contains(part):
			_fail("Upgrade reward Web detail text missing: %s" % part)
			return

	main.call("set_current_run", _run_payload("ENCHANT_CHOICE"))
	run_screen.call("_render_current_tab")
	await process_frame
	for node_name in [
		"RewardChoice_enchant-1",
		"RewardChoiceIcon_enchant-1",
		"RewardChoiceName_enchant-1",
		"RewardChoiceTag_enchant-1",
		"RewardChoiceCopy_enchant-1",
		"RewardDisabledReason",
	]:
		_assert_has(run_screen, node_name)
	text = _collect_text(run_screen)
	for part in ["选择附魔", "附魔", "免费", "附魔奖励", "当前选中：附魔"]:
		if not text.contains(part):
			_fail("Enchant reward Web detail text missing: %s" % part)
			return

	main.call("set_current_run", _run_payload("POTION_CHOICE"))
	run_screen.call("_render_current_tab")
	await process_frame
	for node_name in [
		"RewardChoice_potion-1",
		"RewardChoiceIcon_potion-1",
		"RewardChoiceName_potion-1",
		"RewardChoiceTag_potion-1",
		"RewardChoiceCopy_potion-1",
		"RewardDisabledReason",
	]:
		_assert_has(run_screen, node_name)
	text = _collect_text(run_screen)
	for part in ["选择药水", "药水奖励", "药水", "修改基础触发点数；之后仍会被遗物和其他道具影响。", "职业装备不可使用药水"]:
		if not text.contains(part):
			_fail("Potion reward Web detail text missing: %s" % part)
			return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot reward choice Web detail structure smoke passed")
	quit(0)

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing reward Web detail node: %s" % node_name)

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
		"id": "reward-detail-%s" % phase.to_lower(),
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
		"choices": [],
		"classRewardChoices": [_class_reward("class-1")],
		"relicChoices": [_relic_choice("relic-1")],
		"enchantChoices": [_enchant_choice("enchant-1")],
		"potionChoices": [_potion_choice("potion-1")],
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
