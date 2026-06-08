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
	for part in ["成就与每日任务", "每日任务", "2026-06-02 · 余额 500", "刷新每日任务", "可领取 商店达人", "未完成 继续挑战", "长期目标", "余额 500 / 今日获得 60", "分类", "全部 / 战斗 / 收藏 / 任务", "可领取 首胜", "战斗", "1/1", "奖励 30", "未完成 隐藏成就 收藏大师", "收藏", "2/5", "已领取 任务常客", "任务"]:
		if not text.contains(str(part)):
			_fail("Achievement category label missing: %s" % str(part))
			return
	var collector_button := _find_button(run_screen, "收藏大师")
	if collector_button == null:
		_fail("Hidden achievement button is missing")
		return
	collector_button.pressed.emit()
	await process_frame
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	_assert_modal_text(modal_layer, ["成就详情", "收藏大师", "分类", "收藏", "可见性", "隐藏成就", "未完成"])
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot achievement category labels smoke passed")
	quit(0)

func _assert_modal_text(modal_layer: Node, expected: Array) -> void:
	if modal_layer.get_child_count() != 1:
		_fail("Expected exactly one modal, got %d" % modal_layer.get_child_count())
		return
	var text := _collect_text(modal_layer)
	for part in expected:
		var value := str(part)
		if not text.contains(value):
			_fail("Modal text missing: %s" % value)
			return

func _collect_text(node: Node) -> String:
	var text := ""
	if node is Label:
		text += (node as Label).text + "\n"
	if node is Button:
		text += (node as Button).text + "\n"
	for child in node.get_children():
		text += _collect_text(child)
	return text

func _find_button(node: Node, needle: String) -> Button:
	if node is Button and (node as Button).text.contains(needle):
		return node as Button
	for child in node.get_children():
		var found := _find_button(child, needle)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
