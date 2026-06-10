extends BaseWebScreen

const WebUiTokens := preload("res://scripts/ui/web/WebUiTokens.gd")

var history_data: Dictionary = {}
var active_tab := "ALL"
var selected_run_id := ""
var content_box: VBoxContainer
var selected_detail_box: VBoxContainer

func _ready() -> void:
	_build_screen()
	_apply_payload_data()
	_render()

func _on_payload_changed() -> void:
	_apply_payload_data()
	_render()

func _build_screen() -> void:
	var panel := PanelContainer.new()
	panel.name = "AccountHistoryPanel"
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel.offset_left = 18
	panel.offset_top = 18
	panel.offset_right = -18
	panel.offset_bottom = -18
	panel.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	add_child(panel)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 18)
	margin.add_theme_constant_override("margin_top", 18)
	margin.add_theme_constant_override("margin_right", 18)
	margin.add_theme_constant_override("margin_bottom", 18)
	panel.add_child(margin)

	content_box = VBoxContainer.new()
	content_box.name = "AccountHistoryScreen"
	content_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content_box.add_theme_constant_override("separation", 14)
	margin.add_child(content_box)

func _apply_payload_data() -> void:
	var value = payload.get("history", {})
	if value is Dictionary:
		history_data = value.duplicate(true)

func _render() -> void:
	if content_box == null:
		return
	for child in content_box.get_children():
		content_box.remove_child(child)
		child.queue_free()
	_render_header()
	_render_tabs()
	_render_layout()

func _render_header() -> void:
	var header := GridContainer.new()
	header.name = "HistoryPageHeader"
	header.columns = 3
	header.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_theme_constant_override("h_separation", 14)
	content_box.add_child(header)

	var title_box := VBoxContainer.new()
	title_box.name = "HistoryHeaderText"
	title_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_box.add_theme_constant_override("separation", 2)
	header.add_child(title_box)
	_add_label(title_box, "HistoryHeaderEyebrow", "个人战绩")
	_add_label(title_box, "HistoryHeaderTitle", "%d胜 %d败" % [int(history_data.get("totalWins", 0)), int(history_data.get("totalLosses", 0))])
	_add_label(title_box, "HistoryHeaderMeta", "共 %d 局 · 进行中 %d 局 · 已完成 %d 局" % [int(history_data.get("totalRuns", 0)), int(history_data.get("activeRuns", 0)), int(history_data.get("completedRuns", 0))])

	var best_run: Dictionary = _dict(history_data, "bestRun")
	var best := VBoxContainer.new()
	best.name = "HistoryPageBest"
	best.custom_minimum_size = Vector2(220, 70)
	best.add_theme_constant_override("separation", 4)
	header.add_child(best)
	_add_label(best, "HistoryBestLabel", "最佳成绩", HORIZONTAL_ALIGNMENT_RIGHT)
	var best_text := "暂无对局"
	if not best_run.is_empty():
		best_text = "%s · %d胜 %d败" % [_dog_name(str(best_run.get("dogType", ""))), int(best_run.get("wins", 0)), int(best_run.get("losses", 0))]
	_add_label(best, "HistoryBestRun", best_text, HORIZONTAL_ALIGNMENT_RIGHT)

	var close_button := _plain_button("×", 48)
	close_button.name = "HistoryCloseButton"
	close_button.disabled = true
	header.add_child(close_button)

func _render_tabs() -> void:
	var tabs := HBoxContainer.new()
	tabs.name = "HistoryModeTabs"
	tabs.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tabs.add_theme_constant_override("separation", 8)
	content_box.add_child(tabs)
	for tab in _history_mode_tabs():
		var tab_id := str(tab.get("id", "ALL"))
		var label := "%s  %d" % [str(tab.get("label", "")), _tab_count(tab_id)]
		var button := _plain_button(label, 132)
		button.name = "HistoryTab_%s" % tab_id
		button.toggle_mode = true
		button.button_pressed = active_tab == tab_id
		button.pressed.connect(_select_tab.bind(tab_id))
		tabs.add_child(button)

