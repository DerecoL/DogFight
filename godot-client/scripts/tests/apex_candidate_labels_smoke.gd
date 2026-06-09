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
	for part in ["巅峰竞技场", "巅峰赛季", "可投入的完成狗", "提交巅峰 柴犬", "12胜2负", "第16回合", "遗物 1", "装备 2", "查看配置", "巅峰柴", "柴犬", "我的记录", "雪原萨摩", "萨摩耶", "种子"]:
		if not text.contains(str(part)):
			_fail("Apex candidate label missing: %s" % str(part))
			return
	for raw in ["SHIBA", "SAMOYED"]:
		if text.contains(raw):
			_fail("Apex page leaked raw dog type: %s" % raw)
			return
	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot apex candidate labels smoke passed")
	quit(0)

func _apex_data() -> Dictionary:
	return {
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
