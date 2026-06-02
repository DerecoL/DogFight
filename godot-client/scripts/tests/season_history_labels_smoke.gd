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
	run_screen.set("ladder_data", {
		"season": {"id": "season-2", "name": "第二赛季", "startsAt": "2026-06-01", "endsAt": "2026-07-01"},
		"profile": {"tier": "DIAMOND", "tierLabel": "钻石", "score": 220, "wins": 8, "losses": 4},
		"recentSettlements": [],
	})
	run_screen.set("history_data", {"seasonSummaries": []})
	run_screen.set("current_tab", "赛季")
	run_screen.call("_render_current_tab")
	await process_frame
	var text := _collect_text(run_screen)
	for part in ["赛季", "当前赛季", "第二赛季", "我的天梯", "钻石", "220分", "胜负 8/4", "赛季历史", "赛季结束后会保存在这里", "暂无赛季历史"]:
		if not text.contains(str(part)):
			_fail("Season empty label missing: %s" % str(part))
			return
	for raw in ["DIAMOND", "MASTER", "DOG_KING"]:
		if text.contains(str(raw)):
			_fail("Season page leaked raw tier: %s" % str(raw))
			return
	run_screen.set("history_data", {
		"seasonSummaries": [
			{
				"id": "season-1-summary",
				"seasonName": "第一赛季",
				"ladderTierLabel": "大师",
				"ladderScore": 520,
				"ladderTotalWins": 18,
				"ladderTotalLosses": 7,
				"dogKingRank": 6,
				"apexRank": 0,
				"apexSnapshot": {},
			},
			{
				"id": "season-0-summary",
				"seasonName": "测试赛季",
				"ladderTierLabel": "黄金",
				"ladderScore": 80,
				"ladderTotalWins": 5,
				"ladderTotalLosses": 5,
				"dogKingRank": 0,
				"apexRank": 12,
				"apexWins": 10,
				"apexLosses": 2,
				"apexSnapshot": {"id": "apex-snapshot", "name": "巅峰狗", "dogType": "SHIBA", "wins": 10, "losses": 2, "round": 15, "rank": 12, "challengeWins": 4, "items": [], "relics": []},
			},
		],
	})
	run_screen.call("_render_current_tab")
	await process_frame
	text = _collect_text(run_screen)
	for part in ["赛季历史", "2 个已结束赛季", "第一赛季", "天梯 大师 · 520 分 · 犬王第 6 名", "巅峰未入榜", "测试赛季", "天梯 黄金 · 80 分", "巅峰第 12 名 · 10胜2败", "巅峰配置快照"]:
		if not text.contains(str(part)):
			_fail("Season history label missing: %s" % str(part))
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot season history labels smoke passed")
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
