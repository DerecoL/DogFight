extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var screen_scene := load("res://scenes/screens/SeasonScreen.tscn")
	if screen_scene == null:
		_fail("SeasonScreen scene failed to load")
		return
	var screen = screen_scene.instantiate()
	root.add_child(screen)
	await process_frame

	screen.call("set_payload", _season_payload([]))
	await process_frame
	var text := _collect_text(screen)
	for part in ["当前赛季", "第二赛季", "我的天梯", "钻石", "220 分", "胜负 8/4", "赛季历史", "赛季结束后会保存在这里", "暂无赛季历史"]:
		if not text.contains(str(part)):
			_fail("Season empty label missing: %s" % str(part))
			return
	for raw in ["DIAMOND", "MASTER", "DOG_KING"]:
		if text.contains(str(raw)):
			_fail("Season page leaked raw tier: %s" % str(raw))
			return

	screen.call("set_payload", _season_payload(_summaries()))
	await process_frame
	text = _collect_text(screen)
	for part in ["赛季历史", "2 个已结束赛季", "第一赛季", "天梯 大师 · 520 分 · 犬王第 6 名", "巅峰未入榜", "测试赛季", "天梯 黄金 · 80 分", "巅峰第 12 名 · 10胜2败", "巅峰配置快照"]:
		if not text.contains(str(part)):
			_fail("Season history label missing: %s" % str(part))
			return

	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot season history labels smoke passed")
	quit(0)

func _season_payload(summaries: Array) -> Dictionary:
	return {
		"ladderData": {
			"season": {"id": "season-2", "name": "第二赛季", "startsAt": "2026-06-01", "endsAt": "2026-07-01"},
			"profile": {"tier": "DIAMOND", "tierLabel": "钻石", "score": 220, "wins": 8, "losses": 4},
			"recentSettlements": [],
		},
		"historyData": {"seasonSummaries": summaries},
	}

func _summaries() -> Array:
	return [
		{"id": "season-1-summary", "seasonName": "第一赛季", "ladderTierLabel": "大师", "ladderScore": 520, "ladderTotalWins": 18, "ladderTotalLosses": 7, "dogKingRank": 6, "apexRank": 0, "apexSnapshot": {}},
		{"id": "season-0-summary", "seasonName": "测试赛季", "ladderTierLabel": "黄金", "ladderScore": 80, "ladderTotalWins": 5, "ladderTotalLosses": 5, "dogKingRank": 0, "apexRank": 12, "apexWins": 10, "apexLosses": 2, "apexSnapshot": {"id": "apex-snapshot", "name": "巅峰犬", "dogType": "SHIBA", "wins": 10, "losses": 2, "round": 15, "rank": 12, "challengeWins": 4, "items": [], "relics": []}},
	]

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
