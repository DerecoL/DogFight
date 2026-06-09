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
	run_screen.set("daily_data", {
		"dateKey": "2026-06-02",
		"refreshUsed": true,
		"wallet": {"balance": 240},
		"tasks": [
			{
				"taskId": "daily-claimed",
				"progress": 3,
				"target": 3,
				"reward": 15,
				"claimedAt": "2026-06-02T05:10:00.000Z",
				"def": {"title": "每日战斗", "description": "完成 3 场战斗"},
			},
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
	run_screen.set("current_tab", "每日")
	run_screen.call("_render_current_tab")
	await process_frame
	var text := _collect_text(run_screen)
	for part in ["每日任务 2026-06-02", "今日已刷新", "每日战斗", "完成 3 场战斗", "已领取", "商店达人", "购买 5 件商品", "领取 20", "继续挑战", "完成 4 个回合", "1/4"]:
		if not text.contains(str(part)):
			_fail("Daily task Web label missing: %s" % str(part))
			return
	var refresh_button := _find_by_name(run_screen, "DailyTaskRefreshButton") as Button
	if refresh_button == null:
		_fail("DailyTaskRefreshButton is missing")
		return
	if not refresh_button.disabled:
		_fail("Used refresh button should be disabled")
		return
	var claimed_button := _find_by_name(run_screen, "DailyTaskAction_daily-claimed") as Button
	if claimed_button == null or not claimed_button.disabled:
		_fail("Claimed daily task action should be disabled")
		return
	var open_state := _find_by_name(run_screen, "DailyTaskAction_daily-open")
	if open_state == null:
		_fail("Incomplete daily task state should be visible")
		return
	if open_state is Button and not (open_state as Button).disabled:
		_fail("Incomplete daily task action should not be clickable")
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot daily task state labels smoke passed")
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
