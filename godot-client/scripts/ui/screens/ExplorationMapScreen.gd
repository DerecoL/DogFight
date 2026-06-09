extends BaseWebScreen

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
	scroll.name = "ExplorationMapScroll"
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
		_add_label(margin, "ExplorationMapEmpty", "暂无进行中的探索地图。", HORIZONTAL_ALIGNMENT_CENTER)
		return
	_render_map_run(margin, run)

func _render_map_run(parent: Node, run: Dictionary) -> void:
	var overlay := PanelContainer.new()
	overlay.name = "ExplorationMapOverlay"
	overlay.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	overlay.size_flags_vertical = Control.SIZE_EXPAND_FILL
	overlay.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(overlay)

	var shell := VBoxContainer.new()
	shell.name = "ExplorationMapShell"
	shell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	shell.size_flags_vertical = Control.SIZE_EXPAND_FILL
	shell.add_theme_constant_override("separation", 10)
	overlay.add_child(shell)

	var map_state: Dictionary = _dict(run, "mapState")
	var layer_count := _map_layer_count(map_state)
	_render_topbar(shell, run, map_state, layer_count)

	var route_board := HBoxContainer.new()
	route_board.name = "ExplorationMapRouteBoard"
	route_board.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	route_board.size_flags_vertical = Control.SIZE_EXPAND_FILL
	route_board.add_theme_constant_override("separation", 10)
	shell.add_child(route_board)

	var canvas_panel := PanelContainer.new()
	canvas_panel.name = "MapRouteCanvasPanel"
	canvas_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	canvas_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	canvas_panel.custom_minimum_size = Vector2(560, 420)
	canvas_panel.add_theme_stylebox_override("panel", WebUiTokens.wood_panel_style())
	route_board.add_child(canvas_panel)

	var canvas := VBoxContainer.new()
	canvas.name = "MapRouteCanvas"
	canvas.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	canvas.size_flags_vertical = Control.SIZE_EXPAND_FILL
	canvas.add_theme_constant_override("separation", 8)
	canvas_panel.add_child(canvas)

	_render_layer_markers(canvas, layer_count)

	var route_layer := VBoxContainer.new()
	route_layer.name = "MapRouteLayer"
	route_layer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	route_layer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	canvas.add_child(route_layer)

	var svg_layer := Control.new()
	svg_layer.name = "MapRouteSvg"
	svg_layer.custom_minimum_size = Vector2(0, 1)
	route_layer.add_child(svg_layer)
	_render_map_route(route_layer, map_state)
	_render_drawing_toolbar(canvas)

	var detail_panel := PanelContainer.new()
	detail_panel.name = "MapNodeDetailPanelFrame"
	detail_panel.custom_minimum_size = Vector2(320, 0)
	detail_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	detail_panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	route_board.add_child(detail_panel)
	var detail := VBoxContainer.new()
	detail.name = "MapNodeDetailPanel"
	detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail.size_flags_vertical = Control.SIZE_EXPAND_FILL
	detail.add_theme_constant_override("separation", 8)
	detail_panel.add_child(detail)
	_render_map_detail_panel(detail, map_state)

	if not _dict(map_state, "pendingReward").is_empty():
		var reward_inventory := PanelContainer.new()
		reward_inventory.name = "MapRewardInventory"
		reward_inventory.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		reward_inventory.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
		shell.add_child(reward_inventory)
		var inventory := VBoxContainer.new()
		inventory.name = "InventoryBoard"
		inventory.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		inventory.add_theme_constant_override("separation", 8)
		reward_inventory.add_child(inventory)
		_render_inventory_board(inventory, run)

