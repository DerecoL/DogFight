extends BaseWebScreen

const DOG_TYPES := ["SHIBA", "SAMOYED", "MUTT", "BULLY", "EMPEROR", "FROG"]
const DOG_SELECTION_SLOT_COUNT := 8
const DOG_NAMES := {
	"SHIBA": "柴犬",
	"SAMOYED": "萨摩耶",
	"MUTT": "土狗",
	"BULLY": "恶霸",
	"EMPEROR": "狗皇帝",
	"FROG": "祖灵",
}
const DOG_TRAITS := {
	"SHIBA": "投出 1 点时造成额外伤害",
	"SAMOYED": "每回合开始获得护盾",
	"MUTT": "20% 概率额外投掷一次",
	"BULLY": "高点数触发更强攻击",
	"EMPEROR": "选择幸运数字，命中后强化全局收益",
	"FROG": "显式点数装备改为【蓄水】触发，可被职业装备提速",
}
const DOG_TAGS := {
	"SHIBA": ["新手", "低点"],
	"SAMOYED": ["防御", "稳定"],
	"MUTT": ["随机", "连击"],
	"BULLY": ["爆发", "高点"],
	"EMPEROR": ["幸运", "成长"],
	"FROG": ["蓄水", "稳定"],
}
const DOG_STRATEGIES := {
	"SHIBA": "适合先熟悉商店、放置和战斗节奏，围绕 1 点触发装备展开。",
	"SAMOYED": "通过护盾抵消波动，适合稳健过渡到中后期。",
	"MUTT": "通过额外投掷获得更多触发机会，适合多件低门槛装备。",
	"BULLY": "偏向高点爆发，适合集中强化 5 点和 6 点收益。",
	"EMPEROR": "先选幸运数字，再围绕该点数堆叠触发和经济收益。",
	"FROG": "适合显式点数装备和水位提速构筑，用稳定计时换取持续触发。",
}
const DOG_ASSETS := {
	"SHIBA": "res://assets/dogs/shiba.webp",
	"SAMOYED": "res://assets/dogs/samoyed.webp",
	"MUTT": "res://assets/dogs/mutt.webp",
	"BULLY": "res://assets/dogs/bully.webp",
	"EMPEROR": "res://assets/dogs/emperor.webp",
	"FROG": "res://assets/dogs/zuling.jpg",
}

var selected_dog := "SHIBA"
var selected_lucky_number := 1
var action_in_progress := false

func _ready() -> void:
	_render()

func _on_payload_changed() -> void:
	_render()

