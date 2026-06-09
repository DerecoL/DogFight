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
	_render_relic_rail(parent, run)
	_render_grid_panel(parent, "BagBoard", "背包", "BAG", run)

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
		if item_value is Dictionary and str((item_value as Dictionary).get("area", "")) == area:
			var item: Dictionary = item_value
			var def := _dict(item, "def")
			var button := _action_button(_fallback(str(def.get("name", "")), str(item.get("defId", ""))), _select_item.bind(str(item.get("id", ""))))
			button.name = "%sItem_%s" % [node_name, str(item.get("id", ""))]
			button.custom_minimum_size = Vector2(90, 52)
			item_line.add_child(button)

func _render_relic_rail(parent: VBoxContainer, run: Dictionary) -> void:
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
		row.add_child(button)

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

func _fallback(value: String, fallback: String) -> String:
	return fallback if value.strip_edges().is_empty() else value

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
