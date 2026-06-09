extends SceneTree

var main_node: Node
var api_finished_count := 0
var api_seen_paths: Dictionary = {}
var api_failures: Array[String] = []
var required_api_paths := [
	"/auth/register",
	"/me",
	"/profile/nickname",
]
var forbidden_legacy_refresh_paths := [
	"/achievements",
	"/daily-tasks",
	"/shop",
	"/cosmetics/me",
	"/ladder/leaderboard",
	"/apex",
	"/dogfight/rooms",
]

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
	var api = main.get("api")
	if api != null and api.has_signal("request_finished"):
		api.request_finished.connect(func(path: String, ok: bool, status: int, payload: Dictionary) -> void:
			api_finished_count += 1
			api_seen_paths[path] = true
			print("quick_start_api ", path, " ok=", ok, " status=", status, " error=", str(payload.get("error", "")))
			if not ok and required_api_paths.has(path):
				api_failures.append("%s status=%d error=%s" % [path, status, str(payload.get("error", ""))])
		)

	var login_screen = main.get_node_or_null("ScreenRoot/LoginScreen")
	if login_screen == null or not login_screen.has_method("_on_quick_start_pressed"):
		_fail("LoginScreen quick start action is missing")
		return
	login_screen.call("_on_quick_start_pressed")

	var router = main.get("router")
	for _frame in range(180):
		if router != null and str(router.get("current_screen_id")) != "login":
			break
		await process_frame
	if router == null:
		_fail("Quick start did not initialize router")
		return
	var current_screen = str(router.get("current_screen_id"))
	if current_screen == "login":
		var error_label = login_screen.get_node_or_null("%ErrorLabel")
		var error_text: String = error_label.text if error_label != null else ""
		_fail("Quick start did not leave LoginScreen: %s" % error_text)
		return
	if not ["nickname_setup", "mode_lobby"].has(current_screen):
		_fail("Quick start routed to unexpected Web screen: %s" % current_screen)
		return
	if current_screen == "nickname_setup":
		var nickname_screen = main.get_node_or_null("ScreenRoot/NicknameSetupScreen")
		if nickname_screen == null:
			_fail("NicknameSetupScreen is missing after quick start")
			return
		var nickname_input := _find_line_edit(nickname_screen)
		if nickname_input == null:
			_fail("NicknameSetupScreen must provide a nickname input")
			return
		nickname_input.text = "Godot烟测"
		await nickname_screen.call("_submit_nickname")
		for _frame in range(180):
			if str(router.get("current_screen_id")) == "mode_lobby":
				break
			await process_frame
		current_screen = str(router.get("current_screen_id"))
		if current_screen != "mode_lobby":
			_fail("Nickname submit did not route to standalone mode lobby, got %s" % current_screen)
			return
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if mode_lobby == null or not mode_lobby.visible:
		_fail("Quick start must show standalone ModeLobbyScreen")
		return
	var run_screen = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if run_screen != null and run_screen.visible:
		_fail("Quick start must not render the mode lobby inside LegacyRunScreen")
		return
	if mode_lobby.find_child("PlaceholderPanel", true, false) != null:
		_fail("Quick start must not show placeholder content")
		return
	for node_name in ["ModeLobbyPanel", "ModeLobbyScroll", "ModeGrid", "CasualModeButton", "LadderModeButton", "DogfightModeButton", "PeakModeButton"]:
		if mode_lobby.find_child(node_name, true, false) == null:
			_fail("Quick start mode lobby missing Web node: %s" % node_name)
			return
	for path in required_api_paths:
		if not api_seen_paths.has(path):
			_fail("Quick start did not request required API path: %s" % path)
			return
	for path in forbidden_legacy_refresh_paths:
		if api_seen_paths.has(path):
			_fail("Quick start triggered legacy RunScreen refresh path: %s" % path)
			return
	if not api_failures.is_empty():
		_fail("Quick start API failures: %s" % "; ".join(api_failures))
		return
	print("Godot quick start smoke passed")
	await process_frame
	_cleanup()
	for _frame in range(10):
		await process_frame
	quit(0)

func _cleanup() -> void:
	if main_node != null and is_instance_valid(main_node):
		main_node.queue_free()
	main_node = null

func _fail(message: String) -> void:
	push_error(message)
	_cleanup()
	quit(1)

func _find_line_edit(node: Node) -> LineEdit:
	if node is LineEdit:
		return node as LineEdit
	for child in node.get_children():
		var result := _find_line_edit(child)
		if result != null:
			return result
	return null
