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
		"ShopCardArtIcon_offer-1",
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
		"BagRelicRow",
		"RelicRail",
		"RelicRailTitle",
		"RelicSlot_0",
		"RelicSlot_1",
		"RelicSlot_2",
		"RelicSlot_3",
		"RelicSlot_4",
		"RelicSlot_5",
		"BagGridPanel",
	]:
		_assert_has(screen, node_name)

	var workbench = _find_by_name(screen, "ShopWorkbench")
	if not workbench is HBoxContainer:
		_fail("ShopWorkbench must use a horizontal workbench matching the Web shop layout")
		return
	var bag_relic_row = _find_by_name(screen, "BagRelicRow")
	if not bag_relic_row is HBoxContainer:
		_fail("BagRelicRow must lay out relic rail and bag grid side by side like Web InventoryBoard")
		return
	var shop_card_button := _find_by_name(screen, "ShopCard_offer-1") as Button
	if shop_card_button == null:
		_fail("ShopCard root must be a clickable Button like Web ShopCard")
		return
	var offer_button := _find_by_name(screen, "ShopCardArt_offer-1") as Button
	if offer_button == null:
		_fail("Shop offer art button is missing")
		return
	var offer_icon := _find_by_name(screen, "ShopCardArtIcon_offer-1") as TextureRect
	if offer_icon == null or offer_icon.texture == null:
		_fail("Shop offer art must render the Web ItemArt sticker texture")
		return
	shop_card_button.pressed.emit()
	await process_frame
	for node_name in [
		"FloatingTip",
		"ShopOfferTip",
		"ShopOfferTipTags",
		"ShopOfferTipIdentity",
		"ShopOfferTipSizePreview",
		"ShopOfferTipDice",
		"ShopOfferTipDescription",
		"ShopOfferTipPrice",
		"ShopOfferTipActions",
		"BuyOfferButton",
		"CloseOfferTipButton",
	]:
		_assert_has(screen, node_name)
	var buy_button := _find_by_name(screen, "BuyOfferButton") as Button
	if buy_button == null or buy_button.disabled:
		_fail("Selected shop offer should expose an enabled buy button")
		return
	var close_button := _find_by_name(screen, "CloseOfferTipButton") as Button
	if close_button == null:
		_fail("Selected shop offer should expose a close button")
		return
	close_button.pressed.emit()
	await process_frame
	if _find_by_name(screen, "FloatingTip") != null:
		_fail("Shop offer tip should close from its close button")
		return
	offer_button = _find_by_name(screen, "ShopCardArt_offer-1") as Button
	if offer_button == null:
		_fail("Shop offer art button disappeared after closing the tip")
		return
	offer_button.pressed.emit()
	await process_frame
	buy_button = _find_by_name(screen, "BuyOfferButton") as Button
	if buy_button == null or buy_button.disabled:
		_fail("Selected shop offer should expose an enabled buy button after reopening")
		return
	buy_button.pressed.emit()
	await process_frame
	await process_frame
	if fake_session.bought_offer_id != "offer-1" or fake_session.bought_area != "BAG":
		_fail("BuyOfferButton must call buy_offer with offer-1 into BAG")
		return
	var inventory_item_button := _find_by_name(screen, "EquipmentGridPanelItem_owned-1") as Button
	if inventory_item_button == null:
		_fail("Shop inventory equipment item button is missing")
		return
	inventory_item_button.pressed.emit()
	await process_frame
	if fake_session.bought_offer_id != "offer-1":
		_fail("Shop inventory item click should inspect, not trigger another shop action")
		return
	for item_tip_node in [
		"FloatingTip",
		"ShopItemTip",
		"ShopItemTipTags",
		"ShopItemTipIdentity",
		"ShopItemTipSizePreview",
		"ShopItemTipDice",
		"ShopItemTipDescription",
		"ShopItemTipActions",
		"CloseShopItemTipButton",
	]:
		_assert_has(screen, item_tip_node)
	var close_item_tip := _find_by_name(screen, "CloseShopItemTipButton") as Button
	if close_item_tip == null:
		_fail("Shop inventory item tip close button is missing")
		return
	close_item_tip.pressed.emit()
	await process_frame
	if _find_by_name(screen, "FloatingTip") != null:
		_fail("Shop inventory item tip should close from its close button")
		return
	var relic_button := _find_by_name(screen, "RelicSlot_0") as Button
	if relic_button == null:
		_fail("Shop relic slot button is missing")
		return
	relic_button.pressed.emit()
	await process_frame
	for relic_tip_node in [
		"FloatingTip",
		"ShopRelicTip",
		"ShopRelicTipTags",
		"ShopRelicTipIdentity",
		"ShopRelicTipDescription",
		"ShopRelicTipActions",
		"CloseShopRelicTipButton",
	]:
		_assert_has(screen, relic_tip_node)
	var relic_tip_text := _collect_text(screen)
	for relic_tip_part in ["shop-training-relic", "SHOP_RELIC", "shop-tag"]:
		if not relic_tip_text.contains(relic_tip_part):
			_fail("Shop relic tip text missing: %s" % relic_tip_part)
			return
	var close_relic_tip := _find_by_name(screen, "CloseShopRelicTipButton") as Button
	if close_relic_tip == null:
		_fail("Shop relic tip close button is missing")
		return
	close_relic_tip.pressed.emit()
	await process_frame
	if _find_by_name(screen, "FloatingTip") != null:
		_fail("Shop relic tip should close from its close button")
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

	if not _match_button_text(screen).contains("匹配对手"):
		_fail("Plain standalone SHOP phase should expose match action")
		return
	screen.call("set_payload", {"run": _shop_run("shop-node", "SHOP_FIXED")})
	await process_frame
	if not _match_button_text(screen).contains("返回地图"):
		_fail("Standalone map shop node should expose return-to-map action")
		return
	screen.call("set_payload", {"run": _shop_run("player-node", "PLAYER_BATTLE")})
	await process_frame
	if not _match_button_text(screen).contains("进入战斗"):
		_fail("Standalone player battle shop node should expose enter-battle action")
		return

	screen.queue_free()
	fake_session.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot standalone run shop Web structure smoke passed")
	quit(0)

class FakeSession:
	extends Node
	var bought_offer_id := ""
	var bought_area := ""

	func buy_offer(offer_id: String, area := "BAG") -> bool:
		bought_offer_id = offer_id
		bought_area = area
		return true

func _shop_run(current_node_id := "", current_node_kind := "") -> Dictionary:
	var map_state := {
		"nodes": [],
		"availableNodeIds": [],
		"completedNodeIds": [],
		"currentNodeId": current_node_id,
	}
	if not current_node_id.is_empty():
		map_state["nodes"] = [{
			"id": current_node_id,
			"layer": 0,
			"column": 0,
			"kind": current_node_kind,
			"nextNodeIds": [],
		}]
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
		"relics": [_relic("relic-1")],
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
		"mapState": map_state,
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

func _match_button_text(root_node: Node) -> String:
	var button := _find_by_name(root_node, "MatchButton") as Button
	return "" if button == null else button.text

func _fail(message: String) -> void:
	push_error(message)
	quit(1)

func _relic(id: String) -> Dictionary:
	return {
		"id": id,
		"relicId": "shop-training-relic",
		"quality": "SILVER",
		"slot": 0,
		"def": {"name": "shop-training-relic", "description": "SHOP_RELIC", "effect": "SHOP_RELIC", "tags": ["shop-tag"]},
	}
