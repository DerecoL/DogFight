extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/screens/RunShellScreen.tscn")
	if scene == null:
		_fail("RunShellScreen scene failed to load")
		return
	var screen = scene.instantiate()
	var fake_session := FakeSession.new()
	root.add_child(fake_session)
	root.add_child(screen)
	await process_frame
	if screen.has_method("bind_session"):
		screen.call("bind_session", fake_session)

	if screen.has_method("set_payload"):
		screen.call("set_payload", {"run": _run_payload("PREP")})
	await process_frame
	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("RunShellScreen must be standalone for PREP/MATCH and must not redirect to LegacyRunScreen")
		return
	for node_name in [
		"RunShellScreen",
		"MatchPanel",
		"MatchPanelHeading",
		"InventoryBoard",
		"EquipmentBoard",
		"EquipmentBoardItems",
		"EquipmentBoardSlot_equip-1",
		"EquipmentBoardItemArt_equip-1",
		"EquipmentBoardItemName_equip-1",
		"BagRelicRow",
		"RelicRail",
		"RelicSlot_0Name",
		"BagBoard",
		"BagBoardItems",
		"BagBoardSlot_bag-1",
		"BagBoardItemArt_bag-1",
		"BagBoardItemName_bag-1",
		"MatchActionButton",
	]:
		_assert_has(screen, node_name)
	for texture_node_name in ["EquipmentBoardItemArt_equip-1", "BagBoardItemArt_bag-1"]:
		var texture_rect := _find_by_name(screen, texture_node_name) as TextureRect
		if texture_rect == null or texture_rect.texture == null:
			_fail("PREP inventory item must render Web item art texture: %s" % texture_node_name)
			return
	var prep_text := _collect_text(screen)
	for part in ["整备阶段", "整理装备与遗物后再匹配对手。", "匹配对手", "1点牙咬", "背包"]:
		if not prep_text.contains(part):
			_fail("Standalone PREP run shell text missing: %s" % part)
			return
	var item_button := _find_by_name(screen, "EquipmentBoardItem_equip-1") as Button
	if item_button == null:
		_fail("PREP equipment item button is missing")
		return
	item_button.pressed.emit()
	await process_frame
	if fake_session.upgrade_item_id != "":
		_fail("PREP equipment click should inspect first instead of immediately upgrading")
		return
	for tip_node in [
		"FloatingTip",
		"RunShellItemTip",
		"RunShellItemTipTags",
		"RunShellItemTipIdentity",
		"RunShellItemTipSizePreview",
		"RunShellItemTipDice",
		"RunShellItemTipDescription",
		"RunShellItemTipActions",
		"UpgradeItemButton",
		"CloseItemTipButton",
	]:
		_assert_has(screen, tip_node)
	var upgrade_button := _find_by_name(screen, "UpgradeItemButton") as Button
	if upgrade_button == null or upgrade_button.disabled:
		_fail("PREP selected item tip should expose an enabled upgrade button")
		return
	upgrade_button.pressed.emit()
	await process_frame
	await process_frame
	if fake_session.upgrade_item_id != "equip-1":
		_fail("PREP upgrade button must call upgrade_item(equip-1)")
		return
	var relic_button := _find_by_name(screen, "RelicSlot_0") as Button
	if relic_button == null:
		_fail("PREP relic slot button is missing")
		return
	relic_button.pressed.emit()
	await process_frame
	for relic_tip_node in [
		"FloatingTip",
		"RunShellRelicTip",
		"RunShellRelicTipTags",
		"RunShellRelicTipIdentity",
		"RunShellRelicTipDescription",
		"RunShellRelicTipActions",
		"CloseRunShellRelicTipButton",
	]:
		_assert_has(screen, relic_tip_node)
	var relic_tip_text := _collect_text(screen)
	for relic_tip_part in ["training-relic", "PREP_RELIC", "prep-tag"]:
		if not relic_tip_text.contains(relic_tip_part):
			_fail("PREP relic tip text missing: %s" % relic_tip_part)
			return
	var close_relic_tip_button := _find_by_name(screen, "CloseRunShellRelicTipButton") as Button
	if close_relic_tip_button == null:
		_fail("CloseRunShellRelicTipButton is missing")
		return
	close_relic_tip_button.pressed.emit()
	await process_frame
	if _find_by_name(screen, "FloatingTip") != null:
		_fail("CloseRunShellRelicTipButton must close the PREP relic tip")
		return

	if screen.has_method("set_payload"):
		screen.call("set_payload", {"run": _run_payload("MATCH")})
	await process_frame
	for node_name in [
		"RunShellScreen",
		"MatchPanel",
		"MatchedDogBadge",
		"MatchedDogTitle",
		"MatchedDogMeta",
		"InventoryBoard",
		"EquipmentBoard",
		"BagRelicRow",
		"RelicRail",
		"BagBoard",
		"BattleStartButton",
	]:
		_assert_has(screen, node_name)
	var match_text := _collect_text(screen)
	for part in ["匹配到 训练对手", "柴犬 · 2胜 1败 · 第 4 回合", "开始战斗"]:
		if not match_text.contains(part):
			_fail("Standalone MATCH run shell text missing: %s" % part)
			return

	screen.queue_free()
	fake_session.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot standalone PREP/MATCH run shell Web structure smoke passed")
	quit(0)

class FakeSession:
	extends Node
	var upgrade_item_id := ""

	func upgrade_item(item_id: String) -> bool:
		upgrade_item_id = item_id
		return true

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing standalone PREP/MATCH Web node: %s" % node_name)

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
		"id": "prep-match-%s" % phase.to_lower(),
		"mode": "CASUAL",
		"phase": phase,
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"round": 4,
		"wins": 2,
		"losses": 0,
		"gold": 9,
		"items": [_item("equip-1", "EQUIPMENT", 0), _item("bag-1", "BAG", 1)],
		"relics": [_relic("relic-1")],
		"shopItems": [],
		"choices": [],
		"classRewardChoices": [],
		"enchantChoices": [],
		"relicChoices": [],
		"upgradeChoices": [],
		"potionChoices": [],
		"matchedGhost": {
			"name": "训练对手",
			"dogType": "SHIBA",
			"wins": 2,
			"losses": 1,
			"round": 4,
		},
		"mapState": {
			"nodes": [],
			"availableNodeIds": [],
			"completedNodeIds": [],
			"currentNodeId": "",
		},
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

func _relic(id: String) -> Dictionary:
	return {
		"id": id,
		"relicId": "training-relic",
		"quality": "SILVER",
		"slot": 0,
		"def": {"name": "training-relic", "description": "PREP_RELIC", "effect": "PREP_RELIC", "tags": ["prep-tag"]},
	}

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
