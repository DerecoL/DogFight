extends BaseWebScreen

var action_in_progress := false
var selected_offer_id := ""
var selected_item_id := ""
var selected_relic_id := ""

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

	_render_selected_offer_tip(shelf, run)

	var match_button := _action_button(_match_label(run), _match_battle)
	match_button.name = "MatchButton"
	match_button.disabled = action_in_progress
	shelf.add_child(match_button)

func _render_shop_offer_card(parent: VBoxContainer, run: Dictionary, offer: Dictionary) -> void:
	var def: Dictionary = _dict(offer, "def")
	var offer_id := str(offer.get("offerId", parent.get_child_count() + 1))
	var box := _action_button("", _select_offer.bind(offer_id))
	box.name = "ShopCard_%s" % offer_id
	box.custom_minimum_size = Vector2(0, 118)
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_theme_stylebox_override("normal", WebUiTokens.paper_card_style())
	box.add_theme_stylebox_override("hover", WebUiTokens.paper_card_style())
	box.add_theme_stylebox_override("pressed", WebUiTokens.paper_card_style())
	parent.add_child(box)

	var content := VBoxContainer.new()
	content.name = "ShopCardContent_%s" % offer_id
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.set_anchors_preset(Control.PRESET_FULL_RECT)
	content.offset_left = 8
	content.offset_top = 8
	content.offset_right = -8
	content.offset_bottom = -8
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 4)
	box.add_child(content)

	var quality_chip := Label.new()
	quality_chip.name = "ShopQualityChip_%s" % offer_id
	quality_chip.text = _quality_label(str(offer.get("quality", "")))
	quality_chip.custom_minimum_size = Vector2(0, 24)
	quality_chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.add_child(quality_chip)

	var owned_count := _shop_offer_owned_count(run, offer)
	if owned_count > 0:
		var owned_badge := Label.new()
		owned_badge.name = "ShopOwnedBadge_%s" % offer_id
		owned_badge.text = "已拥有 x%d" % owned_count
		owned_badge.custom_minimum_size = Vector2(0, 24)
		owned_badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
		content.add_child(owned_badge)

	var art_button := _action_button("", _select_offer.bind(offer_id))
	art_button.name = "ShopCardArt_%s" % offer_id
	art_button.custom_minimum_size = Vector2(0, 52)
	content.add_child(art_button)
	var art := TextureRect.new()
	art.name = "ShopCardArtIcon_%s" % offer_id
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	art.texture = _offer_texture(offer)
	art_button.add_child(art)

	var main := HBoxContainer.new()
	main.name = "ShopCardMain_%s" % offer_id
	main.mouse_filter = Control.MOUSE_FILTER_IGNORE
	main.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	main.add_theme_constant_override("separation", 8)
	content.add_child(main)
	var name_button := _action_button(_fallback(str(def.get("name", "")), str(offer.get("defId", offer_id))), _select_offer.bind(offer_id))
	name_button.name = "ShopName_%s" % offer_id
	main.add_child(name_button)
	var size_badge := Label.new()
	size_badge.name = "ShopSizeBadge_%s" % offer_id
	size_badge.text = "%s格" % _fallback(_detail_size_text(def), "?")
	size_badge.custom_minimum_size = Vector2(54, 32)
	size_badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	size_badge.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	size_badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	main.add_child(size_badge)

	var meta := HBoxContainer.new()
	meta.name = "ShopCardMeta_%s" % offer_id
	meta.mouse_filter = Control.MOUSE_FILTER_IGNORE
	meta.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	meta.add_theme_constant_override("separation", 8)
	content.add_child(meta)
	var size_preview := Label.new()
	size_preview.name = "ShopSizePreview_%s" % offer_id
	size_preview.text = _shop_size_preview_text(def)
	size_preview.custom_minimum_size = Vector2(70, 28)
	size_preview.mouse_filter = Control.MOUSE_FILTER_IGNORE
	meta.add_child(size_preview)
	var trigger := _trigger_dice_text(def)
	if not trigger.is_empty():
		var dice_line := Label.new()
		dice_line.name = "ShopDiceLine_%s" % offer_id
		dice_line.text = "点数 %s" % trigger
		dice_line.custom_minimum_size = Vector2(86, 28)
		dice_line.mouse_filter = Control.MOUSE_FILTER_IGNORE
		meta.add_child(dice_line)

	var description := _fallback(str(def.get("description", "")), str(offer.get("description", "")))
	if not description.is_empty():
		var effect_line := _add_label(content, "ShopEffectLine_%s" % offer_id, description)
		effect_line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var price_tag := _add_label(content, "ShopPriceTag_%s" % offer_id, _price_text(offer))
	price_tag.mouse_filter = Control.MOUSE_FILTER_IGNORE

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
	var bag_relic_row := HBoxContainer.new()
	bag_relic_row.name = "BagRelicRow"
	bag_relic_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bag_relic_row.add_theme_constant_override("separation", 10)
	inventory.add_child(bag_relic_row)
	_render_relic_rail(bag_relic_row, run)
	_render_grid_panel(bag_relic_row, "BagGridPanel", "背包", "BAG", run)

	_render_selected_item_tip(inventory, run)
	_render_selected_relic_tip(inventory, run)

