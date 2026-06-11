extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/screens/ExplorationMapScreen.tscn")
	if scene == null:
		_fail("ExplorationMapScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame
	screen.call("set_payload", {"run": _map_run()})
	await process_frame

	for node_name in [
		"MapTitle",
		"MapSubtitle",
		"MapRunStats",
		"MapNodeButton_node-player",
		"MapNodeButton_node-shop",
		"MapNodeDetailPanel",
		"MapNodeDetailTitle",
	]:
		_assert_has(screen, node_name)
	var text := _collect_text(screen)
	for raw in ["MAP", "ACTIVE", "PLAYER_BATTLE", "SHOP_FIXED", "GENERAL"]:
		if text.contains(raw):
			_fail("Run flow leaked raw enum: %s" % raw)
			return

	screen.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot run flow enum labels smoke passed")
	quit(0)

func _map_run() -> Dictionary:
	return {
		"id": "run-flow-labels",
		"mode": "CASUAL",
		"phase": "MAP",
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"round": 3,
		"wins": 1,
		"losses": 0,
		"gold": 8,
		"items": [],
		"relics": [],
		"shopType": "GENERAL",
		"shopItems": [],
		"mapState": {
			"currentNodeId": "node-player",
			"availableNodeIds": ["node-player"],
			"completedNodeIds": [],
			"nodes": [
				{"id": "node-player", "kind": "PLAYER_BATTLE", "layer": 0, "column": 0, "nextNodeIds": ["node-shop"]},
				{"id": "node-shop", "kind": "SHOP_FIXED", "shopType": "GENERAL", "layer": 1, "column": 0, "nextNodeIds": []},
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

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing run flow node: %s" % node_name)

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
