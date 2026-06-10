extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var manifest = load("res://scripts/ui/web/WebUiScreenIds.gd")
	if manifest == null:
		_fail("WebUiScreenIds.gd must load")
		return
	if not manifest.screen_ids().has("apex"):
		_fail("Web UI manifest must expose standalone apex screen")
		return
	if str(manifest.node_name_for("apex")) != "ApexScreen":
		_fail("apex screen must map to ApexScreen")
		return

	var screen_scene := load("res://scenes/screens/ApexScreen.tscn")
	if screen_scene == null:
		_fail("ApexScreen scene failed to load")
		return
	var screen = screen_scene.instantiate()
	root.add_child(screen)
	await process_frame
	screen.call("set_payload", {"apexData": _apex_data()})
	await process_frame

	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("ApexScreen must render standalone UI instead of redirecting to playable shell")
		return

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
		"ApexCandidateDogBadge_candidate-1",
		"ApexCandidateAvatar_candidate-1",
		"ApexSubmit_candidate-1",
		"ApexLeaderboard",
		"ApexTabs",
		"ApexTab_overall",
		"ApexTab_daily",
		"ApexRankList",
		"ApexRankEntry_overall-1",
		"ApexRankDogBadge_overall-1",
		"ApexRankAvatar_overall-1",
		"ApexConfig_overall-1",
	]:
		_assert_has(screen, node_name)

	for avatar_name in ["ApexCandidateAvatar_candidate-1", "ApexRankAvatar_overall-1"]:
		var avatar := _find_by_name(screen, avatar_name) as TextureRect
		if avatar == null or avatar.texture == null:
			_fail("Apex Web DogBadge avatar missing texture: %s" % avatar_name)
			return

	var layout = _find_by_name(screen, "ApexLayout")
	if not layout is GridContainer:
		_fail("ApexLayout must use a grid matching the Web candidate/leaderboard layout")
		return
	if int((layout as GridContainer).columns) != 2:
		_fail("ApexLayout must keep two columns")
		return
	var overall_tab := _find_by_name(screen, "ApexTab_overall") as Button
	var daily_tab := _find_by_name(screen, "ApexTab_daily") as Button
	if overall_tab == null or daily_tab == null:
		_fail("Apex tabs must expose stable Web tab buttons")
		return
	if not overall_tab.button_pressed or daily_tab.button_pressed:
		_fail("Apex leaderboard must default to the overall tab")
		return
	if _find_by_name(screen, "ApexRankEntry_daily-1") != null:
		_fail("Apex overall tab must not render daily board entries before switching")
		return
	if _find_by_name(screen, "ApexDailyHint") != null:
		_fail("Apex overall tab must not render daily hint before switching")
		return
	if _find_by_name(screen, "ApexRankSelf_overall-1") == null:
		_fail("Apex overall tab must render mine marker for my overall entry")
		return
	daily_tab.pressed.emit()
	await process_frame
	daily_tab = _find_by_name(screen, "ApexTab_daily") as Button
	overall_tab = _find_by_name(screen, "ApexTab_overall") as Button
	if daily_tab == null or overall_tab == null or not daily_tab.button_pressed or overall_tab.button_pressed:
		_fail("Apex daily tab must become active after click")
		return
	if _find_by_name(screen, "ApexRankEntry_daily-1") == null:
		_fail("Apex daily tab must render daily leaderboard entries")
		return
	if _find_by_name(screen, "ApexRankEntry_overall-1") != null:
		_fail("Apex daily tab must not render overall board entries")
		return
	if _find_by_name(screen, "ApexDailyHint") == null:
		_fail("Apex daily tab must render daily board hint")
		return
	if _find_by_name(screen, "ApexOverallHint") != null:
		_fail("Apex daily tab must not render overall board hint")
		return
	overall_tab.pressed.emit()
	await process_frame

	var text := _collect_text(screen)
	for part in ["巅峰竞技场", "刷新", "已投入巅峰榜", "可投入的完成狗", "投入巅峰", "总榜", "当日榜", "查看配置", "我的记录", "防守连胜 4"]:
		if not text.contains(part):
			_fail("Apex standalone Web text missing: %s" % part)
			return

	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot apex standalone Web structure smoke passed")
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
		_fail("Missing apex standalone Web node: %s" % node_name)

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
