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
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	if run_screen.has_method("bind_session"):
		run_screen.bind_session(main)

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

	_assert_has(run_screen, "DailyTasksScreen")
	_assert_has(run_screen, "DailyTaskPanelFrame")
	_assert_has(run_screen, "DailyTaskPanel")
	_assert_has(run_screen, "DailyTaskTitleRow")
	_assert_label_text(run_screen, "DailyTaskTitle", "每日任务 2026-06-02")
	_assert_button_text(run_screen, "DailyTaskRefreshButton", "今日已刷新", true)

	_assert_task_row(run_screen, "daily-claimed", "每日战斗", "完成 3 场战斗", 3, 3, "已领取", true, true)
	_assert_task_row(run_screen, "daily-ready", "商店达人", "购买 5 件商品", 5, 5, "领取 20", false, true)
	_assert_task_row(run_screen, "daily-open", "继续挑战", "完成 4 个回合", 1, 4, "1/4", false, false)

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot daily task Web detail structure smoke passed")
	quit(0)

func _assert_task_row(root_node: Node, task_id: String, expected_title: String, expected_description: String, expected_value: int, expected_max: int, expected_action: String, expected_disabled: bool, expected_button: bool) -> void:
	_assert_has(root_node, "DailyTaskRow_%s" % task_id)
	_assert_has(root_node, "DailyTaskInfo_%s" % task_id)
	_assert_label_text(root_node, "DailyTaskTitle_%s" % task_id, expected_title)
	_assert_label_text(root_node, "DailyTaskDescription_%s" % task_id, expected_description)
	var progress := _find_by_name(root_node, "DailyTaskProgress_%s" % task_id) as ProgressBar
	if progress == null:
		_fail("Missing daily task progress bar: %s" % task_id)
		return
	if int(progress.value) != expected_value:
		_fail("Daily task %s progress value should be %d, got %d" % [task_id, expected_value, int(progress.value)])
	if int(progress.max_value) != expected_max:
		_fail("Daily task %s progress max should be %d, got %d" % [task_id, expected_max, int(progress.max_value)])
	if expected_button:
		_assert_button_text(root_node, "DailyTaskAction_%s" % task_id, expected_action, expected_disabled)
	else:
		_assert_label_text(root_node, "DailyTaskAction_%s" % task_id, expected_action)

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing daily task Web detail node: %s" % node_name)

func _assert_label_text(root_node: Node, node_name: String, expected: String) -> void:
	var label := _find_by_name(root_node, node_name) as Label
	if label == null:
		_fail("Missing label: %s" % node_name)
		return
	if label.text != expected:
		_fail("Label %s should be %s, got %s" % [node_name, expected, label.text])

func _assert_button_text(root_node: Node, node_name: String, expected: String, expected_disabled: bool) -> void:
	var button := _find_by_name(root_node, node_name) as Button
	if button == null:
		_fail("Missing button: %s" % node_name)
		return
	if button.text != expected:
		_fail("Button %s should be %s, got %s" % [node_name, expected, button.text])
	if button.disabled != expected_disabled:
		_fail("Button %s disabled should be %s" % [node_name, str(expected_disabled)])

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
