extends SceneTree

func _init() -> void:
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
		_fail("Main session must expose router")
		return

	var cases := {
		"MAP": "exploration_map",
		"SHOP": "run_shop",
		"CHOICE": "reward_choice",
		"CLASS_REWARD": "reward_choice",
		"ENCHANT_CHOICE": "reward_choice",
		"RELIC_CHOICE": "reward_choice",
		"UPGRADE_CHOICE": "reward_choice",
		"POTION_CHOICE": "reward_choice",
		"PREP": "run_shell",
		"MATCH": "run_shell",
		"BATTLE": "battle_replay",
		"COMPLETE": "run_settlement",
	}
	for phase in cases.keys():
		main.call("set_current_run", {
			"id": "route-smoke",
			"phase": phase,
			"status": "ACTIVE",
			"items": [],
			"relics": [],
			"shopItems": [],
		})
		await process_frame
		var expected = str(cases[phase])
		var actual = str(router.get("current_screen_id"))
		if actual != expected:
			_fail("Phase %s should route to %s, got %s" % [phase, expected, actual])
			return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Web UI phase routing smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
