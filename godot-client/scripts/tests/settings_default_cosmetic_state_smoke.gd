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

	run_screen.set("cosmetics_data", {
		"equipped": [
			{"slot": "TITLE", "catalogItemId": "title-paper-crown", "item": {"id": "title-paper-crown", "name": "纸冠头衔", "type": "TITLE", "rarity": "EPIC"}},
		],
		"inventory": [
			{"catalogItemId": "title-paper-crown", "item": {"id": "title-paper-crown", "name": "纸冠头衔", "type": "TITLE", "rarity": "EPIC"}, "owned": true},
			{"catalogItemId": "avatar-crown", "item": {"id": "avatar-crown", "name": "皇冠头像", "type": "AVATAR", "rarity": "RARE"}, "owned": true},
		],
	})
	run_screen.set("current_tab", "设置")
	run_screen.call("_render_current_tab")
	await process_frame

	_assert_named_button_state(run_screen, "CosmeticDefaultAction_TITLE", false, "选择默认")
	_assert_named_button_state(run_screen, "CosmeticDefaultAction_AVATAR", true, "已选择")
	_assert_named_button_state(run_screen, "CosmeticAction_title-paper-crown", true, "已装备")
	_assert_named_button_state(run_screen, "CosmeticAction_avatar-crown", false, "装备")

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot settings default cosmetic state smoke passed")
	quit(0)

func _assert_named_button_state(root_node: Node, node_name: String, expected_disabled: bool, expected_text: String) -> void:
	var button := _find_by_name(root_node, node_name) as Button
	if button == null:
		_fail("Missing button: %s" % node_name)
		return
	if button.disabled != expected_disabled:
		_fail("Button %s disabled should be %s" % [node_name, str(expected_disabled)])
	if button.text != expected_text:
		_fail("Button %s text should be %s, got %s" % [node_name, expected_text, button.text])

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
