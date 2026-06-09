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
		"MAP": "legacy_run",
		"SHOP": "run_shop",
		"CHOICE": "legacy_run",
		"CLASS_REWARD": "legacy_run",
		"ENCHANT_CHOICE": "legacy_run",
		"RELIC_CHOICE": "legacy_run",
		"UPGRADE_CHOICE": "legacy_run",
		"POTION_CHOICE": "legacy_run",
		"PREP": "legacy_run",
		"MATCH": "legacy_run",
		"BATTLE": "legacy_run",
		"COMPLETE": "legacy_run",
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

	main.call("set_current_run", {
		"id": "route-smoke",
		"phase": "BATTLE",
		"status": "ACTIVE",
		"items": [],
		"relics": [],
		"shopItems": [],
		"lastBattle": {
			"id": "route-battle",
			"playerMaxHp": 100,
			"opponentMaxHp": 100,
			"playerSnapshot": {"name": "玩家", "dogType": "SHIBA", "items": [], "relics": []},
			"opponentSnapshot": {"name": "对手", "dogType": "MUTT", "items": [], "relics": []},
			"events": [],
		},
	})
	await process_frame
	if str(router.get("current_screen_id")) != "battle_replay":
		_fail("BATTLE with lastBattle should route to battle_replay, got %s" % str(router.get("current_screen_id")))
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Web UI phase routing smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
