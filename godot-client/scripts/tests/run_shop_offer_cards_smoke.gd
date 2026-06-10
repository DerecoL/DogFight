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
	if run_screen != null and run_screen.has_method("bind_session"):
		run_screen.bind_session(main)
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	if not main.has_method("set_current_run"):
		_fail("Main session does not expose set_current_run")
		return
	main.call("set_current_run", _shop_run())
	run_screen.set("current_tab", "跑局")
	run_screen.call("_render_current_tab")
	await process_frame
	_assert_button_text(run_screen, "RerollButton", "刷新")
	_assert_label_text(run_screen, "RerollPriceTag", "1")
	var text := _collect_text(run_screen)
	for part in ["跑局商店", "装备店", "点击商品查看详情，确认后再购买。", "刷新", "已拥有 x2", "价格 7 · 8折", "金币不足，还差 3 金币", "造成 5 点伤害"]:
		if not text.contains(str(part)):
			_fail("Run shop offer card missing: %s" % str(part))
			return
	if text.contains("GENERAL / 1"):
		_fail("Run shop should not expose raw shop type as the primary heading")
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot run shop offer cards smoke passed")
	quit(0)

func _shop_run() -> Dictionary:
	return {
		"id": "shop-run",
		"mode": "CASUAL",
		"phase": "SHOP",
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"round": 3,
		"wins": 1,
		"losses": 0,
		"gold": 4,
		"refreshCost": 1,
		"shopType": "GENERAL",
		"items": [
			_item("owned-1", "starter-1", "EQUIPMENT", 0),
			_item("owned-2", "starter-1", "BAG", 0),
		],
		"relics": [],
		"shopItems": [
			{
				"offerId": "offer-1",
				"defId": "starter-1",
				"quality": "SILVER",
				"price": 7,
				"discount": 0.8,
				"def": {"name": "1点牙咬", "size": 1, "description": "造成 5 点伤害", "triggerDice": [1]},
			},
		],
	}

func _item(id: String, def_id: String, area: String, x: int) -> Dictionary:
	return {
		"id": id,
		"defId": def_id,
		"quality": "BRONZE",
		"area": area,
		"x": x,
		"y": 0,
		"def": {"name": "1点牙咬", "size": 1},
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

func _assert_button_text(root_node: Node, node_name: String, expected: String) -> void:
	var button := _find_by_name(root_node, node_name) as Button
	if button == null:
		_fail("Missing run shop offer button: %s" % node_name)
		return
	if button.text != expected:
		_fail("Run shop offer button %s should be %s, got %s" % [node_name, expected, button.text])

func _assert_label_text(root_node: Node, node_name: String, expected: String) -> void:
	var label := _find_by_name(root_node, node_name) as Label
	if label == null:
		_fail("Missing run shop offer label: %s" % node_name)
		return
	if label.text != expected:
		_fail("Run shop offer label %s should be %s, got %s" % [node_name, expected, label.text])

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