func _render_topbar(parent: VBoxContainer, run: Dictionary, map_state: Dictionary, layer_count: int) -> void:
	var topbar := HBoxContainer.new()
	topbar.name = "ExplorationMapTopbar"
	topbar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	topbar.custom_minimum_size = Vector2(0, 64)
	topbar.add_theme_constant_override("separation", 12)
	parent.add_child(topbar)

	var title := VBoxContainer.new()
	title.name = "MapTitlePlacard"
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.add_theme_constant_override("separation", 4)
	topbar.add_child(title)
	_add_label(title, "MapTitle", "探索地图")
	_add_label(
		title,
		"MapSubtitle",
		"第 %d 张地图 · 第 %d / %d 层" % [
			int(map_state.get("mapIndex", 0)) + 1,
			min(layer_count, _map_current_layer(map_state) + 1),
			layer_count,
		]
	)

	var stats := HBoxContainer.new()
	stats.name = "MapRunStats"
	stats.add_theme_constant_override("separation", 8)
	topbar.add_child(stats)
	_add_resource_pill(stats, "胜场", "%d/12" % int(run.get("wins", 0)))
	_add_resource_pill(stats, "容错", "%d/3" % max(0, 3 - int(run.get("losses", 0))))
	_add_resource_pill(stats, "金币", str(int(run.get("gold", 0))))

func _render_layer_markers(parent: VBoxContainer, layer_count: int) -> void:
	var marker_row := HBoxContainer.new()
	marker_row.name = "MapLayerMarkerRow"
	marker_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	marker_row.add_theme_constant_override("separation", 8)
	parent.add_child(marker_row)
	for layer in range(layer_count):
		var marker := Label.new()
		marker.name = "MapLayerMarker_%d" % layer
		marker.text = str(layer + 1)
		marker.custom_minimum_size = Vector2(42, 28)
		marker.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		marker.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		marker.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
		marker_row.add_child(marker)

func _render_drawing_toolbar(parent: VBoxContainer) -> void:
	var toolbar := HBoxContainer.new()
	toolbar.name = "MapDrawingToolbar"
	toolbar.add_theme_constant_override("separation", 6)
	parent.add_child(toolbar)
	for tool_label in ["查看节点", "画笔", "橡皮", "清空草稿"]:
		var tool := _action_button(tool_label, _noop)
		tool.custom_minimum_size = Vector2(92, WebUiTokens.touch_target_height())
		tool.disabled = tool_label == "清空草稿"
		toolbar.add_child(tool)

func _render_map_route(parent: VBoxContainer, map_state: Dictionary) -> void:
	var nodes := _array(map_state, "nodes").duplicate()
	if nodes.is_empty():
		_add_line(parent, "MapRouteEmpty", "路线", "暂无地图节点")
		return
	nodes.sort_custom(func(a, b) -> bool:
		if not a is Dictionary or not b is Dictionary:
			return false
		var left_layer := int((a as Dictionary).get("layer", 0))
		var right_layer := int((b as Dictionary).get("layer", 0))
		if left_layer == right_layer:
			return int((a as Dictionary).get("column", 0)) < int((b as Dictionary).get("column", 0))
		return left_layer < right_layer
	)

	var available := _variant_array(map_state.get("availableNodeIds", []))
	var completed := _variant_array(map_state.get("completedNodeIds", []))
	var current_node_id := str(map_state.get("currentNodeId", ""))
	var board := VBoxContainer.new()
	board.name = "ParchmentMapBoard"
	board.custom_minimum_size = Vector2(0, 360)
	board.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	board.size_flags_vertical = Control.SIZE_EXPAND_FILL
	board.add_theme_constant_override("separation", 6)
	parent.add_child(board)

	var route := VBoxContainer.new()
	route.name = "MapRouteContent"
	route.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	route.size_flags_vertical = Control.SIZE_EXPAND_FILL
	route.add_theme_constant_override("separation", 6)
	board.add_child(route)

	var active_layer := -999
	var row: HBoxContainer = null
	for node_value in nodes:
		if not node_value is Dictionary:
			continue
		var node: Dictionary = node_value
		var layer := int(node.get("layer", 0))
		if layer != active_layer:
			active_layer = layer
			_add_label(route, "MapRouteLayerTitle_%d" % layer, "第 %d 层" % (layer + 1))
			row = HBoxContainer.new()
			row.name = "MapRouteLayerRow_%d" % layer
			row.add_theme_constant_override("separation", 6)
			route.add_child(row)
		if row != null:
			row.add_child(_map_node_button(node, available, completed, current_node_id))

