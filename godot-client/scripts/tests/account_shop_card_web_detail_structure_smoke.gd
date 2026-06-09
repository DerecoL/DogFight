extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var packed := load("res://scenes/screens/AccountShopScreen.tscn")
	if packed == null:
		_fail("AccountShopScreen scene failed to load")
		return
	var screen = packed.instantiate()
	root.add_child(screen)
	await process_frame
	screen.set("shop_data", _shop_data())
	screen.set("cosmetics_data", _cosmetics_data())
	screen.call("_render_shop")
	await process_frame

	for node_name in [
		"AccountShopPanel",
		"ScreenHeading",
		"AccountCurrencyPill",
		"ShopSections",
		"ShopCatalogSection_permanent",
		"ShopCatalogHeading_permanent",
		"ShopSectionGrid_permanent",
		"ShopCosmeticCard_title-paper-crown",
		"CosmeticBadge_title-paper-crown",
		"CosmeticName_title-paper-crown",
		"CosmeticDescription_title-paper-crown",
		"CosmeticType_title-paper-crown",
		"ShopCardActions_title-paper-crown",
		"ShopCardPrice_title-paper-crown",
		"ShopCardAction_title-paper-crown",
		"ShopCatalogSection_featured",
		"ShopCatalogHeading_featured",
		"ShopSectionGrid_featured",
		"ShopCosmeticCard_avatar-crown",
		"CosmeticBadge_avatar-crown",
		"CosmeticName_avatar-crown",
		"CosmeticDescription_avatar-crown",
		"CosmeticType_avatar-crown",
		"ShopCardActions_avatar-crown",
		"ShopCardPrice_avatar-crown",
		"ShopCardAction_avatar-crown",
		"ShopCosmeticCard_bg-royal-kennel",
		"CosmeticBadge_bg-royal-kennel",
		"CosmeticName_bg-royal-kennel",
		"CosmeticDescription_bg-royal-kennel",
		"CosmeticType_bg-royal-kennel",
		"ShopCardActions_bg-royal-kennel",
		"ShopCardPrice_bg-royal-kennel",
		"ShopCardAction_bg-royal-kennel",
	]:
		_assert_has(screen, node_name)

	var text := _collect_text(screen)
	for part in [
		"账号商城",
		"外观商店",
		"360",
		"常驻区",
		"精选轮换区",
		"纸冠头衔",
		"在账号面板展示纸冠称号",
		"称号 · 史诗",
		"120",
		"购买",
		"皇冠头像",
		"头像 · 稀有",
		"80",
		"装备",
		"皇家犬舍",
		"主页背景 · 传说",
		"300",
		"已装备",
	]:
		if not text.contains(part):
			_fail("Account shop Web detail text missing: %s" % part)
			return

	var purchase_button := _find_by_name(screen, "ShopCardAction_title-paper-crown") as Button
	var equip_button := _find_by_name(screen, "ShopCardAction_avatar-crown") as Button
	var equipped_button := _find_by_name(screen, "ShopCardAction_bg-royal-kennel") as Button
	if purchase_button == null or purchase_button.disabled or purchase_button.text != "购买":
		_fail("Unowned cosmetic should expose enabled purchase action")
		return
	if equip_button == null or equip_button.disabled or equip_button.text != "装备":
		_fail("Owned cosmetic should expose enabled equip action")
		return
	if equipped_button == null or not equipped_button.disabled or equipped_button.text != "已装备":
		_fail("Equipped cosmetic should expose disabled equipped action")
		return

	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot account shop card Web detail structure smoke passed")
	quit(0)

func _shop_data() -> Dictionary:
	return {
		"wallet": {"balance": 360, "dailyEarned": 40},
		"sections": {
			"permanent": [
				{
					"id": "title-paper-crown",
					"name": "纸冠头衔",
					"description": "在账号面板展示纸冠称号",
					"type": "TITLE",
					"rarity": "EPIC",
					"price": 120,
					"owned": false,
				},
			],
			"featured": [
				{
					"id": "avatar-crown",
					"name": "皇冠头像",
					"description": "显示皇冠头像",
					"type": "AVATAR",
					"rarity": "RARE",
					"price": 80,
					"owned": true,
				},
				{
					"id": "bg-royal-kennel",
					"name": "皇家犬舍",
					"description": "主页背景",
					"type": "BACKGROUND",
					"rarity": "LEGENDARY",
					"price": 300,
					"owned": true,
				},
			],
		},
	}

func _cosmetics_data() -> Dictionary:
	return {
		"equipped": [
			{"slot": "BACKGROUND", "catalogItemId": "bg-royal-kennel", "item": {"id": "bg-royal-kennel", "name": "皇家犬舍", "type": "BACKGROUND"}},
		],
		"inventory": [
			{"catalogItemId": "avatar-crown", "item": {"id": "avatar-crown", "name": "皇冠头像", "type": "AVATAR", "rarity": "RARE"}, "owned": true},
			{"catalogItemId": "bg-royal-kennel", "item": {"id": "bg-royal-kennel", "name": "皇家犬舍", "type": "BACKGROUND", "rarity": "LEGENDARY"}, "owned": true},
		],
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing account shop Web detail node: %s" % node_name)

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
