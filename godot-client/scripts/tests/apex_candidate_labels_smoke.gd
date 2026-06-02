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
	var run_screen = main.get_node_or_null("ScreenRoot/RunScreen")
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	run_screen.set("leaderboard_data", {
		"playerProfile": {"tierLabel": "青铜", "score": 0},
		"leaderboard": [],
	})
	run_screen.set("apex_data", {
		"season": {"name": "巅峰赛季"},
		"dailyBoardKey": "2026-06-02",
		"dailyResetHour": 5,
		"candidates": [
			{
				"id": "run-candidate",
				"dogType": "SHIBA",
				"wins": 12,
				"losses": 2,
				"round": 16,
				"items": [{"id": "item-1"}, {"id": "item-2"}],
				"relics": [{"id": "relic-1"}],
			},
		],
		"leaderboards": {
			"overall": [
				{"id": "overall-1", "rank": 3, "name": "巅峰柴", "dogType": "SHIBA", "wins": 12, "losses": 2, "round": 16, "challengeWins": 4, "isSeed": false, "isMine": true, "items": [], "relics": []},
			],
			"daily": [
				{"id": "daily-1", "rank": 8, "name": "雪原萨摩", "dogType": "SAMOYED", "wins": 10, "losses": 3, "round": 14, "challengeWins": 1, "isSeed": true, "isMine": false, "items": [], "relics": []},
			],
		},
	})
	run_screen.set("current_tab", "排行")
	run_screen.call("_render_current_tab")
	await process_frame
	var text := _collect_text(run_screen)
	for part in ["巅峰榜", "可提交完成局", "提交巅峰 柴犬", "12胜2负", "第16回合", "遗物 1", "装备 2", "查看配置", "巅峰柴", "柴犬", "我的记录", "雪原萨摩", "萨摩耶", "种子"]:
		if not text.contains(str(part)):
			_fail("Apex candidate label missing: %s" % str(part))
			return
	for raw in ["SHIBA", "SAMOYED"]:
		if text.contains(raw):
			_fail("Apex page leaked raw dog type: %s" % raw)
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot apex candidate labels smoke passed")
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
