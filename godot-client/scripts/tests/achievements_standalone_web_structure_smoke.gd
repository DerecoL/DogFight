extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var screen_scene := load("res://scenes/screens/AchievementsScreen.tscn")
	if screen_scene == null:
		_fail("AchievementsScreen scene failed to load")
		return
	var screen = screen_scene.instantiate()
	root.add_child(screen)
	await process_frame
	screen.call("set_payload", {
		"achievementsData": _achievements_data(),
		"dailyData": _daily_data(),
	})
	await process_frame

	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("AchievementsScreen must render standalone UI instead of redirecting to playable shell")
		return

	for node_name in [
		"AchievementsScreen",
		"AchievementsHeading",
		"AchievementsEyebrow",
		"AchievementsTitle",
		"AchievementsCurrencyPill",
		"DailyTaskPanel",
		"DailyTaskTitleRow",
		"DailyTaskRefreshButton",
		"DailyTaskRow_daily-ready",
		"DailyTaskAction_daily-ready",
		"DailyTaskRow_daily-open",
		"DailyTaskAction_daily-open",
		"AchievementTabs",
		"AchievementTab_all",
		"AchievementTab_combat",
		"AchievementTab_collection",
		"AchievementGrid",
		"AchievementCard_first-win",
		"AchievementAction_first-win",
		"AchievementCard_collector",
		"AchievementAction_collector",
	]:
		_assert_has(screen, node_name)

	var grid = _find_by_name(screen, "AchievementGrid")
	if not grid is GridContainer:
		_fail("AchievementGrid must use a grid matching the Web achievement card layout")
		return
	if int((grid as GridContainer).columns) < 2:
		_fail("AchievementGrid should expose a multi-column card layout")
		return

	var text := _collect_text(screen)
	for part in ["长期目标", "成就与每日任务", "500", "每日任务 2026-06-09", "刷新", "商店达人", "购买 5 件商品", "领取 20", "继续挑战", "1/4", "全部", "战斗", "收藏", "首胜", "赢下一场战斗", "1/1 · 30", "领取", "收藏大师", "2/5 · 20", "未完成"]:
		if not text.contains(part):
			_fail("Achievements standalone Web text missing: %s" % part)
			return

	var collector_button := _find_by_name(screen, "AchievementAction_collector") as Button
	if collector_button == null or not collector_button.disabled:
		_fail("Unfinished achievement action must be disabled")
		return

	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot achievements standalone Web structure smoke passed")
	quit(0)

func _achievements_data() -> Dictionary:
	return {
		"wallet": {"balance": 500, "dailyEarned": 60},
		"achievements": [
			{
				"id": "first-win",
				"title": "首胜",
				"description": "赢下一场战斗",
				"category": "战斗",
				"hidden": false,
				"progress": 1,
				"target": 1,
				"reward": 30,
				"claimable": true,
				"claimed": false,
			},
			{
				"id": "collector",
				"title": "收藏大师",
				"description": "拥有 5 件外观",
				"category": "收藏",
				"hidden": true,
				"progress": 2,
				"target": 5,
				"reward": 20,
				"claimable": false,
				"claimed": false,
			},
		],
	}

func _daily_data() -> Dictionary:
	return {
		"dateKey": "2026-06-09",
		"refreshUsed": false,
		"wallet": {"balance": 500},
		"tasks": [
			{
				"taskId": "daily-ready",
				"progress": 5,
				"target": 5,
				"reward": 20,
				"claimedAt": "",
				"def": {"title": "商店达人", "description": "购买 5 件商品"},
			},
			{
				"taskId": "daily-open",
				"progress": 1,
				"target": 4,
				"reward": 10,
				"claimedAt": "",
				"def": {"title": "继续挑战", "description": "完成 4 个回合"},
			},
		],
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing achievements standalone Web node: %s" % node_name)

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
