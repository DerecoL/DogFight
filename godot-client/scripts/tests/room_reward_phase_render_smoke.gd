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
	run_screen.set("active_room", _room_with_enchant_choice())
	run_screen.call("_render_current_tab")
	await process_frame

	var text := _collect_text(run_screen)
	for part in ["房间当前跑局", "奖励 / 选择", "查看附魔", "相邻触发", "装备 / 背包 / 遗物"]:
		if not text.contains(part):
			_fail("Room reward phase render missing: %s" % part)
			return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot room reward phase render smoke passed")
	quit(0)

func _room_with_enchant_choice() -> Dictionary:
	return {
		"id": "room-reward-phase",
		"status": "ACTIVE",
		"phase": "SHOP",
		"currentRound": 3,
		"members": [
			{"id": "member-1", "nickname": "玩家A", "kind": "PLAYER", "wins": 2, "losses": 0, "ready": false, "eliminated": false, "runId": "run-1"},
		],
		"battles": [],
		"currentRunMember": {"id": "member-1", "ready": false, "eliminated": false, "runId": "run-1"},
		"currentRun": {
			"id": "run-1",
			"mode": "DOGFIGHT",
			"phase": "ENCHANT_CHOICE",
			"status": "ACTIVE",
			"dogType": "SHIBA",
			"luckyNumber": null,
			"round": 3,
			"wins": 2,
			"losses": 0,
			"gold": 6,
			"items": [
				{"id": "item-1", "defId": "starter-1", "quality": "BRONZE", "area": "EQUIPMENT", "x": 0, "y": 0, "def": {"name": "1点牙咬"}},
			],
			"relics": [],
			"shopType": "GENERAL",
			"shopItems": [],
			"enchantChoices": [
				{"id": "enchant-1", "description": "相邻触发", "enchant": {"label": "相邻触发", "kind": "TRIGGER_NEIGHBOR", "target": "ADJACENT"}},
			],
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