func _render_layout() -> void:
	var layout := GridContainer.new()
	layout.name = "HistoryDetailLayout"
	layout.columns = 2
	layout.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	layout.size_flags_vertical = Control.SIZE_EXPAND_FILL
	layout.add_theme_constant_override("h_separation", 14)
	layout.add_theme_constant_override("v_separation", 14)
	content_box.add_child(layout)
	_render_run_browser(layout)
	_render_selected_run(layout)

func _render_run_browser(parent: Node) -> void:
	var browser_panel := PanelContainer.new()
	browser_panel.name = "HistoryRunBrowserFrame"
	browser_panel.custom_minimum_size = Vector2(320, 420)
	browser_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	browser_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	browser_panel.add_theme_stylebox_override("panel", _soft_panel_style())
	parent.add_child(browser_panel)

	var browser := VBoxContainer.new()
	browser.name = "HistoryRunBrowser"
	browser.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	browser.size_flags_vertical = Control.SIZE_EXPAND_FILL
	browser.add_theme_constant_override("separation", 8)
	browser_panel.add_child(browser)

	var runs := _runs_for_active_tab()
	if runs.is_empty():
		_render_empty_state(browser, "HistoryRunBrowserEmpty", "%s暂无记录" % _tab_label(active_tab), "这个页签已经预留，后续模式接入历史数据后会显示详情。")
		return
	if selected_run_id.is_empty() or _selected_run(runs).is_empty():
		var first_run: Dictionary = runs[0]
		selected_run_id = str(first_run.get("id", ""))
	for run_value in runs:
		if run_value is Dictionary:
			_render_history_row(browser, run_value)

func _render_history_row(parent: VBoxContainer, entry: Dictionary) -> void:
	var run_id := str(entry.get("id", ""))
	var button := Button.new()
	button.name = "HistoryDetailRow_%s" % run_id
	button.text = "%s\n%d胜 %d败\n%s · 第 %d 回合 · 装备 %d" % [
		_dog_name(str(entry.get("dogType", ""))),
		int(entry.get("wins", 0)),
		int(entry.get("losses", 0)),
		_run_status_text(str(entry.get("status", ""))),
		int(entry.get("round", 0)),
		_array(entry, "items").size(),
	]
	button.custom_minimum_size = Vector2(0, 82)
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.add_theme_stylebox_override("normal", _selected_row_style(run_id == selected_run_id))
	button.add_theme_stylebox_override("hover", WebUiTokens.handdrawn_button_hover_style())
	button.pressed.connect(_select_run.bind(run_id))
	parent.add_child(button)

func _render_selected_run(parent: Node) -> void:
	var detail_panel := PanelContainer.new()
	detail_panel.name = "HistorySelectedRunFrame"
	detail_panel.custom_minimum_size = Vector2(560, 420)
	detail_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	detail_panel.add_theme_stylebox_override("panel", _soft_panel_style())
	parent.add_child(detail_panel)

	selected_detail_box = VBoxContainer.new()
	selected_detail_box.name = "HistorySelectedRun"
	selected_detail_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	selected_detail_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	selected_detail_box.add_theme_constant_override("separation", 12)
	detail_panel.add_child(selected_detail_box)

	var runs := _runs_for_active_tab()
	var selected := _selected_run(runs)
	if selected.is_empty():
		_render_empty_state(selected_detail_box, "HistorySelectedEmpty", "没有可查看的对局", "开始或完成一局后，会在这里显示装备和遗物详情。")
		return
	_render_run_details(selected_detail_box, selected)

