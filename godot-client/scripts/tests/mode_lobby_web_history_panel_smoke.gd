extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene = load("res://scenes/screens/ModeLobbyScreen.tscn")
	if scene == null:
		_fail("ModeLobbyScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame

	for node_name in [
		"ModeLobbyScroll",
		"PlayerHistoryPanel",
		"HistorySummary",
		"HistoryLadderSlot",
		"HistoryBest",
		"AccountPanelActions",
		"HistoryRunList",
	]:
		if screen.find_child(node_name, true, false) == null:
			_fail("ModeLobbyScreen must mirror Web history panel structure: %s" % node_name)
			return
	for button_name in [
		"HistoryShopButton",
		"HistoryAchievementsButton",
		"HistorySettingsButton",
		"HistoryDetailButton",
	]:
		if screen.find_child(button_name, true, false) == null:
			_fail("ModeLobbyScreen history panel missing shortcut: %s" % button_name)
			return

	var sample_history := {
		"totalRuns": 7,
		"totalWins": 9,
		"totalLosses": 5,
		"completedRuns": 4,
		"bestRun": {"dogType": "SHIBA", "wins": 5, "losses": 1, "round": 8},
		"recentRuns": [
			{"id": "r1", "dogType": "SHIBA", "wins": 5, "losses": 1, "round": 8, "status": "COMPLETED"},
			{"id": "r2", "dogType": "SAMOYED", "wins": 4, "losses": 2, "round": 7, "status": "ACTIVE"},
			{"id": "r3", "dogType": "MUTT", "wins": 3, "losses": 3, "round": 6, "status": "COMPLETED"},
			{"id": "r4", "dogType": "BULLY", "wins": 2, "losses": 3, "round": 5, "status": "FAILED"},
			{"id": "r5", "dogType": "EMPEROR", "wins": 1, "losses": 3, "round": 4, "status": "COMPLETED"},
			{"id": "r6", "dogType": "FROG", "wins": 0, "losses": 3, "round": 3, "status": "FAILED"},
		],
	}
	screen.call("set_payload", {
		"user": {"nickname": "Tester"},
		"history": sample_history,
		"ladderProfile": {"tierLabel": "白银", "score": 120},
		"season": {"name": "测试赛季"},
	})
	await process_frame

	var text := _collect_text(screen)
	for part in ["个人战绩", "9胜 5败", "共 7 局", "胜率 64%", "完成 4 局", "天梯段位", "白银", "测试赛季 · 120 分", "最佳成绩", "最近对局"]:
		if not text.contains(str(part)):
			_fail("ModeLobbyScreen history panel text missing: %s" % str(part))
			return

	var history_rows := _count_named_children(screen, "HistoryRunRow")
	if history_rows != 5:
		_fail("ModeLobbyScreen must limit recent lobby runs to five rows, got %d" % history_rows)
		return

	screen.call("set_payload", {
		"user": {"nickname": "Newbie"},
		"history": {"totalRuns": 0, "totalWins": 0, "totalLosses": 0, "completedRuns": 0, "bestRun": null, "recentRuns": null},
		"ladderProfile": null,
		"season": null,
	})
	await process_frame
	var empty_text := _collect_text(screen)
	if not empty_text.contains("暂无对局") or not empty_text.contains("还没有记录"):
		_fail("ModeLobbyScreen must render null history fields as a stable empty state")
		return

	screen.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot mode lobby Web history panel smoke passed")
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

func _count_named_children(node: Node, target_name: String) -> int:
	var count := 0
	if str(node.name).begins_with(target_name):
		count += 1
	for child in node.get_children():
		count += _count_named_children(child, target_name)
	return count

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
