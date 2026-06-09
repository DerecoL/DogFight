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
		_fail("Main must expose router")
		return

	router.call("show_screen", "mode_lobby", false)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "mode_lobby":
		_fail("Direct router display of mode_lobby should stay on mode_lobby, got %s" % str(router.get("current_screen_id")))
		return
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if mode_lobby == null or not mode_lobby.visible:
		_fail("Direct router display of mode_lobby should show ModeLobbyScreen")
		return
	if mode_lobby.find_child("ModeLobbyPanel", true, false) == null:
		_fail("ModeLobbyScreen must show the playable lobby panel")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of mode_lobby must not show a placeholder panel")
		return

	router.call("show_screen", "account_shop", false)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "account_shop":
		_fail("Direct router display of account_shop should stay on standalone account_shop, got %s" % str(router.get("current_screen_id")))
		return
	var account_shop = main.get_node_or_null("ScreenRoot/AccountShopScreen")
	if account_shop == null or not account_shop.visible:
		_fail("Direct router display of account_shop should show AccountShopScreen")
		return
	if account_shop.find_child("AccountShopPanel", true, false) == null:
		_fail("AccountShopScreen must show the Web account shop panel")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of account_shop must not show a placeholder panel")
		return

	router.call("show_screen", "leaderboards", false)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "leaderboards":
		_fail("Direct router display of leaderboards should stay on standalone leaderboards, got %s" % str(router.get("current_screen_id")))
		return
	var leaderboards = main.get_node_or_null("ScreenRoot/LeaderboardsScreen")
	if leaderboards == null or not leaderboards.visible:
		_fail("Direct router display of leaderboards should show LeaderboardsScreen")
		return
	if leaderboards.find_child("LadderScreen", true, false) == null:
		_fail("LeaderboardsScreen must show the Web ladder screen")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of leaderboards must not show a placeholder panel")
		return

	for screen_id in [
		"run_shell",
		"exploration_map",
		"run_shop",
		"reward_choice",
		"run_settlement",
		"achievements",
		"season",
		"dogfight_rooms",
		"dogfight_room_detail",
		"account_settings",
	]:
		router.call("show_screen", screen_id, false)
		if not await _wait_for_screen(router, "legacy_run"):
			_fail("Direct router display of %s should redirect to playable UI, got %s" % [screen_id, str(router.get("current_screen_id"))])
			return
		if _any_visible_placeholder(main):
			_fail("Direct router display of %s must not show a placeholder panel" % screen_id)
			return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot direct placeholder router smoke passed")
	quit(0)

func _wait_for_screen(router: Node, screen_id: String) -> bool:
	for _frame in range(20):
		if str(router.get("current_screen_id")) == screen_id:
			return true
		await process_frame
	return false

func _any_visible_placeholder(node: Node) -> bool:
	if node.name == "PlaceholderPanel" and node is CanvasItem and (node as CanvasItem).is_visible_in_tree():
		return true
	for child in node.get_children():
		if _any_visible_placeholder(child):
			return true
	return false

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
