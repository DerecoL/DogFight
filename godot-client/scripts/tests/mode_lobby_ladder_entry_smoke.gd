extends SceneTree

var seen_paths: Dictionary = {}

func _init() -> void:
	_run()

func _run() -> void:
	var main_scene = load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame

	var api = main.get("api")
	if api == null or not api.has_signal("request_finished"):
		_fail("Main API client must emit request_finished")
		return
	api.request_finished.connect(func(path: String, _ok: bool, _status: int, _payload: Dictionary) -> void:
		seen_paths[path] = true
	)

	var router = main.get("router")
	if router == null:
		_fail("Main session must expose router")
		return
	var login_screen = main.get_node_or_null("ScreenRoot/LoginScreen")
	var account_input = login_screen.get_node_or_null("%AccountInput") as LineEdit
	var password_input = login_screen.get_node_or_null("%PasswordInput") as LineEdit
	if account_input == null or password_input == null:
		_fail("LoginScreen must expose account and password inputs")
		return
	var account := "godot-ladder-entry-%d-%d" % [int(Time.get_unix_time_from_system()), Time.get_ticks_usec()]
	account_input.text = account
	password_input.text = "dogdice"
	await login_screen.call("_on_register_pressed")
	if not await _wait_for_screen(router, "nickname_setup"):
		_fail("Register should route to nickname setup")
		return
	var nickname_screen = main.get_node_or_null("ScreenRoot/NicknameSetupScreen")
	var nickname_input := _find_line_edit(nickname_screen)
	if nickname_input == null:
		_fail("NicknameSetupScreen must expose nickname input")
		return
	nickname_input.text = "天梯入口烟测"
	await nickname_screen.call("_submit_nickname")
	if not await _wait_for_screen(router, "mode_lobby"):
		_fail("Nickname should route to mode lobby")
		return

	seen_paths.clear()
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	var ladder_button = mode_lobby.find_child("LadderModeButton", true, false) as Button
	if ladder_button == null:
		_fail("Mode lobby must expose LadderModeButton")
		return
	ladder_button.pressed.emit()
	if not await _wait_for_screen(router, "legacy_run"):
		_fail("Ladder entry without ladder run should open playable ladder home, got %s" % str(router.get("current_screen_id")))
		return
	if main.get("run_store").has_run():
		_fail("Ladder entry without ladder run must not create a run directly")
		return
	if not await _wait_for_paths(["/ladder/me", "/ladder/leaderboard"]):
		_fail("Ladder entry should refresh ladder profile and leaderboard")
		return
	if not await _wait_for_idle(main):
		_fail("Ladder home should finish refreshing before interaction")
		return
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null or str(legacy.get("current_tab")) != "排行":
		_fail("Ladder entry should show leaderboard tab")
		return
	var ladder_text := _collect_text(legacy)
	for part in ["天梯排行榜", "选择天梯狗狗", "开始天梯"]:
		if not ladder_text.contains(str(part)):
			_fail("Ladder home missing Web-style start section: %s" % str(part))
			return
	var start_ladder_button = legacy.find_child("StartLadderRunButton", true, false) as Button
	if start_ladder_button == null:
		_fail("Ladder home must expose StartLadderRunButton")
		return
	start_ladder_button.pressed.emit()
	if not await _wait_for_run(main, "LADDER"):
		_fail("Starting from ladder home should create a LADDER run")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot mode lobby ladder entry smoke passed")
	quit(0)

func _wait_for_screen(router: Node, screen_id: String) -> bool:
	for _frame in range(180):
		if str(router.get("current_screen_id")) == screen_id:
			return true
		await process_frame
	return false

func _wait_for_paths(paths: Array) -> bool:
	for _frame in range(180):
		var complete := true
		for path in paths:
			if not seen_paths.has(str(path)):
				complete = false
				break
		if complete:
			return true
		await process_frame
	return false

func _wait_for_run(main: Node, mode: String) -> bool:
	for _frame in range(240):
		var run_store = main.get("run_store")
		if run_store != null and run_store.has_method("has_run") and run_store.has_run():
			var run: Dictionary = run_store.get("run")
			if str(run.get("mode", "")) == mode:
				return true
		await process_frame
	return false

func _wait_for_idle(main: Node) -> bool:
	for _frame in range(240):
		var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
		if legacy != null and not bool(legacy.get("action_in_progress")):
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
	quit(1)
