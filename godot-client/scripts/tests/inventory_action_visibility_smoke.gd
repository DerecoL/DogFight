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
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if run_screen == null or modal_layer == null:
		_fail("RunScreen or ModalLayer is missing")
		return
	if run_screen.has_method("bind_session"):
		run_screen.bind_session(main)

	_render_run(main, run_screen, "PREP", false)
	_assert_no_button(run_screen, "出售选中装备")
	_assert_no_button(run_screen, "合成升级选中")
	run_screen.call("_show_item_detail_modal", _item("item-1"))
	await process_frame
	_assert_no_button(modal_layer, "出售装备")
	_assert_no_button(modal_layer, "合成升级")
	run_screen.call("_close_top_modal")
	await process_frame

	_render_run(main, run_screen, "SHOP", false)
	_assert_button(run_screen, "出售选中装备")
	_assert_no_button(run_screen, "合成升级选中")
	run_screen.call("_show_item_detail_modal", _item("item-1"))
	await process_frame
	_assert_button(modal_layer, "出售装备")
	_assert_no_button(modal_layer, "合成升级")
	run_screen.call("_close_top_modal")
	await process_frame

	_render_run(main, run_screen, "SHOP", true)
	_assert_button(run_screen, "出售选中装备")
	_assert_button(run_screen, "合成升级选中")
	run_screen.call("_show_item_detail_modal", _item("item-1"))
	await process_frame
	_assert_button(modal_layer, "出售装备")
	_assert_button(modal_layer, "合成升级")

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot inventory action visibility smoke passed")
	quit(0)

func _render_run(main: Node, run_screen: Node, phase: String, with_duplicate: bool) -> void:
	main.get("run_store").set_run(_run_payload(phase, with_duplicate))
	run_screen.set("selected_item_id", "item-1")
	run_screen.set("selected_item_label", "1点牙咬")
	run_screen.call("show_run_phase")

func _run_payload(phase: String, with_duplicate: bool) -> Dictionary:
	var items := [_item("item-1")]
	if with_duplicate:
		items.append(_item("item-2"))
	return {
		"id": "inventory-action-%s-%s" % [phase, str(with_duplicate)],
		"mode": "CASUAL",
		"phase": phase,
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"round": 2,
		"wins": 1,
		"losses": 0,
		"gold": 8,
		"refreshCost": 1,
		"shopType": "GENERAL",
		"items": items,
		"relics": [],
		"shopItems": [],
		"choices": [],
		"classRewardChoices": [],
		"enchantChoices": [],
		"relicChoices": [],
		"potionChoices": [],
	}

func _item(id: String) -> Dictionary:
	return {
		"id": id,
		"defId": "starter-1",
		"quality": "BRONZE",
		"area": "BAG",
		"x": 0,
		"y": 0,
		"def": {"name": "1点牙咬", "description": "命中 1 点时造成伤害", "triggerDice": [1], "tags": ["伤害"]},
	}

func _assert_button(root_node: Node, text: String) -> void:
	var button := _find_button(root_node, text)
	if button == null:
		_fail("Missing button: %s" % text)
		return
	if button.disabled:
		_fail("Button should be enabled: %s" % text)

func _assert_no_button(root_node: Node, text: String) -> void:
	var button := _find_button(root_node, text)
	if button != null and not button.disabled:
		_fail("Button should not be available: %s" % text)

func _find_button(node: Node, text: String) -> Button:
	if node is Button and (node as Button).text == text:
		return node as Button
	for child in node.get_children():
		var found := _find_button(child, text)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
