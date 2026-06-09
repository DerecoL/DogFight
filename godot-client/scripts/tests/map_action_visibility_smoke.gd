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
	if not main.has_method("set_current_run"):
		_fail("Main session does not expose set_current_run")
		return

	main.call("set_current_run", _map_run("", {}, null))
	await process_frame
	await process_frame
	var map_screen := _current_map_screen(main)
	if map_screen == null:
		return
	for forbidden in ["ResolveMapEventButton", "ClaimMonsterRewardButton", "SkipMonsterRewardButton"]:
		if _find_by_name(map_screen, forbidden) != null:
			_fail("Map without current action must not expose: %s" % forbidden)
			return

	main.call("set_current_run", _map_run("event-1", _event_node(), null))
	await process_frame
	await process_frame
	map_screen = _current_map_screen(main)
	if map_screen == null:
		return
	if _find_by_name(map_screen, "ResolveMapEventButton") == null:
		_fail("Current event node should expose resolve action")
		return
	for forbidden in ["ClaimMonsterRewardButton", "SkipMonsterRewardButton"]:
		if _find_by_name(map_screen, forbidden) != null:
			_fail("Event node must not expose reward action: %s" % forbidden)
			return

	main.call("set_current_run", _map_run("monster-1", _monster_node(), {"defId": "starter-1", "quality": "SILVER"}))
	await process_frame
	await process_frame
	map_screen = _current_map_screen(main)
	if map_screen == null:
		return
	for required in ["ClaimMonsterRewardButton", "SkipMonsterRewardButton"]:
		if _find_by_name(map_screen, required) == null:
			_fail("Pending reward should expose action: %s" % required)
			return
	if _find_by_name(map_screen, "ResolveMapEventButton") != null:
		_fail("Pending reward must not expose event action")
		return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot map action visibility smoke passed")
	quit(0)

func _map_run(current_node_id: String, current_node: Dictionary, pending_reward) -> Dictionary:
	var nodes: Array = [_node("start-1", "SHOP_FIXED")]
	if not current_node.is_empty():
		nodes.append(current_node)
	var map_state := {
		"nodes": nodes,
		"availableNodeIds": ["start-1"],
		"completedNodeIds": [],
		"currentNodeId": current_node_id,
	}
	if pending_reward != null:
		map_state["pendingReward"] = pending_reward
	return {
		"id": "map-action-visibility",
		"mode": "CASUAL",
		"phase": "MAP",
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"round": 2,
		"wins": 1,
		"losses": 0,
		"gold": 8,
		"items": [],
		"relics": [],
		"shopItems": [],
		"choices": [],
		"classRewardChoices": [],
		"enchantChoices": [],
		"relicChoices": [],
		"upgradeChoices": [],
		"potionChoices": [],
		"mapState": map_state,
	}

func _node(id: String, kind: String) -> Dictionary:
	return {
		"id": id,
		"layer": 0,
		"column": 0,
		"kind": kind,
		"nextNodeIds": [],
	}

func _event_node() -> Dictionary:
	var node := _node("event-1", "EVENT")
	node["event"] = {"title": "神秘事件", "description": "获得奖励"}
	return node

func _monster_node() -> Dictionary:
	var node := _node("monster-1", "MONSTER_BATTLE")
	node["monster"] = {
		"name": "训练野怪",
		"dogType": "SHIBA",
		"round": 2,
		"equipment": [],
		"possibleRewards": [],
	}
	return node

func _current_map_screen(main: Node) -> Node:
	var router = main.get("router")
	if router != null and str(router.get("current_screen_id")) != "exploration_map":
		_fail("MAP should route to standalone ExplorationMapScreen, got %s" % str(router.get("current_screen_id")))
		return null
	var map_screen = main.get_node_or_null("ScreenRoot/ExplorationMapScreen")
	if map_screen == null or not map_screen.visible:
		_fail("Standalone ExplorationMapScreen is missing or hidden")
		return null
	return map_screen

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
