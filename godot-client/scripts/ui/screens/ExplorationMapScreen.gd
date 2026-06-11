extends ShellBackedWebScreen

const MAP_NODE_ICONS := {
	"PLAYER_BATTLE": "res://assets/map-icons/player-battle.webp",
	"MONSTER_BATTLE": "res://assets/map-icons/monster-battle.webp",
	"SHOP_FIXED": "res://assets/map-icons/shop-fixed.webp",
	"SHOP_UNKNOWN": "res://assets/map-icons/shop-unknown.webp",
	"SHOP_EQUIPMENT": "res://assets/map-icons/shop-equipment.webp",
	"REST": "res://assets/map-icons/rest.webp",
	"EVENT": "res://assets/map-icons/event.webp",
}

var action_in_progress := false
var selected_item_id := ""
var selected_relic_id := ""
var selected_map_node_id := ""
var selected_map_reward_key := ""
var selected_monster_equipment_item: Dictionary = {}
var drawing_tool := "inspect"

func _render_shell_content() -> void:
	_render()

func _render() -> void:
	var content := content_container()
	for child in content.get_children():
		content.remove_child(child)
		child.queue_free()

	var scroll := ScrollContainer.new()
	scroll.name = "ExplorationMapScroll"
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	content.add_child(scroll)

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
		_render_selected_item_tip(inventory, run)
		_render_selected_relic_tip(inventory, run)

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
		var tool_id: String = str(["inspect", "brush", "eraser", "clear"][toolbar.get_child_count()])
		var tool := _action_button(tool_label, _select_drawing_tool.bind(tool_id))
		tool.name = "MapDrawingTool_%s" % tool_id
		tool.custom_minimum_size = Vector2(92, WebUiTokens.touch_target_height())
		tool.toggle_mode = tool_id != "clear"
		tool.button_pressed = tool_id == drawing_tool
		tool.disabled = tool_label == "清空草稿"
		toolbar.add_child(tool)

func _select_drawing_tool(tool_id: String) -> void:
	if tool_id == "clear":
		return
	drawing_tool = tool_id
	_render()

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
	var button := _action_button("", _inspect_map_node.bind(node_id))
	button.name = "MapNodeButton_%s" % node_id
	button.custom_minimum_size = Vector2(104, 74)
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button.disabled = action_in_progress
	if current_state:
		button.add_theme_color_override("font_color", WebUiTokens.accent_color())
	elif completed_state:
		button.add_theme_color_override("font_color", WebUiTokens.safe_color())
	var content := VBoxContainer.new()
	content.name = "MapNodeContent_%s" % node_id
	content.set_anchors_preset(Control.PRESET_FULL_RECT)
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.alignment = BoxContainer.ALIGNMENT_CENTER
	content.add_theme_constant_override("separation", 4)
	button.add_child(content)

	var sticker := PanelContainer.new()
	sticker.name = "MapNodeSticker_%s" % node_id
	sticker.custom_minimum_size = Vector2(42, 42)
	sticker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	sticker.add_theme_stylebox_override("panel", WebUiTokens.resource_pill_style())
	content.add_child(sticker)

	var icon := TextureRect.new()
	icon.name = "MapNodeIcon_%s" % node_id
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	icon.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.texture = _map_node_icon_texture(str(node.get("kind", "")))
	sticker.add_child(icon)

	var title := Label.new()
	title.name = "MapNodeTitle_%s" % node_id
	title.text = _map_node_title(node)
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_child(title)
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
		if _variant_array(map_state.get("availableNodeIds", [])).has(str(current_node.get("id", ""))):
			var enter_button := _action_button("前往", _enter_map_node.bind(str(current_node.get("id", ""))))
			enter_button.name = "MapEnterActionButton"
			detail.add_child(enter_button)
		_add_label(detail, "MapNodeStateCopy", _map_node_state_text(current_node, map_state))
	_render_selected_monster_equipment_tip(parent)
	_render_selected_map_reward_tip(parent, map_state)

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
		var button := _action_button(_slot_label(item, x), _inspect_monster_equipment_item.bind(item))
		button.name = "MapMonsterEquipmentButton_%s" % str(item.get("id", "slot-%d" % x))
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
			var button := _action_button("%s\n%s" % [_quality_label(str(reward.get("quality", ""))), reward_name], _inspect_map_reward.bind(str(reward.get("defId", "")), str(reward.get("quality", ""))))
			button.name = "MapRewardPreview_%s" % str(reward.get("defId", row.get_child_count()))
			button.custom_minimum_size = Vector2(82, 62)
			button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			row.add_child(button)

