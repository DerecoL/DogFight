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
	var mode_select: OptionButton = run_screen.get("mode_select")
	if mode_select == null or mode_select.item_count < 2:
		_fail("Mode selector is missing")
		return
	var mode_text := ""
	for index in range(mode_select.item_count):
		mode_text += mode_select.get_item_text(index) + "\n"
	if not mode_text.contains("休闲") or not mode_text.contains("天梯"):
		_fail("Mode selector must show localized mode labels")
		return
	for raw_mode in ["CASUAL", "LADDER"]:
		if mode_text.contains(raw_mode):
			_fail("Mode selector leaked raw mode id: %s" % raw_mode)
			return
	battle_screen.call("start_replay", _battle())
	battle_screen.call("_apply_event", _battle()["events"][0])
	await process_frame
	var text := _collect_text(battle_screen)
	for expected in ["柴犬", "萨摩耶", "我方", "装备触发", "啃咬造成 7 点伤害"]:
		if not text.contains(expected):
			_fail("Battle replay label missing: %s" % expected)
			return
	for raw in ["SHIBA", "SAMOYED", "ITEM"]:
		if text.contains(raw):
			_fail("Battle replay leaked raw id: %s" % raw)
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle and mode labels smoke passed")
	quit(0)

func _battle() -> Dictionary:
	return {
		"id": "battle-labels",
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"playerSnapshot": {"name": "玩家犬", "dogType": "SHIBA", "wins": 3, "losses": 1, "round": 5, "items": [], "relics": []},
		"opponentSnapshot": {"name": "雪原犬", "dogType": "SAMOYED", "wins": 2, "losses": 2, "round": 5, "items": [], "relics": []},
		"events": [
			{"time": 1, "actor": "player", "kind": "ITEM", "text": "啃咬造成 7 点伤害", "playerHp": 100, "opponentHp": 93, "playerMaxHp": 100, "opponentMaxHp": 100, "effectType": "DAMAGE"},
		],
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
