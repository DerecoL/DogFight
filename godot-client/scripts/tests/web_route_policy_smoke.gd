extends SceneTree

func _init() -> void:
	var policy = load("res://scripts/ui/web/WebRoutePolicy.gd")
	if policy == null:
		_fail("WebRoutePolicy.gd must exist")
		return
	var screen_ids = load("res://scripts/ui/web/WebUiScreenIds.gd")
	if screen_ids == null:
		_fail("WebUiScreenIds.gd must exist")
		return

	var formal_ids: Array = policy.formal_screen_ids()
	for screen_id in [
		"login",
		"nickname_setup",
		"mode_lobby",
		"dog_select",
		"season",
		"account_shop",
		"achievements",
		"account_settings",
		"leaderboards",
		"apex",
	]:
		if not formal_ids.has(screen_id):
			_fail("Formal screen ids missing %s" % screen_id)
			return
	if formal_ids.has("legacy_run"):
		_fail("Formal screen ids must not include legacy_run")
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
		"UNKNOWN_PHASE": "mode_lobby",
	}
	for phase in phase_expectations.keys():
		var actual := str(policy.formal_screen_for_run_phase(str(phase)))
		var expected := str(phase_expectations[phase])
		if actual != expected:
			_fail("Run phase %s should map to %s, got %s" % [str(phase), expected, actual])
			return
		var runtime_actual := str(screen_ids.screen_for_run_phase(str(phase)))
		if runtime_actual != expected:
			_fail("Runtime run phase %s should map to %s, got %s" % [str(phase), expected, runtime_actual])
			return

	for legacy_phase in ["MAP", "SHOP", "BATTLE"]:
		if not policy.migration_allows_legacy_for_phase(legacy_phase):
			_fail("Migration should allow legacy fallback for phase %s" % legacy_phase)
			return
	if policy.migration_allows_legacy_for_screen("account_shop"):
		_fail("Migration should not allow legacy fallback for account_shop")
		return

	print("Web route policy smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
