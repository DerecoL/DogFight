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

	main.call("set_current_run", _shop_run("", ""))
	await process_frame
	await process_frame
	var shop_screen := _visible_shop_screen(main)
	if shop_screen == null:
		return
	if not _match_button_text(shop_screen).contains("匹配对手"):
		_fail("Plain SHOP phase should expose match action")
		return

	main.call("set_current_run", _shop_run("shop-node", "SHOP_FIXED"))
	await process_frame
	await process_frame
	shop_screen = _visible_shop_screen(main)
	if shop_screen == null:
		return
	if not _match_button_text(shop_screen).contains("返回地图"):
		_fail("Map shop node should expose return-to-map action")
		return

	main.call("set_current_run", _shop_run("player-node", "PLAYER_BATTLE"))
	await process_frame
	await process_frame
	shop_screen = _visible_shop_screen(main)
	if shop_screen == null:
		return
	if not _match_button_text(shop_screen).contains("进入战斗"):
		_fail("Player battle shop node should expose enter-battle action")
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

func _visible_shop_screen(main: Node) -> Node:
	var router = main.get("router")
	if router == null or str(router.get("current_screen_id")) != "run_shop":
		_fail("SHOP phase should route to standalone RunShopScreen")
		return null
	var shop_screen = main.get_node_or_null("ScreenRoot/RunShopScreen")
	if shop_screen == null or not shop_screen.visible:
		_fail("SHOP phase should show RunShopScreen")
		return null
	return shop_screen

func _match_button_text(root_node: Node) -> String:
	var button := _find_by_name(root_node, "MatchButton") as Button
	return "" if button == null else button.text

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