func _render() -> void:
	for child in get_children():
		remove_child(child)
		child.queue_free()

	var scroll := ScrollContainer.new()
	scroll.name = "DogSelectScroll"
	scroll.set_anchors_preset(Control.PRESET_FULL_RECT)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)

	var margin := MarginContainer.new()
	margin.name = "DogSelectMargin"
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_top", 22)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_bottom", 22)
	scroll.add_child(margin)

	var screen := VBoxContainer.new()
	screen.name = "DogSelectScreen"
	screen.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	screen.add_theme_constant_override("separation", 14)
	margin.add_child(screen)

	var heading := VBoxContainer.new()
	heading.name = "ScreenHeading"
	heading.add_theme_constant_override("separation", 4)
	screen.add_child(heading)
	_add_label(heading, "DogSelectTitle", "选择狗狗", HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(heading, "DogSelectSubtitle", "每只狗都有被动。第一次可以直接用默认柴犬开始。", HORIZONTAL_ALIGNMENT_CENTER)

	var dog_select := HBoxContainer.new()
	dog_select.name = "DogSelect"
	dog_select.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dog_select.add_theme_constant_override("separation", 18)
	screen.add_child(dog_select)

	var dog_grid := GridContainer.new()
	dog_grid.name = "DogCardGrid"
	dog_grid.columns = 4
	dog_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dog_grid.add_theme_constant_override("h_separation", 12)
	dog_grid.add_theme_constant_override("v_separation", 12)
	dog_select.add_child(dog_grid)
	for index in range(DOG_SELECTION_SLOT_COUNT):
		if index < DOG_TYPES.size():
			dog_grid.add_child(_dog_card_button(str(DOG_TYPES[index])))
		else:
			dog_grid.add_child(_dog_card_placeholder(index))

	_render_detail_panel(dog_select)

func _dog_card_button(dog_type: String) -> Button:
	var button := Button.new()
	button.name = "DogCard_%s" % dog_type
	button.text = ""
	button.custom_minimum_size = Vector2(148, 150)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.toggle_mode = true
	button.button_pressed = selected_dog == dog_type
	button.disabled = action_in_progress
	button.add_theme_stylebox_override("normal", WebUiTokens.handdrawn_button_style())
	button.add_theme_stylebox_override("hover", WebUiTokens.handdrawn_button_hover_style())
	button.add_theme_stylebox_override("pressed", WebUiTokens.handdrawn_button_pressed_style())
	button.pressed.connect(_select_dog.bind(dog_type))

	var margin := MarginContainer.new()
	margin.name = "DogCardContent_%s" % dog_type
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	margin.add_theme_constant_override("margin_left", 10)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_right", 10)
	margin.add_theme_constant_override("margin_bottom", 10)
	button.add_child(margin)

	var content := VBoxContainer.new()
	content.name = "DogCardStack_%s" % dog_type
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.add_theme_constant_override("separation", 6)
	margin.add_child(content)

	var art_frame := PanelContainer.new()
	art_frame.name = "DogCardArtFrame_%s" % dog_type
	art_frame.custom_minimum_size = Vector2(0, 50)
	art_frame.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	art_frame.size_flags_vertical = Control.SIZE_EXPAND_FILL
	art_frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art_frame.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	content.add_child(art_frame)

	var art := TextureRect.new()
	art.name = "DogCardArt_%s" % dog_type
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	art.texture = _dog_texture(dog_type)
	art_frame.add_child(art)

	_add_label(content, "DogCardName_%s" % dog_type, _dog_name(dog_type), HORIZONTAL_ALIGNMENT_CENTER).mouse_filter = Control.MOUSE_FILTER_IGNORE
	_add_label(content, "DogCardCopy_%s" % dog_type, str(DOG_TRAITS.get(dog_type, "")), HORIZONTAL_ALIGNMENT_CENTER).mouse_filter = Control.MOUSE_FILTER_IGNORE
	_add_tag_row(content, "DogCardTagRow_%s" % dog_type, _dog_tags(dog_type))
	return button

func _dog_card_placeholder(index: int) -> PanelContainer:
	var placeholder := PanelContainer.new()
	placeholder.name = "DogCardPlaceholder_%d" % index
	placeholder.custom_minimum_size = Vector2(148, 150)
	placeholder.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	placeholder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	placeholder.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	return placeholder

func _render_detail_panel(parent: Node) -> void:
	var panel := PanelContainer.new()
	panel.name = "DogDetailPanel"
	panel.custom_minimum_size = Vector2(360, 360)
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(panel)

	var box := VBoxContainer.new()
	box.name = "DogDetailContent"
	box.add_theme_constant_override("separation", 10)
	panel.add_child(box)

	var art := TextureRect.new()
	art.name = "DogDetailArt"
	art.custom_minimum_size = Vector2(0, 122)
	art.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	art.texture = _dog_texture(selected_dog)
	box.add_child(art)

	_add_label(box, "DogDetailName", _dog_name(selected_dog), HORIZONTAL_ALIGNMENT_CENTER)
	_add_detail_box(box, "被动特性", str(DOG_TRAITS.get(selected_dog, "")))
	_add_detail_box(box, "策略说明", str(DOG_STRATEGIES.get(selected_dog, "")))
	_add_tag_row(box, "DogTagRow", _dog_tags(selected_dog))

	if selected_dog == "EMPEROR":
		var lucky := HBoxContainer.new()
		lucky.name = "LuckyNumberPicker"
		lucky.add_theme_constant_override("separation", 6)
		box.add_child(lucky)
		for number in range(1, 7):
			var button := Button.new()
			button.name = "LuckyNumber%d" % number
			button.text = str(number)
			button.custom_minimum_size = Vector2(42, 38)
			button.toggle_mode = true
			button.button_pressed = selected_lucky_number == number
			button.disabled = action_in_progress
			button.add_theme_stylebox_override("normal", WebUiTokens.handdrawn_button_style())
			button.add_theme_stylebox_override("hover", WebUiTokens.handdrawn_button_hover_style())
			button.add_theme_stylebox_override("pressed", WebUiTokens.handdrawn_button_pressed_style())
			button.pressed.connect(_select_lucky_number.bind(number))
			lucky.add_child(button)

	var start := Button.new()
	start.name = "StartRunButton"
	start.text = "开始一局"
	start.custom_minimum_size = Vector2(0, WebUiTokens.touch_target_height())
	start.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	start.disabled = action_in_progress
	start.add_theme_stylebox_override("normal", WebUiTokens.handdrawn_button_style())
	start.add_theme_stylebox_override("hover", WebUiTokens.handdrawn_button_hover_style())
	start.add_theme_stylebox_override("pressed", WebUiTokens.handdrawn_button_pressed_style())
	start.pressed.connect(_start_run)
	box.add_child(start)

func _add_detail_box(parent: Node, title_text: String, body_text: String) -> void:
	var box := VBoxContainer.new()
	box.name = "DetailBox"
	box.add_theme_constant_override("separation", 4)
	parent.add_child(box)
	_add_label(box, "DetailTitle", title_text)
	_add_label(box, "DetailBody", body_text)

func _add_tag_row(parent: Node, node_name: String, tags: Array) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.name = node_name
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", 6)
	parent.add_child(row)
	for index in range(tags.size()):
		var tag := Label.new()
		tag.name = "%sTag_%d" % [node_name, index]
		tag.text = str(tags[index])
		tag.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		tag.mouse_filter = Control.MOUSE_FILTER_IGNORE
		tag.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
		row.add_child(tag)
	return row

func _add_label(parent: Node, node_name: String, text: String, align := HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var label := Label.new()
	label.name = node_name
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.horizontal_alignment = align
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(label)
	return label

func _select_dog(dog_type: String) -> void:
	if action_in_progress:
		return
	selected_dog = dog_type
	_render()

func _select_lucky_number(number: int) -> void:
	if action_in_progress:
		return
	selected_lucky_number = number
	_render()

func _start_run() -> void:
	if action_in_progress:
		return
	if session == null or not session.has_method("create_run"):
		return
	action_in_progress = true
	_render()
	var mode := str(payload.get("mode", "CASUAL"))
	var lucky: Variant = selected_lucky_number if selected_dog == "EMPEROR" else null
	await session.call("create_run", selected_dog, mode, lucky)
	action_in_progress = false
	if is_inside_tree() and visible:
		_render()

func _dog_tags(dog_type: String) -> Array:
	var tags = DOG_TAGS.get(dog_type, [])
	return tags if tags is Array else []

func _dog_name(dog_type: String) -> String:
	return str(DOG_NAMES.get(dog_type, dog_type))

func _dog_texture(dog_type: String) -> Texture2D:
	var path := str(DOG_ASSETS.get(dog_type, ""))
	if path.is_empty():
		return null
	return load(path) as Texture2D
