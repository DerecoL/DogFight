extends BaseWebScreen

const ApiRoutes := preload("res://scripts/api/ApiRoutes.gd")
const WebUiTokens := preload("res://scripts/ui/web/WebUiTokens.gd")

var currency_label: Label
var status_label: Label
var sections_box: VBoxContainer
var action_buttons: Array[Button] = []
var shop_data: Dictionary = {}
var cosmetics_data: Dictionary = {}
var action_in_progress := false

func _ready() -> void:
	_build_screen()
	_render_shop()

func bind_session(next_session: Node) -> void:
	super.bind_session(next_session)

func _on_payload_changed() -> void:
	if visible:
		call_deferred("_refresh_account_shop")

func _build_screen() -> void:
	var panel := PanelContainer.new()
	panel.name = "AccountShopPanel"
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel.offset_left = 28
	panel.offset_top = 28
	panel.offset_right = -28
	panel.offset_bottom = -28
	panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	add_child(panel)

	var scroll := ScrollContainer.new()
	scroll.name = "AccountShopScroll"
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

	var box := VBoxContainer.new()
	box.name = "AccountShopContent"
	box.add_theme_constant_override("separation", 18)
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margin.add_child(box)

	var heading := HBoxContainer.new()
	heading.name = "ScreenHeading"
	heading.add_theme_constant_override("separation", 14)
	box.add_child(heading)

	var title_box := VBoxContainer.new()
	title_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_child(title_box)

	var eyebrow := Label.new()
	eyebrow.name = "Eyebrow"
	eyebrow.text = "账号商城"
	eyebrow.custom_minimum_size = Vector2(0, 24)
	title_box.add_child(eyebrow)

	var title := Label.new()
	title.name = "Title"
	title.text = "外观商店"
	title.custom_minimum_size = Vector2(0, 38)
	title_box.add_child(title)

	currency_label = Label.new()
	currency_label.name = "AccountCurrencyPill"
	currency_label.custom_minimum_size = Vector2(128, 44)
	currency_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	currency_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	currency_label.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
	heading.add_child(currency_label)

	status_label = Label.new()
	status_label.name = "StatusLabel"
	status_label.custom_minimum_size = Vector2(0, 28)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(status_label)

	sections_box = VBoxContainer.new()
	sections_box.name = "ShopSections"
	sections_box.add_theme_constant_override("separation", 18)
	sections_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_child(sections_box)

func _refresh_account_shop() -> void:
	if action_in_progress:
		return
	if status_label == null:
		return
	if not visible:
		return
	if session == null or session.get("api") == null:
		return
	action_in_progress = true
	_set_actions_disabled(true)
	status_label.text = "加载中..."
	var api = session.get("api")
	var shop_response: Dictionary = await api.get_json(ApiRoutes.shop())
	if not bool(shop_response.get("ok", false)):
		_finish_action_with_error(str(shop_response.get("error", "加载失败")))
		return
	var cosmetics_response: Dictionary = await api.get_json(ApiRoutes.cosmetics_me())
	if not bool(cosmetics_response.get("ok", false)):
		_finish_action_with_error(str(cosmetics_response.get("error", "加载失败")))
		return
	shop_data = _response_data(shop_response)
	cosmetics_data = _response_data(cosmetics_response)
	status_label.text = ""
	action_in_progress = false
	_set_actions_disabled(false)
	_render_shop()

func _render_shop() -> void:
	if sections_box == null:
		return
	for child in sections_box.get_children():
		sections_box.remove_child(child)
		child.free()
	action_buttons = []
	var wallet := _dict(shop_data, "wallet")
	currency_label.text = "金币 %d" % int(wallet.get("balance", 0))
	var sections := _dict(shop_data, "sections")
	_add_catalog_section("常驻区", "permanent", _array(sections, "permanent"))
	_add_catalog_section("精选轮换区", "featured", _array(sections, "featured"))

func _add_catalog_section(title: String, section_id: String, items: Array) -> void:
	var section := VBoxContainer.new()
	section.name = "ShopCatalogSection_%s" % section_id
	section.add_theme_constant_override("separation", 12)
	sections_box.add_child(section)

	var heading := Label.new()
	heading.name = "ShopCatalogHeading_%s" % section_id
	heading.text = title
	heading.custom_minimum_size = Vector2(0, 30)
	section.add_child(heading)

	var grid := GridContainer.new()
	grid.name = "ShopSectionGrid_%s" % section_id
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	section.add_child(grid)
	var grid_alias := Control.new()
	grid_alias.name = "ShopSectionGrid"
	grid_alias.custom_minimum_size = Vector2(0, 1)
	grid_alias.visible = false
	grid.add_child(grid_alias)

	if items.is_empty():
		var empty := Label.new()
		empty.name = "ShopCatalogEmpty_%s" % section_id
		empty.text = "暂无外观"
		empty.custom_minimum_size = Vector2(0, 32)
		section.add_child(empty)
		return

	for raw_item in items:
		if raw_item is Dictionary:
			grid.add_child(_cosmetic_card(raw_item))

