extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/screens/RunShopScreen.tscn")
	if scene == null:
		_fail("RunShopScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame
	if screen.has_method("set_payload"):
		screen.call("set_payload", {"run": _shop_run()})
	await process_frame

	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("RunShopScreen must be standalone and must not redirect to LegacyRunScreen")
		return

	for node_name in [
		"ShopWorkbench",
		"ShopShelf",
		"ShopShelfTitle",
		"ShopShelfHeading",
		"ShopActions",
		"SellDropZone",
		"RerollButton",
		"OfferRow",
		"ShopCard_offer-1",
		"ShopQualityChip_offer-1",
		"ShopOwnedBadge_offer-1",
		"ShopCardArt_offer-1",
		"ShopCardMain_offer-1",
		"ShopSizeBadge_offer-1",
		"ShopCardMeta_offer-1",
		"ShopSizePreview_offer-1",
		"ShopDiceLine_offer-1",
		"ShopEffectLine_offer-1",
		"ShopPriceTag_offer-1",
		"MatchButton",
		"InventoryBoard",
		"EquipmentGridPanel",
		"BagGridPanel",
	]:
		_assert_has(screen, node_name)

	var workbench = _find_by_name(screen, "ShopWorkbench")
	if not workbench is HBoxContainer:
		_fail("ShopWorkbench must use a horizontal workbench matching the Web shop layout")
		return
	var text := _collect_text(screen)
	for part in [
		"装备店",
		"点击商品查看详情，确认后再购买。",
		"拖到这里出售",
		"刷新 1 金币",
		"白银",
		"已拥有 x2",
		"1点牙咬",
		"1格",
		"点数 1",
		"造成 5 点伤害",
		"7 · 8折",
		"匹配对手",
		"装备栏",
		"背包",
	]:
		if not text.contains(part):
			_fail("Standalone run shop Web text missing: %s" % part)
			return

	screen.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot standalone run shop Web structure smoke passed")
	quit(0)

func _shop_run() -> Dictionary:
	return {
		"id": "shop-web-detail-run",
		"mode": "CASUAL",
		"phase": "SHOP",
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"round": 3,
		"wins": 1,
		"losses": 0,
		"gold": 12,
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
		"choices": [],
		"classRewardChoices": [],
		"enchantChoices": [],
		"relicChoices": [],
		"upgradeChoices": [],
		"potionChoices": [],
		"mapState": {
			"nodes": [],
			"availableNodeIds": [],
			"completedNodeIds": [],
			"currentNodeId": "",
		},
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

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing standalone run shop Web node: %s" % node_name)

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
