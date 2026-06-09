extends SceneTree

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

	var router = main.get("router")
	if router == null:
		_fail("Main session must expose router")
		return
	main.call("open_screen", "legacy_run")
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "legacy_run":
		_fail("Test setup should show playable shell before returning lobby")
		return

	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null or not legacy.has_method("open_mode_lobby"):
		_fail("LegacyRunScreen must expose open_mode_lobby")
		return
	legacy.call("open_mode_lobby")
	if not await _wait_for_screen(router, "mode_lobby"):
		_fail("open_mode_lobby should route to standalone mode_lobby, got %s" % str(router.get("current_screen_id")))
		return
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if mode_lobby == null or not mode_lobby.visible:
		_fail("open_mode_lobby should show ModeLobbyScreen")
		return
	if legacy.visible:
		_fail("open_mode_lobby must hide LegacyRunScreen")
		return
	if mode_lobby.find_child("ModeGrid", true, false) == null:
		_fail("open_mode_lobby should render standalone Web mode grid")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot legacy shell lobby return smoke passed")
	quit(0)

func _wait_for_screen(router: Node, screen_id: String) -> bool:
	for _frame in range(180):
		if str(router.get("current_screen_id")) == screen_id:
			return true
		await process_frame
	return false

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
