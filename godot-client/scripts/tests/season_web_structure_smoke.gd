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
	run_screen.set("ladder_data", {
		"season": {"id": "season-2", "name": "第二赛季", "startsAt": "2026-06-01", "endsAt": "2026-07-01"},
		"profile": {"tier": "DIAMOND", "tierLabel": "钻石", "score": 220, "wins": 8, "losses": 4},
		"recentSettlements": [
			{"beforeTier": "GOLD", "afterTier": "DIAMOND", "delta": 42},
		],
	})
	run_screen.set("history_data", {
		"seasonSummaries": [
			{
				"id": "season-1-summary",
				"seasonName": "第一赛季",
				"ladderTierLabel": "大师",
				"ladderScore": 520,
				"dogKingRank": 6,
				"apexRank": 0,
				"apexSnapshot": {},
			},
			{
				"id": "season-0-summary",
				"seasonName": "测试赛季",
				"ladderTierLabel": "黄金",
				"ladderScore": 80,
				"dogKingRank": 0,
				"apexRank": 12,
				"apexWins": 10,
				"apexLosses": 2,
				"apexSnapshot": {"id": "apex-snapshot", "name": "巅峰狗", "dogType": "SHIBA", "wins": 10, "losses": 2, "round": 15, "rank": 12, "challengeWins": 4, "items": [], "relics": []},
			},
		],
	})
	run_screen.set("current_tab", "赛季")
	run_screen.call("_render_current_tab")
	await process_frame

	for node_name in [
		"SeasonScreen",
		"CurrentSeasonPanel",
		"SeasonSettlementList",
		"SeasonSettlement_GOLD_DIAMOND",
		"SeasonHistoryList",
		"SeasonHistoryHeading",
		"SeasonHistoryCard_season-1-summary",
		"SeasonHistoryCard_season-0-summary",
		"SeasonSnapshotAction_season-0-summary",
	]:
		_assert_has(run_screen, node_name)

	var text := _collect_text(run_screen)
	for part in ["当前赛季", "第二赛季", "2026-06-01 - 2026-07-01", "我的天梯", "钻石", "220 分", "胜负 8/4", "结算 黄金 -> 钻石  +42", "赛季历史", "2 个已结束赛季", "第一赛季", "天梯 大师 · 520 分 · 犬王第 6 名", "巅峰未入榜", "测试赛季", "天梯 黄金 · 80 分", "巅峰第 12 名 · 10胜2败", "巅峰配置快照"]:
		if not text.contains(part):
			_fail("Season Web text missing: %s" % part)
			return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot season Web structure smoke passed")
	quit(0)

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing season Web node: %s" % node_name)

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
