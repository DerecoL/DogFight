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
	for method_name in ["_show_cosmetic_modal", "_show_achievement_modal", "_show_daily_task_modal"]:
		if not run_screen.has_method(method_name):
			_fail("%s is missing" % method_name)
			return
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	var cosmetic := {
		"id": "title-crown",
		"name": "纸冠头衔",
		"description": "在账号面板展示纸冠称号",
		"type": "TITLE",
		"rarity": "EPIC",
		"price": 120,
		"owned": false,
		"equipped": false,
	}
	run_screen.call("_show_cosmetic_modal", cosmetic)
	await process_frame
	_assert_modal_text(modal_layer, ["外观详情", "纸冠头衔", "称号", "史诗", "120", "购买"])
	run_screen.call("_close_top_modal")
	await process_frame
	run_screen.call("_show_achievement_modal", {
		"id": "first-win",
		"title": "首胜",
		"description": "赢下一场战斗",
		"progress": 1,
		"target": 1,
		"reward": 30,
		"claimable": true,
		"claimed": false,
	})
	await process_frame
	_assert_modal_text(modal_layer, ["成就详情", "首胜", "赢下一场战斗", "1/1", "30", "领取奖励"])
	run_screen.call("_close_top_modal")
	await process_frame
	run_screen.call("_show_daily_task_modal", {
		"taskId": "daily-battle",
		"progress": 2,
		"target": 3,
		"claimedAt": "",
		"def": {"title": "每日战斗", "description": "完成 3 场战斗", "reward": 15},
	})
	await process_frame
	_assert_modal_text(modal_layer, ["每日任务详情", "每日战斗", "完成 3 场战斗", "2/3", "15", "未完成"])
	run_screen.call("_close_top_modal")
	await process_frame
	run_screen.set("cosmetics_data", {
		"equipped": [],
		"inventory": [{"catalogItemId": "title-crown", "item": cosmetic}],
	})
	run_screen.set("current_tab", "设置")
	run_screen.call("_render_current_tab")
	await process_frame
	var screen_text := _collect_text(run_screen)
	if not screen_text.contains("纸冠头衔"):
		_fail("Nested cosmetic inventory item name was not rendered")
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot account panels detail smoke passed")
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

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
