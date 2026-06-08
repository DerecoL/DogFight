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
	if not main.has_method("set_current_run"):
		_fail("Main session does not expose set_current_run")
		return

	main.call("set_current_run", _map_run("", {}, null))
	run_screen.set("current_tab", "跑局")
	run_screen.call("_render_current_tab")
	await process_frame
	var text := _collect_text(run_screen)
	for forbidden in ["处理事件", "完成节点", "领取怪物奖励", "跳过怪物奖励"]:
		if text.contains(str(forbidden)):
			_fail("Map without current action must not expose: %s" % str(forbidden))
			return

	main.call("set_current_run", _map_run("event-1", _event_node(), null))
	run_screen.call("_render_current_tab")
	await process_frame
	text = _collect_text(run_screen)
	if not text.contains("处理事件"):
		_fail("Current event node should expose resolve action")
		return
	for forbidden in ["领取怪物奖励", "跳过怪物奖励"]:
		if text.contains(str(forbidden)):
			_fail("Event node must not expose reward action: %s" % str(forbidden))
			return

	main.call("set_current_run", _map_run("monster-1", _monster_node(), {"defId": "starter-1", "quality": "SILVER"}))
	run_screen.call("_render_current_tab")
	await process_frame
	text = _collect_text(run_screen)
	for required in ["领取怪物奖励", "跳过怪物奖励"]:
		if not text.contains(str(required)):
			_fail("Pending reward should expose action: %s" % str(required))
			return
	if text.contains("处理事件"):
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
