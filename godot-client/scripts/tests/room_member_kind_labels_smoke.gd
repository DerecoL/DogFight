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
	run_screen.set("current_tab", "房间")
	run_screen.set("active_room", {
		"id": "room-1",
		"status": "ACTIVE",
		"round": 3,
		"members": [
			{"id": "member-player", "nickname": "玩家A", "kind": "PLAYER", "isHost": true, "wins": 2, "losses": 0, "ready": true},
			{"id": "member-bot", "nickname": "机器人B", "kind": "BOT", "wins": 1, "losses": 1, "eliminated": true, "eliminatedRound": 2},
		],
		"battles": [],
	})
	run_screen.call("_render_shell")
	await process_frame
	var shell_text := _collect_text(run_screen)
	for expected in ["玩家A", "玩家", "房主", "机器人B", "机器人", "第 2 回合淘汰"]:
		if not shell_text.contains(expected):
			_fail("Room member list label missing: %s" % expected)
			return
	for raw in ["PLAYER", "BOT"]:
		if shell_text.contains(raw):
			_fail("Room member list leaked raw kind: %s" % raw)
			return
	run_screen.call("_show_room_member_modal", {
		"id": "member-seed",
		"nickname": "种子位",
		"kind": "SEED",
		"dogType": "SHIBA",
		"wins": 0,
		"losses": 0,
		"round": 1,
		"gold": 3,
		"phase": "SHOP",
		"status": "ACTIVE",
	})
	await process_frame
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	var modal_text := _collect_text(modal_layer)
	if not modal_text.contains("种子"):
		_fail("Room member modal kind label missing: 种子")
		return
	if modal_text.contains("SEED"):
		_fail("Room member modal leaked raw kind: SEED")
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot room member kind labels smoke passed")
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
