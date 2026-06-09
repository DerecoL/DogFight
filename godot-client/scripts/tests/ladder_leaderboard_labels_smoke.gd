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
	if run_screen != null and run_screen.has_method("bind_session"):
		run_screen.bind_session(main)
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	run_screen.set("leaderboard_data", {
		"playerRank": null,
		"playerProfile": {
			"tier": "MASTER",
			"tierLabel": "大师",
			"score": 420,
			"gamesPlayed": 18,
			"totalWins": 12,
			"totalLosses": 6,
		},
		"leaderboard": [],
	})
	run_screen.set("current_tab", "排行")
	run_screen.call("_render_current_tab")
	await process_frame
	var text := _collect_text(run_screen)
	for part in ["天梯模式", "当前段位", "18 局 · 12胜 6败", "大师", "420 分 / 500 晋级犬王", "犬王积分榜", "进入犬王后参与排名", "还没有犬王，先冲上大师 500 分。"]:
		if not text.contains(str(part)):
			_fail("Ladder leaderboard label missing: %s" % str(part))
			return
	for raw in ["MASTER", "DOG_KING", "天梯排行榜", "#1", "#2"]:
		if text.contains(str(raw)):
			_fail("Ladder leaderboard leaked non-Web label: %s" % str(raw))
			return
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
	run_screen.call("_render_current_tab")
	await process_frame
	text = _collect_text(run_screen)
	for part in ["你的犬王排名：第 2 名", "犬王", "榜首狗", "880", "我的狗", "720", "720 分 · 犬王积分"]:
		if not text.contains(str(part)):
			_fail("Dog king leaderboard entry missing: %s" % str(part))
			return
	for raw in ["#1", "#2"]:
		if text.contains(str(raw)):
			_fail("Dog king leaderboard leaked rank number: %s" % str(raw))
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot ladder leaderboard labels smoke passed")
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
