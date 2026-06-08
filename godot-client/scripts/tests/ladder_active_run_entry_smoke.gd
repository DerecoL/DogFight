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
	if run_screen != null and run_screen.has_method("bind_session"):
		run_screen.bind_session(main)
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	if not main.has_method("set_current_run"):
		_fail("Main session does not expose set_current_run")
		return

	main.call("set_current_run", _ladder_run())
	run_screen.set("leaderboard_data", {
		"playerRank": null,
		"playerProfile": {
			"tier": "SILVER",
			"tierLabel": "白银",
			"score": 180,
			"gamesPlayed": 4,
			"totalWins": 3,
			"totalLosses": 1,
		},
		"leaderboard": [],
	})
	run_screen.set("current_tab", "排行")
	run_screen.call("_render_current_tab")
	await process_frame

	var start_ladder_button = run_screen.find_child("StartLadderRunButton", true, false) as Button
	if start_ladder_button != null:
		_fail("Active LADDER run must not expose StartLadderRunButton from the leaderboard tab")
		return
	var text := _collect_text(run_screen)
	if text.contains("开始天梯"):
		_fail("Active LADDER run must not expose a new ladder start action")
		return
	if not text.contains("继续天梯模式"):
		_fail("Active LADDER run should expose a continue ladder action")
		return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot ladder active run entry smoke passed")
	quit(0)

func _ladder_run() -> Dictionary:
	return {
		"id": "ladder-active-entry-smoke",
		"mode": "LADDER",
		"phase": "SHOP",
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"round": 2,
		"wins": 1,
		"losses": 0,
		"gold": 8,
		"items": [],
		"relics": [],
		"shopItems": [],
		"choices": [],
		"classRewardChoices": [],
		"enchantChoices": [],
		"relicChoices": [],
		"upgradeChoices": [],
		"potionChoices": [],
		"ladderSettlement": {},
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
