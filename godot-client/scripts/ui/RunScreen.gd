extends Control

@onready var run_label: Label = %RunLabel
@onready var create_run_button: Button = %CreateRunButton
@onready var equipment_list: VBoxContainer = %EquipmentList
@onready var bag_list: VBoxContainer = %BagList
@onready var shop_list: VBoxContainer = %ShopList
@onready var action_button: Button = %ActionButton
@onready var error_label: Label = %ErrorLabel
@onready var footer: HBoxContainer = $Root/Footer

var session: Node
var selected_item_id := ""
var selected_item_area := ""

func bind_session(next_session: Node) -> void:
	if session != null:
		if session.has_signal("run_changed") and session.run_changed.is_connected(_on_run_changed):
			session.run_changed.disconnect(_on_run_changed)
		if session.has_signal("error_raised") and session.error_raised.is_connected(_on_error_raised):
			session.error_raised.disconnect(_on_error_raised)
	session = next_session
	if session != null:
		if session.has_signal("run_changed") and not session.run_changed.is_connected(_on_run_changed):
			session.run_changed.connect(_on_run_changed)
		if session.has_signal("error_raised") and not session.error_raised.is_connected(_on_error_raised):
			session.error_raised.connect(_on_error_raised)
	_render()

func _ready() -> void:
	if not create_run_button.pressed.is_connected(_on_create_run_pressed):
		create_run_button.pressed.connect(_on_create_run_pressed)
	_ensure_footer_action_buttons()
	_render()

func clear_error() -> void:
	if not is_node_ready():
		return
	error_label.text = ""

func _on_create_run_pressed() -> void:
	error_label.text = ""
	if session == null or not session.has_method("create_run"):
		error_label.text = "跑局会话未初始化"
		return
	create_run_button.disabled = true
	await session.create_run("SHIBA", "CASUAL")
	create_run_button.disabled = false

func _on_run_changed(_run: Dictionary) -> void:
	_clear_stale_selection()
	_render()

func _render() -> void:
	if not is_node_ready():
		return
	clear_error()
	var store = null if session == null else session.get("run_store")
	if store == null or not store.has_run():
		run_label.text = "暂无跑局"
		action_button.text = _action_label("")
		selected_item_id = ""
		selected_item_area = ""
		_render_items(equipment_list, [], "EQUIPMENT")
		_render_items(bag_list, [], "BAG")
		_render_shop([])
		return
	var phase := store.phase()
	run_label.text = "阶段: %s  回合: %d  金币: %d  胜: %d  负: %d" % [
		phase,
		store.round_number(),
		store.gold(),
		store.wins(),
		store.losses()
	]
	_render_items(equipment_list, store.items_in_area("EQUIPMENT"), "EQUIPMENT")
	_render_items(bag_list, store.items_in_area("BAG"), "BAG")
	_render_shop(store.shop_offers())
	action_button.text = _action_label(phase)

func _render_items(container: VBoxContainer, items: Array, area: String) -> void:
	_clear_children(container)
	for item in items:
		if not item is Dictionary:
			continue
		var item_id := str(item.get("id", ""))
		if item_id.is_empty():
			continue
		var def_data = item.get("def", {})
		var def_name := ""
		if def_data is Dictionary:
			def_name = str(def_data.get("name", ""))
		if def_name.is_empty():
			def_name = str(item.get("defId", item.get("id", "未知道具")))
		var quality := str(item.get("quality", ""))
		var x := int(item.get("x", 0))
		var y := int(item.get("y", 0))
		var row := Button.new()
		row.custom_minimum_size = Vector2(0, 44)
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.clip_text = true
		row.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		row.text = "%s  %s  (%d,%d)" % [def_name, quality, x, y]
		row.pressed.connect(_on_item_pressed.bind(item_id, area, def_name))
		container.add_child(row)

