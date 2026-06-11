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

	screen.call("set_payload", {"dogfightRoomData": _shop_room()})
	await process_frame
	for node_name in [
		"DogfightRoomDetailView",
		"DogfightRoomStatus",
		"DogfightRunStats",
		"DogfightReadyButton",
		"DogfightCurrentRunTitle",
		"DogfightCurrentRunPhase",
		"DogfightCurrentRunDog",
	]:
		_assert_has(screen, node_name)

	screen.call("set_payload", {"dogfightRoomData": _battle_room()})
	await process_frame
	for node_name in [
		"DogfightPhase_BATTLE",
		"DogfightBattleDock",
		"DogfightBattleRow_battle-1",
		"DogfightBattleRow_battle-2",
		"DogfightPlayArea",
		"DogfightReadyButton",
	]:
		_assert_has(screen, node_name)

	var dock = _find_by_name(screen, "DogfightBattleDock")
	if dock == null or dock.find_child("DogfightBattleDockEmpty", true, false) != null:
		_fail("BATTLE phase with battles must render replay rows instead of the empty dock")
		return

	screen.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot room first battle UI progression smoke passed")
	quit(0)

func _shop_room() -> Dictionary:
	var room := _base_room("SHOP")
	room["currentRun"] = _room_run("SHOP")
	room["currentRunMember"] = {"id": "member-host", "runId": "run-host", "ready": false, "losses": 0}
	return room

func _battle_room() -> Dictionary:
	var room := _base_room("BATTLE")
	room["currentRun"] = _room_run("BATTLE")
	room["currentRunMember"] = {"id": "member-host", "runId": "run-host", "ready": false, "losses": 0, "currentBattleId": "battle-1"}
	room["battles"] = [
		{"id": "battle-1", "round": 1, "opponentKind": "PLAYER"},
		{"id": "battle-2", "round": 1, "opponentKind": "BOT"},
	]
	return room

func _base_room(phase: String) -> Dictionary:
	return {
		"id": "room-battle-flow",
		"status": "ACTIVE",
		"phase": phase,
		"currentRound": 1,
		"isHost": true,
		"members": [
			{"id": "member-host", "nickname": "Host", "kind": "PLAYER", "dogType": "SHIBA", "runId": "run-host", "wins": 1, "losses": 0, "ready": false, "isHost": true},
			{"id": "member-guest", "nickname": "Guest", "kind": "PLAYER", "dogType": "SAMOYED", "runId": "run-guest", "wins": 0, "losses": 1, "ready": true},
		],
		"battles": [],
	}

func _room_run(phase: String) -> Dictionary:
	return {
		"id": "run-host",
		"phase": phase,
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"round": 1,
		"wins": 1,
		"losses": 0,
		"gold": 12,
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing dogfight room battle node: %s" % node_name)

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