func _map_node_button(node: Dictionary, available: Array, completed: Array, current_node_id: String) -> Button:
	var node_id := str(node.get("id", ""))
	var available_state := available.has(node_id)
	var completed_state := completed.has(node_id)
	var current_state := node_id == current_node_id
	var text := "%s\n%s" % [_map_node_title(node), _map_node_state_text(node, {
		"availableNodeIds": available,
		"completedNodeIds": completed,
		"currentNodeId": current_node_id,
	})]
	var button := _action_button(text, _select_map_node.bind(node_id, available_state))
	button.name = "MapNodeButton_%s" % node_id
	button.custom_minimum_size = Vector2(104, 74)
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button.disabled = action_in_progress
	if current_state:
		button.add_theme_color_override("font_color", WebUiTokens.accent_color())
	elif completed_state:
		button.add_theme_color_override("font_color", WebUiTokens.safe_color())
	return button

func _render_map_detail_panel(parent: VBoxContainer, map_state: Dictionary) -> void:
	var current_node := _map_selected_node(map_state)
	if str(current_node.get("kind", "")) == "EVENT" and not _dict(current_node, "event").is_empty():
		var event_card := _map_side_card(parent, "MapCurrentEvent")
		var event: Dictionary = _dict(current_node, "event")
		_add_label(event_card, "MapCurrentEventTitle", _fallback(str(event.get("title", "")), "事件"))
		_add_label(event_card, "MapCurrentEventDescription", str(event.get("description", "")))
		var event_action := _action_button("处理事件", _resolve_map_event)
		event_action.name = "ResolveMapEventButton"
		event_card.add_child(event_action)

	var pending_reward: Dictionary = _dict(map_state, "pendingReward")
	if not pending_reward.is_empty():
		var reward_card := _map_side_card(parent, "MapCurrentReward")
		var reward_copy := VBoxContainer.new()
		reward_copy.name = "MapRewardCopy"
		reward_copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		reward_copy.add_theme_constant_override("separation", 4)
		reward_card.add_child(reward_copy)
		_add_label(reward_copy, "MapRewardTitle", "待领取掉落")
		_add_label(reward_copy, "MapRewardLabel", _map_reward_label(pending_reward))
		var reward_actions := HBoxContainer.new()
		reward_actions.name = "MapRewardActions"
		reward_actions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		reward_actions.add_theme_constant_override("separation", 8)
		reward_card.add_child(reward_actions)
		var claim_button := _action_button("领取怪物奖励", _claim_monster_reward)
		claim_button.name = "ClaimMonsterRewardButton"
		reward_actions.add_child(claim_button)
		var skip_button := _action_button("跳过怪物奖励", _skip_monster_reward)
		skip_button.name = "SkipMonsterRewardButton"
		reward_actions.add_child(skip_button)

	if not current_node.is_empty():
		var detail := _map_side_card(parent, "MapSelectedNodeDetail")
		var kicker := Label.new()
		kicker.name = "MapNodeDetailKicker"
		kicker.text = "第 %d 层" % (int(current_node.get("layer", 0)) + 1)
		kicker.custom_minimum_size = Vector2(0, 24)
		detail.add_child(kicker)
		_add_label(detail, "MapNodeDetailTitle", _map_node_title(current_node))
		_add_label(detail, "MapNodePreview", _map_node_preview(current_node))
		var monster: Dictionary = _dict(current_node, "monster")
		if not monster.is_empty():
			_add_line(detail, "MapMonsterLine", "对手", "%s · %s" % [str(monster.get("name", "")), _dog_name(str(monster.get("dogType", "")))])
			_render_map_monster_equipment(detail, monster)
			_render_map_reward_preview(detail, _variant_array(monster.get("possibleRewards", [])))
		_add_label(detail, "MapNodeStateCopy", _map_node_state_text(current_node, map_state))