func _render_shop(offers: Array) -> void:
	_clear_children(shop_list)
	for offer in offers:
		if not offer is Dictionary:
			continue
		var def_data = offer.get("def", {})
		var def_name := ""
		if def_data is Dictionary:
			def_name = str(def_data.get("name", ""))
		if def_name.is_empty():
			def_name = str(offer.get("defId", offer.get("offerId", "未知商品")))
		var price := int(offer.get("price", 0))
		var row := Button.new()
		row.custom_minimum_size = Vector2(0, 44)
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.clip_text = true
		row.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		row.text = "%s  价格: %d" % [def_name, price]
		row.pressed.connect(_on_shop_offer_pressed.bind(str(offer.get("offerId", ""))))
		shop_list.add_child(row)

func _ensure_footer_action_buttons() -> void:
	_add_footer_button("SellSelectedButton", "出售选中", _on_sell_selected_pressed)
	_add_footer_button("RerollShopButton", "刷新商店", _on_reroll_shop_pressed)
	_add_footer_button("MoveBagButton", "移到背包0,0", _on_move_to_bag_pressed)
	_add_footer_button("MoveEquipmentButton", "移到装备0,0", _on_move_to_equipment_pressed)

func _add_footer_button(button_name: String, label: String, handler: Callable) -> void:
	var button := footer.get_node_or_null(button_name) as Button
	if button == null:
		button = Button.new()
		button.name = button_name
		button.custom_minimum_size = Vector2(132, 44)
		button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		footer.add_child(button)
	button.text = label
	button.clip_text = true
	button.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	if not button.pressed.is_connected(handler):
		button.pressed.connect(handler)

func _on_item_pressed(item_id: String, area: String, label: String) -> void:
	selected_item_id = item_id
	selected_item_area = area
	error_label.text = "已选中 %s" % label

func _on_shop_offer_pressed(offer_id: String) -> void:
	if offer_id.is_empty():
		error_label.text = "商品无效"
		return
	if session == null or not session.has_method("buy_offer"):
		error_label.text = "跑局会话未初始化"
		return
	await session.buy_offer(offer_id, "BAG")

func _on_sell_selected_pressed() -> void:
	if not _has_selected_item():
		return
	if session == null or not session.has_method("sell_item"):
		error_label.text = "跑局会话未初始化"
		return
	if await session.sell_item(selected_item_id):
		selected_item_id = ""
		selected_item_area = ""

func _on_reroll_shop_pressed() -> void:
	if session == null or not session.has_method("reroll_shop"):
		error_label.text = "跑局会话未初始化"
		return
	await session.reroll_shop()

func _on_move_to_bag_pressed() -> void:
	await _move_selected_item("BAG")

func _on_move_to_equipment_pressed() -> void:
	await _move_selected_item("EQUIPMENT")

func _move_selected_item(area: String) -> void:
	if not _has_selected_item():
		return
	if session == null or not session.has_method("move_item"):
		error_label.text = "跑局会话未初始化"
		return
	if await session.move_item(selected_item_id, area, 0, 0):
		selected_item_area = area

func _has_selected_item() -> bool:
	if selected_item_id.is_empty():
		error_label.text = "请先选中道具"
		return false
	return true

func _clear_stale_selection() -> void:
	if selected_item_id.is_empty() or session == null:
		return
	var store = session.get("run_store")
	if store == null or not store.has_run():
		selected_item_id = ""
		selected_item_area = ""
		return
	for area in ["EQUIPMENT", "BAG"]:
		for item in store.items_in_area(area):
			if item is Dictionary and str(item.get("id", "")) == selected_item_id:
				return
	selected_item_id = ""
	selected_item_area = ""

func _action_label(phase: String) -> String:
	match phase:
		"PREP":
			return "匹配对手"
		"MATCH":
			return "开始战斗"
		"BATTLE":
			return "继续结算"
		_:
			return "等待阶段操作"

func _clear_children(container: Node) -> void:
	for child in container.get_children():
		container.remove_child(child)
		child.queue_free()

func _on_error_raised(message: String) -> void:
	if not visible:
		return
	error_label.text = message
