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
	for method_name in ["_show_offer_modal", "_show_item_detail_modal", "_show_relic_detail_modal"]:
		if not run_screen.has_method(method_name):
			_fail("%s is missing" % method_name)
			return
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	run_screen.call("_show_offer_modal", {
		"offerId": "offer-bite",
		"defId": "starter-1",
		"quality": "BRONZE",
		"price": 6,
		"def": {"name": "1点牙咬", "description": "命中 1 点时造成伤害", "triggerDice": [1], "tags": ["伤害"]},
	})
	await process_frame
	_assert_modal_text(modal_layer, ["商店报价", "1点牙咬", "价格", "6 金币", "购买到背包"])
	run_screen.call("_close_top_modal")
	await process_frame
	main.get("run_store").set_run(_run_payload("SHOP", true))
	run_screen.call("_show_item_detail_modal", {
		"id": "item-bite",
		"defId": "starter-1",
		"quality": "BRONZE",
		"area": "BAG",
		"x": 2,
		"y": 0,
		"def": {"name": "1点牙咬", "description": "命中 1 点时造成伤害", "triggerDice": [1], "tags": ["伤害"]},
	})
	await process_frame
	_assert_modal_text(modal_layer, ["装备详情", "1点牙咬", "背包", "触发点数", "出售装备", "合成升级"])
	run_screen.call("_close_top_modal")
	await process_frame
	run_screen.call("_show_relic_detail_modal", {
		"id": "relic-gold",
		"relicId": "v3-two-sided-gold-tag",
		"quality": "SILVER",
		"def": {"name": "双面金牌", "description": "商店折扣提高"},
	})
	await process_frame
	_assert_modal_text(modal_layer, ["遗物详情", "双面金牌", "白银", "商店折扣提高", "出售遗物"])
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot item detail modal smoke passed")
	quit(0)

func _assert_modal_text(modal_layer: Node, expected: Array) -> void:
	if modal_layer.get_child_count() != 1:
		_fail("Expected exactly one modal, got %d" % modal_layer.get_child_count())
		return
	var text := _collect_text(modal_layer)
	for part in expected:
		var value := str(part)
		if not text.contains(value):
			_fail("Modal text missing: %s" % value)
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

func _run_payload(phase: String, with_duplicate: bool) -> Dictionary:
	var items := [
		{"id": "item-bite", "defId": "starter-1", "quality": "BRONZE", "area": "BAG", "x": 2, "y": 0},
	]
	if with_duplicate:
		items.append({"id": "item-bite-copy", "defId": "starter-1", "quality": "BRONZE", "area": "BAG", "x": 3, "y": 0})
	return {
		"id": "item-detail-%s" % phase,
		"mode": "CASUAL",
		"phase": phase,
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"round": 2,
		"wins": 1,
		"losses": 0,
		"gold": 8,
		"items": items,
		"relics": [],
		"shopItems": [],
	}

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
