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

	var cases := {
		"MAP": ["exploration_map", "ExplorationMapScreen", "ExplorationMapOverlay"],
		"SHOP": ["run_shop", "RunShopScreen", "ShopWorkbench"],
		"CHOICE": ["reward_choice", "RewardChoiceScreen", "ShopChoiceScreen"],
		"CLASS_REWARD": ["reward_choice", "RewardChoiceScreen", "RewardPanel"],
		"RELIC_CHOICE": ["reward_choice", "RewardChoiceScreen", "RewardPanel"],
		"UPGRADE_CHOICE": ["reward_choice", "RewardChoiceScreen", "RewardPanel"],
		"POTION_CHOICE": ["reward_choice", "RewardChoiceScreen", "RewardPanel"],
		"ENCHANT_CHOICE": ["reward_choice", "RewardChoiceScreen", "RewardPanel"],
		"PREP": ["run_shell", "RunShellScreen", "MatchPanel"],
		"MATCH": ["run_shell", "RunShellScreen", "BattleStartButton"],
		"COMPLETE": ["run_settlement", "RunSettlementScreen", "SettlementPage"],
	}
	for phase in cases.keys():
		main.call("set_current_run", _run_payload(phase))
		await process_frame
		await process_frame
		var expected: Array = cases[phase]
		if str(router.get("current_screen_id")) != str(expected[0]):
			_fail("%s should route to %s, got %s" % [phase, str(expected[0]), str(router.get("current_screen_id"))])
			return
		var screen = main.get_node_or_null("ScreenRoot/%s" % str(expected[1]))
		if screen == null or not screen.visible:
			_fail("%s should show %s" % [phase, str(expected[1])])
			return
		if screen.find_child(str(expected[2]), true, false) == null:
			_fail("%s should render %s" % [phase, str(expected[2])])
			return
		var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
		if legacy != null and legacy.visible:
			_fail("%s should not fall back to LegacyRunScreen" % phase)
			return

	main.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot casual full UI progression smoke passed")
	quit(0)

func _run_payload(phase: String) -> Dictionary:
	var run := {
		"id": "casual-flow-%s" % phase,
		"mode": "CASUAL",
		"phase": phase,
		"status": "COMPLETE" if phase == "COMPLETE" else "ACTIVE",
		"dogType": "SHIBA",
		"round": 2,
		"wins": 1,
		"losses": 0,
		"gold": 20,
		"refreshCost": 1,
		"shopType": "GENERAL",
		"items": [{"id": "item-1", "defId": "starter-1", "name": "Starter", "area": "BACKPACK"}],
		"relics": [],
		"shopItems": [{"id": "offer-1", "item": {"id": "shop-1", "defId": "starter-1", "name": "Starter"}, "price": 3}],
		"choices": [{"id": "choice-1", "label": "Shop", "targetPhase": "SHOP"}],
		"classRewardChoices": [{"classId": "guard", "label": "Guard"}],
		"enchantChoices": [{"enchantId": "sharp", "label": "Sharp"}],
		"relicChoices": [{"relicId": "lucky_coin", "label": "Lucky"}],
		"upgradeChoices": [{"itemId": "item-1", "label": "Upgrade"}],
		"potionChoices": [{"potionId": "heal", "label": "Heal"}],
		"lastBattle": {},
	}
	if phase == "MAP":
		run["mapState"] = {
			"currentNodeId": "node-1",
			"completedNodeIds": [],
			"nodes": [{"id": "node-1", "kind": "MONSTER_BATTLE", "source": "MONSTER_BATTLE", "layer": 0, "column": 0, "reachable": true}],
		}
	if phase == "COMPLETE":
		run["lastBattle"] = {"events": [], "playerSnapshot": {}, "opponentSnapshot": {}}
	return run

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
