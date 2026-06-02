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
	var run_screen = main.get_node_or_null("ScreenRoot/RunScreen")
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	run_screen.set("active_room", {
		"id": "room-1",
		"status": "ACTIVE",
		"phase": "SHOP",
		"currentRound": 2,
		"members": [{"id": "member-1", "nickname": "玩家A", "kind": "PLAYER", "wins": 1, "losses": 0}],
		"battles": [],
		"currentRun": {
			"id": "run-1",
			"mode": "DOGFIGHT",
			"phase": "SHOP",
			"status": "ACTIVE",
			"dogType": "SHIBA",
			"luckyNumber": null,
			"round": 2,
			"wins": 1,
			"losses": 0,
			"gold": 8,
			"items": [
				{"id": "item-1", "defId": "starter-1", "quality": "BRONZE", "area": "EQUIPMENT", "x": 0, "y": 0, "def": {"name": "1点牙咬"}},
				{"id": "item-2", "defId": "starter-2", "quality": "BRONZE", "area": "BAG", "x": 0, "y": 0, "def": {"name": "2点牙咬"}},
			],
			"relics": [],
			"shopType": "GENERAL",
			"refreshCost": 1,
			"shopItems": [
				{"offerId": "offer-1", "defId": "starter-3", "quality": "BRONZE", "price": 5, "def": {"name": "3点牙咬"}},
			],
		},
	})
	run_screen.set("current_tab", "房间")
	run_screen.call("_render_current_tab")
	await process_frame
	var text := _collect_text(run_screen)
	for part in ["房间当前跑局", "第 2 回合", "装备 / 背包 / 遗物", "跑局商店", "3点牙咬"]:
		if not text.contains(part):
			_fail("Room current run preview missing: %s" % part)
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot room current run smoke passed")
	quit(0)

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
