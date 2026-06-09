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
		"PlayableRunScreen",
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
		_assert_has(run_screen, node_name)

	var text := _collect_text(run_screen)
	for part in ["跑局结束", "12", "2", "1202", "+34", "返回大厅"]:
		if not text.contains(part):
			_fail("Settlement Web text missing: %s" % part)
			return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot main flow settlement Web structure smoke passed")
	quit(0)

func _settled_run() -> Dictionary:
	return {
		"id": "settlement-web",
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
			"delta": 34,
			"wins": 12,
			"losses": 2,
		},
		"lastBattle": {
			"id": "battle-1",
			"winner": "player",
			"events": [
				{"kind": "DAMAGE", "side": "player", "text": "我方造成 8 点伤害", "amount": 8},
				{"kind": "DAMAGE", "side": "opponent", "text": "对手造成 5 点伤害", "amount": 5},
			],
		},
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing settlement Web node: %s" % node_name)

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
