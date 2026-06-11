extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/screens/RunSettlementScreen.tscn")
	if scene == null:
		_fail("RunSettlementScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame
	screen.call("set_payload", {"run": _settled_run()})
	await process_frame

	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("RunSettlementScreen must be standalone and must not redirect to LegacyRunScreen")
		return
	for node_name in [
		"SettlementPage",
		"SettlementScroll",
		"SettlementCard",
		"SettlementScoreGrid",
		"SettlementWins",
		"SettlementLosses",
		"SettlementScore",
		"BattleReviewDashboard",
		"BattleReviewSideGrid",
		"ReturnLobbyButton",
	]:
		_assert_has(screen, node_name)

	var score_grid = _find_by_name(screen, "SettlementScoreGrid")
	if not score_grid is GridContainer or int((score_grid as GridContainer).columns) != 3:
		_fail("SettlementScoreGrid must keep a stable three-column metric layout")
		return
	var battle_grid = _find_by_name(screen, "BattleReviewSideGrid")
	if not battle_grid is GridContainer or int((battle_grid as GridContainer).columns) != 2:
		_fail("BattleReviewSideGrid must keep player/opponent columns")
		return

	screen.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot casual forfeit settlement UI smoke passed")
	quit(0)

func _settled_run() -> Dictionary:
	return {
		"id": "settled-casual",
		"mode": "CASUAL",
		"phase": "COMPLETE",
		"status": "COMPLETE",
		"dogType": "SHIBA",
		"round": 4,
		"wins": 2,
		"losses": 1,
		"score": 160,
		"gold": 18,
		"items": [],
		"relics": [],
		"lastBattle": {
			"events": [
				{"type": "damage", "source": "player", "value": 14},
				{"type": "damage", "source": "opponent", "value": 9},
				{"type": "heal", "source": "player", "value": 3},
				{"type": "shield", "source": "opponent", "value": 4},
			],
			"playerSnapshot": {"name": "Player"},
			"opponentSnapshot": {"name": "Opponent"},
		},
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing settlement node: %s" % node_name)

func _find_by_name(node: Node, node_name: String) -> Node:
	if node.name == node_name:
		return node
	for child in node.get_children():
		var found := _find_by_name(child, node_name)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
