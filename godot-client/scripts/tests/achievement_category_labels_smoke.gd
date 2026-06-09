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
	run_screen.set("achievements_data", {
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
			{
				"id": "daily-hero",
				"title": "任务常客",
				"description": "完成每日任务",
				"category": "任务",
				"hidden": false,
				"progress": 10,
				"target": 10,
				"reward": 40,
				"claimable": false,
				"claimed": true,
			},
		],
	})
	run_screen.set("daily_data", {
		"dateKey": "2026-06-02",
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
	})
	run_screen.set("current_tab", "成就")
	run_screen.call("_render_current_tab")
	await process_frame
	var text := _collect_text(run_screen)
	for part in ["长期目标", "成就与每日任务", "每日任务 2026-06-02", "刷新", "商店达人", "购买 5 件商品", "领取 20", "继续挑战", "1/4", "全部", "战斗", "收藏", "任务", "首胜", "赢下一场战斗", "1/1 · 30", "收藏大师", "2/5 · 20", "任务常客", "已领取"]:
		if not text.contains(str(part)):
			_fail("Achievement Web label missing: %s" % str(part))
			return
	for node_name in ["AchievementTab_combat", "AchievementTab_collection", "AchievementTab_task", "AchievementAction_first-win", "AchievementAction_collector", "AchievementAction_daily-hero"]:
		if _find_by_name(run_screen, node_name) == null:
			_fail("Achievement Web node missing: %s" % node_name)
			return
	var collector_button := _find_by_name(run_screen, "AchievementAction_collector") as Button
	if collector_button == null or not collector_button.disabled:
		_fail("Unfinished achievement action must be disabled")
		return
	var claimed_button := _find_by_name(run_screen, "AchievementAction_daily-hero") as Button
	if claimed_button == null or not claimed_button.disabled:
		_fail("Claimed achievement action must be disabled")
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot achievement category labels smoke passed")
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

func _find_by_name(node: Node, node_name: String) -> Node:
	if node.name == node_name:
		return node
	for child in node.get_children():
		var found := _find_by_name(child, node_name)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
