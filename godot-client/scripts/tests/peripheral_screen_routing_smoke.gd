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

	if not main.has_method("open_screen"):
		_fail("GameSession must expose open_screen for mode lobby shortcuts")
		return
	var router = main.get("router")
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if router == null or legacy == null:
		_fail("Main must expose router and playable LegacyRunScreen")
		return

	for screen_id in ["account", "apex"]:
		main.call("open_screen", screen_id)
		await process_frame
		await process_frame
		if str(router.get("current_screen_id")) != "legacy_run":
			_fail("%s should route to playable shell, got %s" % [screen_id, str(router.get("current_screen_id"))])
			return
		if not legacy.visible:
			_fail("%s should show LegacyRunScreen" % screen_id)
			return
		if legacy.find_child("PlaceholderPanel", true, false) != null:
			_fail("%s must not show placeholder panel" % screen_id)
			return

	await _assert_standalone(main, router, "leaderboards", "LeaderboardsScreen", "LadderScreen")
	await _assert_standalone(main, router, "dogfight_rooms", "DogfightRoomsScreen", "DogfightScreen")
	await _assert_standalone(main, router, "account_shop", "AccountShopScreen", "AccountShopPanel")
	await _assert_standalone(main, router, "achievements", "AchievementsScreen", "AchievementsScreen")
	await _assert_standalone(main, router, "account_settings", "AccountSettingsScreen", "AccountSettingsScreen")
	await _assert_standalone(main, router, "season", "SeasonScreen", "SeasonScreen")

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot peripheral screen routing smoke passed")
	quit(0)

func _assert_standalone(main: Node, router: Node, screen_id: String, node_name: String, required_child: String) -> void:
	main.call("open_screen", screen_id)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != screen_id:
		_fail("%s should route to standalone %s, got %s" % [screen_id, node_name, str(router.get("current_screen_id"))])
		return
	var screen = main.get_node_or_null("ScreenRoot/%s" % node_name)
	if screen == null or not screen.visible:
		_fail("%s should show %s" % [screen_id, node_name])
		return
	if screen.find_child(required_child, true, false) == null:
		_fail("%s should render required Web child %s" % [screen_id, required_child])
		return

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
