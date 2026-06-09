extends BaseWebScreen

var action_in_progress := false
var selected_offer_id := ""

func _ready() -> void:
	_render()

func _on_payload_changed() -> void:
	_render()

func _render() -> void:
	for child in get_children():
		remove_child(child)
		child.queue_free()

	var scroll := ScrollContainer.new()
	scroll.name = "RunShopScroll"
	scroll.set_anchors_preset(Control.PRESET_FULL_RECT)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_top", 22)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_bottom", 22)
	scroll.add_child(margin)

	var run := _run()
	if run.is_empty():
		_add_label(margin, "RunShopEmpty", "暂无进行中的商店阶段。", HORIZONTAL_ALIGNMENT_CENTER)
		return
	_render_shop_workbench(margin, run)

func _render_shop_workbench(parent: Node, run: Dictionary) -> void:
	var workbench := HBoxContainer.new()
	workbench.name = "ShopWorkbench"
	workbench.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	workbench.size_flags_vertical = Control.SIZE_EXPAND_FILL
	workbench.add_theme_constant_override("separation", 12)
	parent.add_child(workbench)

	_render_shop_shelf(workbench, run)
	_render_inventory_board(workbench, run)

func _render_shop_shelf(parent: Node, run: Dictionary) -> void:
	var shelf_panel := PanelContainer.new()
	shelf_panel.name = "ShopShelfPanel"
	shelf_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	shelf_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	shelf_panel.add_theme_stylebox_override("panel", WebUiTokens.wood_panel_style())
	parent.add_child(shelf_panel)

	var shelf := VBoxContainer.new()
	shelf.name = "ShopShelf"
	shelf.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	shelf.size_flags_vertical = Control.SIZE_EXPAND_FILL
	shelf.add_theme_constant_override("separation", 8)
	shelf_panel.add_child(shelf)

	var heading := HBoxContainer.new()
	heading.name = "ShopShelfHeading"
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_theme_constant_override("separation", 12)
	shelf.add_child(heading)

	var title := VBoxContainer.new()
	title.name = "ShopShelfTitle"
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.add_theme_constant_override("separation", 4)
	heading.add_child(title)
	_add_label(title, "ShopShelfName", _shop_name(str(run.get("shopType", "GENERAL"))))
	_add_label(title, "ShopShelfDescription", "点击商品查看详情，确认后再购买。")

	var actions := HBoxContainer.new()
	actions.name = "ShopActions"
	actions.add_theme_constant_override("separation", 8)
	heading.add_child(actions)
	var sell_zone := Label.new()
	sell_zone.name = "SellDropZone"
	sell_zone.text = "拖到这里出售"
	sell_zone.custom_minimum_size = Vector2(128, 38)
	sell_zone.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	sell_zone.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sell_zone.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
	actions.add_child(sell_zone)
	var reroll_button := _action_button("刷新 %d 金币" % int(run.get("refreshCost", 0)), _reroll_shop)
	reroll_button.name = "RerollButton"
	reroll_button.disabled = action_in_progress or int(run.get("gold", 0)) < int(run.get("refreshCost", 0))
	actions.add_child(reroll_button)

	var offer_row := VBoxContainer.new()
	offer_row.name = "OfferRow"
	offer_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	offer_row.add_theme_constant_override("separation", 8)
	shelf.add_child(offer_row)
	for offer_value in _array(run, "shopItems"):
		if offer_value is Dictionary:
			_render_shop_offer_card(offer_row, run, offer_value)

	var match_button := _action_button(_match_label(run), _match_battle)
	match_button.name = "MatchButton"
	match_button.disabled = action_in_progress
	shelf.add_child(match_button)

