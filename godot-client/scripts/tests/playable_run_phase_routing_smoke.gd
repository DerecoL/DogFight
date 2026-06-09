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
	if router == null:
		_fail("Main session must expose router")
		return
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null:
		_fail("Main scene must retain playable LegacyRunScreen")
		return

	for phase in ["MAP", "SHOP", "CHOICE", "CLASS_REWARD", "RELIC_CHOICE", "UPGRADE_CHOICE", "POTION_CHOICE", "ENCHANT_CHOICE", "PREP", "MATCH", "COMPLETE"]:
		main.call("set_current_run", _run_payload(phase))
		await process_frame
		await process_frame
		if phase == "SHOP":
			if str(router.get("current_screen_id")) != "run_shop":
				_fail("SHOP should show standalone RunShopScreen, got %s" % str(router.get("current_screen_id")))
				return
			var run_shop = main.get_node_or_null("ScreenRoot/RunShopScreen")
			if run_shop == null or not run_shop.visible or run_shop.find_child("ShopWorkbench", true, false) == null:
				_fail("SHOP should render standalone ShopWorkbench")
				return
			continue
		if not legacy.visible:
			_fail("Phase %s should show playable LegacyRunScreen, got %s" % [phase, str(router.get("current_screen_id"))])
			return
		if legacy.get_node_or_null("HubRoot") == null:
			_fail("Playable run UI must expose HubRoot for phase %s" % phase)
			return
		if _current_screen_has_placeholder(main, router):
			_fail("Phase %s must not route to placeholder Web screen" % phase)
			return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot playable run phase routing smoke passed")
	quit(0)

func _current_screen_has_placeholder(main: Node, router: Node) -> bool:
	var screen_id := str(router.get("current_screen_id"))
	var manifest = load("res://scripts/ui/web/WebUiScreenIds.gd")
	if manifest == null:
		return false
	var node_name := str(manifest.node_name_for(screen_id))
	if node_name.is_empty():
		return false
	var screen = main.get_node_or_null("ScreenRoot/%s" % node_name)
	return screen != null and screen.find_child("PlaceholderPanel", true, false) != null

func _run_payload(phase: String) -> Dictionary:
	var run := {
		"id": "playable-route-smoke",
		"mode": "CASUAL",
		"dogType": "SHIBA",
		"phase": phase,
		"status": "ACTIVE",
		"round": 1,
		"wins": 0,
		"losses": 0,
		"gold": 10,
		"items": [],
		"relics": [],
		"shopItems": [],
		"choices": [],
		"classRewardChoices": [],
		"enchantChoices": [],
		"relicChoices": [],
		"upgradeChoices": [],
		"potionChoices": [],
	}
	if phase == "MAP":
		run["mapState"] = {
			"nodes": [],
			"currentNodeId": "",
			"completedNodeIds": [],
		}
	if phase == "COMPLETE":
		run["status"] = "COMPLETE"
	return run

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
