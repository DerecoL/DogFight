extends SceneTree

func _init() -> void:
	var manifest = load("res://scripts/ui/web/WebUiScreenIds.gd")
	if manifest == null:
		_fail("WebUiScreenIds.gd must exist")
		return

	var expected_node_names := {
		"login": "LoginScreen",
		"nickname_setup": "NicknameSetupScreen",
		"mode_lobby": "ModeLobbyScreen",
		"dog_select": "DogSelectScreen",
		"run_shell": "RunShellScreen",
		"exploration_map": "ExplorationMapScreen",
		"run_shop": "RunShopScreen",
		"reward_choice": "RewardChoiceScreen",
		"battle_replay": "BattleReplayScreen",
		"run_settlement": "RunSettlementScreen",
		"account": "AccountHistoryScreen",
		"account_shop": "AccountShopScreen",
		"achievements": "AchievementsScreen",
		"leaderboards": "LeaderboardsScreen",
		"apex": "ApexScreen",
		"season": "SeasonScreen",
		"dogfight_rooms": "DogfightRoomsScreen",
		"dogfight_room_detail": "DogfightRoomDetailScreen",
		"account_settings": "AccountSettingsScreen",
	}
	for screen_id in expected_node_names.keys():
		if not manifest.screen_ids().has(screen_id):
			_fail("Missing Web UI screen id: %s" % screen_id)
			return
		var node_name := str(manifest.node_name_for(screen_id))
		var expected_node_name := str(expected_node_names[screen_id])
		if node_name != expected_node_name:
			_fail("Screen id %s should map to node %s, got %s" % [screen_id, expected_node_name, node_name])
			return

	var phase_expectations := {
		"MAP": "exploration_map",
		"CHOICE": "reward_choice",
		"CLASS_REWARD": "reward_choice",
		"ENCHANT_CHOICE": "reward_choice",
		"RELIC_CHOICE": "reward_choice",
		"UPGRADE_CHOICE": "reward_choice",
		"POTION_CHOICE": "reward_choice",
		"SHOP": "run_shop",
		"PREP": "run_shell",
		"MATCH": "run_shell",
		"BATTLE": "battle_replay",
		"COMPLETE": "run_settlement",
	}
	for phase in phase_expectations.keys():
		var actual := str(manifest.screen_for_run_phase(phase))
		var expected := str(phase_expectations[phase])
		if actual != expected:
			_fail("Phase %s should route to %s, got %s" % [phase, expected, actual])
			return

	if str(manifest.screen_for_run_phase("UNKNOWN_PHASE")) != "mode_lobby":
		_fail("Unknown run phase should fall back to mode lobby")
		return

	print("Web UI screen manifest smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
