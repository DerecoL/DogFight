extends SceneTree

func _init() -> void:
	var scene_paths := {
		"nickname_setup": "res://scenes/screens/NicknameSetupScreen.tscn",
		"mode_lobby": "res://scenes/screens/ModeLobbyScreen.tscn",
		"run_shell": "res://scenes/screens/RunShellScreen.tscn",
		"exploration_map": "res://scenes/screens/ExplorationMapScreen.tscn",
		"run_shop": "res://scenes/screens/RunShopScreen.tscn",
		"reward_choice": "res://scenes/screens/RewardChoiceScreen.tscn",
		"run_settlement": "res://scenes/screens/RunSettlementScreen.tscn",
		"account_shop": "res://scenes/screens/AccountShopScreen.tscn",
		"achievements": "res://scenes/screens/AchievementsScreen.tscn",
		"leaderboards": "res://scenes/screens/LeaderboardsScreen.tscn",
		"apex": "res://scenes/screens/ApexScreen.tscn",
		"season": "res://scenes/screens/SeasonScreen.tscn",
		"dogfight_rooms": "res://scenes/screens/DogfightRoomsScreen.tscn",
		"dogfight_room_detail": "res://scenes/screens/DogfightRoomDetailScreen.tscn",
		"account_settings": "res://scenes/screens/AccountSettingsScreen.tscn",
	}
	for screen_id in scene_paths.keys():
		var packed := load(str(scene_paths[screen_id]))
		if packed == null:
			_fail("Missing scene for %s at %s" % [screen_id, str(scene_paths[screen_id])])
			return
		var instance = packed.instantiate()
		if instance == null:
			_fail("Scene failed to instantiate for %s" % screen_id)
			return
		if not instance.has_method("bind_session"):
			_fail("Scene %s must expose bind_session" % screen_id)
			return
		instance.free()

	var manifest = load("res://scripts/ui/web/WebUiScreenIds.gd")
	if manifest == null:
		_fail("WebUiScreenIds.gd must load")
		return

	var main_scene = load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene must load")
		return
	var main = main_scene.instantiate()
	if main == null:
		_fail("Main scene must instantiate")
		return
	root.add_child(main)
	await process_frame
	await process_frame

	var screen_root = main.get_node_or_null("ScreenRoot")
	if screen_root == null:
		_fail("Main scene must include ScreenRoot")
		return
	for screen_id in manifest.screen_ids():
		var node_name = str(manifest.node_name_for(screen_id))
		if screen_root.get_node_or_null(node_name) == null:
			_fail("Main ScreenRoot missing Web UI node for %s: %s" % [screen_id, node_name])
			return
	if screen_root.get_node_or_null("RunScreen") != null:
		_fail("Legacy RunScreen node must be renamed to LegacyRunScreen")
		return
	if screen_root.get_node_or_null("LegacyRunScreen") == null:
		_fail("Main ScreenRoot must retain LegacyRunScreen")
		return
	var legacy_run_screen = screen_root.get_node_or_null("LegacyRunScreen")
	if legacy_run_screen.get("session") != null:
		_fail("LegacyRunScreen must stay unbound so hidden legacy UI cannot drive live run side effects")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame

	print("Web UI main scene smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
