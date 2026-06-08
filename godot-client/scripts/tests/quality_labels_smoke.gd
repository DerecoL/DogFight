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
	var battle_screen = main.get_node_or_null("ScreenRoot/BattleReplayScreen")
	if run_screen == null or battle_screen == null:
		_fail("Required screens are missing")
		return
	main.call("set_current_run", _shop_run())
	run_screen.set("current_tab", "跑局")
	run_screen.call("_render_current_tab")
	battle_screen.call("start_replay", _battle())
	await process_frame
	var text := _collect_text(run_screen) + "\n" + _collect_text(battle_screen)
	for expected in ["青铜", "黄金", "钻石", "幸运骨头", "祖灵莲池"]:
		if not text.contains(expected):
			_fail("Quality label missing: %s" % expected)
			return
	for raw in ["BRONZE", "GOLD", "DIAMOND"]:
		if text.contains(raw):
			_fail("Quality label leaked raw enum: %s" % raw)
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot quality labels smoke passed")
	quit(0)

func _shop_run() -> Dictionary:
	var item_def := {"id": "lucky-bone", "name": "幸运骨头", "size": 1, "width": 1, "height": 1, "dice": [1, 2], "description": "造成伤害"}
	var relic_def := {"id": "lotus-sea", "name": "祖灵莲池", "description": "蓄水强化", "effect": "蓄水强化"}
	return {
		"id": "quality-run",
		"mode": "CASUAL",
		"phase": "SHOP",
		"status": "ACTIVE",
		"dogType": "FROG",
		"luckyNumber": null,
		"round": 4,
		"wins": 2,
		"losses": 1,
		"gold": 30,
		"shopType": "GENERAL",
		"refreshCost": 1,
		"shopItems": [
			{"offerId": "offer-gold", "defId": "lucky-bone", "price": 6, "discount": 1.0, "quality": "GOLD", "def": item_def},
		],
		"items": [
			{"id": "item-bronze", "defId": "lucky-bone", "quality": "BRONZE", "area": "EQUIPMENT", "x": 0, "y": 0, "def": item_def},
		],
		"relics": [
			{"id": "relic-diamond", "relicId": "lotus-sea", "quality": "DIAMOND", "slot": 0, "def": relic_def},
		],
	}

func _battle() -> Dictionary:
	return {
		"id": "quality-battle",
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"playerSnapshot": {"name": "品质犬", "dogType": "FROG", "wins": 2, "losses": 1, "round": 4, "items": _shop_run()["items"], "relics": _shop_run()["relics"]},
		"opponentSnapshot": {"name": "对手犬", "dogType": "SHIBA", "wins": 1, "losses": 1, "round": 4, "items": [], "relics": []},
		"events": [],
	}

func _collect_text(node: Node) -> String:
	var text := ""
	if node is Label:
		text += (node as Label).text + "\n"
	if node is Button:
		text += (node as Button).text + "\n"
	if node is RichTextLabel:
		text += (node as RichTextLabel).text + "\n"
	for child in node.get_children():
		text += _collect_text(child)
	return text

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
