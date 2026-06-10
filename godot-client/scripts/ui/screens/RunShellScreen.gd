extends BaseWebScreen

var selected_item_id := ""

func _ready() -> void:
	_render()

func _on_payload_changed() -> void:
	_render()

func _render() -> void:
	for child in get_children():
		remove_child(child)
		child.queue_free()

	var scroll := ScrollContainer.new()
	scroll.name = "RunShellScroll"
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
		_add_label(margin, "RunShellEmpty", "暂无进行中的跑局。", HORIZONTAL_ALIGNMENT_CENTER)
		return
	_render_match_panel(margin, run)

func _render_match_panel(parent: Node, run: Dictionary) -> void:
	var panel := PanelContainer.new()
	panel.name = "MatchPanel"
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(panel)

	var content := VBoxContainer.new()
	content.name = "MatchPanelContent"
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 12)
	panel.add_child(content)

	var phase := str(run.get("phase", ""))
	if phase == "MATCH":
		_render_matched_heading(content, run)
	else:
		_render_prep_heading(content)

	var inventory := VBoxContainer.new()
	inventory.name = "InventoryBoard"
	inventory.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	inventory.add_theme_constant_override("separation", 8)
	content.add_child(inventory)
	_render_inventory_board(inventory, run)
	_render_selected_item_tip(content, run)

	var action := _action_button("开始战斗" if phase == "MATCH" else "匹配对手", _start_battle if phase == "MATCH" else _match_battle)
	action.name = "BattleStartButton" if phase == "MATCH" else "MatchActionButton"
	content.add_child(action)

