extends SceneTree

const ApiClient := preload("res://scripts/api/ApiClient.gd")

var seen_paths: Dictionary = {}
var main_node: Node
var guest_api: Node

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

	var rooms_button = _find_button_containing(legacy, "进入斗狗模式")
	if rooms_button == null:
		_fail("Playable lobby must expose dogfight room entry")
		return
	rooms_button.pressed.emit()
	if not await _wait_for_idle(legacy):
		_fail("Dogfight room entry should finish refreshing")
		return
	var create_button = _find_button_containing(legacy, "创建房间")
	if create_button == null:
		_fail("Room tab must expose create-room action")
		return

	seen_paths.clear()
	create_button.pressed.emit()
	if not await _wait_for_path("/dogfight/rooms"):
		_fail("Create-room action should POST /dogfight/rooms")
		return
	if not await _wait_for_idle(legacy):
		_fail("Create-room action should finish refreshing")
		return
	var active_room: Dictionary = legacy.get("active_room")
	var room_id := str(active_room.get("id", ""))
	if room_id.is_empty():
		_fail("Create-room action should populate active_room id")
		return

	if not await _register_guest_and_join_room(room_id):
		return

	var start_button = _find_button_containing(legacy, "开始房间")
	if start_button == null:
		_fail("Host room detail must expose start-room action after creation")
		return
	seen_paths.clear()
	start_button.pressed.emit()
	if not await _wait_for_path("/dogfight/rooms/%s/start" % room_id):
		_fail("Start-room action should POST /dogfight/rooms/{roomId}/start")
		return
	if not await _wait_for_idle(legacy):
		_fail("Start-room action should finish refreshing")
		return
	if not await _wait_for_room_phase(legacy, "DOG_SELECT"):
		_fail("Starting a room with two players should enter dog selection")
		return
	if _visible_placeholder(main):
		_fail("Dog selection must not route to placeholder content")
		return
	var choice_button = await _wait_for_room_dog_choice_button(legacy)
	if choice_button == null or not choice_button.is_visible_in_tree():
		_fail("Dog selection UI must expose the lock-dog button")
		return

	seen_paths.clear()
	choice_button.pressed.emit()
	if not await _wait_for_path("/dogfight/rooms/%s/dog-choice" % room_id):
		_fail("Lock-dog action should POST /dogfight/rooms/{roomId}/dog-choice")
		return
	if not await _wait_for_idle(legacy):
		_fail("Lock-dog action should finish refreshing")
		return
	if not await _wait_for_room_current_run(legacy):
		_fail("Locking a dog should render the host's current room run")
		return
	if _visible_placeholder(main):
		_fail("Locked room run must not show placeholder content")
		return
	var text := await _wait_for_text_parts(legacy, ["当前房间", "房间当前跑局", "犬种", "进度"])
	for part in ["当前房间", "房间当前跑局", "犬种", "进度"]:
		if not text.contains(part):
			_fail("Locked room run UI missing Web-style room detail: %s" % part)
			return
	var old_detail = main.get_node_or_null("ScreenRoot/DogfightRoomDetailScreen")
	if old_detail != null and old_detail.visible:
		_fail("Room start flow must not show the old standalone room detail screen")
		return

	main.queue_free()
	if guest_api != null:
		guest_api.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot room start and dog choice UI smoke passed")
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
	account_input.text = "godot-room-start-%d-%d" % [int(Time.get_unix_time_from_system()), Time.get_ticks_usec()]
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
	nickname_input.text = "房主烟测"
	await nickname_screen.call("_submit_nickname")
	return main

func _register_guest_and_join_room(room_id: String) -> bool:
	guest_api = ApiClient.new()
	var base_url := OS.get_environment("DOGFIGHT_API_BASE_URL")
	guest_api.configure(base_url if base_url.length() > 0 else "http://127.0.0.1:4000/api")
	root.add_child(guest_api)
	var account := "godot-room-guest-%d-%d" % [int(Time.get_unix_time_from_system()), Time.get_ticks_usec()]
	var registered: Dictionary = await guest_api.post_json("/auth/register", {"account": account, "password": "dogdice"})
	if not bool(registered.get("ok", false)):
		_fail("Guest account registration failed: %s" % str(registered.get("error", "")))
		return false
	var nicknamed: Dictionary = await guest_api.post_json("/profile/nickname", {"nickname": "访客烟测"})
	if not bool(nicknamed.get("ok", false)):
		_fail("Guest nickname setup failed: %s" % str(nicknamed.get("error", "")))
		return false
	var joined: Dictionary = await guest_api.post_json("/dogfight/rooms/%s/join" % room_id, {})
	if not bool(joined.get("ok", false)):
		_fail("Guest should be able to join host room: %s" % str(joined.get("error", "")))
		return false
	return true

func _wait_for_screen(router: Node, screen_id: String) -> bool:
	for _frame in range(180):
		if str(router.get("current_screen_id")) == screen_id:
			return true
		await process_frame
	return false

func _wait_for_path(path: String) -> bool:
	for _frame in range(240):
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

func _wait_for_room_phase(legacy: Node, phase: String) -> bool:
	for _frame in range(240):
		var active_room: Dictionary = legacy.get("active_room")
		if str(active_room.get("phase", "")) == phase:
			return true
		await process_frame
	return false

func _wait_for_room_current_run(legacy: Node) -> bool:
	for _frame in range(240):
		var active_room: Dictionary = legacy.get("active_room")
		var current_run = active_room.get("currentRun", {})
		if current_run is Dictionary and not (current_run as Dictionary).is_empty():
			return true
		await process_frame
	return false

func _wait_for_room_dog_choice_button(legacy: Node) -> Button:
	for _frame in range(240):
		var choice_button = legacy.find_child("RoomDogChoiceButton", true, false) as Button
		if choice_button != null and choice_button.is_visible_in_tree():
			return choice_button
		await process_frame
	return null

func _wait_for_text_parts(node: Node, parts: Array) -> String:
	var text := ""
	for _frame in range(240):
		text = _collect_text(node)
		var complete := true
		for part in parts:
			if not text.contains(str(part)):
				complete = false
				break
		if complete:
			return text
		await process_frame
	return text

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
	if node == null:
		return null
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

func _visible_placeholder(main: Node) -> bool:
	var placeholder = main.find_child("PlaceholderPanel", true, false)
	return placeholder is CanvasItem and (placeholder as CanvasItem).is_visible_in_tree()

func _fail(message: String) -> void:
	push_error(message)
	if main_node != null:
		main_node.queue_free()
	if guest_api != null:
		guest_api.queue_free()
	quit(1)
