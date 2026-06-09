extends BaseWebScreen

const ApiRoutes := preload("res://scripts/api/ApiRoutes.gd")
const WebUiTokens := preload("res://scripts/ui/web/WebUiTokens.gd")

var cosmetics_data: Dictionary = {}
var action_in_progress := false
var status_label: Label
var content_box: VBoxContainer
var action_buttons: Array[Button] = []

func _ready() -> void:
	_build_screen()
	_apply_payload_data()
	_render()

func bind_session(next_session: Node) -> void:
	super.bind_session(next_session)
	if visible:
		call_deferred("_refresh_cosmetics")

func _on_payload_changed() -> void:
	_apply_payload_data()
	_render()

func _notification(what: int) -> void:
	if what == NOTIFICATION_VISIBILITY_CHANGED and visible:
		call_deferred("_refresh_cosmetics")

func _build_screen() -> void:
	var panel := PanelContainer.new()
	panel.name = "AccountSettingsPanel"
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel.offset_left = 28
	panel.offset_top = 28
	panel.offset_right = -28
	panel.offset_bottom = -28
	panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	add_child(panel)

	var scroll := ScrollContainer.new()
	scroll.name = "AccountSettingsScroll"
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	panel.add_child(scroll)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_top", 22)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_bottom", 22)
	scroll.add_child(margin)

	content_box = VBoxContainer.new()
	content_box.name = "AccountSettingsScreen"
	content_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content_box.add_theme_constant_override("separation", 18)
	margin.add_child(content_box)

func _apply_payload_data() -> void:
	var value = payload.get("cosmeticsData", {})
	if value is Dictionary:
		cosmetics_data = value.duplicate(true)

func _refresh_cosmetics() -> void:
	if action_in_progress:
		return
	if not visible or session == null or session.get("api") == null:
		return
	action_in_progress = true
	_set_actions_disabled(true)
	_set_status("正在读取个人时装...")
	var api = session.get("api")
	var response: Dictionary = await api.get_json(ApiRoutes.cosmetics_me())
	if not bool(response.get("ok", false)):
		_finish_action_with_error(str(response.get("error", "加载失败")))
		return
	cosmetics_data = _response_data(response)
	action_in_progress = false
	_set_status("")
	_render()

func _render() -> void:
	if content_box == null:
		return
	for child in content_box.get_children():
		content_box.remove_child(child)
		child.queue_free()
	action_buttons = []
	_render_heading()
	if cosmetics_data.is_empty():
		_add_label(content_box, "AccountSettingsEmpty", "正在读取个人时装...")
	else:
		for cosmetic_type in ["TITLE", "AVATAR", "BACKGROUND", "DOG_SKIN", "BATTLE_EFFECT"]:
			_render_cosmetic_group(cosmetic_type)
	_set_actions_disabled(action_in_progress)

func _render_heading() -> void:
	var heading := VBoxContainer.new()
	heading.name = "AccountSettingsHeading"
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_theme_constant_override("separation", 4)
	content_box.add_child(heading)
	_add_label(heading, "AccountSettingsEyebrow", "个人设置")
	_add_label(heading, "AccountSettingsTitle", "时装与展示")
	status_label = Label.new()
	status_label.name = "AccountSettingsStatus"
	status_label.custom_minimum_size = Vector2(0, 24)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	content_box.add_child(status_label)

func _render_cosmetic_group(cosmetic_type: String) -> void:
	var group := VBoxContainer.new()
	group.name = "CosmeticGroup_%s" % cosmetic_type
	group.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	group.add_theme_constant_override("separation", 10)
	content_box.add_child(group)
	_add_label(group, "CosmeticGroupHeading_%s" % cosmetic_type, _cosmetic_type_label(cosmetic_type))

	var grid := GridContainer.new()
	grid.name = "CosmeticGrid_%s" % cosmetic_type
	grid.columns = 3
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	group.add_child(grid)
	_render_default_cosmetic_card(grid, cosmetic_type)

	var owned_count := 0
	for raw_item in _array(cosmetics_data, "inventory"):
		if raw_item is Dictionary and _cosmetic_type(raw_item) == cosmetic_type:
			owned_count += 1
			_render_owned_cosmetic_card(grid, raw_item)
	if owned_count == 0:
		var empty := Label.new()
		empty.name = "CosmeticEmpty_%s" % cosmetic_type
		empty.text = "暂无已拥有的%s，可先去商城购买。" % _cosmetic_type_label(cosmetic_type)
		empty.custom_minimum_size = Vector2(0, 30)
		empty.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		group.add_child(empty)

