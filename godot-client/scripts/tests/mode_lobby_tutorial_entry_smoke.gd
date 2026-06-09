extends SceneTree

var main_node: Node

func _init() -> void:
	_run()

func _run() -> void:
	var main := await _new_logged_in_main("godot-tutorial-entry", "TutorialEntrySmoke")
	if main == null:
		return
	var router = main.get("router")
	if not await _assert_standalone_lobby(main, router):
		return

	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	var tutorial_button = mode_lobby.find_child("TutorialReplayButton", true, false) as Button
	if tutorial_button == null:
		_fail("Standalone mode lobby must expose TutorialReplayButton")
		return
	tutorial_button.pressed.emit()
	if not await _wait_for_screen(router, "legacy_run"):
		_fail("Tutorial entry should open playable tutorial shell")
		return
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null or not legacy.visible:
		_fail("Tutorial entry should show LegacyRunScreen tutorial flow")
		return
	if main.get("run_store").has_run():
		_fail("Tutorial entry must not create a run directly")
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
	main_node = main
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
		var error_label = login_screen.get_node_or_null("%ErrorLabel")
		var error_text := str(error_label.text) if error_label != null else ""
		_fail("Register should route to nickname setup, got %s error=%s" % [str(router.get("current_screen_id")), error_text])
		return null
	var nickname_input := _find_line_edit(main.get_node_or_null("ScreenRoot/NicknameSetupScreen"))
	if nickname_input == null:
		_fail("NicknameSetupScreen must expose nickname input")
		return null
	nickname_input.text = nickname
	await main.get_node_or_null("ScreenRoot/NicknameSetupScreen").call("_submit_nickname")
	return main

func _assert_standalone_lobby(main: Node, router: Node) -> bool:
	if not await _wait_for_screen(router, "mode_lobby"):
		_fail("Nickname should route to standalone mode lobby")
		return false
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if mode_lobby == null or not mode_lobby.visible:
		_fail("Standalone mode lobby should show ModeLobbyScreen")
		return false
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy != null and legacy.visible:
		_fail("Standalone mode lobby must not show LegacyRunScreen")
		return false
	for node_name in ["ModeLobbyPanel", "ModeGrid", "TutorialReplayButton"]:
		if mode_lobby.find_child(node_name, true, false) == null:
			_fail("Standalone mode lobby missing node: %s" % node_name)
			return false
	return true

func _wait_for_screen(router: Node, screen_id: String) -> bool:
	for _frame in range(240):
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

func _fail(message: String) -> void:
	push_error(message)
	if main_node != null:
		main_node.queue_free()
	quit(1)
