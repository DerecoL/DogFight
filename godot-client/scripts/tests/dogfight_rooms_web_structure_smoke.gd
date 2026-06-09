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
		],
	})
	run_screen.set("current_tab", "房间")
	run_screen.call("_render_current_tab")
	await process_frame

	for node_name in [
		"DogfightScreen",
		"DogfightHeading",
		"DogfightLayout",
		"DogfightActions",
		"CreateRoomButton",
		"JoinRoomButton",
		"MatchRoomButton",
		"DogfightRoomList",
		"DogfightRoomListHeading",
		"DogfightRefreshButton",
		"DogfightRoomCard_room-waiting",
		"DogfightRoomAction_room-waiting",
		"DogfightRoomCard_room-active",
		"DogfightRoomAction_room-active",
	]:
		_assert_has(run_screen, node_name)

	var layout = _find_by_name(run_screen, "DogfightLayout")
	if not layout is GridContainer:
		_fail("DogfightLayout must use a grid matching the Web action/list layout")
		return
	if int((layout as GridContainer).columns) != 2:
		_fail("DogfightLayout must keep two columns")
		return

	var join_button := _find_by_name(run_screen, "JoinRoomButton") as Button
	if join_button == null:
		_fail("JoinRoomButton must be a button")
		return
	if not join_button.disabled:
		_fail("JoinRoomButton should be disabled until a room is selected, matching the Web lobby")
		return

	var text := _collect_text(run_screen)
	for part in ["斗狗模式", "房间内同步推进回合", "创建房间", "加入房间", "随机匹配", "玩家席位先进入房间", "房间列表", "刷新", "小白 的房间", "等待中", "真人 2/8", "存活 8/8", "阿柴 的房间", "商店阶段 · 第 3 回合", "观战"]:
		if not text.contains(part):
			_fail("Dogfight room Web text missing: %s" % part)
			return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot dogfight rooms Web structure smoke passed")
	quit(0)

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing dogfight rooms Web node: %s" % node_name)

func _find_by_name(node: Node, node_name: String) -> Node:
	if node.name == node_name:
		return node
	for child in node.get_children():
		var found := _find_by_name(child, node_name)
		if found != null:
			return found
	return null

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
