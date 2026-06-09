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
	run_screen.set("apex_data", _apex_data())
	run_screen.set("current_tab", "巅峰")
	run_screen.call("_render_current_tab")
	await process_frame

	for node_name in [
		"ApexScreen",
		"ApexHeading",
		"ApexToolbar",
		"ApexRefreshButton",
		"ApexReport",
		"ApexLayout",
		"ApexCandidates",
		"ApexCandidateList",
		"ApexCandidate_candidate-1",
		"ApexSubmit_candidate-1",
		"ApexLeaderboard",
		"ApexTabs",
		"ApexTab_overall",
		"ApexTab_daily",
		"ApexRankList",
		"ApexRankEntry_overall-1",
		"ApexConfig_overall-1",
	]:
		_assert_has(run_screen, node_name)

	var layout = _find_by_name(run_screen, "ApexLayout")
	if not layout is GridContainer:
		_fail("ApexLayout must use a grid matching the Web candidate/leaderboard layout")
		return
	if int((layout as GridContainer).columns) != 2:
		_fail("ApexLayout must keep two columns")
		return

	var text := _collect_text(run_screen)
	for part in ["巅峰竞技场", "刷新", "已投入巅峰榜", "可投入的完成狗", "投入巅峰", "总榜", "当日榜", "查看配置", "我的记录", "防守连胜 4"]:
		if not text.contains(part):
			_fail("Apex Web text missing: %s" % part)
			return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot apex home Web structure smoke passed")
	quit(0)

func _apex_data() -> Dictionary:
	return {
		"season": {"name": "Apex S1"},
		"dailyBoardKey": "2026-06-09",
		"dailyResetHour": 5,
		"reports": {
			"overall": {"placementRank": 3},
			"daily": {"placementRank": null},
		},
		"entries": {
			"overall": {"id": "overall-player", "name": "巅峰柴", "challengeWins": 4},
		},
		"candidates": [
			{"id": "candidate-1", "dogType": "SHIBA", "wins": 12, "losses": 2, "round": 16, "items": [{}, {}], "relics": [{}]},
		],
		"leaderboards": {
			"overall": [
				{"id": "overall-1", "rank": 1, "name": "榜首柴", "dogType": "SHIBA", "wins": 12, "losses": 1, "round": 18, "challengeWins": 4, "isSeed": false, "isMine": true, "items": [], "relics": []},
			],
			"daily": [
				{"id": "daily-1", "rank": 2, "name": "今日萨摩", "dogType": "SAMOYED", "wins": 10, "losses": 2, "round": 15, "challengeWins": 2, "isSeed": true, "isMine": false, "items": [], "relics": []},
			],
		},
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing apex Web node: %s" % node_name)

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
