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
	run_screen.set("rooms_data", {
		"rooms": [
			{
				"id": "room-waiting",
				"hostName": "小白",
				"status": "WAITING",
				"phase": "LOBBY",
				"currentRound": 0,
				"memberCount": 2,
				"maxPlayers": 8,
				"aliveCount": 8,
				"targetPlayerCount": 8,
			},
			{
				"id": "room-active",
				"hostName": "阿柴",
				"status": "ACTIVE",
				"phase": "SHOP",
				"currentRound": 3,
				"memberCount": 8,
				"maxPlayers": 8,
				"aliveCount": 6,
				"targetPlayerCount": 8,
			},
			{
				"id": "room-complete",
				"hostName": "犬王",
				"status": "COMPLETE",
				"phase": "COMPLETE",
				"currentRound": 9,
				"memberCount": 8,
				"maxPlayers": 8,
				"aliveCount": 1,
				"targetPlayerCount": 8,
			},
		],
	})
	run_screen.set("current_tab", "房间")
	run_screen.call("_render_current_tab")
	await process_frame
	var text := _collect_text(run_screen)
	for part in ["多人房间", "房间列表", "玩家席位先进入房间", "小白 的房间", "等待中", "真人 2/8", "存活 8/8", "加入房间", "阿柴 的房间", "商店阶段 · 第 3 回合", "观战", "犬王 的房间", "已结束"]:
		if not text.contains(str(part)):
			_fail("Room list label missing: %s" % str(part))
			return
	for raw in ["WAITING", "ACTIVE", "COMPLETE", "SHOP", "LOBBY"]:
		if text.contains(str(raw)):
			_fail("Room list leaked raw status: %s" % str(raw))
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot room list labels smoke passed")
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
