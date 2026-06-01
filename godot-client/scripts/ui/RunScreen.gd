extends Control

@onready var run_label: Label = %RunLabel
@onready var create_run_button: Button = %CreateRunButton
@onready var equipment_list: VBoxContainer = %EquipmentList
@onready var bag_list: VBoxContainer = %BagList
@onready var shop_list: VBoxContainer = %ShopList
@onready var action_button: Button = %ActionButton
@onready var error_label: Label = %ErrorLabel

var session: Node

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
	_render()

func _on_create_run_pressed() -> void:
	error_label.text = ""
	if session == null or not session.has_method("create_run"):
		error_label.text = "跑局会话未初始化"
		return
	create_run_button.disabled = true
	await session.create_run("SHIBA", "CASUAL")
	create_run_button.disabled = false

func _on_run_changed(_run: Dictionary) -> void:
	_render()

func _render() -> void:
	if not is_node_ready():
		return
	var store = null if session == null else session.get("run_store")
	if store == null or not store.has_run():
		run_label.text = "暂无跑局"
		action_button.text = _action_label("")
		_render_items(equipment_list, [])
		_render_items(bag_list, [])
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
	_render_items(equipment_list, store.items_in_area("EQUIPMENT"))
	_render_items(bag_list, store.items_in_area("BAG"))
	_render_shop(store.shop_offers())
	action_button.text = _action_label(phase)

func _render_items(container: VBoxContainer, items: Array) -> void:
	_clear_children(container)
	for item in items:
		if not item is Dictionary:
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
		row.text = "%s  %s  (%d,%d)" % [def_name, quality, x, y]
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
		row.text = "%s  价格: %d" % [def_name, price]
		shop_list.add_child(row)

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
		child.queue_free()

func _on_error_raised(message: String) -> void:
	error_label.text = message
