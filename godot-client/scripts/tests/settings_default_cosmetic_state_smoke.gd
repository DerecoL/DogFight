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

	_assert_button_state(run_screen, "选择默认 称号", false)
	_assert_no_enabled_button(run_screen, "选择默认 头像")
	_assert_button_state(run_screen, "已选择 默认 头像", true)
	_assert_button_state(run_screen, "已装备 纸冠头衔", false)
	_assert_button_state(run_screen, "查看 皇冠头像", false)

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot settings default cosmetic state smoke passed")
	quit(0)

func _assert_button_state(root_node: Node, text: String, expected_disabled: bool) -> void:
	var button := _find_button(root_node, text)
	if button == null:
		_fail("Missing button: %s" % text)
		return
	if button.disabled != expected_disabled:
		_fail("Button %s disabled should be %s" % [text, str(expected_disabled)])

func _assert_no_enabled_button(root_node: Node, text: String) -> void:
	var button := _find_button(root_node, text)
	if button != null and not button.disabled:
		_fail("Button should not be enabled: %s" % text)

func _find_button(node: Node, text: String) -> Button:
	if node is Button and (node as Button).text == text:
		return node as Button
	for child in node.get_children():
		var found := _find_button(child, text)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
