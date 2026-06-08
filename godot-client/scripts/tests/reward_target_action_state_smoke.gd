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

	run_screen.set("selected_item_id", "")
	run_screen.call("_show_enchant_choice_modal", _enchant_choice())
	await process_frame
	_assert_button_state(modal_layer, "先选中装备再附魔", true)
	_assert_no_enabled_button(modal_layer, "附魔到选中装备")
	run_screen.call("_close_top_modal")
	await process_frame

	run_screen.call("_show_potion_choice_modal", _potion_choice())
	await process_frame
	_assert_button_state(modal_layer, "先选中装备再使用药水", true)
	_assert_no_enabled_button(modal_layer, "药水给选中装备")
	run_screen.call("_close_top_modal")
	await process_frame

	run_screen.set("selected_item_id", "item-1")
	run_screen.call("_show_enchant_choice_modal", _enchant_choice())
	await process_frame
	_assert_button_state(modal_layer, "附魔到选中装备", false)
	run_screen.call("_close_top_modal")
	await process_frame

	run_screen.call("_show_potion_choice_modal", _potion_choice())
	await process_frame
	_assert_button_state(modal_layer, "药水给选中装备", false)
	run_screen.call("_close_top_modal")
	await process_frame

	main.get("run_store").set_run(_upgrade_run())
	run_screen.set("selected_item_id", "")
	run_screen.call("show_run_phase")
	await process_frame
	_assert_button_state(run_screen, "先选中装备再升级", true)
	_assert_no_enabled_button(run_screen, "升级选中装备")

	run_screen.set("selected_item_id", "item-1")
	run_screen.call("show_run_phase")
	await process_frame
	_assert_button_state(run_screen, "升级选中装备", false)

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot reward target action state smoke passed")
	quit(0)

func _enchant_choice() -> Dictionary:
	return {
		"id": "ench-1",
		"description": "相邻装备伤害 +2",
		"enchant": {"kind": "BUFF_NEIGHBOR_EFFECT", "target": "ADJACENT", "effect": "DAMAGE", "amount": 2, "label": "邻近伤害"},
	}

func _potion_choice() -> Dictionary:
	return {
		"id": "potion-1",
		"category": "ADD_ONE",
		"dice": [1, 3],
		"description": "增加 1、3 点触发",
	}

func _upgrade_run() -> Dictionary:
	return {
		"id": "run-upgrade",
		"phase": "UPGRADE_CHOICE",
		"status": "ACTIVE",
		"mode": "CASUAL",
		"dogType": "SHIBA",
		"round": 2,
		"wins": 1,
		"losses": 0,
		"gold": 6,
		"items": [
			{
				"id": "item-1",
				"defId": "starter-1",
				"quality": "BRONZE",
				"area": "BAG",
				"x": 0,
				"y": 0,
				"def": {"name": "1点牙咬", "description": "命中 1 点时造成伤害", "triggerDice": [1]},
			},
		],
		"relics": [],
	}

func _assert_button_state(root_node: Node, text: String, expected_disabled: bool) -> void:
	var button := _find_button(root_node, text)
	if button == null:
		_fail("Missing button: %s" % text)
		return
	if button.disabled != expected_disabled:
		_fail("Button %s disabled should be %s" % [text, str(expected_disabled)])

func _assert_no_enabled_button(root_node: Node, text: String) -> void:
	var button := _find_button(root_node, text)
	if button != null and not button.disabled:
		_fail("Button should not be enabled without selected item: %s" % text)

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
