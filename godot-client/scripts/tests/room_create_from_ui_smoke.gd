extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/screens/DogfightRoomsScreen.tscn")
	if scene == null:
		_fail("DogfightRoomsScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame
	screen.call("set_payload", {"dogfightRoomsData": {"rooms": [_waiting_room(), _active_room()]}})
	await process_frame

	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("DogfightRoomsScreen must be standalone and must not redirect to LegacyRunScreen")
		return
	for node_name in [
		"DogfightScreen",
		"DogfightLayout",
		"DogfightActions",
		"CreateRoomButton",
		"JoinRoomButton",
		"MatchRoomButton",
		"DogfightRoomList",
		"DogfightRefreshButton",
		"DogfightRoomCard_room-waiting",
		"DogfightRoomAction_room-waiting",
		"DogfightRoomCard_room-active",
		"DogfightRoomAction_room-active",
	]:
		_assert_has(screen, node_name)
	var layout = _find_by_name(screen, "DogfightLayout")
	if not layout is GridContainer or int((layout as GridContainer).columns) != 2:
		_fail("DogfightLayout must keep action/list columns")
		return
	var join_button = _find_by_name(screen, "JoinRoomButton") as Button
	if join_button == null or not join_button.disabled:
		_fail("JoinRoomButton should stay disabled until a room is selected")
		return

	screen.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot room create from UI smoke passed")
	quit(0)

func _waiting_room() -> Dictionary:
	return {
		"id": "room-waiting",
		"hostName": "Host A",
		"status": "WAITING",
		"phase": "LOBBY",
		"currentRound": 0,
		"memberCount": 2,
		"maxPlayers": 8,
		"aliveCount": 8,
		"targetPlayerCount": 8,
	}

func _active_room() -> Dictionary:
	return {
		"id": "room-active",
		"hostName": "Host B",
		"status": "ACTIVE",
		"phase": "SHOP",
		"currentRound": 3,
		"memberCount": 8,
		"maxPlayers": 8,
		"aliveCount": 6,
		"targetPlayerCount": 8,
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing dogfight rooms node: %s" % node_name)

func _find_by_name(node: Node, node_name: String) -> Node:
	if node.name == node_name:
		return node
	for child in node.get_children():
		var found := _find_by_name(child, node_name)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
