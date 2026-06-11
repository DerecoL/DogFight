extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var main_scene := load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame

	var router = main.get("router")
	if router == null:
		_fail("Main session must expose router")
		return
	for phase in ["MAP", "SHOP", "CHOICE", "PREP", "MATCH", "COMPLETE"]:
		main.call("set_current_run", _run_payload(phase))
		await process_frame
		await process_frame
		var actual := str(router.get("current_screen_id"))
		var expected := _expected_screen(phase)
		if actual != expected:
			_fail("%s should route to %s, got %s" % [phase, expected, actual])
			return
		var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
		if legacy != null and legacy.visible:
			_fail("%s should not expose legacy forfeit controls through LegacyRunScreen" % phase)
			return

	var policy = load("res://scripts/ui/web/WebRoutePolicy.gd")
	if policy == null:
		_fail("WebRoutePolicy failed to load")
		return
	for phase in ["MAP", "SHOP", "CHOICE", "PREP", "MATCH", "COMPLETE"]:
		if policy.migration_allows_legacy_for_phase(phase):
			_fail("%s must not be a legacy-allowed phase after standalone routing" % phase)
			return
	if not policy.migration_allows_legacy_for_phase("BATTLE"):
		_fail("BATTLE without replay data is the only remaining legacy-compatible phase")
		return

	main.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot forfeit visibility by phase smoke passed")
	quit(0)

func _expected_screen(phase: String) -> String:
	match phase:
		"MAP":
			return "exploration_map"
		"SHOP":
			return "run_shop"
		"CHOICE":
			return "reward_choice"
		"COMPLETE":
			return "run_settlement"
		_:
			return "run_shell"

func _run_payload(phase: String) -> Dictionary:
	var run := {
		"id": "forfeit-boundary-%s" % phase,
		"mode": "CASUAL",
		"phase": phase,
		"status": "COMPLETE" if phase == "COMPLETE" else "ACTIVE",
		"dogType": "SHIBA",
		"round": 3,
		"wins": 1,
		"losses": 0,
		"gold": 10,
		"items": [],
		"relics": [],
		"shopItems": [],
		"choices": [{"id": "choice-1", "targetPhase": "SHOP"}],
		"classRewardChoices": [],
		"enchantChoices": [],
		"relicChoices": [],
		"upgradeChoices": [],
		"potionChoices": [],
		"mapState": {"nodes": [], "currentNodeId": "", "completedNodeIds": []},
		"lastBattle": {},
	}
	if phase == "COMPLETE":
		run["lastBattle"] = {"events": [], "playerSnapshot": {}, "opponentSnapshot": {}}
	return run

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
