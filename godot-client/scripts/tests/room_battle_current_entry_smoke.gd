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

	var run_screen = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	if run_screen.has_method("bind_session"):
		run_screen.bind_session(main)

	run_screen.set("current_tab", "房间")
	run_screen.set("active_room", _battle_room())
	run_screen.call("_render_current_tab")
	await process_frame

	var text := _collect_text(run_screen)
	for part in ["当前房间", "战斗阶段", "载入当前战报", "准备 / 完成本回合"]:
		if not text.contains(part):
			_fail("Room battle phase current entry missing: %s" % part)
			return
	var current_context: Dictionary = run_screen.call("_room_battle_finish_context", "battle-current")
	if str(current_context.get("kind", "")) != "DOGFIGHT_ROOM_READY":
		_fail("Current room battle should finish by marking ready")
		return
	var view_context: Dictionary = run_screen.call("_room_battle_finish_context", "battle-other")
	if str(view_context.get("kind", "")) != "DOGFIGHT_ROOM_VIEW":
		_fail("Non-current room battle should only return to room")
		return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot room battle current entry smoke passed")
	quit(0)

func _battle_room() -> Dictionary:
	return {
		"id": "room-battle-current",
		"status": "ACTIVE",
		"phase": "BATTLE",
		"currentRound": 4,
		"members": [
			{"id": "member-1", "nickname": "玩家A", "kind": "PLAYER", "wins": 2, "losses": 1, "ready": false, "eliminated": false, "runId": "run-1", "currentBattleId": "battle-current"},
			{"id": "member-2", "nickname": "玩家B", "kind": "PLAYER", "wins": 1, "losses": 2, "ready": false, "eliminated": false, "runId": "run-2", "currentBattleId": "battle-other"},
		],
		"battles": [],
		"currentRunMember": {"id": "member-1", "ready": false, "eliminated": false, "runId": "run-1", "currentBattleId": "battle-current"},
		"currentRun": {
			"id": "run-1",
			"mode": "DOGFIGHT",
			"phase": "BATTLE",
			"status": "ACTIVE",
			"dogType": "SHIBA",
			"luckyNumber": null,
			"round": 4,
			"wins": 2,
			"losses": 1,
			"gold": 0,
			"items": [],
			"relics": [],
			"shopType": "GENERAL",
			"shopItems": [],
		},
	}

func _collect_text(node: Node) -> String:
	var text := ""
	if node is Label:
		text += (node as Label).text + "\n"
	if node is Button:
		text += (node as Button).text + "\n"
	for child in node.get_children():
		text += _collect_text(child)
	return text

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
