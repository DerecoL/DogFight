extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var screen_scene := load("res://scenes/screens/RunSettlementScreen.tscn")
	if screen_scene == null:
		_fail("RunSettlementScreen scene failed to load")
		return
	var screen = screen_scene.instantiate()
	root.add_child(screen)
	await process_frame
	screen.call("set_payload", {"run": _settled_run()})
	await process_frame

	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("RunSettlementScreen must render standalone UI instead of redirecting to playable shell")
		return

	for node_name in [
		"SettlementPage",
		"SettlementHideButton",
		"SettlementCard",
		"SettlementIcon",
		"SettlementTitle",
		"SettlementScoreGrid",
		"SettlementWins",
		"SettlementLosses",
		"SettlementScore",
		"LadderSettlementSummary",
		"BattleReviewDashboard",
		"BattleReviewSideGrid",
		"BattleReviewPlayer",
		"BattleReviewOpponent",
		"ReturnLobbyButton",
	]:
		_assert_has(screen, node_name)

	var text := _collect_text(screen)
	for part in ["跑局结束", "12", "2", "1202", "黄金 82", "铂金 16", "+34", "战斗数据看板", "返回大厅"]:
		if not text.contains(part):
			_fail("Settlement standalone text missing: %s" % part)
			return

	screen.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot run settlement standalone Web structure smoke passed")
	quit(0)

func _settled_run() -> Dictionary:
	return {
		"id": "settlement-standalone",
		"mode": "LADDER",
		"phase": "COMPLETE",
		"status": "COMPLETE",
		"dogType": "SHIBA",
		"round": 12,
		"wins": 12,
		"losses": 2,
		"gold": 18,
		"score": 1202,
		"items": [],
		"relics": [],
		"shopItems": [],
		"ladderSettlement": {
			"id": "settle-1",
			"beforeTier": "GOLD",
			"beforeScore": 82,
			"afterTier": "PLATINUM",
			"afterScore": 16,
			"baseScore": 42,
			"tierTax": 5,
			"lossPenalty": 3,
			"perfectBonus": 0,
			"newbieProtection": 0,
			"delta": 34,
			"wins": 12,
			"losses": 2,
		},
		"lastBattle": {
			"id": "battle-1",
			"winner": "player",
			"playerSnapshot": {"name": "玩家", "dogType": "SHIBA", "items": [], "relics": []},
			"opponentSnapshot": {"name": "对手", "dogType": "MUTT", "items": [], "relics": []},
			"events": [
				{"kind": "DAMAGE", "side": "player", "text": "我方造成 8 点伤害", "amount": 8},
				{"kind": "HEAL", "side": "player", "text": "我方治疗 2 点", "amount": 2},
				{"kind": "DAMAGE", "side": "opponent", "text": "对手造成 5 点伤害", "amount": 5},
			],
		},
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing settlement standalone Web node: %s" % node_name)

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