func _render_selected_map_reward_tip(parent: VBoxContainer, map_state: Dictionary) -> void:
	var reward := _selected_map_reward(map_state)
	if reward.is_empty():
		return
	var def: Dictionary = _dict(reward, "def")
	var title := _fallback(str(def.get("name", "")), str(reward.get("defId", "")))
	var floating_tip := PanelContainer.new()
	floating_tip.name = "FloatingTip"
	floating_tip.custom_minimum_size = Vector2(0, 220)
	floating_tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	floating_tip.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(floating_tip)

	var tip := VBoxContainer.new()
	tip.name = "MapRewardTip"
	tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tip.add_theme_constant_override("separation", 7)
	floating_tip.add_child(tip)

	var tags := HBoxContainer.new()
	tags.name = "MapRewardTipTags"
	tags.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tags.add_theme_constant_override("separation", 6)
	tip.add_child(tags)
	_add_label(tags, "MapRewardTipSizeTag", "%s\u683c" % _fallback(_detail_size_text(def), "?"), HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(tags, "MapRewardTipQualityTag", _quality_label(str(reward.get("quality", ""))), HORIZONTAL_ALIGNMENT_CENTER)

	var identity := HBoxContainer.new()
	identity.name = "MapRewardTipIdentity"
	identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity.add_theme_constant_override("separation", 8)
	tip.add_child(identity)
	var art := Label.new()
	art.name = "MapRewardTipArt"
	art.text = ""
	art.custom_minimum_size = Vector2(54, 54)
	art.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
	identity.add_child(art)
	_add_label(identity, "MapRewardTipTitle", title)

	var size_preview := HBoxContainer.new()
	size_preview.name = "MapRewardTipSizePreview"
	size_preview.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_preview.add_theme_constant_override("separation", 8)
	tip.add_child(size_preview)
	_add_label(size_preview, "MapRewardTipGridPreview", _shop_size_preview_text(def))
	_add_label(size_preview, "MapRewardTipSizeText", "\u5360\u7528 %s \u683c" % _fallback(_detail_size_text(def), "?"))

	var trigger := _trigger_dice_text(def)
	_add_label(tip, "MapRewardTipDice", "\u89e6\u53d1\u70b9\u6570 %s" % trigger if not trigger.is_empty() else "\u89e6\u53d1\u70b9\u6570 -")
	var description := _fallback(str(def.get("description", "")), str(reward.get("description", "")))
	_add_label(tip, "MapRewardTipDescription", description)
	_add_label(tip, "MapRewardTipPrice", "\u5730\u56fe\u6389\u843d\u9884\u89c8")

	var actions := HBoxContainer.new()
	actions.name = "MapRewardTipActions"
	actions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tip.add_child(actions)
	var close_button := _action_button("\u5173\u95ed", _close_map_reward_tip)
	close_button.name = "CloseMapRewardTipButton"
	actions.add_child(close_button)

func _render_selected_monster_equipment_tip(parent: VBoxContainer) -> void:
	if selected_monster_equipment_item.is_empty():
		return
	var item := selected_monster_equipment_item
	var def: Dictionary = _dict(item, "def")
	var title := _fallback(str(def.get("name", "")), str(item.get("defId", item.get("id", ""))))
	var modal := PanelContainer.new()
	modal.name = "MapMonsterEquipmentPreviewModal"
	modal.custom_minimum_size = Vector2(0, 260)
	modal.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	modal.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(modal)

	var sheet := VBoxContainer.new()
	sheet.name = "MapMonsterEquipmentSheet"
	sheet.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sheet.add_theme_constant_override("separation", 8)
	modal.add_child(sheet)
	_add_label(sheet, "MapMonsterEquipmentHeader", "\u91ce\u602a\u88c5\u5907\u680f\u9884\u89c8")
	_add_label(sheet, "MapMonsterEquipmentPreview", "\u70b9\u51fb\u88c5\u5907\u67e5\u770b\u8be6\u60c5")

	var floating_tip := PanelContainer.new()
	floating_tip.name = "FloatingTip"
	floating_tip.custom_minimum_size = Vector2(0, 220)
	floating_tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	floating_tip.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	sheet.add_child(floating_tip)

	var tip := VBoxContainer.new()
	tip.name = "MapMonsterItemTip"
	tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tip.add_theme_constant_override("separation", 7)
	floating_tip.add_child(tip)
	var tags := HBoxContainer.new()
	tags.name = "MapMonsterItemTipTags"
	tags.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tags.add_theme_constant_override("separation", 6)
	tip.add_child(tags)
	_add_label(tags, "MapMonsterItemTipSizeTag", "%s\u683c" % _fallback(_detail_size_text(def), "?"), HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(tags, "MapMonsterItemTipQualityTag", _quality_label(str(item.get("quality", ""))), HORIZONTAL_ALIGNMENT_CENTER)

	var identity := HBoxContainer.new()
	identity.name = "MapMonsterItemTipIdentity"
	identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity.add_theme_constant_override("separation", 8)
	tip.add_child(identity)
	var art := Label.new()
	art.name = "MapMonsterItemTipArt"
	art.text = ""
	art.custom_minimum_size = Vector2(54, 54)
	art.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
	identity.add_child(art)
	_add_label(identity, "MapMonsterItemTipTitle", title)

	var size_preview := HBoxContainer.new()
	size_preview.name = "MapMonsterItemTipSizePreview"
	size_preview.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_preview.add_theme_constant_override("separation", 8)
	tip.add_child(size_preview)
	_add_label(size_preview, "MapMonsterItemTipGridPreview", _shop_size_preview_text(def))
	_add_label(size_preview, "MapMonsterItemTipSizeText", "\u5360\u7528 %s \u683c" % _fallback(_detail_size_text(def), "?"))
	var trigger := _trigger_dice_text(def)
	_add_label(tip, "MapMonsterItemTipDice", "\u89e6\u53d1\u70b9\u6570 %s" % trigger if not trigger.is_empty() else "\u89e6\u53d1\u70b9\u6570 -")
	var description := _fallback(str(def.get("description", "")), str(item.get("description", "")))
	_add_label(tip, "MapMonsterItemTipDescription", description)
	var actions := HBoxContainer.new()
	actions.name = "MapMonsterItemTipActions"
	actions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tip.add_child(actions)
	var close_button := _action_button("\u5173\u95ed", _close_monster_equipment_tip)
	close_button.name = "CloseMapMonsterItemTipButton"
	actions.add_child(close_button)

func _render_inventory_board(parent: VBoxContainer, run: Dictionary) -> void:
	_render_grid_panel(parent, "EquipmentGridPanel", "装备格", "EQUIPMENT", run)
	var bag_relic_row := HBoxContainer.new()
	bag_relic_row.name = "BagRelicRow"
	bag_relic_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bag_relic_row.add_theme_constant_override("separation", 10)
	parent.add_child(bag_relic_row)
	_render_relic_rail(bag_relic_row, run)
	_render_grid_panel(bag_relic_row, "BagGridPanel", "背包", "BAG", run)

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
		var relic_id := str(relic.get("id", relic.get("relicId", "")))
		var button := _action_button(_fallback(str(def.get("name", "")), "遗物槽 %d" % (slot + 1)), _select_relic.bind(relic_id) if not relic_id.is_empty() else _noop)
		button.name = "RelicSlot_%d" % slot
		button.custom_minimum_size = Vector2(74, 42)
		button.disabled = relic.is_empty()
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
	tip.name = "MapItemTip"
	tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tip.add_theme_constant_override("separation", 7)
	floating_tip.add_child(tip)

	var tags := HBoxContainer.new()
	tags.name = "MapItemTipTags"
	tags.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tags.add_theme_constant_override("separation", 6)
	tip.add_child(tags)
	_add_label(tags, "MapItemTipSizeTag", "%s格" % _fallback(_detail_size_text(def), "?"), HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(tags, "MapItemTipQualityTag", _quality_label(str(item.get("quality", ""))), HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(tags, "MapItemTipAreaTag", _area_label(str(item.get("area", ""))), HORIZONTAL_ALIGNMENT_CENTER)

	var identity := HBoxContainer.new()
	identity.name = "MapItemTipIdentity"
	identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity.add_theme_constant_override("separation", 8)
	tip.add_child(identity)
	var art := Label.new()
	art.name = "MapItemTipArt"
	art.text = ""
	art.custom_minimum_size = Vector2(54, 54)
	art.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
	identity.add_child(art)
	_add_label(identity, "MapItemTipTitle", title)

	var size_preview := HBoxContainer.new()
	size_preview.name = "MapItemTipSizePreview"
	size_preview.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_preview.add_theme_constant_override("separation", 8)
	tip.add_child(size_preview)
	_add_label(size_preview, "MapItemTipGridPreview", _shop_size_preview_text(def))
	_add_label(size_preview, "MapItemTipSizeText", "占用 %s 格" % _fallback(_detail_size_text(def), "?"))

	var trigger := _trigger_dice_text(def)
	if not trigger.is_empty():
		_add_label(tip, "MapItemTipDice", "触发点数 %s" % trigger)
	else:
		_add_label(tip, "MapItemTipDice", "触发点数 -")

	var description := _fallback(str(def.get("description", "")), str(item.get("description", "")))
	_add_label(tip, "MapItemTipDescription", description)

	var actions := HBoxContainer.new()
	actions.name = "MapItemTipActions"
	actions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_theme_constant_override("separation", 8)
	tip.add_child(actions)
	var upgrade_button := _action_button("升级", _upgrade_selected_item)
	upgrade_button.name = "UpgradeItemButton"
	upgrade_button.disabled = action_in_progress or not _can_upgrade_selected_item(run)
	actions.add_child(upgrade_button)
	var close_button := _action_button("关闭", _close_item_tip)
	close_button.name = "CloseItemTipButton"
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
	tip.name = "MapRelicTip"
	tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tip.add_theme_constant_override("separation", 7)
	floating_tip.add_child(tip)

	var tags := HBoxContainer.new()
	tags.name = "MapRelicTipTags"
	tags.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tags.add_theme_constant_override("separation", 6)
	tip.add_child(tags)
	_add_label(tags, "MapRelicTipQualityTag", _quality_label(str(relic.get("quality", ""))), HORIZONTAL_ALIGNMENT_CENTER)
	for tag in _array(def, "tags"):
		_add_label(tags, "MapRelicTipTag_%s" % _node_key(str(tag)), str(tag), HORIZONTAL_ALIGNMENT_CENTER)

	var identity := HBoxContainer.new()
	identity.name = "MapRelicTipIdentity"
	identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity.add_theme_constant_override("separation", 8)
	tip.add_child(identity)
	var icon := TextureRect.new()
	icon.name = "MapRelicTipIcon"
	icon.texture = _relic_texture(relic)
	icon.custom_minimum_size = Vector2(44, 44)
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	identity.add_child(icon)
	var identity_text := VBoxContainer.new()
	identity_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity.add_child(identity_text)
	_add_label(identity_text, "MapRelicTipTitle", title)
	_add_label(identity_text, "MapRelicTipId", str(relic.get("relicId", relic.get("id", ""))))

	_add_label(tip, "MapRelicTipDescription", _fallback(str(def.get("description", "")), str(relic.get("description", ""))))
	var effect := str(def.get("effect", ""))
	if not effect.is_empty():
		_add_label(tip, "MapRelicTipEffect", effect)

	var actions := HBoxContainer.new()
	actions.name = "MapRelicTipActions"
	actions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_theme_constant_override("separation", 8)
	tip.add_child(actions)
	var close_button := _action_button("\u5173\u95ed", _close_relic_tip)
	close_button.name = "CloseMapRelicTipButton"
	actions.add_child(close_button)

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

func _inspect_map_node(node_id: String) -> void:
	selected_map_node_id = node_id
	selected_item_id = ""
	selected_relic_id = ""
	selected_map_reward_key = ""
	selected_monster_equipment_item = {}
	_render()

func _inspect_map_reward(def_id: String, quality: String) -> void:
	selected_map_reward_key = "%s|%s" % [def_id, quality]
	selected_item_id = ""
	selected_relic_id = ""
	selected_monster_equipment_item = {}
	_render()

func _close_map_reward_tip() -> void:
	selected_map_reward_key = ""
	_render()

func _inspect_monster_equipment_item(item: Dictionary) -> void:
	if item.is_empty():
		return
	selected_monster_equipment_item = item.duplicate(true)
	selected_item_id = ""
	selected_relic_id = ""
	selected_map_reward_key = ""
	_render()

func _close_monster_equipment_tip() -> void:
	selected_monster_equipment_item = {}
	_render()

func _enter_map_node(node_id: String) -> void:
	if action_in_progress:
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

func _select_item(item_id: String) -> void:
	selected_item_id = item_id
	selected_relic_id = ""
	_render()

func _close_item_tip() -> void:
	selected_item_id = ""
	_render()

func _select_relic(relic_id: String) -> void:
	selected_relic_id = "" if selected_relic_id == relic_id else relic_id
	selected_item_id = ""
	selected_map_reward_key = ""
	selected_monster_equipment_item = {}
	_render()

func _close_relic_tip() -> void:
	selected_relic_id = ""
	_render()

func _upgrade_selected_item() -> void:
	if selected_item_id.is_empty() or action_in_progress:
		return
	if session != null and session.has_method("upgrade_item"):
		var item_id := selected_item_id
		action_in_progress = true
		await session.call("upgrade_item", item_id)
		selected_item_id = ""
		action_in_progress = false
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

func _variant_array(value: Variant) -> Array:
	return value if value is Array else []

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

func _selected_map_reward(map_state: Dictionary) -> Dictionary:
	if selected_map_reward_key.is_empty():
		return {}
	for node_value in _array(map_state, "nodes"):
		if not node_value is Dictionary:
			continue
		var monster: Dictionary = _dict(node_value, "monster")
		for reward_value in _variant_array(monster.get("possibleRewards", [])):
			if reward_value is Dictionary:
				var reward: Dictionary = reward_value
				var reward_key := "%s|%s" % [str(reward.get("defId", "")), str(reward.get("quality", ""))]
				if reward_key == selected_map_reward_key:
					return reward
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
	if not selected_map_node_id.is_empty():
		var selected := _find_map_node(map_state, selected_map_node_id)
		if not selected.is_empty():
			return selected
		selected_map_node_id = ""
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

func _map_node_icon_texture(kind: String) -> Texture2D:
	var path := str(MAP_NODE_ICONS.get(kind, ""))
	if path.is_empty():
		return null
	return load(path) as Texture2D

func _relic_texture(relic: Dictionary) -> Texture2D:
	var def: Dictionary = _dict(relic, "def")
	var asset_id := str(def.get("icon", relic.get("relicId", relic.get("id", ""))))
	return _sticker_texture(asset_id)

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

func _node_key(value: String) -> String:
	var key := value.strip_edges().replace(" ", "_").replace("-", "_").replace(".", "_")
	return "empty" if key.is_empty() else key

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

func _area_label(area: String) -> String:
	match area:
		"EQUIPMENT":
			return "装备格"
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
