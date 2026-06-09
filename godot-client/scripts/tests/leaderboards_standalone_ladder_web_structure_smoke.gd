extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene = load("res://scenes/screens/LeaderboardsScreen.tscn")
	if scene == null:
		_fail("LeaderboardsScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame

	screen.call("set_payload", {
		"ladderData": {
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
		},
		"leaderboardData": {
			"playerRank": 2,
			"leaderboard": [
				{"rank": 1, "title": "犬王", "name": "榜首狗", "profile": {"score": 880}},
				{"rank": 2, "title": "犬王", "name": "我的狗", "profile": {"score": 720}},
			],
		},
	})
	await process_frame

	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("LeaderboardsScreen must be standalone and must not redirect to LegacyRunScreen")
		return

	for node_name in [
		"LadderScreen",
		"LadderHeading",
		"LadderHeadingTitle",
		"LadderHeadingSubtitle",
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
		if screen.find_child(node_name, true, false) == null:
			_fail("Missing standalone ladder Web node: %s" % node_name)
			return

	var layout := screen.find_child("LadderLayout", true, false) as GridContainer
	if layout.columns != 2:
		_fail("LadderLayout must use the Web two-panel grid")
		return

	var progress := screen.find_child("LadderProgress", true, false) as ProgressBar
	if int(progress.value) != 100:
		_fail("Dog king ladder progress should be capped at 100")
		return

	var text := _collect_text(screen)
	for part in [
		"天梯模式",
		"当前赛季：S1 · 12 胜或 5 败结算积分，低段位更宽松，高段位按犬王积分榜竞争。",
		"当前段位",
		"30 局 · 21胜 9败",
		"犬王",
		"720 分 · 犬王积分",
		"犬王积分榜",
		"你的犬王排名：第 2 名",
		"榜首狗",
		"我的狗",
		"选择天梯狗狗",
		"开始天梯会进入独立匹配池，并按整局表现结算。",
		"柴犬",
		"开始天梯",
		"最近结算",
		"积分变化按整局胜败统一计算。",
		"12胜2败",
		"+34",
	]:
		if not text.contains(part):
			_fail("Standalone ladder Web text missing: %s" % part)
			return

	screen.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot standalone leaderboards ladder Web structure smoke passed")
	quit(0)

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