func _render_prep_heading(parent: VBoxContainer) -> void:
	var heading := VBoxContainer.new()
	heading.name = "MatchPanelHeading"
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_theme_constant_override("separation", 4)
	parent.add_child(heading)
	_add_label(heading, "MatchPanelTitle", "整备阶段", HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(heading, "MatchPanelDescription", "整理装备与遗物后再匹配对手。", HORIZONTAL_ALIGNMENT_CENTER)

func _render_matched_heading(parent: VBoxContainer, run: Dictionary) -> void:
	var heading := VBoxContainer.new()
	heading.name = "MatchPanelHeading"
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_theme_constant_override("separation", 4)
	parent.add_child(heading)
	var ghost: Dictionary = _dict(run, "matchedGhost")
	var badge := Label.new()
	badge.name = "MatchedDogBadge"
	badge.text = _dog_name(str(ghost.get("dogType", "SHIBA")))
	badge.custom_minimum_size = Vector2(96, 72)
	badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	badge.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	badge.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
	heading.add_child(badge)
	_add_label(heading, "MatchedDogTitle", "匹配到 %s" % _fallback(str(ghost.get("name", "")), "对手"), HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(
		heading,
		"MatchedDogMeta",
		"%s · %d胜 %d败 · 第 %d 回合" % [
			_dog_name(str(ghost.get("dogType", "SHIBA"))),
			int(ghost.get("wins", 0)),
			int(ghost.get("losses", 0)),
			int(ghost.get("round", int(run.get("round", 0)))),
		],
		HORIZONTAL_ALIGNMENT_CENTER
	)

func _render_inventory_board(parent: VBoxContainer, run: Dictionary) -> void:
	_render_grid_panel(parent, "EquipmentBoard", "装备格", "EQUIPMENT", run)
	var bag_relic_row := HBoxContainer.new()
	bag_relic_row.name = "BagRelicRow"
	bag_relic_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bag_relic_row.add_theme_constant_override("separation", 10)
	parent.add_child(bag_relic_row)
	_render_relic_rail(bag_relic_row, run)
	_render_grid_panel(bag_relic_row, "BagBoard", "背包", "BAG", run)

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
		if item_value is Dictionary and str((item_value as Dictionary).get("area", "")) == area:
			var item: Dictionary = item_value
			var def := _dict(item, "def")
			var item_id := str(item.get("id", ""))
			var button := _action_button("", _select_item.bind(item_id))
			button.name = "%sItem_%s" % [node_name, item_id]
			button.custom_minimum_size = Vector2(108, 86)
			button.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
			var slot := VBoxContainer.new()
			slot.name = "%sSlot_%s" % [node_name, item_id]
			slot.mouse_filter = Control.MOUSE_FILTER_IGNORE
			slot.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			slot.add_theme_constant_override("separation", 3)
			button.add_child(slot)
			var art := TextureRect.new()
			art.name = "%sItemArt_%s" % [node_name, item_id]
			art.custom_minimum_size = Vector2(0, 44)
			art.mouse_filter = Control.MOUSE_FILTER_IGNORE
			art.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
			art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			art.texture = _item_texture(item)
			slot.add_child(art)
			_add_label(slot, "%sItemName_%s" % [node_name, item_id], _fallback(str(def.get("name", "")), str(item.get("defId", ""))), HORIZONTAL_ALIGNMENT_CENTER)
			item_line.add_child(button)

func _render_relic_rail(parent: Node, run: Dictionary) -> void:
	var rail := VBoxContainer.new()
	rail.name = "RelicRail"
	rail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rail.add_theme_constant_override("separation", 4)
	parent.add_child(rail)
	_add_label(rail, "RelicRailTitle", "遗物")
	var row := HBoxContainer.new()
	row.name = "RelicRailItems"
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
		var name := Label.new()
		name.name = "RelicSlot_%dName" % slot
		name.text = _fallback(str(def.get("name", "")), "遗物槽 %d" % (slot + 1))
		name.mouse_filter = Control.MOUSE_FILTER_IGNORE
		name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		name.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		name.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.add_child(name)
		row.add_child(button)

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
	tip.name = "RunShellItemTip"
	tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tip.add_theme_constant_override("separation", 7)
	floating_tip.add_child(tip)

	var tags := HBoxContainer.new()
	tags.name = "RunShellItemTipTags"
	tags.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tags.add_theme_constant_override("separation", 6)
	tip.add_child(tags)
	_add_label(tags, "RunShellItemTipSizeTag", "%s格" % _fallback(_detail_size_text(def), "?"), HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(tags, "RunShellItemTipQualityTag", _quality_label(str(item.get("quality", ""))), HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(tags, "RunShellItemTipAreaTag", _area_label(str(item.get("area", ""))), HORIZONTAL_ALIGNMENT_CENTER)

	var identity := HBoxContainer.new()
	identity.name = "RunShellItemTipIdentity"
	identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity.add_theme_constant_override("separation", 8)
	tip.add_child(identity)
	var art := Label.new()
	art.name = "RunShellItemTipArt"
	art.text = ""
	art.custom_minimum_size = Vector2(54, 54)
	art.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
	identity.add_child(art)
	_add_label(identity, "RunShellItemTipTitle", title)

	var size_preview := HBoxContainer.new()
	size_preview.name = "RunShellItemTipSizePreview"
	size_preview.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_preview.add_theme_constant_override("separation", 8)
	tip.add_child(size_preview)
	_add_label(size_preview, "RunShellItemTipGridPreview", _shop_size_preview_text(def))
	_add_label(size_preview, "RunShellItemTipSizeText", "占用 %s 格" % _fallback(_detail_size_text(def), "?"))

	var trigger := _trigger_dice_text(def)
	if not trigger.is_empty():
		_add_label(tip, "RunShellItemTipDice", "触发点数 %s" % trigger)
	else:
		_add_label(tip, "RunShellItemTipDice", "触发点数 -")

	var description := _fallback(str(def.get("description", "")), str(item.get("description", "")))
	_add_label(tip, "RunShellItemTipDescription", description)

	var actions := HBoxContainer.new()
	actions.name = "RunShellItemTipActions"
	actions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_theme_constant_override("separation", 8)
	tip.add_child(actions)
	var upgrade_button := _action_button("升级", _upgrade_selected_item)
	upgrade_button.name = "UpgradeItemButton"
	upgrade_button.disabled = not _can_upgrade_selected_item(run)
	actions.add_child(upgrade_button)
	var close_button := _action_button("关闭", _close_item_tip)
	close_button.name = "CloseItemTipButton"
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

func _match_battle() -> void:
	if session != null and session.has_method("match_battle"):
		await session.call("match_battle")

func _start_battle() -> void:
	if session != null and session.has_method("start_battle"):
		await session.call("start_battle")

func _select_item(item_id: String) -> void:
	selected_item_id = item_id
	_render()

func _close_item_tip() -> void:
	selected_item_id = ""
	_render()

func _upgrade_selected_item() -> void:
	if selected_item_id.is_empty():
		return
	var item_id := selected_item_id
	if session != null and session.has_method("upgrade_item"):
		await session.call("upgrade_item", item_id)
	selected_item_id = ""
	_render()

func _noop() -> void:
	pass

func _run() -> Dictionary:
	var value = payload.get("run", {})
	return value if value is Dictionary else {}

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value = source.get(key, {})
	return value if value is Dictionary else {}

func _array(source: Dictionary, key: String) -> Array:
	var value = source.get(key, [])
	return value if value is Array else []

func _item_texture(item: Dictionary) -> Texture2D:
	var def_id := str(item.get("defId", ""))
	var art := _texture("res://assets/item-card-art/%s.webp" % def_id) if not def_id.is_empty() else null
	if art != null:
		return art
	return _sticker_texture(def_id)

func _sticker_texture(asset_id: String) -> Texture2D:
	if asset_id.is_empty():
		return _texture("res://assets/sticker-icons/starter-1.webp")
	var texture := _texture("res://assets/sticker-icons/%s.webp" % asset_id)
	return texture if texture != null else _texture("res://assets/sticker-icons/starter-1.webp")

func _texture(path: String) -> Texture2D:
	if path.is_empty():
		return null
	if not ResourceLoader.exists(path):
		return null
	return load(path) as Texture2D

func _selected_item(run: Dictionary) -> Dictionary:
	if selected_item_id.is_empty():
		return {}
	for item_value in _array(run, "items"):
		if item_value is Dictionary and str((item_value as Dictionary).get("id", "")) == selected_item_id:
			return item_value
	return {}

func _fallback(value: String, fallback: String) -> String:
	return fallback if value.strip_edges().is_empty() else value

func _detail_size_text(def: Dictionary) -> String:
	if def.has("size"):
		return str(int(def.get("size", 0)))
	return ""

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

func _can_upgrade_selected_item(run: Dictionary) -> bool:
	var selected := _selected_item(run)
	if selected.is_empty():
		return false
	var def_id := str(selected.get("defId", ""))
	if def_id.is_empty():
		return false
	var count := 0
	for item_value in _array(run, "items"):
		if item_value is Dictionary and str((item_value as Dictionary).get("defId", "")) == def_id:
			count += 1
	return count >= 2

func _area_label(area: String) -> String:
	match area:
		"EQUIPMENT":
			return "装备栏"
		"BAG":
			return "背包"
		_:
			return _fallback(area, "未放置")

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
			return _fallback(quality, "普通")

func _dog_name(dog_type: String) -> String:
	match dog_type:
		"SHIBA":
			return "柴犬"
		"CORGI":
			return "柯基"
		"HUSKY":
			return "哈士奇"
		"DOBERMAN":
			return "杜宾"
		"MUTT":
			return "土狗"
		_:
			return _fallback(dog_type, "野狗")
