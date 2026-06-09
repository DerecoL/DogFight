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

	var legacy_cases := {
		"account": "账号",
		"achievements": "成就",
		"apex": "巅峰",
		"season": "赛季",
		"account_settings": "设置",
	}
	for screen_id in legacy_cases.keys():
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

	main.call("open_screen", "leaderboards")
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "leaderboards":
		_fail("leaderboards should route to standalone LeaderboardsScreen, got %s" % str(router.get("current_screen_id")))
		return
	var leaderboards = main.get_node_or_null("ScreenRoot/LeaderboardsScreen")
	if leaderboards == null or not leaderboards.visible:
		_fail("leaderboards should show LeaderboardsScreen")
		return
	if leaderboards.find_child("LadderScreen", true, false) == null:
		_fail("leaderboards should render the Web ladder screen")
		return

	main.call("open_screen", "dogfight_rooms")
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "dogfight_rooms":
		_fail("dogfight_rooms should route to standalone DogfightRoomsScreen, got %s" % str(router.get("current_screen_id")))
		return
	var dogfight_rooms = main.get_node_or_null("ScreenRoot/DogfightRoomsScreen")
	if dogfight_rooms == null or not dogfight_rooms.visible:
		_fail("dogfight_rooms should show DogfightRoomsScreen")
		return
	if dogfight_rooms.find_child("DogfightScreen", true, false) == null:
		_fail("dogfight_rooms should render the Web dogfight room list")
		return

	main.call("open_screen", "account_shop")
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "account_shop":
		_fail("account_shop should route to standalone AccountShopScreen, got %s" % str(router.get("current_screen_id")))
		return
	var account_shop = main.get_node_or_null("ScreenRoot/AccountShopScreen")
	if account_shop == null or not account_shop.visible:
		_fail("account_shop should show AccountShopScreen")
		return
	if account_shop.find_child("AccountShopPanel", true, false) == null:
		_fail("account_shop should render the Web account shop panel")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot peripheral screen routing smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
