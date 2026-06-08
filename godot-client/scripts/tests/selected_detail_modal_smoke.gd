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
		_fail("RunScreen or ModalLayer is missing")
		return
	if not run_screen.has_method("_show_selected_detail_modal"):
		_fail("RunScreen selected detail modal is missing")
		return
	main.get("run_store").set_run({
		"id": "selected-detail-shop",
		"mode": "CASUAL",
		"phase": "SHOP",
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"round": 2,
		"wins": 1,
		"losses": 0,
		"gold": 8,
		"items": [{"id": "item-1", "defId": "starter-1", "quality": "BRONZE", "area": "BAG", "x": 0, "y": 0}],
		"relics": [],
		"shopItems": [],
	})
	run_screen.set("selected_item", {
		"id": "item-1",
		"defId": "starter-1",
		"quality": "BRONZE",
		"x": 0,
		"y": 0,
		"def": {
			"name": "1点牙咬",
			"description": "命中 1 点时造成伤害",
			"triggerDice": [1],
			"tags": ["伤害"],
		},
	})
	run_screen.call("_show_selected_detail_modal")
	await process_frame
	_assert_modal_text(modal_layer, ["装备详情", "1点牙咬", "青铜", "触发点数", "出售装备"])
	run_screen.call("_close_top_modal")
	await process_frame
	run_screen.set("selected_item", {})
	run_screen.set("selected_relic", {
		"id": "relic-1",
		"relicId": "extra-slot",
		"quality": "SILVER",
		"def": {"name": "备用犬包", "description": "装备栏容量提高"},
	})
	run_screen.call("_show_selected_detail_modal")
	await process_frame
	_assert_modal_text(modal_layer, ["遗物详情", "备用犬包", "白银", "装备栏容量提高", "出售遗物"])
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot selected detail modal smoke passed")
	quit(0)

func _assert_modal_text(modal_layer: Node, expected: Array) -> void:
	if modal_layer.get_child_count() != 1:
		_fail("Expected exactly one modal, got %d" % modal_layer.get_child_count())
		return
	var text := _collect_text(modal_layer)
	for part in expected:
		if not text.contains(str(part)):
			_fail("Selected detail modal missing: %s" % str(part))
			return

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