func _render_relic_rail(parent: Node, run: Dictionary) -> void:
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
		var relic_id := str(relic.get("id", relic.get("relicId", "")))
		var button := _action_button(_fallback(str(def.get("name", "")), "遗物槽 %d" % (slot + 1)), _select_relic.bind(relic_id) if not relic_id.is_empty() else _noop)
		button.name = "RelicSlot_%d" % slot
		button.custom_minimum_size = Vector2(74, 42)
		button.disabled = relic.is_empty()
		row.add_child(button)

func _render_grid_panel(parent: Node, node_name: String, title: String, area: String, run: Dictionary) -> void:
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
			var button := _action_button(_fallback(str(def.get("name", "")), str(item.get("defId", ""))), _select_item.bind(str(item.get("id", ""))))
			button.name = "%sItem_%s" % [node_name, str(item.get("id", ""))]
			button.custom_minimum_size = Vector2(90, 52)
			item_line.add_child(button)
func _render_selected_offer_tip(parent: VBoxContainer, run: Dictionary) -> void:
	var offer := _selected_offer(run)
	if offer.is_empty():
		return
	var def: Dictionary = _dict(offer, "def")
	var title := _fallback(str(def.get("name", "")), str(offer.get("defId", offer.get("offerId", ""))))
	var floating_tip := PanelContainer.new()
	floating_tip.name = "FloatingTip"
	floating_tip.custom_minimum_size = Vector2(0, 244)
	floating_tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	floating_tip.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(floating_tip)

	var tip := VBoxContainer.new()
	tip.name = "ShopOfferTip"
	tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tip.add_theme_constant_override("separation", 7)
	floating_tip.add_child(tip)

	var tags := HBoxContainer.new()
	tags.name = "ShopOfferTipTags"
	tags.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tags.add_theme_constant_override("separation", 6)
	tip.add_child(tags)
	_add_label(tags, "ShopOfferTipSizeTag", "%s格" % _fallback(_detail_size_text(def), "?"), HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(tags, "ShopOfferTipQualityTag", _quality_label(str(offer.get("quality", ""))), HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(tags, "ShopOfferTipDiceTone", "点数", HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(tags, "ShopOfferTipEffectTone", "效果", HORIZONTAL_ALIGNMENT_CENTER)

	var identity := HBoxContainer.new()
	identity.name = "ShopOfferTipIdentity"
	identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity.add_theme_constant_override("separation", 8)
	tip.add_child(identity)
	var art := Label.new()
	art.name = "ShopOfferTipArt"
	art.text = ""
	art.custom_minimum_size = Vector2(54, 54)
	art.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
	identity.add_child(art)
	_add_label(identity, "ShopOfferTipTitle", title)

	var size_preview := HBoxContainer.new()
	size_preview.name = "ShopOfferTipSizePreview"
	size_preview.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_preview.add_theme_constant_override("separation", 8)
	tip.add_child(size_preview)
	_add_label(size_preview, "ShopOfferTipGridPreview", _shop_size_preview_text(def))
	_add_label(size_preview, "ShopOfferTipSizeText", "占用 %s 格" % _fallback(_detail_size_text(def), "?"))

	var trigger := _trigger_dice_text(def)
	if not trigger.is_empty():
		_add_label(tip, "ShopOfferTipDice", "触发点数 %s" % trigger)
	else:
		_add_label(tip, "ShopOfferTipDice", "触发点数 -")

	var description := _fallback(str(def.get("description", "")), str(offer.get("description", "")))
	_add_label(tip, "ShopOfferTipDescription", description)
	_add_label(tip, "ShopOfferTipPrice", "价格 %s" % _price_text(offer))

	var actions := HBoxContainer.new()
	actions.name = "ShopOfferTipActions"
	actions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_theme_constant_override("separation", 8)
	tip.add_child(actions)
	var buy_button := _action_button("购买到背包", _buy_selected_offer)
	buy_button.name = "BuyOfferButton"
	buy_button.disabled = action_in_progress or int(run.get("gold", 0)) < int(offer.get("price", 0))
	actions.add_child(buy_button)
	var close_button := _action_button("关闭", _close_offer_tip)
	close_button.name = "CloseOfferTipButton"
	actions.add_child(close_button)

func _render_selected_item_tip(parent: VBoxContainer, run: Dictionary) -> void:
	var item := _selected_item(run)
	if item.is_empty():
		return
	var def: Dictionary = _dict(item, "def")
	var title := _fallback(str(def.get("name", "")), str(item.get("defId", item.get("id", ""))))
	var floating_tip := PanelContainer.new()
	floating_tip.name = "FloatingTip"
	floating_tip.custom_minimum_size = Vector2(0, 244)
	floating_tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	floating_tip.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(floating_tip)

	var tip := VBoxContainer.new()
	tip.name = "ShopItemTip"
	tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tip.add_theme_constant_override("separation", 7)
	floating_tip.add_child(tip)

	var tags := HBoxContainer.new()
	tags.name = "ShopItemTipTags"
	tags.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tags.add_theme_constant_override("separation", 6)
	tip.add_child(tags)
	_add_label(tags, "ShopItemTipSizeTag", "%s\u683c" % _fallback(_detail_size_text(def), "?"), HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(tags, "ShopItemTipQualityTag", _quality_label(str(item.get("quality", ""))), HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(tags, "ShopItemTipAreaTag", _area_label(str(item.get("area", ""))), HORIZONTAL_ALIGNMENT_CENTER)

	var identity := HBoxContainer.new()
	identity.name = "ShopItemTipIdentity"
	identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity.add_theme_constant_override("separation", 8)
	tip.add_child(identity)
	var art := Label.new()
	art.name = "ShopItemTipArt"
	art.text = ""
	art.custom_minimum_size = Vector2(54, 54)
	art.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
	identity.add_child(art)
	_add_label(identity, "ShopItemTipTitle", title)

	var size_preview := HBoxContainer.new()
	size_preview.name = "ShopItemTipSizePreview"
	size_preview.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_preview.add_theme_constant_override("separation", 8)
	tip.add_child(size_preview)
	_add_label(size_preview, "ShopItemTipGridPreview", _shop_size_preview_text(def))
	_add_label(size_preview, "ShopItemTipSizeText", "\u5360\u7528 %s \u683c" % _fallback(_detail_size_text(def), "?"))

	var trigger := _trigger_dice_text(def)
	_add_label(tip, "ShopItemTipDice", "\u89e6\u53d1\u70b9\u6570 %s" % trigger if not trigger.is_empty() else "\u89e6\u53d1\u70b9\u6570 -")
	var description := _fallback(str(def.get("description", "")), str(item.get("description", "")))
	_add_label(tip, "ShopItemTipDescription", description)

	var actions := HBoxContainer.new()
	actions.name = "ShopItemTipActions"
	actions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_theme_constant_override("separation", 8)
	tip.add_child(actions)
	var close_button := _action_button("\u5173\u95ed", _close_item_tip)
	close_button.name = "CloseShopItemTipButton"
	actions.add_child(close_button)

func _render_selected_relic_tip(parent: VBoxContainer, run: Dictionary) -> void:
	var relic := _selected_relic(run)
	if relic.is_empty():
		return
	var def: Dictionary = _dict(relic, "def")
	var title := _fallback(str(def.get("name", "")), str(relic.get("relicId", relic.get("id", ""))))
	var floating_tip := PanelContainer.new()
	floating_tip.name = "FloatingTip"
	floating_tip.custom_minimum_size = Vector2(0, 204)
	floating_tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	floating_tip.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(floating_tip)

	var tip := VBoxContainer.new()
	tip.name = "ShopRelicTip"
	tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tip.add_theme_constant_override("separation", 7)
	floating_tip.add_child(tip)

	var tags := HBoxContainer.new()
	tags.name = "ShopRelicTipTags"
	tags.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tags.add_theme_constant_override("separation", 6)
	tip.add_child(tags)
	_add_label(tags, "ShopRelicTipQualityTag", _quality_label(str(relic.get("quality", ""))), HORIZONTAL_ALIGNMENT_CENTER)
	for tag in _array(def, "tags"):
		_add_label(tags, "ShopRelicTipTag_%s" % _node_key(str(tag)), str(tag), HORIZONTAL_ALIGNMENT_CENTER)

	var identity := HBoxContainer.new()
	identity.name = "ShopRelicTipIdentity"
	identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity.add_theme_constant_override("separation", 8)
	tip.add_child(identity)
	var icon := TextureRect.new()
	icon.name = "ShopRelicTipIcon"
	icon.texture = _relic_texture(relic)
	icon.custom_minimum_size = Vector2(44, 44)
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	identity.add_child(icon)
	var identity_text := VBoxContainer.new()
	identity_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity.add_child(identity_text)
	_add_label(identity_text, "ShopRelicTipTitle", title)
	_add_label(identity_text, "ShopRelicTipId", str(relic.get("relicId", relic.get("id", ""))))

	_add_label(tip, "ShopRelicTipDescription", _fallback(str(def.get("description", "")), str(relic.get("description", ""))))
	var effect := str(def.get("effect", ""))
	if not effect.is_empty():
		_add_label(tip, "ShopRelicTipEffect", effect)

	var actions := HBoxContainer.new()
	actions.name = "ShopRelicTipActions"
	actions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_theme_constant_override("separation", 8)
	tip.add_child(actions)
	var close_button := _action_button("\u5173\u95ed", _close_relic_tip)
	close_button.name = "CloseShopRelicTipButton"
	actions.add_child(close_button)

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
	selected_item_id = ""
	selected_relic_id = ""
	_render()

func _close_offer_tip() -> void:
	selected_offer_id = ""
	_render()

func _buy_selected_offer() -> void:
	if selected_offer_id.is_empty() or action_in_progress:
		return
	action_in_progress = true
	var offer_id := selected_offer_id
	if session != null and session.has_method("buy_offer"):
		await session.call("buy_offer", offer_id, "BAG")
	selected_offer_id = ""
	action_in_progress = false
	_render()

func _select_item(item_id: String) -> void:
	selected_item_id = item_id
	selected_offer_id = ""
	selected_relic_id = ""
	_render()

func _close_item_tip() -> void:
	selected_item_id = ""
	_render()

func _select_relic(relic_id: String) -> void:
	selected_relic_id = "" if selected_relic_id == relic_id else relic_id
	selected_offer_id = ""
	selected_item_id = ""
	_render()

func _close_relic_tip() -> void:
	selected_relic_id = ""
	_render()

func _run() -> Dictionary:
	var value = payload.get("run", {})
	return value if value is Dictionary else {}

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value = source.get(key, {})
	return value if value is Dictionary else {}

func _array(source: Dictionary, key: String) -> Array:
	var value = source.get(key, [])
	return value if value is Array else []

func _selected_offer(run: Dictionary) -> Dictionary:
	if selected_offer_id.is_empty():
		return {}
	for offer_value in _array(run, "shopItems"):
		if offer_value is Dictionary and str((offer_value as Dictionary).get("offerId", "")) == selected_offer_id:
			return offer_value
	return {}

func _selected_item(run: Dictionary) -> Dictionary:
	if selected_item_id.is_empty():
		return {}
	for item_value in _array(run, "items"):
		if item_value is Dictionary and str((item_value as Dictionary).get("id", "")) == selected_item_id:
			return item_value
	return {}

func _selected_relic(run: Dictionary) -> Dictionary:
	if selected_relic_id.is_empty():
		return {}
	for relic_value in _array(run, "relics"):
		if relic_value is Dictionary:
			var relic: Dictionary = relic_value
			if str(relic.get("id", relic.get("relicId", ""))) == selected_relic_id:
				return relic
	return {}

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

func _area_label(area: String) -> String:
	match area:
		"EQUIPMENT":
			return "\u88c5\u5907\u680f"
		"BAG":
			return "\u80cc\u5305"
		_:
			return area

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

func _offer_texture(offer: Dictionary) -> Texture2D:
	var def_id := str(offer.get("defId", ""))
	var art := _texture("res://assets/item-card-art/%s.webp" % def_id) if not def_id.is_empty() else null
	if art != null:
		return art
	return _sticker_texture(def_id)

func _sticker_texture(asset_id: String) -> Texture2D:
	if asset_id.is_empty():
		return _texture("res://assets/sticker-icons/starter-1.webp")
	var texture := _texture("res://assets/sticker-icons/%s.webp" % asset_id)
	return texture if texture != null else _texture("res://assets/sticker-icons/starter-1.webp")

func _relic_texture(relic: Dictionary) -> Texture2D:
	var def: Dictionary = _dict(relic, "def")
	var asset_id := str(def.get("icon", relic.get("relicId", relic.get("id", ""))))
	return _sticker_texture(asset_id)

func _node_key(value: String) -> String:
	var key := value.strip_edges().replace(" ", "_").replace("-", "_").replace(".", "_")
	return "empty" if key.is_empty() else key

func _texture(path: String) -> Texture2D:
	if path.is_empty():
		return null
	if not ResourceLoader.exists(path):
		return null
	return load(path) as Texture2D

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
	var current_node_id := str(map_state.get("currentNodeId", ""))
	if current_node_id.is_empty():
		return "匹配对手"
	for node in _array(map_state, "nodes"):
		if node is Dictionary and str((node as Dictionary).get("id", "")) == current_node_id:
			return "进入战斗" if str((node as Dictionary).get("kind", "")) == "PLAYER_BATTLE" else "返回地图"
	return "返回地图"

func _noop() -> void:
	pass
