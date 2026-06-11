extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/screens/RunShopScreen.tscn")
	if scene == null:
		_fail("RunShopScreen scene failed to load")
		return
	var screen = scene.instantiate()
	var fake_session := FakeSession.new()
	root.add_child(fake_session)
	root.add_child(screen)
	await process_frame
	if screen.has_method("bind_session"):
		screen.call("bind_session", fake_session)
	if screen.has_method("set_payload"):
		screen.call("set_payload", {"run": _shop_run()})
	await process_frame

	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("RunShopScreen must be standalone and must not redirect to LegacyRunScreen")
		return
	_assert_has(screen, "ShopWorkbench")
	_assert_has(screen, "ShopShelf")
	_assert_has(screen, "OfferRow")
	_assert_has(screen, "ShopCard_offer-1")
	_assert_has(screen, "ShopOwnedBadge_offer-1")
	_assert_has(screen, "ShopEffectLine_offer-1")
	_assert_has(screen, "RerollButton")
	_assert_label_text(screen, "RerollPriceTag", "1")
	_assert_label_starts_with(screen, "ShopPriceTag_offer-1", "7")

	var text := _collect_text(screen)
	for part in ["Starter Fang", "Deal 5 damage", "x2"]:
		if not text.contains(str(part)):
			_fail("Standalone run shop offer card missing: %s" % str(part))
			return
	if text.contains("GENERAL / 1"):
		_fail("Run shop should not expose raw shop type as the primary heading")
		return

	screen.queue_free()
	fake_session.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot standalone run shop offer cards smoke passed")
	quit(0)

class FakeSession:
	extends Node

	func buy_offer(_offer_id: String, _area := "BAG") -> bool:
		return true

	func match_battle() -> bool:
		return true

	func reroll_shop() -> bool:
		return true

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
				"def": {"name": "Starter Fang", "size": 1, "description": "Deal 5 damage", "triggerDice": [1]},
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
		"def": {"name": "Starter Fang", "size": 1},
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

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing standalone run shop offer node: %s" % node_name)

func _assert_label_text(root_node: Node, node_name: String, expected: String) -> void:
	var label := _find_by_name(root_node, node_name) as Label
	if label == null:
		_fail("Missing standalone run shop offer label: %s" % node_name)
		return
	if label.text != expected:
		_fail("Standalone run shop offer label %s should be %s, got %s" % [node_name, expected, label.text])

func _assert_label_starts_with(root_node: Node, node_name: String, expected_prefix: String) -> void:
	var label := _find_by_name(root_node, node_name) as Label
	if label == null:
		_fail("Missing standalone run shop offer label: %s" % node_name)
		return
	if not label.text.begins_with(expected_prefix):
		_fail("Standalone run shop offer label %s should start with %s, got %s" % [node_name, expected_prefix, label.text])

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
