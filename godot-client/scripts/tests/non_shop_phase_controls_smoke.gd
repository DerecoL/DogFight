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

	for phase in ["PREP", "MATCH", "CHOICE", "CLASS_REWARD", "RELIC_CHOICE", "UPGRADE_CHOICE", "POTION_CHOICE", "ENCHANT_CHOICE", "COMPLETE"]:
		main.call("set_current_run", _run_payload(phase))
		run_screen.set("current_tab", "跑局")
		run_screen.call("_render_current_tab")
		await process_frame
		var text := _collect_text(run_screen)
		if text.contains("跑局商店") or text.contains("刷新跑局商店") or text.contains("刷新 0 金币"):
			_fail("Phase %s must not expose shop controls outside the SHOP phase" % phase)
			return

	main.call("set_current_run", _run_payload("SHOP"))
	run_screen.set("current_tab", "跑局")
	run_screen.call("_render_current_tab")
	await process_frame
	var shop_text := _collect_text(run_screen)
	if not shop_text.contains("跑局商店") or not shop_text.contains("刷新 1 金币"):
		_fail("SHOP phase should expose shop controls")
		return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot non-shop phase controls smoke passed")
	quit(0)

func _run_payload(phase: String) -> Dictionary:
	var run := {
		"id": "non-shop-phase-smoke-%s" % phase,
		"mode": "CASUAL",
		"phase": phase,
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"round": 3,
		"wins": 1,
		"losses": 0,
		"gold": 10,
		"refreshCost": 1,
		"shopType": "GENERAL",
		"items": [],
		"relics": [],
		"shopItems": [
			{
				"offerId": "offer-1",
				"defId": "starter-1",
				"quality": "SILVER",
				"price": 3,
				"discount": 1.0,
				"def": {"name": "1点牙咬", "size": 1, "description": "造成 5 点伤害", "triggerDice": [1]},
			},
		],
		"choices": [],
		"classRewardChoices": [],
		"enchantChoices": [],
		"relicChoices": [],
		"upgradeChoices": [],
		"potionChoices": [],
		"ladderSettlement": {},
	}
	if phase == "COMPLETE":
		run["status"] = "COMPLETE"
	return run

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
