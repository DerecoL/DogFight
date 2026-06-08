extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var main := await _new_logged_in_main("godot-tutorial-entry", "引导入口烟测")
	if main == null:
		return
	var router = main.get("router")
	if not await _assert_playable_lobby(main, router):
		return

	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	var tutorial_button = _find_button_containing(legacy, "重播新手引导")
	if tutorial_button == null:
		_fail("Playable mode lobby must expose tutorial entry")
		return
	tutorial_button.pressed.emit()
	if not await _wait_for_screen(router, "legacy_run"):
		_fail("Tutorial entry should keep playable run shell visible")
		return
	if main.get("run_store").has_run():
		_fail("Tutorial entry must not create a run directly")
		return
	if str(legacy.get("current_tab")) != "大厅":
		_fail("Tutorial entry should keep the run shell on lobby guidance")
		return
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	if not await _wait_for_modal(modal_layer):
		_fail("Tutorial entry should open tutorial modal")
		return
	var text := _collect_text(modal_layer)
	for part in ["新手引导", "选择狗狗", "继续跑局"]:
		if not text.contains(part):
			_fail("Tutorial modal missing text: %s" % part)
			return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot mode lobby tutorial entry smoke passed")
	quit(0)

func _new_logged_in_main(account_prefix: String, nickname: String) -> Node:
	var main_scene = load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return null
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame
	var router = main.get("router")
	var login_screen = main.get_node_or_null("ScreenRoot/LoginScreen")
	if router == null or login_screen == null:
		_fail("Main session must expose router and LoginScreen")
		return null
	var account_input = login_screen.get_node_or_null("%AccountInput") as LineEdit
	var password_input = login_screen.get_node_or_null("%PasswordInput") as LineEdit
	if account_input == null or password_input == null:
		_fail("LoginScreen must expose account and password inputs")
		return null
	account_input.text = "%s-%d-%d" % [account_prefix, int(Time.get_unix_time_from_system()), Time.get_ticks_usec()]
	password_input.text = "dogdice"
	await login_screen.call("_on_register_pressed")
	if not await _wait_for_screen(router, "nickname_setup"):
		_fail("Register should route to nickname setup")
		return null
	var nickname_input := _find_line_edit(main.get_node_or_null("ScreenRoot/NicknameSetupScreen"))
	if nickname_input == null:
		_fail("NicknameSetupScreen must expose nickname input")
		return null
	nickname_input.text = nickname
	await main.get_node_or_null("ScreenRoot/NicknameSetupScreen").call("_submit_nickname")
	return main

func _assert_playable_lobby(main: Node, router: Node) -> bool:
	if not await _wait_for_screen(router, "legacy_run"):
		_fail("Nickname should route to playable mode lobby")
		return false
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null or not legacy.visible:
		_fail("Playable mode lobby should show LegacyRunScreen")
		return false
	if main.get_node_or_null("ScreenRoot/ModeLobbyScreen").visible:
		_fail("Playable mode lobby must not show the old standalone ModeLobbyScreen")
		return false
	return true

func _wait_for_screen(router: Node, screen_id: String) -> bool:
	for _frame in range(180):
		if str(router.get("current_screen_id")) == screen_id:
			return true
		await process_frame
	return false

func _wait_for_modal(modal_layer: Node) -> bool:
	for _frame in range(180):
		if modal_layer.get_child_count() > 0:
			return true
		await process_frame
	return false

func _find_line_edit(node: Node) -> LineEdit:
	if node == null:
		return null
	if node is LineEdit:
		return node as LineEdit
	for child in node.get_children():
		var result := _find_line_edit(child)
		if result != null:
			return result
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

func _find_button_containing(node: Node, text: String) -> Button:
	if node is Button and (node as Button).text.contains(text):
		return node as Button
	for child in node.get_children():
		var result := _find_button_containing(child, text)
		if result != null:
			return result
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
