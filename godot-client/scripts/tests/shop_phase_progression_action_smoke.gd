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

	main.call("set_current_run", _shop_run("", ""))
	run_screen.set("current_tab", "跑局")
	run_screen.call("_render_current_tab")
	await process_frame
	var text := _collect_text(run_screen)
	if not text.contains("匹配对手"):
		_fail("Plain SHOP phase should expose match action")
		return
	if text.contains("返回地图") or text.contains("进入战斗"):
		_fail("Plain SHOP phase should not expose map-node completion labels")
		return

	main.call("set_current_run", _shop_run("shop-node", "SHOP_FIXED"))
	run_screen.call("_render_current_tab")
	await process_frame
	text = _collect_text(run_screen)
	if not text.contains("返回地图"):
		_fail("Map shop node should expose return-to-map action")
		return
	if text.contains("匹配对手") or text.contains("进入战斗"):
		_fail("Map shop node should not expose plain match labels")
		return

	main.call("set_current_run", _shop_run("player-node", "PLAYER_BATTLE"))
	run_screen.call("_render_current_tab")
	await process_frame
	text = _collect_text(run_screen)
	if not text.contains("进入战斗"):
		_fail("Player battle shop node should expose enter-battle action")
		return
	if text.contains("匹配对手") or text.contains("返回地图"):
		_fail("Player battle shop node should not expose other progression labels")
		return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot shop phase progression action smoke passed")
	quit(0)

func _shop_run(current_node_id: String, current_node_kind: String) -> Dictionary:
	var map_state := {
		"nodes": [],
		"availableNodeIds": [],
		"completedNodeIds": [],
		"currentNodeId": current_node_id,
	}
	if not current_node_id.is_empty():
		map_state["nodes"] = [_node(current_node_id, current_node_kind)]
	return {
		"id": "shop-progression-%s" % _fallback(current_node_kind, "plain"),
		"mode": "CASUAL",
		"phase": "SHOP",
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"round": 2,
		"wins": 1,
		"losses": 0,
		"gold": 8,
		"refreshCost": 1,
		"shopType": "GENERAL",
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

func _fallback(value: String, fallback: String) -> String:
	return fallback if value.strip_edges().is_empty() else value

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