func _render_default_cosmetic_card(parent: GridContainer, cosmetic_type: String) -> void:
	var card := _cosmetic_card_container(parent, "CosmeticDefaultCard_%s" % cosmetic_type, "COMMON", _is_default_cosmetic_equipped(cosmetic_type))
	_add_label(card, "CosmeticDefaultBadge_%s" % cosmetic_type, _cosmetic_type_label(cosmetic_type))
	_add_label(card, "CosmeticDefaultName_%s" % cosmetic_type, _default_cosmetic_name(cosmetic_type))
	_add_label(card, "CosmeticDefaultDescription_%s" % cosmetic_type, _default_cosmetic_description(cosmetic_type))
	_add_label(card, "CosmeticDefaultMeta_%s" % cosmetic_type, "默认 · 免费")
	var action_row := HBoxContainer.new()
	action_row.name = "CosmeticDefaultActions_%s" % cosmetic_type
	action_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	action_row.add_theme_constant_override("separation", 8)
	card.add_child(action_row)
	var default_equipped := _is_default_cosmetic_equipped(cosmetic_type)
	var state := Label.new()
	state.name = "CosmeticDefaultState_%s" % cosmetic_type
	state.text = "当前默认" if default_equipped else "初始外观"
	state.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	state.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	action_row.add_child(state)
	var action: Button
	if default_equipped:
		action = _plain_button("已选择", 96)
		action.disabled = true
	else:
		action = _action_button("选择默认", _unequip_cosmetic.bind(cosmetic_type))
	action.name = "CosmeticDefaultAction_%s" % cosmetic_type
	action_row.add_child(action)

func _render_owned_cosmetic_card(parent: GridContainer, raw_item: Dictionary) -> void:
	var catalog_item_id := _cosmetic_catalog_id(raw_item)
	var item := _cosmetic_item(raw_item)
	var is_equipped := _is_cosmetic_equipped(raw_item)
	var card := _cosmetic_card_container(parent, "CosmeticCard_%s" % catalog_item_id, str(item.get("rarity", "")), is_equipped)
	_add_label(card, "CosmeticBadge_%s" % catalog_item_id, _cosmetic_type_label(_cosmetic_type(raw_item)))
	_add_label(card, "CosmeticName_%s" % catalog_item_id, _cosmetic_display_name(raw_item))
	_add_label(card, "CosmeticDescription_%s" % catalog_item_id, str(item.get("description", "")))
	_add_label(card, "CosmeticMeta_%s" % catalog_item_id, "%s · 已拥有" % _rarity_label(str(item.get("rarity", ""))))
	var action_row := HBoxContainer.new()
	action_row.name = "CosmeticActions_%s" % catalog_item_id
	action_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	action_row.add_theme_constant_override("separation", 8)
	card.add_child(action_row)
	var state := Label.new()
	state.name = "CosmeticState_%s" % catalog_item_id
	state.text = "当前装备" if is_equipped else "可装备"
	state.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	state.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	action_row.add_child(state)
	var action: Button
	if is_equipped:
		action = _plain_button("已装备", 96)
		action.disabled = true
	else:
		action = _action_button("装备", _equip_cosmetic.bind(catalog_item_id))
	action.name = "CosmeticAction_%s" % catalog_item_id
	action_row.add_child(action)

func _cosmetic_card_container(parent: GridContainer, node_name: String, rarity: String, equipped: bool) -> VBoxContainer:
	var panel := PanelContainer.new()
	panel.name = node_name
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.custom_minimum_size = Vector2(220, 158)
	panel.add_theme_stylebox_override("panel", _cosmetic_card_style(rarity, equipped))
	parent.add_child(panel)
	var card := VBoxContainer.new()
	card.name = "%sBody" % node_name
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.add_theme_constant_override("separation", 8)
	panel.add_child(card)
	return card

func _action_button(text: String, callback: Callable) -> Button:
	var button := _plain_button(text, 96)
	button.pressed.connect(callback)
	action_buttons.append(button)
	return button

func _plain_button(text: String, width: int) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(width, WebUiTokens.touch_target_height())
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button.add_theme_stylebox_override("normal", WebUiTokens.handdrawn_button_style())
	button.add_theme_stylebox_override("hover", WebUiTokens.handdrawn_button_hover_style())
	button.add_theme_stylebox_override("pressed", WebUiTokens.handdrawn_button_pressed_style())
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

func _equip_cosmetic(catalog_item_id: String) -> void:
	await _post_cosmetics_equip({"catalogItemId": catalog_item_id})

func _unequip_cosmetic(cosmetic_type: String) -> void:
	await _post_cosmetics_equip({"catalogItemId": null, "cosmeticType": cosmetic_type})

func _post_cosmetics_equip(body: Dictionary) -> void:
	if action_in_progress or session == null or session.get("api") == null:
		return
	action_in_progress = true
	_set_actions_disabled(true)
	var api = session.get("api")
	var response: Dictionary = await api.post_json(ApiRoutes.cosmetics_equip(), body)
	if not bool(response.get("ok", false)):
		_finish_action_with_error(str(response.get("error", "操作失败")))
		return
	cosmetics_data = _response_data(response)
	action_in_progress = false
	_set_status("")
	_render()