func _render_shop_offer_card(parent: VBoxContainer, run: Dictionary, offer: Dictionary) -> void:
	var def: Dictionary = _dict(offer, "def")
	var offer_id := str(offer.get("offerId", parent.get_child_count() + 1))
	var box := VBoxContainer.new()
	box.name = "ShopCard_%s" % offer_id
	box.custom_minimum_size = Vector2(0, 118)
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_theme_constant_override("separation", 4)
	box.add_theme_stylebox_override("normal", WebUiTokens.paper_card_style())
	parent.add_child(box)

	var quality_chip := Label.new()
	quality_chip.name = "ShopQualityChip_%s" % offer_id
	quality_chip.text = _quality_label(str(offer.get("quality", "")))
	quality_chip.custom_minimum_size = Vector2(0, 24)
	box.add_child(quality_chip)

	var owned_count := _shop_offer_owned_count(run, offer)
	if owned_count > 0:
		var owned_badge := Label.new()
		owned_badge.name = "ShopOwnedBadge_%s" % offer_id
		owned_badge.text = "已拥有 x%d" % owned_count
		owned_badge.custom_minimum_size = Vector2(0, 24)
		box.add_child(owned_badge)

	var art_button := _action_button("", _select_offer.bind(offer_id))
	art_button.name = "ShopCardArt_%s" % offer_id
	art_button.custom_minimum_size = Vector2(0, 52)
	box.add_child(art_button)

	var main := HBoxContainer.new()
	main.name = "ShopCardMain_%s" % offer_id
	main.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	main.add_theme_constant_override("separation", 8)
	box.add_child(main)
	var name_button := _action_button(_fallback(str(def.get("name", "")), str(offer.get("defId", offer_id))), _select_offer.bind(offer_id))
	name_button.name = "ShopName_%s" % offer_id
	main.add_child(name_button)
	var size_badge := Label.new()
	size_badge.name = "ShopSizeBadge_%s" % offer_id
	size_badge.text = "%s格" % _fallback(_detail_size_text(def), "?")
	size_badge.custom_minimum_size = Vector2(54, 32)
	size_badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	size_badge.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	main.add_child(size_badge)

	var meta := HBoxContainer.new()
	meta.name = "ShopCardMeta_%s" % offer_id
	meta.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	meta.add_theme_constant_override("separation", 8)
	box.add_child(meta)
	var size_preview := Label.new()
	size_preview.name = "ShopSizePreview_%s" % offer_id
	size_preview.text = _shop_size_preview_text(def)
	size_preview.custom_minimum_size = Vector2(70, 28)
	meta.add_child(size_preview)
	var trigger := _trigger_dice_text(def)
	if not trigger.is_empty():
		var dice_line := Label.new()
		dice_line.name = "ShopDiceLine_%s" % offer_id
		dice_line.text = "点数 %s" % trigger
		dice_line.custom_minimum_size = Vector2(86, 28)
		meta.add_child(dice_line)

	var description := _fallback(str(def.get("description", "")), str(offer.get("description", "")))
	if not description.is_empty():
		_add_label(box, "ShopEffectLine_%s" % offer_id, description)
	_add_label(box, "ShopPriceTag_%s" % offer_id, _price_text(offer))

func _render_inventory_board(parent: Node, run: Dictionary) -> void:
	var inventory_panel := PanelContainer.new()
	inventory_panel.name = "InventoryBoardPanel"
	inventory_panel.custom_minimum_size = Vector2(420, 0)
	inventory_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	inventory_panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(inventory_panel)
	var inventory := VBoxContainer.new()
	inventory.name = "InventoryBoard"
	inventory.add_theme_constant_override("separation", 8)
	inventory_panel.add_child(inventory)
	_render_grid_panel(inventory, "EquipmentGridPanel", "装备栏", "EQUIPMENT", run)
	_render_relic_rail(inventory, run)
	_render_grid_panel(inventory, "BagGridPanel", "背包", "BAG", run)

func _render_relic_rail(parent: VBoxContainer, run: Dictionary) -> void:
	var rail := VBoxContainer.new()
	rail.name = "RelicRail"
	rail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rail.add_theme_constant_override("separation", 4)
	parent.add_child(rail)
	_add_label(rail, "RelicRailTitle", "遗物")
	var row := HBoxContainer.new()
	row.name = "RelicRailItems"
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 6)
	rail.add_child(row)
	var relics := _array(run, "relics")
	for slot in range(6):
		var relic: Dictionary = relics[slot] if slot < relics.size() and relics[slot] is Dictionary else {}
		var def: Dictionary = _dict(relic, "def")
		var button := _action_button(_fallback(str(def.get("name", "")), "遗物槽 %d" % (slot + 1)), _noop)
		button.name = "RelicSlot_%d" % slot
		button.custom_minimum_size = Vector2(74, 42)
		button.disabled = relic.is_empty()
		row.add_child(button)

