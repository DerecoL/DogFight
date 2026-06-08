extends SceneTree

func _init() -> void:
	var manifest = load("res://scripts/ui/web/WebUiScreenIds.gd")
	if manifest == null:
		_fail("WebUiScreenIds.gd must exist")
		return

	var required_screens := [
		"login",
		"nickname_setup",
		"mode_lobby",
		"run_shell",
		"exploration_map",
		"run_shop",
		"reward_choice",
		"battle_replay",
		"run_settlement",
		"account_shop",
		"achievements",
		"leaderboards",
		"season",
		"dogfight_rooms",
		"dogfight_room_detail",
		"account_settings",
	]
	for screen_id in required_screens:
		if not manifest.screen_ids().has(screen_id):
			_fail("Missing Web UI screen id: %s" % screen_id)
			return
		var node_name := str(manifest.node_name_for(screen_id))
		if node_name.is_empty():
			_fail("Missing node name for screen id: %s" % screen_id)
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

	if str(manifest.screen_for_run_phase("UNKNOWN_PHASE")) != "run_shell":
		_fail("Unknown run phase should fall back to run_shell")
		return

	print("Web UI screen manifest smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