func _finish_action_with_error(message: String) -> void:
	action_in_progress = false
	_set_status(message)
	_set_actions_disabled(false)

func _set_status(text: String) -> void:
	if status_label != null:
		status_label.text = text

func _set_actions_disabled(disabled: bool) -> void:
	for button in action_buttons:
		if button != null:
			button.disabled = disabled

func _response_data(response: Dictionary) -> Dictionary:
	var value = response.get("data", {})
	return value if value is Dictionary else {}

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value = source.get(key, {})
	return value if value is Dictionary else {}

func _array(source: Dictionary, key: String) -> Array:
	var value = source.get(key, [])
	return value if value is Array else []

func _cosmetic_item(raw_item: Dictionary) -> Dictionary:
	var value = raw_item.get("item", raw_item)
	return value if value is Dictionary else raw_item

func _cosmetic_catalog_id(raw_item: Dictionary) -> String:
	var item := _cosmetic_item(raw_item)
	return str(raw_item.get("catalogItemId", item.get("id", raw_item.get("id", ""))))

func _cosmetic_display_name(raw_item: Dictionary) -> String:
	var item := _cosmetic_item(raw_item)
	return _fallback(str(item.get("name", "")), _cosmetic_catalog_id(raw_item))

func _cosmetic_type(raw_item: Dictionary) -> String:
	var item := _cosmetic_item(raw_item)
	return str(item.get("type", item.get("cosmeticType", raw_item.get("type", raw_item.get("cosmeticType", "")))))

func _is_cosmetic_equipped(raw_item: Dictionary) -> bool:
	if bool(raw_item.get("equipped", false)):
		return true
	var catalog_item_id := _cosmetic_catalog_id(raw_item)
	for entry_value in _array(cosmetics_data, "equipped"):
		if entry_value is Dictionary:
			var entry: Dictionary = entry_value
			if str(entry.get("catalogItemId", "")) == catalog_item_id:
				return true
			if _cosmetic_catalog_id(entry) == catalog_item_id:
				return true
	return false

func _is_default_cosmetic_equipped(cosmetic_type: String) -> bool:
	for entry_value in _array(cosmetics_data, "equipped"):
		if entry_value is Dictionary:
			var entry: Dictionary = entry_value
			var entry_type := str(entry.get("slot", entry.get("cosmeticType", _cosmetic_type(entry))))
			if entry_type == cosmetic_type:
				return false
	return true

func _fallback(value: String, fallback: String) -> String:
	return fallback if value.strip_edges().is_empty() else value

func _default_cosmetic_name(cosmetic_type: String) -> String:
	match cosmetic_type:
		"TITLE":
			return "默认称号"
		"AVATAR":
			return "默认头像"
		"BACKGROUND":
			return "默认主页"
		"DOG_SKIN":
			return "默认狗狗"
		"BATTLE_EFFECT":
			return "默认特效"
		_:
			return "默认外观"

func _default_cosmetic_description(cosmetic_type: String) -> String:
	match cosmetic_type:
		"TITLE":
			return "不装备称号，显示账号原始样式。"
		"AVATAR":
			return "使用初始狗狗头像。"
		"BACKGROUND":
			return "使用游戏初始主页背景。"
		"DOG_SKIN":
			return "使用狗狗原本的外观。"
		"BATTLE_EFFECT":
			return "使用基础战斗表现。"
		_:
			return "恢复默认外观。"

func _cosmetic_type_label(cosmetic_type: String) -> String:
	match cosmetic_type:
		"TITLE":
			return "称号"
		"AVATAR":
			return "头像"
		"BACKGROUND":
			return "主页背景"
		"DOG_SKIN":
			return "狗狗皮肤"
		"BATTLE_EFFECT":
			return "战斗特效"
		_:
			return _fallback(cosmetic_type, "外观")

func _rarity_label(rarity: String) -> String:
	match rarity:
		"COMMON":
			return "普通"
		"RARE":
			return "稀有"
		"EPIC":
			return "史诗"
		"LEGENDARY":
			return "传说"
		_:
			return _fallback(rarity, "普通")

func _cosmetic_card_style(rarity: String, equipped: bool) -> StyleBoxFlat:
	var style := WebUiTokens.paper_card_style()
	style.border_color = WebUiTokens.quality_color(_rarity_to_quality(rarity))
	style.set_border_width_all(3 if equipped else 2)
	return style

func _rarity_to_quality(rarity: String) -> String:
	match rarity:
		"COMMON":
			return "BRONZE"
		"RARE":
			return "SILVER"
		"EPIC":
			return "DIAMOND"
		"LEGENDARY":
			return "GOLD"
		_:
			return "BRONZE"
