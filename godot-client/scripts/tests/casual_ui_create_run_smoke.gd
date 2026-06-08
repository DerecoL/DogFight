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
	if not await _wait_for_screen(router, "legacy_run"):
		_fail("Login should route to playable lobby")
		return
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null or not legacy.visible:
		_fail("LegacyRunScreen should be visible after login")
		return

	var casual_button = _find_button_containing(legacy, "开始休闲模式")
	if casual_button == null:
		_fail("Playable lobby must expose casual mode entry")
		return
	casual_button.pressed.emit()
	await process_frame
	await process_frame
	if main.get("run_store").has_run():
		_fail("Entering casual mode must not create a run before dog confirmation")
		return
	if str(legacy.get("current_tab")) != "跑局":
		_fail("Casual mode entry should open dog-selection run tab")
		return
	if _find_button_containing(legacy, "开始一局") == null:
		_fail("Dog-selection run tab must expose start-run confirmation")
		return

	var start_button = _find_button_containing(legacy, "开始一局")
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
		_fail("Created run must not show the old standalone ModeLobbyScreen")
		return
	if legacy.find_child("PlaceholderPanel", true, false) != null:
		_fail("Created run must not show placeholder content")
		return
	var text := _collect_text(legacy)
	for part in ["当前跑局", "地图", "装备", "遗物"]:
		if not text.contains(part):
			_fail("Created run UI missing section: %s" % part)
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
		_fail("Register should route to nickname setup")
		return null
	var nickname_screen = main.get_node_or_null("ScreenRoot/NicknameSetupScreen")
	var nickname_input := _find_line_edit(nickname_screen)
	if nickname_input == null:
		_fail("NicknameSetupScreen must expose nickname input")
		return null
	nickname_input.text = "休闲建局烟测"
	await nickname_screen.call("_submit_nickname")
	return main

func _wait_for_screen(router: Node, screen_id: String) -> bool:
	for _frame in range(180):
		if str(router.get("current_screen_id")) == screen_id:
			return true
		await process_frame
	return false

func _wait_for_run(main: Node) -> bool:
	for _frame in range(600):
		var run_store = main.get("run_store")
		if run_store != null and run_store.has_method("has_run") and run_store.has_run():
			var run: Dictionary = run_store.get("run")
			if str(run.get("mode", "")) == "CASUAL" and str(run.get("phase", "")).length() > 0:
				return true
		await process_frame
	return false

func _run_store_debug(main: Node) -> String:
	var run_store = main.get("run_store")
	if run_store == null:
		return "missing"
	if not run_store.has_method("has_run"):
		return "no has_run method"
	if not run_store.has_run():
		return "empty"
	var run: Dictionary = run_store.get("run")
	return "mode=%s phase=%s status=%s id=%s" % [
		str(run.get("mode", "")),
		str(run.get("phase", "")),
		str(run.get("status", "")),
		str(run.get("id", "")),
	]

func _wait_for_path(path: String) -> bool:
	for _frame in range(600):
		if seen_paths.has(path):
			return true
		await process_frame
	return false

func _wait_for_idle(legacy: Node) -> bool:
	for _frame in range(600):
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

func _find_button_containing(node: Node, text: String) -> Button:
	if node is Button and (node as Button).is_visible_in_tree() and (node as Button).text.contains(text):
		return node as Button
	for child in node.get_children():
		var result := _find_button_containing(child, text)
		if result != null:
			return result
	return null

func _collect_text(node: Node) -> String:
	var text := ""
	if node is CanvasItem and not (node as CanvasItem).is_visible_in_tree():
		return text
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
