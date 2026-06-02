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
	run_screen.set("apex_data", {
		"season": {"name": "第一赛季"},
		"dailyBoardKey": "2026-06-02",
		"dailyResetHour": 5,
		"candidates": [
			{"id": "run-old", "dogType": "MUTT", "wins": 9, "losses": 3, "round": 12, "items": [], "relics": []},
		],
		"reports": {
			"overall": {"placementRank": 7, "battles": []},
			"daily": {"placementRank": null, "battles": []},
		},
		"entries": {
			"overall": {
				"id": "apex-overall",
				"name": "巅峰玩家",
				"dogType": "SHIBA",
				"wins": 12,
				"losses": 2,
				"round": 16,
				"rank": 7,
				"challengeWins": 3,
				"isSeed": false,
				"isMine": true,
				"items": [],
				"relics": [],
			},
			"daily": {
				"id": "apex-daily",
				"name": "巅峰玩家",
				"dogType": "SHIBA",
				"wins": 12,
				"losses": 2,
				"round": 16,
				"rank": null,
				"challengeWins": 3,
				"isSeed": false,
				"isMine": true,
				"items": [],
				"relics": [],
			},
		},
		"leaderboards": {
			"overall": [
				{"id": "apex-overall", "name": "巅峰玩家", "dogType": "SHIBA", "wins": 12, "losses": 2, "round": 16, "rank": 7, "challengeWins": 3, "isSeed": false, "isMine": true, "items": [], "relics": []},
			],
			"daily": [],
		},
	})
	run_screen.call("_clear_children", run_screen.get("content"))
	run_screen.call("_render_leaderboards_tab")
	await process_frame
	var text := _collect_text(run_screen)
	for part in ["巅峰玩家 已投入巅峰榜", "总榜第 7 名", "当日榜未上榜", "防守连胜从 3 开始", "每日 05:00 更新", "我的记录", "查看配置"]:
		if not text.contains(part):
			_fail("Apex submit report missing: %s" % part)
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot apex submit report smoke passed")
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
