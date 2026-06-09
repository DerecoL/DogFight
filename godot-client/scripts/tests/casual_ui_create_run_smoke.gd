extends SceneTree

var main_node: Node
var seen_paths: Dictionary = {}
var seen_responses: Dictionary = {}

func _init() -> void:
	_run()

func _run() -> void:
	var main := await _new_logged_in_main()
	if main == null:
		return
	var router = main.get("router")
	if not await _wait_for_screen(router, "mode_lobby"):
		_fail("Login should route to standalone mode lobby")
		return
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if mode_lobby == null or not mode_lobby.visible:
		_fail("ModeLobbyScreen should be visible after login")
		return
	var casual_button = mode_lobby.find_child("CasualModeButton", true, false) as Button
	if casual_button == null:
		_fail("Standalone mode lobby must expose CasualModeButton")
		return
	casual_button.pressed.emit()
	if not await _wait_for_screen(router, "legacy_run"):
		_fail("Casual mode entry should open playable dog-selection shell")
		return
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null or not legacy.visible:
		_fail("Casual mode entry should show LegacyRunScreen")
		return
	if main.get("run_store").has_run():
		_fail("Entering casual mode must not create a run before dog confirmation")
		return
	if str(legacy.get("current_tab")) != "跑局":
		_fail("Casual mode entry should open dog-selection run tab, got %s" % str(legacy.get("current_tab")))
		return
	var start_button = _find_button_containing(legacy, "开始一局")
	if start_button == null:
		_fail("Dog-selection run tab must expose start-run confirmation")
		return

	seen_paths.clear()
	start_button.pressed.emit()
	if not await _wait_for_path("/runs"):
		_fail("Start-run confirmation should POST /runs")
		return
	if not await _wait_for_idle(legacy):
		_fail("Start-run confirmation should finish refreshing")
		return
	if not await _wait_for_run(main):
		_fail("Start-run confirmation should create a playable CASUAL run; /runs response=%s store=%s" % [
			str(seen_responses.get("/runs", {})),
			_run_store_debug(main),
		])
		return
	if str(router.get("current_screen_id")) != "legacy_run":
		_fail("Created run should stay in playable run shell")
		return
	if main.get_node_or_null("ScreenRoot/ModeLobbyScreen").visible:
		_fail("Created run must hide ModeLobbyScreen")
		return
	if legacy.find_child("PlaceholderPanel", true, false) != null:
		_fail("Created run must not show placeholder content")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot casual UI create run smoke passed")
	quit(0)

func _new_logged_in_main() -> Node:
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
		_fail("Main must expose router and LoginScreen")
		return null
	var api = main.get("api")
	if api == null or not api.has_signal("request_finished"):
		_fail("Main API client must emit request_finished")
		return null
	api.request_finished.connect(func(path: String, _ok: bool, _status: int, _payload: Dictionary) -> void:
		seen_paths[path] = true
		seen_responses[path] = {"ok": _ok, "status": _status, "payload": _payload}
	)
	var account_input = login_screen.get_node_or_null("%AccountInput") as LineEdit
	var password_input = login_screen.get_node_or_null("%PasswordInput") as LineEdit
	if account_input == null or password_input == null:
		_fail("LoginScreen must expose account and password inputs")
		return null
	account_input.text = "godot-casual-ui-%d-%d" % [int(Time.get_unix_time_from_system()), Time.get_ticks_usec()]
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
	nickname_input.text = "CasualUiSmoke"
	await main.get_node_or_null("ScreenRoot/NicknameSetupScreen").call("_submit_nickname")
	return main

func _wait_for_screen(router: Node, screen_id: String) -> bool:
	for _frame in range(240):
		if str(router.get("current_screen_id")) == screen_id:
			return true
		await process_frame
	return false

func _wait_for_path(path: String) -> bool:
	for _frame in range(600):
		if seen_paths.has(path):
			return true
		await process_frame
	return false

func _wait_for_run(main: Node) -> bool:
	for _frame in range(600):
		var run_store = main.get("run_store")
		if run_store != null and run_store.has_method("has_run") and run_store.has_run():
			var run: Dictionary = run_store.get("run")
			if str(run.get("mode", "")) == "CASUAL":
				return true
		await process_frame
	return false

func _wait_for_idle(node: Node) -> bool:
	for _frame in range(600):
		if node != null and not bool(node.get("action_in_progress")):
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

func _find_button_containing(node: Node, text: String) -> Button:
	if node is Button and (node as Button).text.contains(text):
		return node as Button
	for child in node.get_children():
		var result := _find_button_containing(child, text)
		if result != null:
			return result
	return null

func _run_store_debug(main: Node) -> String:
	var run_store = main.get("run_store")
	if run_store == null:
		return "<missing>"
	return "has_run=%s run=%s" % [str(run_store.has_run()), str(run_store.get("run"))]

func _fail(message: String) -> void:
	push_error(message)
	if main_node != null:
		main_node.queue_free()
	quit(1)
