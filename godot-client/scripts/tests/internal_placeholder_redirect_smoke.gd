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
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if router == null or legacy == null:
		_fail("Main must expose router and LegacyRunScreen")
		return
	if not main.call("open_screen", "mode_lobby"):
		_fail("open_screen should accept standalone mode_lobby")
		return
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "mode_lobby":
		_fail("mode_lobby should stay on standalone ModeLobbyScreen, got %s" % str(router.get("current_screen_id")))
		return
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if mode_lobby == null or not mode_lobby.visible:
		_fail("mode_lobby should show ModeLobbyScreen")
		return
	if mode_lobby.find_child("PlaceholderPanel", true, false) != null:
		_fail("mode_lobby must not show a placeholder panel")
		return
	for screen_id in [
		"run_shell",
		"run_settlement",
		"achievements",
		"season",
		"account_settings",
	]:
		if not main.call("open_screen", screen_id):
			_fail("open_screen should accept internal run screen id: %s" % screen_id)
			return
		await process_frame
		await process_frame
		if str(router.get("current_screen_id")) != "legacy_run":
			_fail("%s should redirect to playable shell, got %s" % [screen_id, str(router.get("current_screen_id"))])
			return
		if not legacy.visible:
			_fail("%s should show LegacyRunScreen" % screen_id)
			return
		if _any_visible_placeholder(main):
			_fail("%s must not show any visible placeholder panel" % screen_id)
			return

	if not main.call("open_screen", "leaderboards"):
		_fail("open_screen should accept standalone leaderboards")
		return
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "leaderboards":
		_fail("leaderboards should stay on standalone LeaderboardsScreen, got %s" % str(router.get("current_screen_id")))
		return
	var leaderboards = main.get_node_or_null("ScreenRoot/LeaderboardsScreen")
	if leaderboards == null or not leaderboards.visible:
		_fail("leaderboards should show LeaderboardsScreen")
		return
	if leaderboards.find_child("PlaceholderPanel", true, false) != null:
		_fail("leaderboards must not show a placeholder panel")
		return

	if not main.call("open_screen", "dogfight_rooms"):
		_fail("open_screen should accept standalone dogfight_rooms")
		return
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "dogfight_rooms":
		_fail("dogfight_rooms should stay on standalone DogfightRoomsScreen, got %s" % str(router.get("current_screen_id")))
		return
	var dogfight_rooms = main.get_node_or_null("ScreenRoot/DogfightRoomsScreen")
	if dogfight_rooms == null or not dogfight_rooms.visible:
		_fail("dogfight_rooms should show DogfightRoomsScreen")
		return
	if dogfight_rooms.find_child("PlaceholderPanel", true, false) != null:
		_fail("dogfight_rooms must not show a placeholder panel")
		return

	if not main.call("open_screen", "dogfight_room_detail"):
		_fail("open_screen should accept standalone dogfight_room_detail")
		return
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "dogfight_room_detail":
		_fail("dogfight_room_detail should stay on standalone DogfightRoomDetailScreen, got %s" % str(router.get("current_screen_id")))
		return
	var dogfight_room_detail = main.get_node_or_null("ScreenRoot/DogfightRoomDetailScreen")
	if dogfight_room_detail == null or not dogfight_room_detail.visible:
		_fail("dogfight_room_detail should show DogfightRoomDetailScreen")
		return
	if dogfight_room_detail.find_child("PlaceholderPanel", true, false) != null:
		_fail("dogfight_room_detail must not show a placeholder panel")
		return

	if not main.call("open_screen", "run_shop"):
		_fail("open_screen should accept standalone run_shop")
		return
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "run_shop":
		_fail("run_shop should stay on standalone RunShopScreen, got %s" % str(router.get("current_screen_id")))
		return
	var run_shop = main.get_node_or_null("ScreenRoot/RunShopScreen")
	if run_shop == null or not run_shop.visible:
		_fail("run_shop should show RunShopScreen")
		return
	if run_shop.find_child("PlaceholderPanel", true, false) != null:
		_fail("run_shop must not show a placeholder panel")
		return

	if not main.call("open_screen", "exploration_map"):
		_fail("open_screen should accept standalone exploration_map")
		return
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "exploration_map":
		_fail("exploration_map should stay on standalone ExplorationMapScreen, got %s" % str(router.get("current_screen_id")))
		return
	var exploration_map = main.get_node_or_null("ScreenRoot/ExplorationMapScreen")
	if exploration_map == null or not exploration_map.visible:
		_fail("exploration_map should show ExplorationMapScreen")
		return
	if exploration_map.find_child("PlaceholderPanel", true, false) != null:
		_fail("exploration_map must not show a placeholder panel")
		return

	if not main.call("open_screen", "reward_choice"):
		_fail("open_screen should accept standalone reward_choice")
		return
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "reward_choice":
		_fail("reward_choice should stay on standalone RewardChoiceScreen, got %s" % str(router.get("current_screen_id")))
		return
	var reward_choice = main.get_node_or_null("ScreenRoot/RewardChoiceScreen")
	if reward_choice == null or not reward_choice.visible:
		_fail("reward_choice should show RewardChoiceScreen")
		return
	if reward_choice.find_child("PlaceholderPanel", true, false) != null:
		_fail("reward_choice must not show a placeholder panel")
		return

	if not main.call("open_screen", "account_shop"):
		_fail("open_screen should accept standalone account_shop")
		return
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "account_shop":
		_fail("account_shop should stay on standalone AccountShopScreen, got %s" % str(router.get("current_screen_id")))
		return
	var account_shop = main.get_node_or_null("ScreenRoot/AccountShopScreen")
	if account_shop == null or not account_shop.visible:
		_fail("account_shop should show AccountShopScreen")
		return
	if account_shop.find_child("PlaceholderPanel", true, false) != null:
		_fail("account_shop must not show a placeholder panel")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot internal placeholder redirect smoke passed")
	quit(0)

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
