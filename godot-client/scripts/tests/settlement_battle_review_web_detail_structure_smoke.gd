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

	main.call("set_current_run", _settled_run())
	run_screen.call("show_run_phase")
	await process_frame

	for node_name in [
		"BattleReviewDashboard",
		"BattleReviewHeading",
		"BattleReviewSystemDamageTag",
		"BattleReviewSideGrid",
		"BattleReviewPlayer",
		"BattleReviewPlayerHeader",
		"BattleReviewPlayerMetrics",
		"BattleReviewPlayerMetricDamage",
		"BattleReviewPlayerMetricHealing",
		"BattleReviewPlayerMetricShield",
		"BattleReviewPlayerMetricPoison",
		"BattleReviewPlayerMetricStatuses",
		"BattleReviewPlayerTopItem",
		"BattleReviewOpponent",
		"BattleReviewOpponentHeader",
		"BattleReviewOpponentMetrics",
		"BattleReviewOpponentMetricDamage",
		"BattleReviewOpponentMetricHealing",
		"BattleReviewOpponentMetricShield",
		"BattleReviewOpponentMetricPoison",
		"BattleReviewOpponentMetricStatuses",
		"BattleReviewOpponentTopItem",
	]:
		_assert_has(run_screen, node_name)

	var text := _collect_text(run_screen)
	for part in [
		"战斗数据看板",
		"系统伤害 5",
		"我方",
		"Hero",
		"总伤害 8",
		"治疗 3",
		"护盾 4",
		"毒伤 3",
		"状态 1",
		"最高贡献",
		"1点牙咬 · 15",
		"对手",
		"Rival",
		"总伤害 5",
		"反击爪 · 5",
	]:
		if not text.contains(part):
			_fail("Settlement battle review Web detail text missing: %s" % part)
			return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot settlement battle review Web detail structure smoke passed")
	quit(0)

func _settled_run() -> Dictionary:
	return {
		"id": "settlement-review-web-detail",
		"mode": "CASUAL",
		"phase": "COMPLETE",
		"status": "COMPLETE",
		"dogType": "SHIBA",
		"round": 8,
		"wins": 8,
		"losses": 1,
		"gold": 18,
		"score": 880,
		"items": [],
		"relics": [],
		"shopItems": [],
		"lastBattle": {
			"id": "battle-review-detail",
			"winner": "player",
			"playerSnapshot": {
				"name": "Hero",
				"items": [_item("player-bite", "1点牙咬")],
			},
			"opponentSnapshot": {
				"name": "Rival",
				"items": [_item("opponent-claw", "反击爪")],
			},
			"events": [
				{"actor": "player", "kind": "ITEM", "effectType": "DAMAGE", "target": "opponent", "sourceHpDelta": 0, "targetHpDelta": -8, "itemId": "player-bite", "text": "1点牙咬造成 8 点伤害"},
				{"actor": "player", "kind": "ITEM", "effectType": "HEAL", "target": "player", "sourceHpDelta": 3, "targetHpDelta": 0, "itemId": "player-bite", "text": "1点牙咬治疗 3 点"},
				{"actor": "player", "kind": "ITEM", "effectType": "UTILITY", "amount": 4, "statusChanged": ["shield"], "itemId": "player-bite", "text": "1点牙咬获得 4 点护盾"},
				{"actor": "player", "kind": "ITEM", "effectType": "POISON", "statusChanged": ["poison"], "itemId": "player-bite", "text": "1点牙咬施加中毒"},
				{"actor": "system", "kind": "POISON", "target": "opponent", "sourceHpDelta": 0, "targetHpDelta": -3, "text": "中毒造成 3 点伤害"},
				{"actor": "system", "kind": "POISON", "target": "both", "sourceHpDelta": -2, "targetHpDelta": -3, "text": "环境造成系统伤害"},
				{"actor": "opponent", "kind": "ITEM", "effectType": "DAMAGE", "target": "player", "sourceHpDelta": 0, "targetHpDelta": -5, "itemId": "opponent-claw", "text": "反击爪造成 5 点伤害"},
			],
		},
	}

func _item(id: String, name: String) -> Dictionary:
	return {
		"id": id,
		"defId": id,
		"quality": "BRONZE",
		"area": "EQUIPMENT",
		"x": 0,
		"y": 0,
		"def": {"name": name},
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing settlement battle review Web detail node: %s" % node_name)

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
