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

	if not main.call("open_screen", "run_settlement"):
		_fail("open_screen should accept standalone run_settlement")
		return
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "run_settlement":
		_fail("run_settlement should stay on standalone RunSettlementScreen, got %s" % str(router.get("current_screen_id")))
		return
	var run_settlement = main.get_node_or_null("ScreenRoot/RunSettlementScreen")
	if run_settlement == null or not run_settlement.visible:
		_fail("run_settlement should show RunSettlementScreen")
		return
	if run_settlement.find_child("PlaceholderPanel", true, false) != null:
		_fail("run_settlement must not show a placeholder panel")
		return
	if run_settlement.find_child("SettlementPage", true, false) == null:
		_fail("run_settlement must render a Web settlement surface")
		return

	if not main.call("open_screen", "achievements"):
		_fail("open_screen should accept standalone achievements")
		return
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "achievements":
		_fail("achievements should stay on standalone AchievementsScreen, got %s" % str(router.get("current_screen_id")))
		return
	var achievements = main.get_node_or_null("ScreenRoot/AchievementsScreen")
	if achievements == null or not achievements.visible:
		_fail("achievements should show AchievementsScreen")
		return
	if achievements.find_child("PlaceholderPanel", true, false) != null:
		_fail("achievements must not show a placeholder panel")
		return
	if achievements.find_child("AchievementsScreen", true, false) == null:
		_fail("achievements must render a Web achievements surface")
		return

	if not main.call("open_screen", "account_settings"):
		_fail("open_screen should accept standalone account_settings")
		return
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "account_settings":
		_fail("account_settings should stay on standalone AccountSettingsScreen, got %s" % str(router.get("current_screen_id")))
		return
	var account_settings = main.get_node_or_null("ScreenRoot/AccountSettingsScreen")
	if account_settings == null or not account_settings.visible:
		_fail("account_settings should show AccountSettingsScreen")
		return
	if account_settings.find_child("PlaceholderPanel", true, false) != null:
		_fail("account_settings must not show a placeholder panel")
		return
	if account_settings.find_child("AccountSettingsScreen", true, false) == null:
		_fail("account_settings must render a Web settings surface")
		return

	if not main.call("open_screen", "season"):
		_fail("open_screen should accept standalone season")
		return
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "season":
		_fail("season should stay on standalone SeasonScreen, got %s" % str(router.get("current_screen_id")))
		return
	var season = main.get_node_or_null("ScreenRoot/SeasonScreen")
	if season == null or not season.visible:
		_fail("season should show SeasonScreen")
		return
	if season.find_child("PlaceholderPanel", true, false) != null:
		_fail("season must not show a placeholder panel")
		return
	if season.find_child("SeasonScreen", true, false) == null:
		_fail("season must render a Web season surface")
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

	if not main.call("open_screen", "run_shell"):
		_fail("open_screen should accept standalone run_shell")
		return
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "run_shell":
		_fail("run_shell should stay on standalone RunShellScreen, got %s" % str(router.get("current_screen_id")))
		return
	var run_shell = main.get_node_or_null("ScreenRoot/RunShellScreen")
	if run_shell == null or not run_shell.visible:
		_fail("run_shell should show RunShellScreen")
		return
	if run_shell.find_child("PlaceholderPanel", true, false) != null:
		_fail("run_shell must not show a placeholder panel")
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
