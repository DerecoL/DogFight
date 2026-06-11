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
		"ExplorationMapOverlay",
		"MapNodeDetailPanel",
		"MapMonsterEquipmentTitle",
		"MapMonsterEquipmentGrid",
		"MapRewardPreviewLinks",
		"MapRewardPreviewRow",
		"MapRewardPreview_starter-1",
	]:
		_assert_has(screen, node_name)
	var equipment_button := _find_by_name(screen, "MapMonsterEquipmentButton_monster-bite") as Button
	if equipment_button == null:
		_fail("Monster equipment button is missing")
		return
	equipment_button.pressed.emit()
	await process_frame
	_assert_has(screen, "MapMonsterEquipmentPreviewModal")
	_assert_has(screen, "MapMonsterItemTip")

	screen.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot map node modal smoke passed")
	quit(0)

func _map_run() -> Dictionary:
	return {
		"id": "map-node-modal-run",
		"phase": "MAP",
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"round": 1,
		"wins": 0,
		"losses": 0,
		"gold": 8,
		"items": [],
		"relics": [],
		"mapState": {
			"currentNodeId": "m0-l0-c0",
			"availableNodeIds": ["m0-l0-c0"],
			"completedNodeIds": [],
			"nodes": [{
				"id": "m0-l0-c0",
				"layer": 0,
				"column": 0,
				"kind": "MONSTER_BATTLE",
				"monster": {
					"name": "Training Monster",
					"dogType": "SHIBA",
					"round": 1,
					"equipment": [
						{"id": "monster-bite", "defId": "starter-1", "quality": "BRONZE", "area": "EQUIPMENT", "x": 0, "y": 0, "def": {"name": "Monster Fang", "size": 1}},
					],
					"possibleRewards": [
						{"defId": "starter-1", "quality": "BRONZE", "def": {"name": "Reward Fang", "size": 1}},
					],
				},
			}],
		},
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing map node: %s" % node_name)

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
