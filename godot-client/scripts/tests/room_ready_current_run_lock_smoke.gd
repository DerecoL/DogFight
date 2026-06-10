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
	if run_screen.has_method("bind_session"):
		run_screen.bind_session(main)

	run_screen.set("current_tab", "房间")
	run_screen.set("selected_item_id", "item-1")
	run_screen.set("selected_item_label", "1点牙咬")
	run_screen.set("active_room", _ready_room())
	run_screen.call("_render_current_tab")
	await process_frame

	_assert_enabled_button_contains(run_screen, "查看选中详情")
	for part in ["出售选中装备", "合成升级选中", "匹配对手"]:
		_assert_no_enabled_button_contains(run_screen, part)
	_assert_reroll_button_locked_or_hidden(run_screen)

	var offer_button := _find_button_contains(run_screen, "3点牙咬")
	if offer_button == null:
		_fail("Ready room current run should still allow inspecting shop offers")
		return
	if offer_button.disabled:
		_fail("Ready room current run offer detail should remain inspectable")
		return
	offer_button.pressed.emit()
	await process_frame
	await process_frame

	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	_assert_no_enabled_button_contains(modal_layer, "购买到背包")

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot room ready current run lock smoke passed")
	quit(0)

func _ready_room() -> Dictionary:
	return {
		"id": "room-ready-lock",
		"status": "ACTIVE",
		"phase": "SHOP",
		"currentRound": 2,
		"members": [
			{"id": "member-1", "nickname": "玩家A", "kind": "PLAYER", "wins": 1, "losses": 0, "ready": true, "eliminated": false, "runId": "run-1"},
		],
		"battles": [],
		"currentRunMember": {"id": "member-1", "ready": true, "eliminated": false, "runId": "run-1"},
		"currentRun": {
			"id": "run-1",
			"mode": "DOGFIGHT",
			"phase": "SHOP",
			"status": "ACTIVE",
			"dogType": "SHIBA",
			"luckyNumber": null,
			"round": 2,
			"wins": 1,
			"losses": 0,
			"gold": 8,
			"items": [
				{"id": "item-1", "defId": "starter-1", "quality": "BRONZE", "area": "EQUIPMENT", "x": 0, "y": 0, "def": {"name": "1点牙咬"}},
				{"id": "item-2", "defId": "starter-1", "quality": "BRONZE", "area": "BAG", "x": 0, "y": 0, "def": {"name": "1点牙咬"}},
			],
			"relics": [],
			"shopType": "GENERAL",
			"refreshCost": 1,
			"shopItems": [
				{"offerId": "offer-1", "defId": "starter-3", "quality": "BRONZE", "price": 5, "def": {"name": "3点牙咬"}},
			],
		},
	}

func _assert_enabled_button_contains(root_node: Node, text: String) -> void:
	var button := _find_button_contains(root_node, text)
	if button == null:
		_fail("Missing button containing: %s" % text)
		return
	if button.disabled:
		_fail("Button should be enabled: %s" % button.text)

func _assert_no_enabled_button_contains(root_node: Node, text: String) -> void:
	var button := _find_button_contains(root_node, text)
	if button != null and not button.disabled:
		_fail("Button should be locked or hidden: %s" % button.text)

func _assert_reroll_button_locked_or_hidden(root_node: Node) -> void:
	var button := _find_by_name(root_node, "RerollButton") as Button
	if button == null:
		return
	if not button.disabled:
		_fail("RerollButton should be locked or hidden while room member is ready")
		return
	var price_tag := _find_by_name(root_node, "RerollPriceTag") as Label
	if price_tag == null or price_tag.text != "1":
		_fail("Locked RerollButton should keep the Web price tag value")

func _find_button_contains(node: Node, text: String) -> Button:
	if node is Button and (node as Button).text.contains(text):
		return node as Button
	for child in node.get_children():
		var found := _find_button_contains(child, text)
		if found != null:
			return found
	return null

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
