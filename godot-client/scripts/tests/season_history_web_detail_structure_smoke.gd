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
		"recentSettlements": [],
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

	_assert_label_text(run_screen, "SeasonHistoryTitle", "赛季历史")
	_assert_label_text(run_screen, "SeasonHistorySubtitle", "2 个已结束赛季")
	_assert_history_card(run_screen, "season-1-summary", "第一赛季", "天梯 大师 · 520 分 · 犬王第 6 名", "巅峰未入榜", false)
	_assert_history_card(run_screen, "season-0-summary", "测试赛季", "天梯 黄金 · 80 分", "巅峰第 12 名 · 10胜2败", true)

	run_screen.set("history_data", {"seasonSummaries": []})
	run_screen.call("_render_current_tab")
	await process_frame
	_assert_label_text(run_screen, "SeasonHistoryTitle", "赛季历史")
	_assert_label_text(run_screen, "SeasonHistorySubtitle", "赛季结束后会保存在这里")
	_assert_label_text(run_screen, "SeasonHistoryEmpty", "暂无赛季历史")

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot season history Web detail structure smoke passed")
	quit(0)

func _assert_history_card(root_node: Node, summary_id: String, expected_name: String, expected_ladder: String, expected_apex: String, expected_snapshot: bool) -> void:
	_assert_has(root_node, "SeasonHistoryCard_%s" % summary_id)
	_assert_has(root_node, "SeasonHistoryCardRow_%s" % summary_id)
	_assert_has(root_node, "SeasonHistoryCardText_%s" % summary_id)
	_assert_label_text(root_node, "SeasonHistoryName_%s" % summary_id, expected_name)
	_assert_label_text(root_node, "SeasonHistoryLadder_%s" % summary_id, expected_ladder)
	_assert_label_text(root_node, "SeasonHistoryApex_%s" % summary_id, expected_apex)
	var snapshot = _find_by_name(root_node, "SeasonSnapshotAction_%s" % summary_id)
	if expected_snapshot and not snapshot is Button:
		_fail("Missing season snapshot action: %s" % summary_id)
	if not expected_snapshot and snapshot != null:
		_fail("Unexpected season snapshot action: %s" % summary_id)

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing season history Web detail node: %s" % node_name)

func _assert_label_text(root_node: Node, node_name: String, expected: String) -> void:
	var label := _find_by_name(root_node, node_name) as Label
	if label == null:
		_fail("Missing label: %s" % node_name)
		return
	if label.text != expected:
		_fail("Label %s should be %s, got %s" % [node_name, expected, label.text])

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
