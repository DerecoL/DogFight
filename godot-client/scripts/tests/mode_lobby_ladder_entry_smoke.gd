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
			"/runs":
				return _ok({"run": _new_run(str(body.get("dogType", "SHIBA")), str(body.get("mode", "LADDER")))})
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
				return _ok({"profile": {"tierLabel": "青铜", "score": 0}, "leaderboard": [], "bestRun": null})
			"/ladder/leaderboard":
				return _ok({"leaderboard": []})
			_:
				return _ok({})

	func _new_run(dog_type: String, mode: String) -> Dictionary:
		return {
			"id": "ladder-entry-run",
			"mode": mode,
			"phase": "PREP",
			"status": "ACTIVE",
			"dogType": dog_type,
			"round": 1,
			"wins": 0,
			"losses": 0,
			"gold": 10,
			"items": [],
			"relics": [],
			"shopItems": [],
		}

	func _needs_nickname(user: Dictionary) -> bool:
		return user.get("nickname", null) == null or str(user.get("nickname", "")).strip_edges().is_empty()

	func _ok(data: Dictionary) -> Dictionary:
		return {"ok": true, "status": 200, "error": "", "data": data}

	func _error(message: String) -> Dictionary:
		return {"ok": false, "status": 400, "error": message, "data": {}}

var main_node: Node
var seen_paths: Dictionary = {}
var seen_responses: Dictionary = {}
var fake_api_node: FakeApi

func _init() -> void:
	_run()

func _run() -> void:
	var main := await _new_logged_in_main("godot-ladder-entry", "LadderEntrySmoke")
	if main == null:
		return
	var router = main.get("router")
	if not await _assert_standalone_lobby(main, router):
		return

	seen_paths.clear()
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	var ladder_button = mode_lobby.find_child("LadderModeButton", true, false) as Button
	if ladder_button == null:
		_fail("Standalone mode lobby must expose LadderModeButton")
		return
	ladder_button.pressed.emit()
	if not await _wait_for_screen(router, "leaderboards"):
		_fail("Ladder entry should show standalone LeaderboardsScreen, got %s" % str(router.get("current_screen_id")))
		return
	var leaderboards = main.get_node_or_null("ScreenRoot/LeaderboardsScreen")
	if leaderboards == null or not leaderboards.visible:
		_fail("Ladder entry should show LeaderboardsScreen leaderboard flow")
		return
	if main.get("run_store").has_run():
		_fail("Ladder entry without ladder run must not create a run directly")
		return
	if not await _wait_for_paths(["/ladder/me", "/ladder/leaderboard"]):
		_fail("Ladder entry should refresh ladder profile and leaderboard; seen=%s" % str(seen_paths.keys()))
		return
	if not await _wait_for_idle(leaderboards):
		_fail("Ladder home should finish refreshing before interaction")
		return
	var start_ladder_button = leaderboards.find_child("StartLadderRunButton", true, false) as Button
	if start_ladder_button == null:
		_fail("Ladder home must expose StartLadderRunButton")
		return
	seen_paths.clear()
	start_ladder_button.pressed.emit()
	if not await _wait_for_path("/runs"):
		_fail("StartLadderRunButton should POST /runs")
		return
	if not await _wait_for_idle(leaderboards):
		_fail("StartLadderRunButton should finish refreshing")
		return
	if not await _wait_for_run(main, "LADDER"):
		_fail("Starting from ladder home should create a playable LADDER run; /runs response=%s store=%s" % [
			str(seen_responses.get("/runs", {})),
			_run_store_debug(main),
		])
		return
	if str(router.get("current_screen_id")) != "run_shell":
		_fail("Created ladder run should show standalone run_shell, got %s" % str(router.get("current_screen_id")))
		return
	if main.get_node_or_null("ScreenRoot/ModeLobbyScreen").visible:
		_fail("Created ladder run must hide ModeLobbyScreen")
		return
	var run_shell = main.get_node_or_null("ScreenRoot/RunShellScreen")
	if run_shell == null or not run_shell.visible:
		_fail("Created ladder run must show RunShellScreen")
		return
	if run_shell.find_child("MatchPanel", true, false) == null:
		_fail("Created ladder run must render Web run shell content")
		return
	if run_shell.find_child("PlaceholderPanel", true, false) != null:
		_fail("Created ladder run must not show placeholder content")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot mode lobby ladder entry smoke passed")
	quit(0)

