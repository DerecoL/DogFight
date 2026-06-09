extends SceneTree

var seen_paths: Dictionary = {}
var main_node: Node

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
	if not await _wait_for_idle(mode_lobby):
		_fail("Mode lobby should finish initial refresh before room entry")
		return
	var rooms_button = mode_lobby.find_child("DogfightModeButton", true, false) as Button
	if rooms_button == null:
		_fail("Standalone mode lobby must expose DogfightModeButton")
		return

	seen_paths.clear()
	rooms_button.pressed.emit()
	if not await _wait_for_screen(router, "legacy_run"):
		_fail("Dogfight room entry should show the playable room shell")
		return
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null or not legacy.visible:
		_fail("Dogfight room entry should show LegacyRunScreen room flow")
		return
	for _frame in range(4):
		await process_frame
	if str(legacy.get("current_tab")) != "房间":
		_fail("Dogfight room entry should switch to room tab before refresh, got %s" % str(legacy.get("current_tab")))
		return
	if not await _wait_for_path("/dogfight/rooms"):
		_fail("Dogfight room entry should refresh room list; seen paths: %s rooms=%s" % [str(seen_paths.keys()), str(legacy.get("rooms_data"))])
		return
	if not await _wait_for_idle(legacy):
		_fail("Dogfight room entry should finish refreshing before interaction")
		return
	if main.get_node_or_null("ScreenRoot/DogfightRoomsScreen").visible:
		_fail("Dogfight room entry must not show the old standalone DogfightRoomsScreen")
		return
	if legacy.find_child("PlaceholderPanel", true, false) != null:
		_fail("Dogfight room entry must not show placeholder content")
		return
	if main.get("run_store").has_run():
		_fail("Opening dogfight rooms must not create a casual or ladder run")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot mode lobby rooms entry smoke passed")
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
	var api = main.get("api")
	if api == null or not api.has_signal("request_finished"):
		_fail("Main API client must emit request_finished")
		return null
	api.request_finished.connect(func(path: String, _ok: bool, _status: int, _payload: Dictionary) -> void:
		seen_paths[path] = true
	)
	var router = main.get("router")
	var login_screen = main.get_node_or_null("ScreenRoot/LoginScreen")
	var account_input = login_screen.get_node_or_null("%AccountInput") as LineEdit
	var password_input = login_screen.get_node_or_null("%PasswordInput") as LineEdit
	if router == null or account_input == null or password_input == null:
		_fail("Login flow requires router and login inputs")
		return null
	account_input.text = "godot-rooms-entry-%d-%d" % [int(Time.get_unix_time_from_system()), Time.get_ticks_usec()]
	password_input.text = "dogdice"
	await login_screen.call("_on_register_pressed")
	if not await _wait_for_screen(router, "nickname_setup"):
		var error_label = login_screen.get_node_or_null("%ErrorLabel")
		var error_text := str(error_label.text) if error_label != null else ""
		_fail("Register should route to nickname setup, got %s error=%s" % [str(router.get("current_screen_id")), error_text])
		return null
	var nickname_screen = main.get_node_or_null("ScreenRoot/NicknameSetupScreen")
	var nickname_input := _find_line_edit(nickname_screen)
	if nickname_input == null:
		_fail("NicknameSetupScreen must expose nickname input")
		return null
	nickname_input.text = "RoomsEntrySmoke"
	await nickname_screen.call("_submit_nickname")
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

func _fail(message: String) -> void:
	push_error(message)
	if main_node != null:
		main_node.queue_free()
	quit(1)