func _render_map_monster_equipment(parent: VBoxContainer, monster: Dictionary) -> void:
	var label := Label.new()
	label.name = "MapMonsterEquipmentTitle"
	label.text = "野怪装备栏"
	label.custom_minimum_size = Vector2(0, 28)
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	parent.add_child(label)
	var grid := GridContainer.new()
	grid.name = "MapMonsterEquipmentGrid"
	grid.columns = 6
	grid.add_theme_constant_override("h_separation", 4)
	grid.add_theme_constant_override("v_separation", 4)
	parent.add_child(grid)
	var items := _variant_array(monster.get("equipment", []))
	for x in range(6):
		var item := _item_at_slot(items, "EQUIPMENT", x)
		var button := _action_button(_slot_label(item, x), _noop)
		button.custom_minimum_size = Vector2(52, 48)
		button.disabled = item.is_empty()
		grid.add_child(button)

func _render_map_reward_preview(parent: VBoxContainer, rewards: Array) -> void:
	var links := VBoxContainer.new()
	links.name = "MapRewardPreviewLinks"
	links.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	links.add_theme_constant_override("separation", 6)
	parent.add_child(links)
	_add_label(links, "MapRewardPreviewKicker", "预期掉落")
	var row := HBoxContainer.new()
	row.name = "MapRewardPreviewRow"
	row.add_theme_constant_override("separation", 6)
	links.add_child(row)
	if rewards.is_empty():
		_add_label(links, "MapRewardPreviewEmpty", "预期掉落：暂无明确装备")
		return
	for reward_value in rewards.slice(0, min(8, rewards.size())):
		if reward_value is Dictionary:
			var reward: Dictionary = reward_value
			var def: Dictionary = _dict(reward, "def")
			var reward_name := _fallback(str(def.get("name", "")), str(reward.get("defId", "")))
			var button := _action_button("%s\n%s" % [_quality_label(str(reward.get("quality", ""))), reward_name], _noop)
			button.name = "MapRewardPreview_%s" % str(reward.get("defId", row.get_child_count()))
			button.custom_minimum_size = Vector2(82, 62)
			button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			row.add_child(button)

func _render_inventory_board(parent: VBoxContainer, run: Dictionary) -> void:
	_render_grid_panel(parent, "EquipmentGridPanel", "装备格", "EQUIPMENT", run)
	_render_grid_panel(parent, "BagGridPanel", "背包", "BAG", run)

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

func _map_side_card(parent: VBoxContainer, node_name: String) -> VBoxContainer:
	var card := VBoxContainer.new()
	card.name = node_name
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.add_theme_constant_override("separation", 6)
	card.add_theme_stylebox_override("normal", WebUiTokens.paper_card_style())
	parent.add_child(card)
	return card

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

func _add_line(parent: Node, node_name: String, label: String, value: String) -> void:
	var line := Label.new()
	line.name = node_name
	line.text = "%s：%s" % [label, value] if not value.is_empty() else label
	line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	line.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(line)

func _add_resource_pill(parent: Node, label: String, value: String) -> void:
	var pill := Label.new()
	pill.name = "MapResourcePill_%s" % label
	pill.text = "%s\n%s" % [label, value]
	pill.custom_minimum_size = Vector2(82, 42)
	pill.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pill.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	pill.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
	parent.add_child(pill)

func _select_map_node(node_id: String, available: bool) -> void:
	if action_in_progress:
		return
	if not available:
		return
	if session != null and session.has_method("select_map_node"):
		action_in_progress = true
		await session.call("select_map_node", node_id)
		action_in_progress = false

func _resolve_map_event() -> void:
	if session != null and session.has_method("resolve_map_event"):
		await session.call("resolve_map_event")

func _claim_monster_reward() -> void:
	if session != null and session.has_method("claim_monster_reward"):
		await session.call("claim_monster_reward")

func _skip_monster_reward() -> void:
	if session != null and session.has_method("skip_monster_reward"):
		await session.call("skip_monster_reward")

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

func _variant_array(value: Variant) -> Array:
	return value if value is Array else []

func _fallback(value: String, fallback: String) -> String:
	return fallback if value.strip_edges().is_empty() else value

func _map_layer_count(map_state: Dictionary) -> int:
	var count := 1
	for node in _array(map_state, "nodes"):
		if node is Dictionary:
			count = max(count, int((node as Dictionary).get("layer", 0)) + 1)
	return count

