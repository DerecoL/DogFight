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

	screen.call("set_payload", {
		"user": {"nickname": "Tester"},
		"run": {},
		"history": {
			"totalRuns": 0,
			"totalWins": 0,
			"totalLosses": 0,
			"completedRuns": 0,
			"bestRun": null,
			"recentRuns": [],
		},
		"ladderProfile": null,
		"season": null,
	})
	await process_frame

	for node_name in [
		"ModeLobbyPanel",
		"ModeLobbyScroll",
		"ModeLobbyHeading",
		"ModeLobbyTitle",
		"ModeLobbySubtitle",
		"TutorialReplayButton",
		"ModeGrid",
		"CasualModeButton",
		"LadderModeButton",
		"DogfightModeButton",
		"PeakModeButton",
		"PlayerHistoryPanel",
		"HistorySummary",
		"HistoryRunList",
	]:
		if screen.find_child(node_name, true, false) == null:
			_fail("Missing mode lobby Web node: %s" % node_name)
			return

	var grid := screen.find_child("ModeGrid", true, false) as GridContainer
	if grid.columns != 2:
		_fail("ModeGrid must keep the Web two-column card grid")
		return
	for mode_id in ["CASUAL", "LADDER", "DOGFIGHT", "PEAK"]:
		for child_name in [
			"ModeCard_%s" % mode_id,
			"ModeIcon_%s" % mode_id,
			"ModeCopy_%s" % mode_id,
			"ModeTitle_%s" % mode_id,
			"ModeDescription_%s" % mode_id,
		]:
			if screen.find_child(child_name, true, false) == null:
				_fail("ModeLobby mode card must mirror Web child: %s" % child_name)
				return
	for button_name in ["CasualModeButton", "LadderModeButton", "DogfightModeButton", "PeakModeButton"]:
		_assert_mode_action_button(screen, button_name)

	var text := _collect_text(screen)
	for part in [
		"模式大厅",
		"选择本次要进入的竞技方式。休闲或天梯完成后的狗可以送入巅峰竞技场。",
		"新手引导",
		"休闲模式",
		"当前经典构筑、商店、匹配和自动战斗流程",
		"开始休闲模式",
		"天梯模式",
		"按整局表现结算积分，冲击大师与犬王排行榜",
		"进入天梯模式",
		"斗狗模式",
		"实时房间，8 狗同场淘汰",
		"进入斗狗模式",
		"巅峰模式",
		"战斗结束后的狗进入巅峰竞技场，自动挑战榜单冲击排名",
		"进入巅峰模式",
		"个人战绩",
		"0胜 0败",
		"共 0 局 · 胜率 0% · 完成 0 局",
		"天梯段位",
		"青铜",
		"当前赛季 · 0 分",
		"最佳成绩",
		"暂无对局",
		"商城",
		"成就",
		"个人设置",
		"查看详情和装备",
		"最近对局",
		"还没有记录",
		"开始一局后会自动统计",
	]:
		if not text.contains(part):
			_fail("ModeLobby Web text missing: %s" % part)
			return

	for leaked in ["妯", "澶", "閫", "浼", "鐧", "鎴", "鍟", "璁"]:
		if text.contains(leaked):
			_fail("ModeLobby leaked mojibake text fragment: %s" % leaked)
			return

	screen.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot mode lobby Web text structure smoke passed")
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

func _assert_mode_action_button(root_node: Node, node_name: String) -> void:
	var node := root_node.find_child(node_name, true, false)
	if not node is Button:
		_fail("%s should be a Web mode-action Button" % node_name)
		return
	var button := node as Button
	if button.text.contains("\n"):
		_fail("%s should only contain Web action text, got multiline card text" % node_name)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
