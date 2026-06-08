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
	var battle_screen = main.get_node_or_null("ScreenRoot/BattleReplayScreen")
	if router == null or battle_screen == null:
		_fail("Main scene must expose router and BattleReplayScreen")
		return

	main.call("set_current_run", _battle_run(null))
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "legacy_run":
		_fail("BATTLE run without lastBattle must fall back to playable run shell, got %s" % str(router.get("current_screen_id")))
		return
	if not (battle_screen.get("battle") as Dictionary).is_empty():
		_fail("BATTLE run without lastBattle must not leave stale replay payload")
		return

	main.call("set_current_run", _battle_run(_battle_payload("restore-battle")))
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "battle_replay":
		_fail("BATTLE run with lastBattle must open battle replay, got %s" % str(router.get("current_screen_id")))
		return
	var restored_battle: Dictionary = battle_screen.get("battle")
	if str(restored_battle.get("id", "")) != "restore-battle":
		_fail("BATTLE run with lastBattle must start replay from lastBattle")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot battle phase restore routing smoke passed")
	quit(0)

func _battle_run(last_battle: Variant) -> Dictionary:
	var run := {
		"id": "restore-run",
		"phase": "BATTLE",
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"items": [],
		"relics": [],
		"shopItems": [],
	}
	if last_battle != null:
		run["lastBattle"] = last_battle
	return run

func _battle_payload(id: String) -> Dictionary:
	return {
		"id": id,
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"playerSnapshot": {"name": "玩家", "dogType": "SHIBA", "items": [], "relics": []},
		"opponentSnapshot": {"name": "对手", "dogType": "MUTT", "items": [], "relics": []},
		"events": [{"kind": "ROLL", "actor": "player", "roll": 6, "playerHp": 100, "opponentHp": 94}],
	}

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