func _cosmetic_card(item: Dictionary) -> PanelContainer:
	var catalog_item_id := str(item.get("id", ""))
	var card_key := _node_key(catalog_item_id)
	var card := PanelContainer.new()
	card.name = "ShopCosmeticCard_%s" % card_key
	card.custom_minimum_size = Vector2(240, 190)
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.add_theme_stylebox_override("panel", _rarity_card_style(str(item.get("rarity", ""))))

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_bottom", 12)
	card.add_child(margin)

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	margin.add_child(box)
	var card_alias := Control.new()
	card_alias.name = "ShopCosmeticCard"
	card_alias.custom_minimum_size = Vector2(0, 1)
	card_alias.visible = false
	box.add_child(card_alias)

	var badge := Label.new()
	badge.name = "CosmeticBadge_%s" % card_key
	badge.text = _cosmetic_type_label(str(item.get("type", "")))
	badge.custom_minimum_size = Vector2(0, 28)
	badge.clip_text = true
	badge.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	box.add_child(badge)

	var name_label := Label.new()
	name_label.name = "CosmeticName_%s" % card_key
	name_label.text = str(item.get("name", item.get("id", "")))
	name_label.custom_minimum_size = Vector2(0, 28)
	name_label.clip_text = true
	name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	box.add_child(name_label)

	var description := Label.new()
	description.name = "CosmeticDescription_%s" % card_key
	description.text = str(item.get("description", ""))
	description.custom_minimum_size = Vector2(0, 46)
	description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(description)

	var meta := Label.new()
	meta.name = "CosmeticType_%s" % card_key
	meta.text = "%s · %s" % [_cosmetic_type_label(str(item.get("type", ""))), _rarity_label(str(item.get("rarity", "")))]
	meta.custom_minimum_size = Vector2(0, 24)
	box.add_child(meta)

	var actions := HBoxContainer.new()
	actions.name = "ShopCardActions_%s" % card_key
	actions.add_theme_constant_override("separation", 8)
	box.add_child(actions)
	var actions_alias := Control.new()
	actions_alias.name = "ShopCardActions"
	actions_alias.custom_minimum_size = Vector2(0, 1)
	actions_alias.visible = false
	actions.add_child(actions_alias)

	var price := Label.new()
	price.name = "ShopCardPrice_%s" % card_key
	price.text = "金币 %d" % int(item.get("price", 0))
	price.custom_minimum_size = Vector2(86, 34)
	price.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	actions.add_child(price)

	var action := Button.new()
	action.name = "ShopCardAction_%s" % card_key
	action.custom_minimum_size = Vector2(86, 34)
	action.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if _is_equipped(catalog_item_id) or bool(item.get("equipped", false)):
		action.text = "已装备"
		action.disabled = true
	elif bool(item.get("owned", false)):
		action.text = "装备"
		action.pressed.connect(_equip_cosmetic.bind(catalog_item_id))
	else:
		action.text = "购买"
		action.pressed.connect(_purchase_cosmetic.bind(catalog_item_id))
	actions.add_child(_track_action_button(action))
	return card

func _purchase_cosmetic(catalog_item_id: String) -> void:
	await _post_account_action(ApiRoutes.shop_purchase(), {"catalogItemId": catalog_item_id}, "购买成功")

func _equip_cosmetic(catalog_item_id: String) -> void:
	await _post_account_action(ApiRoutes.cosmetics_equip(), {"catalogItemId": catalog_item_id}, "装备成功")

func _post_account_action(path: String, body: Dictionary, success_message: String) -> void:
	if action_in_progress or session == null or session.get("api") == null:
		return
	action_in_progress = true
	_set_actions_disabled(true)
	var api = session.get("api")
	var response: Dictionary = await api.post_json(path, body)
	if not bool(response.get("ok", false)):
		_finish_action_with_error(str(response.get("error", "操作失败")))
		return
	status_label.text = success_message
	action_in_progress = false
	_set_actions_disabled(false)
	await _refresh_account_shop()

func _finish_action_with_error(message: String) -> void:
	status_label.text = message
	action_in_progress = false
	_set_actions_disabled(false)

func _track_action_button(button: Button) -> Button:
	action_buttons.append(button)
	button.disabled = true if button.text == "已装备" else action_in_progress
	return button

func _set_actions_disabled(disabled: bool) -> void:
	for button in action_buttons:
		if button != null and button.text != "已装备":
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

func _node_key(value: String) -> String:
	var key := value
	for part in ["/", "\\", ":", " ", ".", "\n", "\t"]:
		key = key.replace(part, "_")
	return key

func _is_equipped(catalog_item_id: String) -> bool:
	for entry in _array(cosmetics_data, "equipped"):
		if entry is Dictionary and str((entry as Dictionary).get("catalogItemId", "")) == catalog_item_id:
			return true
	return false

func _rarity_card_style(rarity: String) -> StyleBoxFlat:
	var style := WebUiTokens.paper_card_style()
	style.border_color = WebUiTokens.quality_color(_rarity_to_quality(rarity))
	style.set_border_width_all(2)
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
			return cosmetic_type

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
			return rarity
