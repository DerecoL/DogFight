extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/BattleReplayScreen.tscn")
	if scene == null:
		_fail("BattleReplayScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame
	screen.start_replay(_battle())
	screen.call("_apply_event", _event())
	await process_frame

	for node_name in [
		"OpponentEquipmentRow",
		"OpponentBattleRowTitle",
		"OpponentBattleSlotGrid",
		"OpponentBattleSlot_0",
		"OpponentBattleItem_opponent-bite",
		"OpponentBattleItemIcon_opponent-bite",
		"OpponentBattleItemName_opponent-bite",
		"OpponentBattleItemInfo_opponent-bite",
		"OpponentBattleItemDice_opponent-bite",
		"OpponentBattleTriggerCount_opponent-bite",
		"OpponentBattleRelicRail",
		"OpponentBattleRelicSlotGrid",
		"OpponentBattleRelicSlot_0",
		"OpponentBattleRelicButton_relic-opponent",
		"PlayerEquipmentRow",
		"PlayerBattleRowTitle",
		"PlayerBattleSlotGrid",
		"PlayerBattleSlot_0",
		"PlayerBattleItem_player-bite",
		"PlayerBattleItemIcon_player-bite",
		"PlayerBattleItemName_player-bite",
		"PlayerBattleItemInfo_player-bite",
		"PlayerBattleItemDice_player-bite",
		"PlayerBattleTriggerCount_player-bite",
		"PlayerBattleRelicRail",
		"PlayerBattleRelicSlotGrid",
		"PlayerBattleRelicSlot_0",
		"PlayerBattleRelicButton_relic-player",
	]:
		_assert_has(screen, node_name)

	var text := _collect_text(screen)
	for part in [
		"你的装备栏",
		"对手装备栏",
		"1点牙咬",
		"青铜",
		"点数 1",
		"x1",
		"双面金牌",
		"成长徽章",
	]:
		if not text.contains(part):
			_fail("Battle equipment Web detail text missing: %s" % part)
			return

	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle equipment row Web detail structure smoke passed")
	quit(0)

func _battle() -> Dictionary:
	return {
		"id": "battle-equipment-web-detail",
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"winner": "player",
		"events": [_event()],
		"playerSnapshot": _snapshot("player-bite", "Hero", "SHIBA", "relic-player", "双面金牌", "GOLD"),
		"opponentSnapshot": _snapshot("opponent-bite", "Rival", "MUTT", "relic-opponent", "成长徽章", "SILVER"),
	}

func _event() -> Dictionary:
	return {
		"time": 1.0,
		"actor": "player",
		"kind": "ITEM",
		"text": "1点牙咬造成 5 点伤害",
		"effectType": "DAMAGE",
		"target": "opponent",
		"sourceHpDelta": 0,
		"targetHpDelta": -5,
		"roll": 1,
		"itemId": "player-bite",
		"playerHp": 100,
		"opponentHp": 95,
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
	}

func _snapshot(item_id: String, display_name: String, dog_type: String, relic_id: String, relic_name: String, quality: String) -> Dictionary:
	return {
		"name": display_name,
		"dogType": dog_type,
		"wins": 1,
		"losses": 0,
		"round": 2,
		"items": [
			{
				"id": item_id,
				"defId": "starter-1",
				"quality": "BRONZE",
				"area": "EQUIPMENT",
				"x": 0,
				"y": 0,
				"def": {"name": "1点牙咬", "size": 1, "width": 1, "description": "造成 5 点伤害", "triggerDice": [1]},
			},
		],
		"relics": [
			{
				"id": relic_id,
				"relicId": relic_id,
				"slot": 0,
				"quality": quality,
				"def": {"name": relic_name, "description": "战斗预览遗物"},
			},
		],
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing battle equipment Web detail node: %s" % node_name)

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
