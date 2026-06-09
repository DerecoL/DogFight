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

	run_screen.set("leaderboard_data", {
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
	})
	run_screen.set("ladder_data", {
		"season": {"name": "S1"},
		"profile": {
			"tier": "DOG_KING",
			"tierLabel": "犬王",
			"score": 720,
			"gamesPlayed": 30,
			"totalWins": 21,
			"totalLosses": 9,
		},
		"recentSettlements": [],
	})
	run_screen.set("current_tab", "排行")
	run_screen.call("_render_current_tab")
	await process_frame

	_assert_label_text(run_screen, "LadderHeadingTitle", "天梯模式")
	_assert_label_text(run_screen, "LadderHeadingSubtitle", "当前赛季：S1 · 12 胜或 5 败结算积分，低段位更宽松，高段位按犬王积分榜竞争。")
	_assert_label_text(run_screen, "CurrentTierTitle", "当前段位")
	_assert_label_text(run_screen, "CurrentTierSubtitle", "30 局 · 21胜 9败")
	_assert_label_text(run_screen, "LadderRank", "犬王")
	var progress := _find_by_name(run_screen, "LadderProgress") as ProgressBar
	if progress == null:
		_fail("LadderProgress is missing")
		return
	if int(progress.value) != 100:
		_fail("Dog king ladder progress should be capped at 100")
		return
	_assert_label_text(run_screen, "LadderScoreText", "720 分 · 犬王积分")
	_assert_label_text(run_screen, "DogKingLeaderboardTitle", "犬王积分榜")
	_assert_label_text(run_screen, "DogKingLeaderboardSubtitle", "你的犬王排名：第 2 名")
	_assert_label_text(run_screen, "LadderRowRank_1", "犬王")
	_assert_label_text(run_screen, "LadderRowName_1", "榜首狗")
	_assert_label_text(run_screen, "LadderRowScore_1", "880")
	_assert_label_text(run_screen, "LadderRowRank_2", "犬王")
	_assert_label_text(run_screen, "LadderRowName_2", "我的狗")
	_assert_label_text(run_screen, "LadderRowScore_2", "720")

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot ladder home Web detail structure smoke passed")
	quit(0)

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
