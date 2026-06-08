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
	if not await _wait_for_screen(router, "legacy_run"):
		_fail("Login should route to playable lobby")
		return
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null or not legacy.visible:
		_fail("LegacyRunScreen should be visible after login")
		return
	if main.get_node_or_null("ScreenRoot/ModeLobbyScreen").visible:
		_fail("Playable lobby must not show the old standalone ModeLobbyScreen")
		return

	seen_paths.clear()
	var rooms_button = _find_button_containing(legacy, "进入斗狗模式")
	if rooms_button == null:
		_fail("Playable lobby must expose dogfight room entry")
		return
	rooms_button.pressed.emit()
	if not await _wait_for_screen(router, "legacy_run"):
		_fail("Dogfight room entry should keep playable shell visible")
		return
	if not await _wait_for_path("/dogfight/rooms"):
		_fail("Dogfight room entry should refresh room list")
		return
	if not await _wait_for_idle(legacy):
		_fail("Dogfight room entry should finish refreshing before interaction")
		return
	if str(legacy.get("current_tab")) != "房间":
		_fail("Dogfight room entry should show room tab")
		return
	if main.get_node_or_null("ScreenRoot/DogfightRoomsScreen").visible:
		_fail("Dogfight room entry must not show the old standalone DogfightRoomsScreen")
		return
	if legacy.find_child("PlaceholderPanel", true, false) != null:
		_fail("Dogfight room entry must not show placeholder content")
		return
	var text := _collect_text(legacy)
	for part in ["多人房间", "创建房间", "随机匹配", "刷新房间", "房间列表"]:
		if not text.contains(part):
			_fail("Dogfight room tab missing Web-style control: %s" % part)
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
	if router == null or login_screen == null:
		_fail("Main must expose router and LoginScreen")
		return null
	var account_input = login_screen.get_node_or_null("%AccountInput") as LineEdit
	var password_input = login_screen.get_node_or_null("%PasswordInput") as LineEdit
	if account_input == null or password_input == null:
		_fail("LoginScreen must expose account and password inputs")
		return null
	account_input.text = "godot-rooms-entry-%d-%d" % [int(Time.get_unix_time_from_system()), Time.get_ticks_usec()]
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
	nickname_input.text = "房间入口烟测"
	await nickname_screen.call("_submit_nickname")
	return main

func _wait_for_screen(router: Node, screen_id: String) -> bool:
	for _frame in range(180):
		if str(router.get("current_screen_id")) == screen_id:
			return true
		await process_frame
	return false

func _wait_for_path(path: String) -> bool:
	for _frame in range(180):
		if seen_paths.has(path):
			return true
		await process_frame
	return false

func _wait_for_idle(legacy: Node) -> bool:
	for _frame in range(240):
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
