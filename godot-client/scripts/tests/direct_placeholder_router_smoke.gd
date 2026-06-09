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

	router.call("show_screen", "account", false)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "account":
		_fail("Direct router display of account should stay on standalone account, got %s" % str(router.get("current_screen_id")))
		return
	var account_history = main.get_node_or_null("ScreenRoot/AccountHistoryScreen")
	if account_history == null or not account_history.visible:
		_fail("Direct router display of account should show AccountHistoryScreen")
		return
	if account_history.find_child("AccountHistoryScreen", true, false) == null:
		_fail("AccountHistoryScreen must show the Web account history page")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of account must not show a placeholder panel")
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

	router.call("show_screen", "apex", false)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "apex":
		_fail("Direct router display of apex should stay on standalone apex, got %s" % str(router.get("current_screen_id")))
		return
	var apex = main.get_node_or_null("ScreenRoot/ApexScreen")
	if apex == null or not apex.visible:
		_fail("Direct router display of apex should show ApexScreen")
		return
	if apex.find_child("ApexScreen", true, false) == null:
		_fail("ApexScreen must show the Web apex screen")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of apex must not show a placeholder panel")
		return

	router.call("show_screen", "dogfight_rooms", false)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "dogfight_rooms":
		_fail("Direct router display of dogfight_rooms should stay on standalone dogfight_rooms, got %s" % str(router.get("current_screen_id")))
		return
	var dogfight_rooms = main.get_node_or_null("ScreenRoot/DogfightRoomsScreen")
	if dogfight_rooms == null or not dogfight_rooms.visible:
		_fail("Direct router display of dogfight_rooms should show DogfightRoomsScreen")
		return
	if dogfight_rooms.find_child("DogfightScreen", true, false) == null:
		_fail("DogfightRoomsScreen must show the Web dogfight room list")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of dogfight_rooms must not show a placeholder panel")
		return

	router.call("show_screen", "dogfight_room_detail", false)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "dogfight_room_detail":
		_fail("Direct router display of dogfight_room_detail should stay on standalone dogfight_room_detail, got %s" % str(router.get("current_screen_id")))
		return
	var dogfight_room_detail = main.get_node_or_null("ScreenRoot/DogfightRoomDetailScreen")
	if dogfight_room_detail == null or not dogfight_room_detail.visible:
		_fail("Direct router display of dogfight_room_detail should show DogfightRoomDetailScreen")
		return
	if dogfight_room_detail.find_child("DogfightRoomToolbar", true, false) == null:
		_fail("DogfightRoomDetailScreen must show the Web dogfight room toolbar")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of dogfight_room_detail must not show a placeholder panel")
		return

	router.call("show_screen", "run_shop", false)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "run_shop":
		_fail("Direct router display of run_shop should stay on standalone run_shop, got %s" % str(router.get("current_screen_id")))
		return
	var run_shop = main.get_node_or_null("ScreenRoot/RunShopScreen")
	if run_shop == null or not run_shop.visible:
		_fail("Direct router display of run_shop should show RunShopScreen")
		return
	if run_shop.find_child("RunShopEmpty", true, false) == null and run_shop.find_child("ShopWorkbench", true, false) == null:
		_fail("RunShopScreen must render a Web shop surface")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of run_shop must not show a placeholder panel")
		return

	router.call("show_screen", "exploration_map", false)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "exploration_map":
		_fail("Direct router display of exploration_map should stay on standalone exploration_map, got %s" % str(router.get("current_screen_id")))
		return
	var exploration_map = main.get_node_or_null("ScreenRoot/ExplorationMapScreen")
	if exploration_map == null or not exploration_map.visible:
		_fail("Direct router display of exploration_map should show ExplorationMapScreen")
		return
	if exploration_map.find_child("ExplorationMapEmpty", true, false) == null and exploration_map.find_child("ExplorationMapOverlay", true, false) == null:
		_fail("ExplorationMapScreen must render a Web exploration map surface")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of exploration_map must not show a placeholder panel")
		return

	router.call("show_screen", "reward_choice", false)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "reward_choice":
		_fail("Direct router display of reward_choice should stay on standalone reward_choice, got %s" % str(router.get("current_screen_id")))
		return
	var reward_choice = main.get_node_or_null("ScreenRoot/RewardChoiceScreen")
	if reward_choice == null or not reward_choice.visible:
		_fail("Direct router display of reward_choice should show RewardChoiceScreen")
		return
	if reward_choice.find_child("RewardChoiceEmpty", true, false) == null and reward_choice.find_child("RewardPanel", true, false) == null and reward_choice.find_child("ShopChoiceScreen", true, false) == null:
		_fail("RewardChoiceScreen must render a Web reward choice surface")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of reward_choice must not show a placeholder panel")
		return

	router.call("show_screen", "run_shell", false)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "run_shell":
		_fail("Direct router display of run_shell should stay on standalone run_shell, got %s" % str(router.get("current_screen_id")))
		return
	var run_shell = main.get_node_or_null("ScreenRoot/RunShellScreen")
	if run_shell == null or not run_shell.visible:
		_fail("Direct router display of run_shell should show RunShellScreen")
		return
	if run_shell.find_child("RunShellEmpty", true, false) == null and run_shell.find_child("MatchPanel", true, false) == null:
		_fail("RunShellScreen must render a Web run shell surface")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of run_shell must not show a placeholder panel")
		return

	router.call("show_screen", "run_settlement", false)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "run_settlement":
		_fail("Direct router display of run_settlement should stay on standalone run_settlement, got %s" % str(router.get("current_screen_id")))
		return
	var run_settlement = main.get_node_or_null("ScreenRoot/RunSettlementScreen")
	if run_settlement == null or not run_settlement.visible:
		_fail("Direct router display of run_settlement should show RunSettlementScreen")
		return
	if run_settlement.find_child("SettlementPage", true, false) == null:
		_fail("RunSettlementScreen must render a Web settlement surface")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of run_settlement must not show a placeholder panel")
		return

	router.call("show_screen", "achievements", false)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "achievements":
		_fail("Direct router display of achievements should stay on standalone achievements, got %s" % str(router.get("current_screen_id")))
		return
	var achievements = main.get_node_or_null("ScreenRoot/AchievementsScreen")
	if achievements == null or not achievements.visible:
		_fail("Direct router display of achievements should show AchievementsScreen")
		return
	if achievements.find_child("AchievementsScreen", true, false) == null:
		_fail("AchievementsScreen must render a Web achievements surface")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of achievements must not show a placeholder panel")
		return

	router.call("show_screen", "account_settings", false)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "account_settings":
		_fail("Direct router display of account_settings should stay on standalone account_settings, got %s" % str(router.get("current_screen_id")))
		return
	var account_settings = main.get_node_or_null("ScreenRoot/AccountSettingsScreen")
	if account_settings == null or not account_settings.visible:
		_fail("Direct router display of account_settings should show AccountSettingsScreen")
		return
	if account_settings.find_child("AccountSettingsScreen", true, false) == null:
		_fail("AccountSettingsScreen must render a Web settings surface")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of account_settings must not show a placeholder panel")
		return

	router.call("show_screen", "season", false)
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "season":
		_fail("Direct router display of season should stay on standalone season, got %s" % str(router.get("current_screen_id")))
		return
	var season = main.get_node_or_null("ScreenRoot/SeasonScreen")
	if season == null or not season.visible:
		_fail("Direct router display of season should show SeasonScreen")
		return
	if season.find_child("SeasonScreen", true, false) == null:
		_fail("SeasonScreen must render a Web season surface")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of season must not show a placeholder panel")
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
