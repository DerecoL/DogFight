extends SceneTree

func _init() -> void:
	var scene_paths := {
		"mode_lobby": "res://scenes/screens/ModeLobbyScreen.tscn",
		"run_shell": "res://scenes/screens/RunShellScreen.tscn",
		"exploration_map": "res://scenes/screens/ExplorationMapScreen.tscn",
		"run_shop": "res://scenes/screens/RunShopScreen.tscn",
		"reward_choice": "res://scenes/screens/RewardChoiceScreen.tscn",
		"run_settlement": "res://scenes/screens/RunSettlementScreen.tscn",
		"account_shop": "res://scenes/screens/AccountShopScreen.tscn",
		"achievements": "res://scenes/screens/AchievementsScreen.tscn",
		"leaderboards": "res://scenes/screens/LeaderboardsScreen.tscn",
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

	print("Web UI main scene smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