func _render_run_details(parent: VBoxContainer, entry: Dictionary) -> void:
	var details := VBoxContainer.new()
	details.name = "HistoryRunDetails"
	details.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	details.add_theme_constant_override("separation", 12)
	parent.add_child(details)

	var title := VBoxContainer.new()
	title.name = "HistoryRunTitle"
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.add_theme_constant_override("separation", 3)
	details.add_child(title)
	_add_label(title, "HistoryRunMode", _tab_label(str(entry.get("mode", "ALL"))))
	_add_label(title, "HistoryRunName", "%s · %d胜 %d败" % [_dog_name(str(entry.get("dogType", ""))), int(entry.get("wins", 0)), int(entry.get("losses", 0))])
	_add_label(title, "HistoryRunMeta", "%s · 第 %d 回合 · %s" % [_run_status_text(str(entry.get("status", ""))), int(entry.get("round", 0)), str(entry.get("updatedAt", ""))])

	_render_equipment_preview(details, entry)
	_render_inventory_summary(details, entry)

func _render_equipment_preview(parent: VBoxContainer, entry: Dictionary) -> void:
	var preview := VBoxContainer.new()
	preview.name = "HistoryEquipmentPreview"
	preview.custom_minimum_size = Vector2(0, 132)
	preview.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	preview.add_theme_constant_override("separation", 8)
	parent.add_child(preview)
	var title := HBoxContainer.new()
	title.name = "HistoryEquipmentTitle"
	title.add_theme_constant_override("separation", 8)
	preview.add_child(title)
	_add_label(title, "HistoryEquipmentLabel", "历史装备栏")
	_add_label(title, "HistoryEquipmentHint", "点击查看装备", HORIZONTAL_ALIGNMENT_RIGHT)

	var equipment := _equipment_items(entry)
	var slots: int = max(6, _equipment_slot_count(_array(entry, "relics")))
	var slot_grid := GridContainer.new()
	slot_grid.name = "HistoryEquipmentSlots"
	slot_grid.columns = slots
	slot_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slot_grid.add_theme_constant_override("h_separation", 6)
	preview.add_child(slot_grid)
	for index in range(slots):
		var slot := PanelContainer.new()
		slot.name = "HistoryEquipmentSlot_%d" % index
		slot.custom_minimum_size = Vector2(58, 82)
		slot.add_theme_stylebox_override("panel", WebUiTokens.slot_style(false, false))
		slot_grid.add_child(slot)
		var item := _item_at_slot(equipment, index)
		if not item.is_empty():
			var label := _add_label(slot, "HistoryEquipmentItem_%s" % str(item.get("id", index)), _item_label(item), HORIZONTAL_ALIGNMENT_CENTER)
			label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER

func _render_inventory_summary(parent: VBoxContainer, entry: Dictionary) -> void:
	var summary := VBoxContainer.new()
	summary.name = "HistoryInventorySummary"
	summary.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	summary.add_theme_constant_override("separation", 6)
	parent.add_child(summary)
	var relics := _array(entry, "relics")
	var bag := _bag_items(entry)
	var relic_list := HBoxContainer.new()
	relic_list.name = "HistoryRelicList"
	relic_list.add_theme_constant_override("separation", 6)
	summary.add_child(relic_list)
	if relics.is_empty():
		_add_label(relic_list, "HistoryRelicEmpty", "暂无遗物")
	else:
		for index in range(relics.size()):
			var relic_value = relics[index]
			if relic_value is Dictionary:
				_add_label(relic_list, "HistoryRelic_%d" % index, str((relic_value as Dictionary).get("name", "遗物")))
	_add_label(summary, "HistoryInventoryText", "遗物 %d 个 · 背包物品 %d 个" % [relics.size(), bag.size()])

func _render_empty_state(parent: Node, node_name: String, title: String, detail: String) -> void:
	var box := VBoxContainer.new()
	box.name = node_name
	box.custom_minimum_size = Vector2(0, 112)
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_theme_constant_override("separation", 6)
	parent.add_child(box)
	_add_label(box, "%sTitle" % node_name, title)
	_add_label(box, "%sDetail" % node_name, detail)

func _select_tab(tab_id: String) -> void:
	active_tab = tab_id
	selected_run_id = ""
	_render()

func _select_run(run_id: String) -> void:
	selected_run_id = run_id
	_render()

func _runs_for_active_tab() -> Array:
	var runs := _array(history_data, "recentRuns")
	if active_tab == "ALL":
		return runs
	var filtered: Array = []
	for entry_value in runs:
		if entry_value is Dictionary and str((entry_value as Dictionary).get("mode", "")) == active_tab:
			filtered.append(entry_value)
	return filtered