func _map_current_layer(map_state: Dictionary) -> int:
	var current := 0
	for node_id in _variant_array(map_state.get("completedNodeIds", [])):
		for node in _array(map_state, "nodes"):
			if node is Dictionary and str((node as Dictionary).get("id", "")) == str(node_id):
				current = max(current, int((node as Dictionary).get("layer", 0)) + 1)
	return current

func _map_selected_node(map_state: Dictionary) -> Dictionary:
	var current_node_id := str(map_state.get("currentNodeId", ""))
	if not current_node_id.is_empty():
		var current := _find_map_node(map_state, current_node_id)
		if not current.is_empty():
			return current
	for node_id in _variant_array(map_state.get("availableNodeIds", [])):
		var available := _find_map_node(map_state, str(node_id))
		if not available.is_empty():
			return available
	for node in _array(map_state, "nodes"):
		if node is Dictionary:
			return node
	return {}

func _find_map_node(map_state: Dictionary, node_id: String) -> Dictionary:
	for node in _array(map_state, "nodes"):
		if node is Dictionary and str((node as Dictionary).get("id", "")) == node_id:
			return node
	return {}

func _map_node_state_text(node: Dictionary, map_state: Dictionary) -> String:
	var node_id := str(node.get("id", ""))
	if _variant_array(map_state.get("availableNodeIds", [])).has(node_id):
		return "可进入"
	if str(map_state.get("currentNodeId", "")) == node_id:
		return "当前处理中"
	if _variant_array(map_state.get("completedNodeIds", [])).has(node_id):
		return "已完成"
	return "路线未解锁"

func _map_node_title(node: Dictionary) -> String:
	match str(node.get("kind", "")):
		"PLAYER_BATTLE":
			return "玩家战"
		"MONSTER_BATTLE":
			var monster: Dictionary = _dict(node, "monster")
			return _fallback(str(monster.get("name", "")), "野怪")
		"SHOP_FIXED":
			return "固定商店"
		"SHOP_UNKNOWN":
			return "? 商店"
		"SHOP_EQUIPMENT":
			return "装备商店"
		"REST":
			return "休息点"
		"EVENT":
			var event: Dictionary = _dict(node, "event")
			return _fallback(str(event.get("title", "")), "事件")
		_:
			return str(node.get("kind", "节点"))

func _map_node_preview(node: Dictionary) -> String:
	match str(node.get("kind", "")):
		"MONSTER_BATTLE":
			var monster: Dictionary = _dict(node, "monster")
			return "%s · 第 %d 回合" % [_dog_name(str(monster.get("dogType", ""))), int(monster.get("round", int(node.get("layer", 0)) + 1))]
		"SHOP_FIXED", "SHOP_UNKNOWN", "SHOP_EQUIPMENT":
			return _shop_name(str(node.get("shopType", node.get("kind", ""))))
		"REST":
			return "恢复并调整装备"
		"EVENT":
			var event: Dictionary = _dict(node, "event")
			return str(event.get("description", "处理地图事件"))
		_:
			return "选择路线节点"

func _map_reward_label(reward: Dictionary) -> String:
	var def: Dictionary = _dict(reward, "def")
	var reward_name := _fallback(str(def.get("name", "")), str(reward.get("defId", "")))
	return "%s · %s" % [reward_name, _quality_label(str(reward.get("quality", "")))]

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

func _shop_name(shop_type: String) -> String:
	match shop_type:
		"SHOP_FIXED", "GENERAL":
			return "固定商店"
		"SHOP_EQUIPMENT", "EQUIPMENT":
			return "装备商店"
		"SHOP_UNKNOWN":
			return "未知商店"
		_:
			return _fallback(shop_type, "商店")

func _item_at_slot(items: Array, area: String, x: int) -> Dictionary:
	for item in items:
		if item is Dictionary and str((item as Dictionary).get("area", "")) == area and int((item as Dictionary).get("x", 0)) == x:
			return item
	return {}

func _slot_label(item: Dictionary, x: int) -> String:
	if item.is_empty():
		return str(x + 1)
	var def: Dictionary = _dict(item, "def")
	var name := _fallback(str(def.get("name", "")), str(item.get("defId", item.get("id", ""))))
	return "%d\n%s\n%s" % [x + 1, _quality_label(str(item.get("quality", ""))), name]
