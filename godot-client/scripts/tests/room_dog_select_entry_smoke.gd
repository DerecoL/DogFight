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
	screen.call("set_payload", {"dogfightRoomData": _room("DOG_SELECT")})
	await process_frame

	for node_name in [
		"DogfightRoomDetailView",
		"DogfightRoomStatus",
		"DogfightPhase_DOG_SELECT",
		"DogfightPlayArea",
		"DogfightDogSelectTitle",
		"DogfightDogSelectSubtitle",
		"DogfightMember_member-1",
		"DogfightMemberPaw_member-1",
	]:
		_assert_has(screen, node_name)

	screen.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot room dog-select entry smoke passed")
	quit(0)

func _room(phase: String) -> Dictionary:
	return {
		"id": "room-dog-select",
		"status": "ACTIVE",
		"phase": phase,
		"currentRound": 1,
		"isHost": false,
		"members": [
			{"id": "member-1", "nickname": "Player A", "kind": "PLAYER", "wins": 0, "losses": 0, "ready": false, "isCurrentUser": true},
			{"id": "bot-1", "nickname": "Bot", "kind": "BOT", "wins": 0, "losses": 0, "ready": false},
		],
		"battles": [],
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing dogfight room node: %s" % node_name)

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
