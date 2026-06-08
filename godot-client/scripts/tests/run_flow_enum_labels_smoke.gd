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
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if run_screen == null or modal_layer == null:
		_fail("Required Godot UI nodes are missing")
		return
	main.call("set_current_run", _map_run())
	run_screen.set("current_tab", "跑局")
	run_screen.call("_render_current_tab")
	await process_frame
	var text := _collect_text(run_screen)
	for expected in ["探索地图", "进行中", "玩家战", "固定商店", "可进入"]:
		if not text.contains(expected):
			_fail("Run flow label missing: %s" % expected)
			return
	run_screen.call("_show_map_node_modal", _map_run()["mapState"]["nodes"][1])
	await process_frame
	var modal_text := _collect_text(modal_layer)
	for expected in ["固定商店", "第 2 层", "类型"]:
		if not modal_text.contains(expected):
			_fail("Map node modal label missing: %s" % expected)
			return
	for raw in ["MAP", "ACTIVE", "PLAYER_BATTLE", "SHOP_FIXED", "GENERAL"]:
		if text.contains(raw) or modal_text.contains(raw):
			_fail("Run flow leaked raw enum: %s" % raw)
			return
	main.queue_free()
	for _frame in range(5):
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
		"luckyNumber": null,
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

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
