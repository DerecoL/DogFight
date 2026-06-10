extends SceneTree

const ApiClientScript := preload("res://scripts/api/ApiClient.gd")

class FakeApi:
	extends ApiClientScript

	var users: Dictionary = {}
	var current_account := ""

	func post_json(path: String, body: Dictionary = {}) -> Dictionary:
		var response := _response_for_post(path, body)
		request_finished.emit(path, bool(response.get("ok", false)), int(response.get("status", 0)), response)
		return response

	func get_json(path: String) -> Dictionary:
		var response := _response_for_get(path)
		request_finished.emit(path, bool(response.get("ok", false)), int(response.get("status", 0)), response)
		return response

	func _response_for_post(path: String, body: Dictionary) -> Dictionary:
		match path:
			"/auth/register":
				var account := str(body.get("account", ""))
				var user := {"id": "user-%s" % account, "account": account, "nickname": null}
				users[account] = user
				current_account = account
				return _ok({"user": user.duplicate(true), "needsNickname": true})
			"/profile/nickname":
				if current_account.is_empty() or not users.has(current_account):
					return _error("No active user")
				var user: Dictionary = users[current_account]
				user["nickname"] = str(body.get("nickname", ""))
				users[current_account] = user
				return _ok({"user": user.duplicate(true), "needsNickname": false})
			_:
				return _ok({})

	func _response_for_get(path: String) -> Dictionary:
		match path:
			"/me":
				if current_account.is_empty() or not users.has(current_account):
					return _error("Not logged in")
				var user: Dictionary = users[current_account]
				return _ok({"user": user.duplicate(true), "needsNickname": _needs_nickname(user), "activeRun": null})
			"/runs/history":
				return _ok({"history": {"runs": [], "stats": {"totalRuns": 0, "wins": 0, "losses": 0}}, "seasonSummaries": []})
			"/ladder/me":
				return _ok({"profile": {}, "leaderboard": [], "bestRun": null})
			"/dogfight/rooms":
				return _ok({"rooms": [], "activeRoom": null})
			_:
				return _ok({})

	func _needs_nickname(user: Dictionary) -> bool:
		return user.get("nickname", null) == null or str(user.get("nickname", "")).strip_edges().is_empty()

	func _ok(data: Dictionary) -> Dictionary:
		return {"ok": true, "status": 200, "error": "", "data": data}

	func _error(message: String) -> Dictionary:
		return {"ok": false, "status": 400, "error": message, "data": {}}

var seen_paths: Dictionary = {}
var main_node: Node
var fake_api_node: FakeApi

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
	if not await _wait_for_screen(router, "dogfight_rooms"):
		_fail("Dogfight room entry should show the standalone dogfight room list")
		return
	var dogfight_rooms = main.get_node_or_null("ScreenRoot/DogfightRoomsScreen")
	if dogfight_rooms == null or not dogfight_rooms.visible:
		_fail("Dogfight room entry should show DogfightRoomsScreen")
		return
	for _frame in range(4):
		await process_frame
	if dogfight_rooms.find_child("DogfightScreen", true, false) == null:
		_fail("Dogfight room entry should render the Web dogfight room list")
		return
	if not await _wait_for_path("/dogfight/rooms"):
		_fail("Dogfight room entry should refresh room list; seen paths: %s" % str(seen_paths.keys()))
		return
	if not await _wait_for_idle(dogfight_rooms):
		_fail("Dogfight room entry should finish refreshing before interaction")
		return
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy != null and legacy.visible:
		_fail("Dogfight room entry must not show LegacyRunScreen")
		return
	if dogfight_rooms.find_child("PlaceholderPanel", true, false) != null:
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
	var fake_api := FakeApi.new()
	fake_api_node = fake_api
	main.set("api", fake_api)
	main.add_child(fake_api)
	var api = fake_api
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
