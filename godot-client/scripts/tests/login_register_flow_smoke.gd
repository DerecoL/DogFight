extends SceneTree

const ApiClientScript := preload("res://scripts/api/ApiClient.gd")

class FakeApi:
	extends ApiClientScript

	var users: Dictionary = {}
	var current_account := ""
	var seen_paths: Dictionary = {}

	func post_json(path: String, body: Dictionary = {}) -> Dictionary:
		seen_paths[path] = true
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
			"/auth/login":
				var account := str(body.get("account", ""))
				if not users.has(account):
					return _error("Unknown account")
				current_account = account
				var user: Dictionary = users[account]
				return _ok({"user": user.duplicate(true), "needsNickname": _needs_nickname(user)})
			_:
				return _ok({})

	func get_json(path: String) -> Dictionary:
		seen_paths[path] = true
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

	var router = main.get("router")
	var login_screen = main.get_node_or_null("ScreenRoot/LoginScreen")
	if router == null or login_screen == null:
		_fail("Login flow requires router and LoginScreen")
		return
	var fake_api := FakeApi.new()
	fake_api_node = fake_api
	main.set("api", fake_api)
	main.add_child(fake_api)
	var account_input = login_screen.get_node_or_null("%AccountInput") as LineEdit
	var password_input = login_screen.get_node_or_null("%PasswordInput") as LineEdit
	if account_input == null or password_input == null:
		_fail("LoginScreen must expose account and password inputs")
		return

	var account := "godot-login-flow-%d-%d" % [int(Time.get_unix_time_from_system()), Time.get_ticks_usec()]
	account_input.text = account
	password_input.text = "dogdice"
	await login_screen.call("_on_register_pressed")
	var reached_nickname := false
	for _frame in range(240):
		if str(router.get("current_screen_id")) == "nickname_setup":
			reached_nickname = true
			break
		await process_frame
	if not reached_nickname:
		_fail("Register should route new account to nickname_setup, got %s" % str(router.get("current_screen_id")))
		return

	var nickname_screen = main.get_node_or_null("ScreenRoot/NicknameSetupScreen")
	var nickname_input := _find_line_edit(nickname_screen)
	if nickname_input == null:
		_fail("NicknameSetupScreen must expose nickname input")
		return
	nickname_input.text = "LoginFlowSmoke"
	await nickname_screen.call("_submit_nickname")
	var reached_lobby_after_nickname := false
	for _frame in range(240):
		if str(router.get("current_screen_id")) == "mode_lobby":
			reached_lobby_after_nickname = true
			break
		await process_frame
	if not reached_lobby_after_nickname:
		_fail("Nickname submit should route to standalone mode lobby, got %s" % str(router.get("current_screen_id")))
		return
	if not _assert_mode_lobby_visible(main, "Nickname submit"):
		return

	if not await main.call("logout"):
		_fail("Logout failed after registration")
		return
	var reached_login := false
	for _frame in range(240):
		if str(router.get("current_screen_id")) == "login":
			reached_login = true
			break
		await process_frame
	if not reached_login:
		_fail("Logout should route back to login, got %s" % str(router.get("current_screen_id")))
		return

	account_input.text = account
	password_input.text = "dogdice"
	await login_screen.call("_on_login_pressed")
	var reached_lobby_after_login := false
	for _frame in range(240):
		if str(router.get("current_screen_id")) == "mode_lobby":
			reached_lobby_after_login = true
			break
		await process_frame
	if not reached_lobby_after_login:
		_fail("Login with saved nickname should route to standalone mode lobby, got %s" % str(router.get("current_screen_id")))
		return
	if not _assert_mode_lobby_visible(main, "Login with saved nickname"):
		return

	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	var casual_button = mode_lobby.find_child("CasualModeButton", true, false) as Button
	if casual_button == null:
		_fail("Standalone mode lobby must expose CasualModeButton")
		return
	casual_button.pressed.emit()
	var reached_dog_select := false
	for _frame in range(240):
		if str(router.get("current_screen_id")) == "dog_select":
			reached_dog_select = true
			break
		await process_frame
	if not reached_dog_select:
		_fail("Entering casual mode should open standalone dog_select, got %s" % str(router.get("current_screen_id")))
		return
	var dog_select = main.get_node_or_null("ScreenRoot/DogSelectScreen")
	if dog_select == null or not dog_select.visible:
		_fail("Casual mode entry should show standalone DogSelectScreen")
		return
	if main.get("run_store").has_run():
		_fail("Entering casual mode without a run must not create a run directly")
		return
	var legacy_run_screen = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy_run_screen != null and legacy_run_screen.visible:
		_fail("Casual mode entry must not show LegacyRunScreen")
		return
	for node_name in ["DogSelectScreen", "DogCardGrid", "DogDetailPanel", "StartRunButton"]:
		if dog_select.find_child(node_name, true, false) == null:
			_fail("Standalone dog_select missing Web node after login: %s" % node_name)
			return
	if dog_select.find_child("PlaceholderPanel", true, false) != null:
		_fail("Standalone dog_select must not show placeholder content")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot login/register flow smoke passed")
	quit(0)

func _assert_mode_lobby_visible(main: Node, context: String) -> bool:
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if mode_lobby == null or not mode_lobby.visible:
		_fail("%s should show ModeLobbyScreen" % context)
		return false
	var legacy_run_screen = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy_run_screen != null and legacy_run_screen.visible:
		_fail("%s must not render mode lobby inside LegacyRunScreen" % context)
		return false
	if mode_lobby.find_child("PlaceholderPanel", true, false) != null:
		_fail("%s must not show placeholder content" % context)
		return false
	for node_name in ["ModeLobbyPanel", "ModeLobbyScroll", "ModeGrid", "CasualModeButton", "LadderModeButton", "DogfightModeButton", "PeakModeButton"]:
		if mode_lobby.find_child(node_name, true, false) == null:
			_fail("%s mode lobby missing Web node: %s" % [context, node_name])
			return false
	if mode_lobby.find_child("StartRunButton", true, false) != null:
		_fail("%s mode lobby should not expose direct start form controls before choosing casual mode" % context)
		return false
	return true

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
