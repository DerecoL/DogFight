extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/screens/ExplorationMapScreen.tscn")
	if scene == null:
		_fail("ExplorationMapScreen scene failed to load")
		return
	var screen = scene.instantiate()
	var fake_session := FakeSession.new()
	root.add_child(fake_session)
	root.add_child(screen)
	await process_frame
	if screen.has_method("bind_session"):
		screen.call("bind_session", fake_session)
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
		"MapDrawingTool_inspect",
		"MapDrawingTool_brush",
		"MapDrawingTool_eraser",
		"MapDrawingTool_clear",
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
		"EquipmentGridPanel",
		"BagRelicRow",
		"RelicRail",
		"BagGridPanel",
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
	var inspect_tool := _find_by_name(screen, "MapDrawingTool_inspect") as Button
	var brush_tool := _find_by_name(screen, "MapDrawingTool_brush") as Button
	var eraser_tool := _find_by_name(screen, "MapDrawingTool_eraser") as Button
	var clear_tool := _find_by_name(screen, "MapDrawingTool_clear") as Button
	if inspect_tool == null or brush_tool == null or eraser_tool == null or clear_tool == null:
		_fail("Map drawing toolbar must expose Web tool buttons by stable names")
		return
	if not inspect_tool.button_pressed or brush_tool.button_pressed or eraser_tool.button_pressed:
		_fail("Map drawing toolbar should default to inspect mode like Web")
		return
	if not clear_tool.disabled:
		_fail("Map clear draft tool should be disabled while no draft exists")
		return
	brush_tool.pressed.emit()
	await process_frame
	brush_tool = _find_by_name(screen, "MapDrawingTool_brush") as Button
	inspect_tool = _find_by_name(screen, "MapDrawingTool_inspect") as Button
	if brush_tool == null or inspect_tool == null or not brush_tool.button_pressed or inspect_tool.button_pressed:
		_fail("Map drawing toolbar brush button must switch active tool")
		return
	eraser_tool = _find_by_name(screen, "MapDrawingTool_eraser") as Button
	eraser_tool.pressed.emit()
	await process_frame
	eraser_tool = _find_by_name(screen, "MapDrawingTool_eraser") as Button
	brush_tool = _find_by_name(screen, "MapDrawingTool_brush") as Button
	if eraser_tool == null or brush_tool == null or not eraser_tool.button_pressed or brush_tool.button_pressed:
		_fail("Map drawing toolbar eraser button must switch active tool")
		return
	for node_id in ["start-1", "monster-1"]:
		var node_button := _find_by_name(screen, "MapNodeButton_%s" % node_id) as Button
		if node_button == null:
			_fail("Exploration map route is missing node button %s" % node_id)
			return
		for child_name in [
			"MapNodeSticker_%s" % node_id,
			"MapNodeIcon_%s" % node_id,
			"MapNodeTitle_%s" % node_id,
		]:
			if node_button.find_child(child_name, true, false) == null:
				_fail("MapNodeButton should mirror Web map-node child: %s" % child_name)
				return
		var icon := node_button.find_child("MapNodeIcon_%s" % node_id, true, false) as TextureRect
		if icon == null or icon.texture == null:
			_fail("MapNodeButton must render map icon texture for %s" % node_id)
			return
	var available_node_button := _find_by_name(screen, "MapNodeButton_start-1") as Button
	if available_node_button == null:
		_fail("Available map node button is missing")
		return
	available_node_button.pressed.emit()
	await process_frame
	if fake_session.selected_node_id != "":
		_fail("Map node click should inspect/select the detail panel before entering")
		return
	var enter_button := _find_by_name(screen, "MapEnterActionButton") as Button
	if enter_button == null or enter_button.disabled:
		_fail("Selected available map node should expose a Web-style enter action button")
		return
	enter_button.pressed.emit()
	await process_frame
	if fake_session.selected_node_id != "start-1":
		_fail("MapEnterActionButton must call select_map_node(start-1)")
		return
	var current_node_button := _find_by_name(screen, "MapNodeButton_monster-1") as Button
	if current_node_button == null:
		_fail("Current map node button is missing after entering available node")
		return
	current_node_button.pressed.emit()
	await process_frame
	var monster_equipment_button := _find_by_name(screen, "MapMonsterEquipmentButton_monster-item") as Button
	if monster_equipment_button == null or monster_equipment_button.disabled:
		_fail("Map monster equipment button should be clickable like Web monster equipment preview")
		return
	monster_equipment_button.pressed.emit()
	await process_frame
	for monster_tip_node in [
		"MapMonsterEquipmentPreviewModal",
		"MapMonsterEquipmentSheet",
		"MapMonsterEquipmentHeader",
		"MapMonsterEquipmentPreview",
		"FloatingTip",
		"MapMonsterItemTip",
		"MapMonsterItemTipTags",
		"MapMonsterItemTipIdentity",
		"MapMonsterItemTipSizePreview",
		"MapMonsterItemTipDice",
		"MapMonsterItemTipDescription",
		"CloseMapMonsterItemTipButton",
	]:
		_assert_has(screen, monster_tip_node)
	var close_monster_tip := _find_by_name(screen, "CloseMapMonsterItemTipButton") as Button
	if close_monster_tip == null:
		_fail("Map monster equipment tip close button is missing")
		return
	close_monster_tip.pressed.emit()
	await process_frame
	if _find_by_name(screen, "MapMonsterEquipmentPreviewModal") != null:
		_fail("Map monster equipment preview should close from its close button")
		return
	var reward_preview_button := _find_by_name(screen, "MapRewardPreview_starter-1") as Button
	if reward_preview_button == null:
		_fail("Map reward preview button is missing")
		return
	reward_preview_button.pressed.emit()
	await process_frame
	for reward_tip_node in [
		"FloatingTip",
		"MapRewardTip",
		"MapRewardTipTags",
		"MapRewardTipIdentity",
		"MapRewardTipSizePreview",
		"MapRewardTipDice",
		"MapRewardTipDescription",
		"MapRewardTipPrice",
		"CloseMapRewardTipButton",
	]:
		_assert_has(screen, reward_tip_node)
	var close_reward_tip := _find_by_name(screen, "CloseMapRewardTipButton") as Button
	if close_reward_tip == null:
		_fail("Map reward preview FloatingTip close button is missing")
		return
	close_reward_tip.pressed.emit()
	await process_frame
	if _find_by_name(screen, "FloatingTip") != null:
		_fail("Map reward preview FloatingTip should close from its close button")
		return
	var bag_relic_row = _find_by_name(screen, "BagRelicRow")
	if not bag_relic_row is HBoxContainer:
		_fail("ExplorationMap BagRelicRow must lay out relic rail and bag grid side by side like Web InventoryBoard")
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
	var item_button := _find_by_name(screen, "EquipmentGridPanelItem_item-1") as Button
	if item_button == null:
		_fail("MAP equipment item button is missing")
		return
	item_button.pressed.emit()
	await process_frame
	if fake_session.upgrade_item_id != "":
		_fail("MAP equipment click should inspect first instead of immediately upgrading")
		return
	for tip_node in [
		"FloatingTip",
		"MapItemTip",
		"MapItemTipTags",
		"MapItemTipIdentity",
		"MapItemTipSizePreview",
		"MapItemTipDice",
		"MapItemTipDescription",
		"MapItemTipActions",
		"UpgradeItemButton",
		"CloseItemTipButton",
	]:
		_assert_has(screen, tip_node)
	var upgrade_button := _find_by_name(screen, "UpgradeItemButton") as Button
	if upgrade_button == null or upgrade_button.disabled:
		_fail("MAP selected item tip should expose an enabled upgrade button")
		return
	upgrade_button.pressed.emit()
	await process_frame
	await process_frame
	if fake_session.upgrade_item_id != "item-1":
		_fail("MAP upgrade button must call upgrade_item(item-1)")
		return
	var relic_button := _find_by_name(screen, "RelicSlot_0") as Button
	if relic_button == null:
		_fail("MAP relic slot button is missing")
		return
	relic_button.pressed.emit()
	await process_frame
	for relic_tip_node in [
		"FloatingTip",
		"MapRelicTip",
		"MapRelicTipTags",
		"MapRelicTipIdentity",
		"MapRelicTipDescription",
		"MapRelicTipActions",
		"CloseMapRelicTipButton",
	]:
		_assert_has(screen, relic_tip_node)
	var relic_tip_text := _collect_text(screen)
	for relic_tip_part in ["map-owned-relic", "MAP_RELIC", "map-tag"]:
		if not relic_tip_text.contains(relic_tip_part):
			_fail("Map relic tip text missing: %s" % relic_tip_part)
			return
	var close_relic_tip := _find_by_name(screen, "CloseMapRelicTipButton") as Button
	if close_relic_tip == null:
		_fail("Map relic tip close button is missing")
		return
	close_relic_tip.pressed.emit()
	await process_frame
	if _find_by_name(screen, "FloatingTip") != null:
		_fail("Map relic tip should close from its close button")
		return

	if screen.has_method("set_payload"):
		screen.call("set_payload", {"run": _map_run(false)})
	await process_frame
	if _find_by_name(screen, "MapRewardInventory") != null:
		_fail("MapRewardInventory should only render when pending reward exists, matching Web")
		return

	screen.queue_free()
	fake_session.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot standalone exploration map Web structure smoke passed")
	quit(0)

class FakeSession:
	extends Node
	var upgrade_item_id := ""
	var selected_node_id := ""

	func upgrade_item(item_id: String) -> bool:
		upgrade_item_id = item_id
		return true

	func select_map_node(node_id: String) -> bool:
		selected_node_id = node_id
		return true

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
		"items": [_item("item-1", "EQUIPMENT", 0), _item("item-2", "BAG", 1)],
		"relics": [_relic("map-relic-1")],
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
			"equipment": [_item("monster-item", "EQUIPMENT", 0)],
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

func _relic(id: String) -> Dictionary:
	return {
		"id": id,
		"relicId": "map-owned-relic",
		"quality": "GOLD",
		"slot": 0,
		"def": {"name": "map-owned-relic", "description": "MAP_RELIC", "effect": "MAP_RELIC", "tags": ["map-tag"]},
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
