extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var screen_scene := load("res://scenes/screens/ApexScreen.tscn")
	if screen_scene == null:
		_fail("ApexScreen scene failed to load")
		return
	var screen = screen_scene.instantiate()
	root.add_child(screen)
	await process_frame
	screen.call("set_payload", {"apexData": _apex_data()})
	await process_frame

	var text := _collect_text(screen)
	for part in ["巅峰玩家 已投入巅峰榜", "总榜第 7 名", "当日榜未上榜", "防守连胜从 3 开始", "每日 05:00 更新", "我的记录", "查看配置"]:
		if not text.contains(part):
			_fail("Apex submit report missing: %s" % part)
			return
	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot apex submit report smoke passed")
	quit(0)

func _apex_data() -> Dictionary:
	return {
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
	}

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
