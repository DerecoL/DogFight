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
	var account := "godot-peak-entry-%d-%d" % [int(Time.get_unix_time_from_system()), Time.get_ticks_usec()]
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
	nickname_input.text = "巅峰入口烟测"
	await nickname_screen.call("_submit_nickname")
	if not await _wait_for_screen(router, "mode_lobby"):
		_fail("Nickname should route to mode lobby")
		return

	seen_paths.clear()
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	var peak_button = mode_lobby.find_child("PeakModeButton", true, false) as Button
	if peak_button == null:
		_fail("Mode lobby must expose PeakModeButton")
		return
	peak_button.pressed.emit()
	if not await _wait_for_screen(router, "legacy_run"):
		_fail("Peak entry should open playable Apex screen")
		return
	if not await _wait_for_paths(["/apex"]):
		_fail("Peak entry should refresh Apex data")
		return
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null or str(legacy.get("current_tab")) != "巅峰":
		_fail("Peak entry should show independent Apex tab")
		return
	var text := _collect_text(legacy)
	for part in ["巅峰竞技场", "可提交完成局", "总榜", "当日榜"]:
		if not text.contains(str(part)):
			_fail("Peak screen missing Web-style section: %s" % str(part))
			return
	if text.contains("天梯排行榜"):
		_fail("Peak screen must not open on ladder leaderboard content")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot mode lobby peak entry smoke passed")
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
