extends SceneTree

const ApiClientScript := preload("res://scripts/api/ApiClient.gd")

class FakeApi:
	extends ApiClientScript

	var users: Dictionary = {}
	var current_account := ""

	func post_json(path: String, body: Dictionary = {}) -> Dictionary:
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
			"/auth/logout":
				current_account = ""
				return _ok({})
			_:
				return _ok({})

	func get_json(path: String) -> Dictionary:
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
			_:
				return _ok({})

	func _needs_nickname(user: Dictionary) -> bool:
		return user.get("nickname", null) == null or str(user.get("nickname", "")).strip_edges().is_empty()

	func _ok(data: Dictionary) -> Dictionary:
		return {"ok": true, "status": 200, "error": "", "data": data}

	func _error(message: String) -> Dictionary:
		return {"ok": false, "status": 400, "error": message, "data": {}}

var main_node: Node
var fake_api_node: FakeApi

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
	var fake_api := FakeApi.new()
	fake_api_node = fake_api
	main.set("api", fake_api)
	main.add_child(fake_api)

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

	account_input.text = "godot-mode-lobby-standalone-%d-%d" % [int(Time.get_unix_time_from_system()), Time.get_ticks_usec()]
	password_input.text = "dogdice"
	await login_screen.call("_on_register_pressed")
	if not await _wait_for_screen(router, "nickname_setup"):
		_fail("Register should route to nickname setup, got %s" % str(router.get("current_screen_id")))
		return

	var nickname_screen = main.get_node_or_null("ScreenRoot/NicknameSetupScreen")
	var nickname_input := _find_line_edit(nickname_screen)
	if nickname_input == null:
		_fail("NicknameSetupScreen must expose nickname input")
		return
	nickname_input.text = "ModeLobbyStandaloneSmoke"
	await nickname_screen.call("_submit_nickname")
	if not await _wait_for_screen(router, "mode_lobby"):
		_fail("Nickname submit should route to standalone mode_lobby, got %s" % str(router.get("current_screen_id")))
		return
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if mode_lobby == null or not mode_lobby.visible:
		_fail("Standalone ModeLobbyScreen should be visible after auth")
		return
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy != null and legacy.visible:
		_fail("Auth landing must not render the mode lobby inside LegacyRunScreen")
		return
	if mode_lobby.find_child("PlaceholderPanel", true, false) != null:
		_fail("Standalone ModeLobbyScreen must not show placeholder content")
		return
	for node_name in ["ModeLobbyPanel", "ModeLobbyScroll", "ModeGrid", "CasualModeButton", "LadderModeButton", "DogfightModeButton", "PeakModeButton"]:
		if mode_lobby.find_child(node_name, true, false) == null:
			_fail("Standalone ModeLobbyScreen missing Web lobby node: %s" % node_name)
			return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot mode lobby standalone after auth smoke passed")
	quit(0)

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

func _fail(message: String) -> void:
	push_error(message)
	if main_node != null:
		main_node.queue_free()
	quit(1)