func _new_logged_in_main(account_prefix: String, nickname: String) -> Node:
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
		seen_responses[path] = {"ok": _ok, "status": _status, "payload": _payload}
	)
	var router = main.get("router")
	var login_screen = main.get_node_or_null("ScreenRoot/LoginScreen")
	if router == null or login_screen == null:
		_fail("Main session must expose router and LoginScreen")
		return null
	var account_input = login_screen.get_node_or_null("%AccountInput") as LineEdit
	var password_input = login_screen.get_node_or_null("%PasswordInput") as LineEdit
	if account_input == null or password_input == null:
		_fail("LoginScreen must expose account and password inputs")
		return null
	account_input.text = "%s-%d-%d" % [account_prefix, int(Time.get_unix_time_from_system()), Time.get_ticks_usec()]
	password_input.text = "dogdice"
	await login_screen.call("_on_register_pressed")
	if not await _wait_for_screen(router, "nickname_setup"):
		var error_label = login_screen.get_node_or_null("%ErrorLabel")
		var error_text := str(error_label.text) if error_label != null else ""
		_fail("Register should route to nickname setup, got %s error=%s" % [str(router.get("current_screen_id")), error_text])
		return null
	var nickname_input := _find_line_edit(main.get_node_or_null("ScreenRoot/NicknameSetupScreen"))
	if nickname_input == null:
		_fail("NicknameSetupScreen must expose nickname input")
		return null
	nickname_input.text = nickname
	await main.get_node_or_null("ScreenRoot/NicknameSetupScreen").call("_submit_nickname")
	return main

func _assert_standalone_lobby(main: Node, router: Node) -> bool:
	if not await _wait_for_screen(router, "mode_lobby"):
		_fail("Nickname should route to standalone mode lobby")
		return false
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if mode_lobby == null or not mode_lobby.visible:
		_fail("Standalone mode lobby should show ModeLobbyScreen")
		return false
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy != null and legacy.visible:
		_fail("Standalone mode lobby must not show LegacyRunScreen")
		return false
	for node_name in ["ModeLobbyPanel", "ModeGrid", "LadderModeButton"]:
		if mode_lobby.find_child(node_name, true, false) == null:
			_fail("Standalone mode lobby missing node: %s" % node_name)
			return false
	return true

func _wait_for_screen(router: Node, screen_id: String) -> bool:
	for _frame in range(240):
		if str(router.get("current_screen_id")) == screen_id:
			return true
		await process_frame
	return false

func _wait_for_paths(paths: Array) -> bool:
	for _frame in range(600):
		var complete := true
		for path in paths:
			if not seen_paths.has(str(path)):
				complete = false
				break
		if complete:
			return true
		await process_frame
	return false

func _wait_for_path(path: String) -> bool:
	for _frame in range(600):
		if seen_paths.has(path):
			return true
		await process_frame
	return false

func _wait_for_run(main: Node, mode: String) -> bool:
	for _frame in range(600):
		var run_store = main.get("run_store")
		if run_store != null and run_store.has_method("has_run") and run_store.has_run():
			var run: Dictionary = run_store.get("run")
			if str(run.get("mode", "")) == mode:
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

func _run_store_debug(main: Node) -> String:
	var run_store = main.get("run_store")
	if run_store == null:
		return "<missing>"
	return "has_run=%s run=%s" % [str(run_store.has_run()), str(run_store.get("run"))]

func _fail(message: String) -> void:
	push_error(message)
	if main_node != null:
		main_node.queue_free()
	quit(1)
