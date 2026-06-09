extends SceneTree

var main_node: Node

func _init() -> void:
	_run()

func _run() -> void:
	var main_scene = load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	main_node = main
	root.add_child(main)
	await process_frame
	await process_frame

	var router = main.get("router")
	var login_screen = main.get_node_or_null("ScreenRoot/LoginScreen")
	if router == null or login_screen == null:
		_fail("Login flow requires router and LoginScreen")
		return
	var account_input = login_screen.get_node_or_null("%AccountInput") as LineEdit
	var password_input = login_screen.get_node_or_null("%PasswordInput") as LineEdit
	if account_input == null or password_input == null:
		_fail("LoginScreen must expose account and password inputs")
		return

	var account := "godot-login-flow-%d-%d" % [int(Time.get_unix_time_from_system()), Time.get_ticks_usec()]
	account_input.text = account
	password_input.text = "dogdice"
	await login_screen.call("_on_register_pressed")
	if not await _wait_for_screen(router, "nickname_setup"):
		_fail("Register should route new account to nickname_setup, got %s" % str(router.get("current_screen_id")))
		return

	var nickname_screen = main.get_node_or_null("ScreenRoot/NicknameSetupScreen")
	var nickname_input := _find_line_edit(nickname_screen)
	if nickname_input == null:
		_fail("NicknameSetupScreen must expose nickname input")
		return
	nickname_input.text = "LoginFlowSmoke"
	await nickname_screen.call("_submit_nickname")
	if not await _assert_standalone_mode_lobby(main, router, "Nickname submit"):
		return

	if not await main.call("logout"):
		_fail("Logout failed after registration")
		return
	if not await _wait_for_screen(router, "login"):
		_fail("Logout should route back to login, got %s" % str(router.get("current_screen_id")))
		return

	account_input.text = account
	password_input.text = "dogdice"
	await login_screen.call("_on_login_pressed")
	if not await _assert_standalone_mode_lobby(main, router, "Login with saved nickname"):
		return
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	var casual_button = mode_lobby.find_child("CasualModeButton", true, false) as Button
	if casual_button == null:
		_fail("Standalone mode lobby must expose CasualModeButton")
		return
	casual_button.pressed.emit()
	if not await _wait_for_screen(router, "legacy_run"):
		_fail("Entering casual mode should open the playable dog-selection shell, got %s" % str(router.get("current_screen_id")))
		return
	var legacy_run_screen = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy_run_screen == null or not legacy_run_screen.visible:
		_fail("Casual mode entry should show LegacyRunScreen dog-selection flow")
		return
	if main.get("run_store").has_run():
		_fail("Entering casual mode without a run must not create a run directly")
		return
	if str(legacy_run_screen.get("current_tab")) != "跑局":
		_fail("Entering casual mode should open the run tab, got %s" % str(legacy_run_screen.get("current_tab")))
		return
	var run_text := _collect_text(legacy_run_screen)
	if not run_text.contains("选择狗狗") or not run_text.contains("开始一局"):
		_fail("Entering casual mode should show dog selection and start action")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot login/register flow smoke passed")
	quit(0)

func _assert_standalone_mode_lobby(main: Node, router: Node, context: String) -> bool:
	if not await _wait_for_screen(router, "mode_lobby"):
		_fail("%s should route to standalone mode lobby, got %s" % [context, str(router.get("current_screen_id"))])
		return false
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if mode_lobby == null or not mode_lobby.visible:
		_fail("%s should show ModeLobbyScreen" % context)
		return false
	var legacy_run_screen = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy_run_screen != null and legacy_run_screen.visible:
		_fail("%s must not render mode lobby inside LegacyRunScreen" % context)
		return false
	if mode_lobby.find_child("PlaceholderPanel", true, false) != null:
		_fail("%s must not show placeholder content" % context)
		return false
	for node_name in ["ModeLobbyPanel", "ModeLobbyScroll", "ModeGrid", "CasualModeButton", "LadderModeButton", "DogfightModeButton", "PeakModeButton"]:
		if mode_lobby.find_child(node_name, true, false) == null:
			_fail("%s mode lobby missing Web node: %s" % [context, node_name])
			return false
	if mode_lobby.find_child("StartRunButton", true, false) != null:
		_fail("%s mode lobby should not expose direct start form controls before choosing casual mode" % context)
		return false
	return true

func _wait_for_screen(router: Node, screen_id: String) -> bool:
	for _frame in range(240):
		if str(router.get("current_screen_id")) == screen_id:
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
