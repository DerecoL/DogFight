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
				"id": "claimed-one",
				"title": "已经领取",
				"description": "验证已领取状态",
				"category": "战斗",
				"hidden": false,
				"progress": 3,
				"target": 3,
				"reward": 10,
				"claimable": false,
				"claimed": true,
			},
		],
	})
	run_screen.set("daily_data", {"dateKey": "2026-06-09", "refreshUsed": false, "tasks": []})
	run_screen.set("current_tab", "成就")
	run_screen.call("_render_current_tab")
	await process_frame

	_assert_achievement_card(run_screen, "first-win", "首胜", "战斗", "赢下一场战斗", 1, 1, "1/1 · 30", "领取", false)
	_assert_achievement_card(run_screen, "collector", "收藏大师", "收藏", "拥有 5 件外观", 2, 5, "2/5 · 20", "未完成", true)
	_assert_achievement_card(run_screen, "claimed-one", "已经领取", "战斗", "验证已领取状态", 3, 3, "3/3 · 10", "已领取", true)

	var text := _collect_text(run_screen)
	if text.contains("隐藏成就"):
		_fail("Achievement hidden state should be a card style, not visible category text")
		return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot achievement card Web detail structure smoke passed")
	quit(0)

func _assert_achievement_card(root_node: Node, achievement_id: String, expected_title: String, expected_category: String, expected_description: String, expected_value: int, expected_max: int, expected_state: String, expected_button: String, expected_disabled: bool) -> void:
	_assert_has(root_node, "AchievementCard_%s" % achievement_id)
	_assert_has(root_node, "AchievementCardBody_%s" % achievement_id)
	_assert_has(root_node, "AchievementCardHeader_%s" % achievement_id)
	_assert_label_text(root_node, "AchievementTitle_%s" % achievement_id, expected_title)
	_assert_label_text(root_node, "AchievementCategory_%s" % achievement_id, expected_category)
	_assert_label_text(root_node, "AchievementDescription_%s" % achievement_id, expected_description)
	var progress := _find_by_name(root_node, "AchievementProgress_%s" % achievement_id) as ProgressBar
	if progress == null:
		_fail("Missing achievement progress bar: %s" % achievement_id)
		return
	if int(progress.value) != expected_value:
		_fail("Achievement %s progress value should be %d, got %d" % [achievement_id, expected_value, int(progress.value)])
	if int(progress.max_value) != expected_max:
		_fail("Achievement %s progress max should be %d, got %d" % [achievement_id, expected_max, int(progress.max_value)])
	_assert_has(root_node, "AchievementActions_%s" % achievement_id)
	_assert_label_text(root_node, "AchievementState_%s" % achievement_id, expected_state)
	_assert_button_text(root_node, "AchievementAction_%s" % achievement_id, expected_button, expected_disabled)

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing achievement card Web detail node: %s" % node_name)

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
