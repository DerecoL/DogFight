extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/screens/DogfightRoomDetailScreen.tscn")
	if scene == null:
		_fail("DogfightRoomDetailScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame

	screen.call("set_payload", {"dogfightRoomData": _lobby_room()})
	await process_frame
	for node_name in [
		"DogfightRoomDetailView",
		"DogfightRoomToolbar",
		"DogfightRoomStatus",
		"DogfightStartButton",
		"DogfightPhase_DOG_SELECT",
		"DogfightPhase_SHOP",
		"DogfightPhase_BATTLE",
	]:
		_assert_has(screen, node_name)

	screen.call("set_payload", {"dogfightRoomData": _dog_select_room()})
	await process_frame
	for node_name in [
		"DogfightDogSelectTitle",
		"DogfightDogSelectSubtitle",
		"DogfightMember_member-host",
		"DogfightMemberPaw_member-host",
		"DogfightMember_member-guest",
		"DogfightMemberDogBadge_member-guest",
		"DogfightBattleDockEmpty",
	]:
		_assert_has(screen, node_name)
	if _find_by_name(screen, "DogfightStartButton") != null:
		_fail("DOG_SELECT phase should not keep the lobby start-room button visible")
		return

	screen.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot room start and dog choice UI smoke passed")
	quit(0)

func _lobby_room() -> Dictionary:
	return {
		"id": "room-start",
		"status": "WAITING",
		"phase": "LOBBY",
		"currentRound": 0,
		"isHost": true,
		"members": [
			{"id": "member-host", "nickname": "Host", "kind": "PLAYER", "wins": 0, "losses": 0, "ready": false, "isHost": true},
			{"id": "member-guest", "nickname": "Guest", "kind": "PLAYER", "wins": 0, "losses": 0, "ready": false},
		],
		"battles": [],
	}

func _dog_select_room() -> Dictionary:
	var room := _lobby_room()
	room["status"] = "ACTIVE"
	room["phase"] = "DOG_SELECT"
	room["members"] = [
		{"id": "member-host", "nickname": "Host", "kind": "PLAYER", "wins": 0, "losses": 0, "ready": false, "isHost": true},
		{"id": "member-guest", "nickname": "Guest", "kind": "PLAYER", "dogType": "SAMOYED", "wins": 0, "losses": 0, "ready": false},
	]
	return room

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing dogfight start node: %s" % node_name)

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