func _selected_run(runs: Array) -> Dictionary:
	for entry_value in runs:
		if entry_value is Dictionary and str((entry_value as Dictionary).get("id", "")) == selected_run_id:
			return entry_value
	if runs.size() > 0 and runs[0] is Dictionary:
		return runs[0]
	return {}

func _history_mode_tabs() -> Array:
	return [
		{"id": "ALL", "label": "全部"},
		{"id": "CASUAL", "label": "休闲模式"},
		{"id": "DOGFIGHT", "label": "斗狗模式"},
		{"id": "PEAK", "label": "巅峰模式"},
		{"id": "LADDER", "label": "天梯模式"},
	]

func _tab_count(tab_id: String) -> int:
	if tab_id == "ALL":
		return _array(history_data, "recentRuns").size()
	var count := 0
	for entry_value in _array(history_data, "recentRuns"):
		if entry_value is Dictionary and str((entry_value as Dictionary).get("mode", "")) == tab_id:
			count += 1
	return count

func _tab_label(tab_id: String) -> String:
	for tab in _history_mode_tabs():
		if str(tab.get("id", "")) == tab_id:
			return str(tab.get("label", tab_id))
	return tab_id

func _run_status_text(status: String) -> String:
	match status:
		"ACTIVE":
			return "进行中"
		"COMPLETE":
			return "已完成"
		"ABANDONED":
			return "已换狗"
		_:
			return "已记录"

func _equipment_items(entry: Dictionary) -> Array:
	var items := []
	for item_value in _array(entry, "items"):
		if item_value is Dictionary and str((item_value as Dictionary).get("area", "")) == "EQUIPMENT":
			items.append(item_value)
	return items

func _bag_items(entry: Dictionary) -> Array:
	var items := []
	for item_value in _array(entry, "items"):
		if item_value is Dictionary and str((item_value as Dictionary).get("area", "")) == "BAG":
			items.append(item_value)
	return items

func _item_at_slot(items: Array, slot_index: int) -> Dictionary:
	for item_value in items:
		if item_value is Dictionary and int((item_value as Dictionary).get("x", 0)) == slot_index:
			return item_value
	return {}

func _item_label(item: Dictionary) -> String:
	var label := str(item.get("name", ""))
	if label.is_empty():
		label = str(item.get("defId", "装备"))
	return "%s\n%s" % [label, _quality_label(str(item.get("quality", "")))]

func _equipment_slot_count(relics: Array) -> int:
	var bonus := 0
	for relic_value in relics:
		if relic_value is Dictionary and str((relic_value as Dictionary).get("kind", "")) == "BAG_SLOT":
			bonus += int((relic_value as Dictionary).get("amount", 0))
	return 6 + bonus

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

func _dog_name(dog_type: String) -> String:
	match dog_type:
		"SHIBA":
			return "柴犬"
		"SAMOYED":
			return "萨摩耶"
		"MUTT":
			return "土狗"
		"BULLY":
			return "恶霸犬"
		"EMPEROR":
			return "狗皇帝"
		"FROG":
			return "祖灵"
		_:
			return dog_type

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value = source.get(key, {})
	return value if value is Dictionary else {}

func _array(source: Dictionary, key: String) -> Array:
	var value = source.get(key, [])
	return value if value is Array else []

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
	label.add_theme_color_override("font_color", WebUiTokens.ink_color())
	parent.add_child(label)
	return label

func _soft_panel_style() -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(1.0, 0.96, 0.84, 0.76)
	style.border_color = Color(0.24, 0.16, 0.10, 0.28)
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	style.content_margin_left = 12
	style.content_margin_top = 12
	style.content_margin_right = 12
	style.content_margin_bottom = 12
	return style

func _selected_row_style(selected: bool) -> StyleBoxFlat:
	if selected:
		return WebUiTokens.resource_pill_style()
	return _soft_panel_style()
