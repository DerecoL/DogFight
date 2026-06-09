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
	run_screen.set("leaderboard_data", _leaderboard_data())
	run_screen.set("ladder_data", _ladder_data())
	run_screen.set("current_tab", "排行")
	run_screen.call("_render_current_tab")
	await process_frame

	for node_name in [
		"LadderScreen",
		"LadderHeading",
		"LadderLayout",
		"CurrentTierPanel",
		"LadderProgress",
		"DogKingLeaderboardPanel",
		"LadderBoard",
		"LadderRow_1",
		"LadderRow_2",
		"LadderStart",
		"DogSelectScreen",
		"DogCardGrid",
		"DogDetailPanel",
		"StartLadderRunButton",
		"RecentSettlementsPanel",
		"RecentSettlementsBoard",
		"LadderSettlementLine_settle-1",
	]:
		_assert_has(run_screen, node_name)

	var layout = _find_by_name(run_screen, "LadderLayout")
	if not layout is GridContainer:
		_fail("LadderLayout must use a grid matching the Web two-panel layout")
		return
	if int((layout as GridContainer).columns) != 2:
		_fail("LadderLayout must keep two columns")
		return

	var text := _collect_text(run_screen)
	for part in ["天梯模式", "当前赛季", "当前段位", "犬王积分榜", "选择天梯狗狗", "最近结算", "开始天梯", "榜首狗", "我的狗", "+34"]:
		if not text.contains(part):
			_fail("Ladder Web text missing: %s" % part)
			return
	for raw in ["天梯排行榜", "#1", "#2"]:
		if text.contains(raw):
			_fail("Ladder Web text leaked non-Web label: %s" % raw)
			return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot ladder home Web structure smoke passed")
	quit(0)

func _leaderboard_data() -> Dictionary:
	return {
		"playerRank": 2,
		"playerProfile": {
			"tier": "DOG_KING",
			"tierLabel": "犬王",
			"score": 720,
			"gamesPlayed": 30,
			"totalWins": 21,
			"totalLosses": 9,
		},
		"leaderboard": [
			{"rank": 1, "title": "犬王", "name": "榜首狗", "profile": {"score": 880}},
			{"rank": 2, "title": "犬王", "name": "我的狗", "profile": {"score": 720}},
		],
	}

func _ladder_data() -> Dictionary:
	return {
		"season": {"name": "S1"},
		"profile": {
			"tier": "DOG_KING",
			"tierLabel": "犬王",
			"score": 720,
			"gamesPlayed": 30,
			"totalWins": 21,
			"totalLosses": 9,
		},
		"recentSettlements": [
			{"id": "settle-1", "wins": 12, "losses": 2, "beforeTier": "MASTER", "beforeScore": 486, "afterTier": "DOG_KING", "afterScore": 20, "delta": 34},
		],
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing ladder Web node: %s" % node_name)

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
