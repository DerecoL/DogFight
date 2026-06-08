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
	if not main.has_method("set_current_run"):
		_fail("Main session does not expose set_current_run")
		return

	for phase in ["PREP", "SHOP", "MAP", "CHOICE"]:
		main.call("set_current_run", _run_payload(phase, "ACTIVE"))
		run_screen.set("current_tab", "跑局")
		run_screen.call("_render_current_tab")
		await process_frame
		if not _collect_text(run_screen).contains("放弃并结算"):
			_fail("Active non-battle phase %s should expose forfeit action" % phase)
			return

	for phase in ["BATTLE", "COMPLETE"]:
		main.call("set_current_run", _run_payload(phase, "COMPLETE" if phase == "COMPLETE" else "ACTIVE"))
		run_screen.set("current_tab", "跑局")
		run_screen.call("_render_current_tab")
		await process_frame
		if _collect_text(run_screen).contains("放弃并结算"):
			_fail("Phase %s must not expose forfeit action" % phase)
			return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot forfeit visibility by phase smoke passed")
	quit(0)

func _run_payload(phase: String, status: String) -> Dictionary:
	return {
		"id": "forfeit-visibility-%s" % phase,
		"mode": "CASUAL",
		"phase": phase,
		"status": status,
		"dogType": "SHIBA",
		"round": 3,
		"wins": 1,
		"losses": 0,
		"gold": 10,
		"refreshCost": 1,
		"shopType": "GENERAL",
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
		"mapState": {
			"nodes": [],
			"currentNodeId": "",
			"completedNodeIds": [],
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