func _render_grid_panel(parent: VBoxContainer, node_name: String, title: String, area: String, run: Dictionary) -> void:
	var panel := VBoxContainer.new()
	panel.name = node_name
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_constant_override("separation", 4)
	parent.add_child(panel)
	_add_label(panel, "%sTitle" % node_name, title)
	var item_line := HBoxContainer.new()
	item_line.name = "%sItems" % node_name
	item_line.add_theme_constant_override("separation", 6)
	panel.add_child(item_line)
	for item_value in _array(run, "items"):
		if item_value is Dictionary and str(item_value.get("area", "")) == area:
			var item: Dictionary = item_value
			var def := _dict(item, "def")
			var button := _action_button(_fallback(str(def.get("name", "")), str(item.get("defId", ""))), _noop)
			button.name = "%sItem_%s" % [node_name, str(item.get("id", ""))]
			button.custom_minimum_size = Vector2(90, 52)
			item_line.add_child(button)

func _action_button(text: String, callback: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0, WebUiTokens.touch_target_height())
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button.add_theme_stylebox_override("normal", WebUiTokens.handdrawn_button_style())
	button.add_theme_stylebox_override("hover", WebUiTokens.handdrawn_button_hover_style())
	button.add_theme_stylebox_override("pressed", WebUiTokens.handdrawn_button_pressed_style())
	button.pressed.connect(callback)
	return button

func _add_label(parent: Node, node_name: String, text: String, align := HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var label := Label.new()
	label.name = node_name
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.horizontal_alignment = align
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(label)
	return label

func _reroll_shop() -> void:
	if session != null and session.has_method("reroll_shop"):
		await session.call("reroll_shop")

func _match_battle() -> void:
	if session != null and session.has_method("match_battle"):
		await session.call("match_battle")

func _select_offer(offer_id: String) -> void:
	selected_offer_id = offer_id

func _run() -> Dictionary:
	var value = payload.get("run", {})
	return value if value is Dictionary else {}

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value = source.get(key, {})
	return value if value is Dictionary else {}

func _array(source: Dictionary, key: String) -> Array:
	var value = source.get(key, [])
	return value if value is Array else []

func _fallback(value: String, fallback: String) -> String:
	return fallback if value.strip_edges().is_empty() else value

func _shop_name(shop_type: String) -> String:
	match shop_type:
		"GENERAL":
			return "装备店"
		"ATTACK":
			return "攻击商店"
		"DEFENSE":
			return "防御商店"
		"ECONOMY":
			return "经济商店"
		"UTILITY":
			return "功能商店"
		_:
			return shop_type

func _quality_label(quality: String) -> String:
	match quality:
		"BRONZE":
			return "青铜"
		"SILVER":
			return "白银"
		"GOLD":
			return "黄金"
		"DIAMOND":
			return "钻石"
		_:
			return quality

func _detail_size_text(def: Dictionary) -> String:
	var size = def.get("size", "")
	return "" if str(size).is_empty() else str(int(size))

func _shop_size_preview_text(def: Dictionary) -> String:
	var size := int(def.get("size", 0))
	var text := ""
	for index in range(4):
		text += "■" if index < size else "□"
	return text

func _trigger_dice_text(def: Dictionary) -> String:
	var dice := _array(def, "triggerDice")
	if dice.is_empty():
		return ""
	var parts: Array[String] = []
	for value in dice:
		parts.append(str(value))
	return " / ".join(parts)

func _price_text(offer: Dictionary) -> String:
	var price := int(offer.get("price", 0))
	var discount := float(offer.get("discount", 1.0))
	if discount < 1.0:
		return "%d · %d折" % [price, int(round(discount * 10.0))]
	return str(price)

func _shop_offer_owned_count(run: Dictionary, offer: Dictionary) -> int:
	var def_id := str(offer.get("defId", ""))
	if def_id.is_empty():
		return 0
	var count := 0
	for item_value in _array(run, "items"):
		if item_value is Dictionary and str(item_value.get("defId", "")) == def_id:
			count += 1
	return count

func _match_label(run: Dictionary) -> String:
	var map_state := _dict(run, "mapState")
	if not str(map_state.get("currentNodeId", "")).is_empty():
		return "返回地图"
	return "匹配对手"

func _noop() -> void:
	pass
