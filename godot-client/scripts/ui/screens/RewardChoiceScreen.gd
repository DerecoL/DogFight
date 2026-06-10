extends BaseWebScreen

var action_in_progress := false
var selected_shop_type := ""
var selected_class_reward_id := ""
var selected_relic_choice_id := ""
var selected_enchant_id := ""
var selected_potion_id := ""
var selected_item_id := ""
var selected_inventory_relic_id := ""

func _ready() -> void:
	_render()

func _on_payload_changed() -> void:
	_select_defaults()
	_render()

func _select_defaults() -> void:
	var run := _run()
	var shop_choices := _array(run, "choices")
	if not _string_array_has(shop_choices, selected_shop_type):
		selected_shop_type = str(shop_choices[0]) if not shop_choices.is_empty() else ""
	var class_choices := _array(run, "classRewardChoices")
	if not _choice_array_has_id(class_choices, "defId", selected_class_reward_id):
		selected_class_reward_id = str((class_choices[0] as Dictionary).get("defId", "")) if not class_choices.is_empty() and class_choices[0] is Dictionary else ""
	var relic_choices := _array(run, "relicChoices")
	if not _choice_array_has_id(relic_choices, "relicId", selected_relic_choice_id):
		selected_relic_choice_id = str((relic_choices[0] as Dictionary).get("relicId", "")) if not relic_choices.is_empty() and relic_choices[0] is Dictionary else ""
	var enchants := _array(run, "enchantChoices")
	if selected_enchant_id.is_empty() and not enchants.is_empty() and enchants[0] is Dictionary:
		selected_enchant_id = str((enchants[0] as Dictionary).get("id", ""))
	var potions := _array(run, "potionChoices")
	if selected_potion_id.is_empty() and not potions.is_empty() and potions[0] is Dictionary:
		selected_potion_id = str((potions[0] as Dictionary).get("id", ""))

func _render() -> void:
	for child in get_children():
		remove_child(child)
		child.queue_free()

	var scroll := ScrollContainer.new()
	scroll.name = "RewardChoiceScroll"
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
		_add_label(margin, "RewardChoiceEmpty", "暂无可领取的奖励。", HORIZONTAL_ALIGNMENT_CENTER)
		return
	var phase := str(run.get("phase", ""))
	if phase == "CHOICE":
		_select_defaults()
		_render_shop_choice(margin, run)
		return
	if phase == "RELIC_CHOICE":
		_select_defaults()
		_render_relic_choice(margin, run)
		return
	_select_defaults()
	_render_reward_workbench(margin, run)
	_ensure_reward_choice_web_children(run)

func _render_shop_choice(parent: Node, run: Dictionary) -> void:
	var screen := VBoxContainer.new()
	screen.name = "ShopChoiceScreen"
	screen.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	screen.size_flags_vertical = Control.SIZE_EXPAND_FILL
	screen.add_theme_constant_override("separation", 12)
	parent.add_child(screen)
	_render_screen_heading(screen, "选择本回合要访问的商店", "不同商店提供不同类型的道具，选择适合你战术的商店")

	var grid := GridContainer.new()
	grid.name = "ChoiceGrid"
	grid.columns = 3
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	screen.add_child(grid)

	var choices := _array(run, "choices")
	for index in range(9):
		if index < choices.size():
			var shop_type := str(choices[index])
			var button := _choice_button("%s\n%s" % [_shop_name(shop_type), _shop_description(shop_type)], _set_shop_choice.bind(shop_type))
			button.name = "ChoiceCard_%s" % shop_type
			button.custom_minimum_size = Vector2(176, 126)
			button.toggle_mode = true
			button.button_pressed = selected_shop_type == shop_type
			grid.add_child(button)
		else:
			var placeholder := Label.new()
			placeholder.name = "ChoicePlaceholder_%d" % (index + 1)
			placeholder.text = ""
			placeholder.custom_minimum_size = Vector2(176, 126)
			placeholder.add_theme_stylebox_override("normal", WebUiTokens.paper_card_style())
			grid.add_child(placeholder)

	var submit := _action_button("进入商店", _submit_shop_choice)
	submit.name = "ChoiceSubmit"
	if not choices.is_empty():
		submit.text = "进入 %s" % _shop_name(selected_shop_type)
		submit.disabled = action_in_progress
	else:
		submit.disabled = true
	screen.add_child(submit)

func _render_reward_workbench(parent: Node, run: Dictionary) -> void:
	var workbench := HBoxContainer.new()
	workbench.name = "RewardWorkbench"
	workbench.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	workbench.size_flags_vertical = Control.SIZE_EXPAND_FILL
	workbench.add_theme_constant_override("separation", 12)
	parent.add_child(workbench)

	var phase := str(run.get("phase", ""))
	match phase:
		"CLASS_REWARD":
			_render_class_reward(workbench, run)
		"UPGRADE_CHOICE":
			var upgrade := VBoxContainer.new()
			upgrade.name = "UpgradeWorkbench"
			upgrade.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			upgrade.size_flags_vertical = Control.SIZE_EXPAND_FILL
			workbench.add_child(upgrade)
			_render_upgrade_choice(upgrade, run)
		"ENCHANT_CHOICE":
			var enchant := VBoxContainer.new()
			enchant.name = "EnchantWorkbench"
			enchant.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			enchant.size_flags_vertical = Control.SIZE_EXPAND_FILL
			workbench.add_child(enchant)
			_render_enchant_choice(enchant, run)
		"POTION_CHOICE":
			var potion := VBoxContainer.new()
			potion.name = "PotionWorkbench"
			potion.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			potion.size_flags_vertical = Control.SIZE_EXPAND_FILL
			workbench.add_child(potion)
			_render_potion_choice(potion, run)
		_:
			_render_reward_empty_panel(workbench)

	var inventory_frame := PanelContainer.new()
	inventory_frame.name = "InventoryBoardFrame"
	inventory_frame.custom_minimum_size = Vector2(420, 0)
	inventory_frame.size_flags_vertical = Control.SIZE_EXPAND_FILL
	inventory_frame.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	workbench.add_child(inventory_frame)
	var inventory := VBoxContainer.new()
	inventory.name = "InventoryBoard"
	inventory.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	inventory.size_flags_vertical = Control.SIZE_EXPAND_FILL
	inventory.add_theme_constant_override("separation", 8)
	inventory_frame.add_child(inventory)
	_render_inventory_board(inventory, run)
	_render_selected_item_tip(workbench, run)
	_render_selected_relic_tip(workbench, run)

func _render_class_reward(parent: HBoxContainer, run: Dictionary) -> void:
	var selector := VBoxContainer.new()
	selector.name = "ClassRewardSelect"
	selector.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	selector.size_flags_vertical = Control.SIZE_EXPAND_FILL
	parent.add_child(selector)
	var panel := _new_reward_panel(selector)
	_render_screen_heading(panel, "选择职业装备", "先整理背包，再选择一个职业装备放入背包。")
	var grid := GridContainer.new()
	grid.name = "RewardChoiceGrid"
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	panel.add_child(grid)
	var choices := _array(run, "classRewardChoices")
	for choice_value in choices:
		if choice_value is Dictionary:
			var choice: Dictionary = choice_value
			var def: Dictionary = _dict(choice, "def")
			var def_id := str(choice.get("defId", ""))
			var button := _choice_button("%s\n%s\n%s" % [_fallback(str(def.get("name", "")), def_id), _quality_label(str(choice.get("quality", ""))), _fallback(str(def.get("description", "")), "")], _set_class_reward_choice.bind(def_id))
			button.name = "RewardChoice_%s" % def_id
			button.custom_minimum_size = Vector2(220, 128)
			button.toggle_mode = true
			button.button_pressed = selected_class_reward_id == def_id
			grid.add_child(button)
			_add_label(button, "RewardChoiceName_%s" % def_id, _fallback(str(def.get("name", "")), def_id))
			_add_label(button, "RewardChoiceTag_%s" % def_id, _quality_label(str(choice.get("quality", ""))))
			_add_label(button, "RewardChoiceMeta_%s" % def_id, "%s格" % _fallback(_detail_size_text(def), "?"))
			_add_label(button, "RewardChoiceCopy_%s" % def_id, _fallback(str(def.get("description", "")), str(choice.get("quality", ""))))
	var submit := _action_button("领取职业装备", _submit_class_reward_choice)
	submit.name = "ChoiceSubmit"
	if not selected_class_reward_id.is_empty():
		submit.disabled = action_in_progress
	else:
		submit.disabled = true
	panel.add_child(submit)

func _render_relic_choice(parent: Node, run: Dictionary) -> void:
	var selector := VBoxContainer.new()
	selector.name = "RelicChoiceSelect"
	selector.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	selector.size_flags_vertical = Control.SIZE_EXPAND_FILL
	selector.add_theme_constant_override("separation", 10)
	parent.add_child(selector)
	var panel := _new_reward_panel(selector)
	_render_screen_heading(panel, "选择遗物", "免费选择一个遗物；重复遗物会直接升级。")
	var grid_wrap := VBoxContainer.new()
	grid_wrap.name = "ChoiceGrid"
	grid_wrap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_child(grid_wrap)
	var grid := GridContainer.new()
	grid.name = "RelicChoiceGrid"
	grid.columns = 3
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	grid_wrap.add_child(grid)
	var choices := _array(run, "relicChoices")
	for choice_value in choices:
		if choice_value is Dictionary:
			var choice: Dictionary = choice_value
			var def: Dictionary = _dict(choice, "def")
			var relic_id := str(choice.get("relicId", ""))
			var button := _choice_button("%s\n%s\n%s" % [_fallback(str(def.get("name", "")), relic_id), _quality_label(str(choice.get("quality", ""))), _fallback(str(def.get("description", "")), "")], _set_relic_choice.bind(relic_id))
			button.name = "RelicChoice_%s" % relic_id
			button.custom_minimum_size = Vector2(190, 132)
			button.toggle_mode = true
			button.button_pressed = selected_relic_choice_id == relic_id
			grid.add_child(button)
			_add_label(button, "RelicGlyph_%s" % relic_id, "遗物")
			_add_label(button, "RelicChoiceName_%s" % relic_id, _fallback(str(def.get("name", "")), relic_id))
			_add_label(button, "RelicChoiceTag_%s" % relic_id, _quality_label(str(choice.get("quality", ""))))
			_add_label(button, "RelicChoiceCopy_%s" % relic_id, _fallback(str(def.get("description", "")), str(choice.get("quality", ""))))
	var submit := _action_button("获得遗物", _submit_relic_choice)
	submit.name = "ChoiceSubmit"
	if not selected_relic_choice_id.is_empty():
		submit.disabled = action_in_progress
	else:
		submit.disabled = true
	panel.add_child(submit)

func _render_upgrade_choice(parent: VBoxContainer, run: Dictionary) -> void:
	var panel := _new_reward_panel(parent, "UpgradePanel")
	var alias := Control.new()
	alias.name = "RewardPanel"
	panel.add_child(alias)
	_render_screen_heading(panel, "选择升级装备", "点击装备栏或背包里任意可升级装备，免费提升 1 个品质。")
	var grid := GridContainer.new()
	grid.name = "RewardChoiceGrid"
	grid.columns = 1
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_child(grid)
	var max_quality := _upgrade_shop_max_quality(str(run.get("shopType", "UPGRADE")))
	var card := _choice_button("%s\n可升级 %d 件\n%s及以上品质不能在本商店继续提升。" % [_shop_name(str(run.get("shopType", "UPGRADE"))), _upgradeable_item_count(run, max_quality), _quality_label(max_quality)], _noop)
	card.name = "RewardChoice_upgrade"
	card.custom_minimum_size = Vector2(220, 120)
	grid.add_child(card)
	var skip := _action_button("放弃升级", _skip_upgrade_choice)
	skip.name = "ChoiceSubmit"
	panel.add_child(skip)

func _render_enchant_choice(parent: VBoxContainer, run: Dictionary) -> void:
	var panel := _new_reward_panel(parent, "EnchantPanel")
	var alias := Control.new()
	alias.name = "RewardPanel"
	panel.add_child(alias)
	_render_screen_heading(panel, "选择附魔", "选中一个附魔后，点击装备栏或背包中的任意装备施加。")
	var grid := GridContainer.new()
	grid.name = "RewardChoiceGrid"
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	panel.add_child(grid)
	for choice_value in _array(run, "enchantChoices"):
		if choice_value is Dictionary:
			var choice: Dictionary = choice_value
			var enchant: Dictionary = _dict(choice, "enchant")
			var id := str(choice.get("id", ""))
			var button := _choice_button("%s\n免费\n%s" % [_fallback(str(enchant.get("label", "")), id), str(choice.get("description", ""))], _set_enchant_choice.bind(id))
			button.name = "RewardChoice_%s" % id
			button.custom_minimum_size = Vector2(220, 116)
			grid.add_child(button)
	_add_label(panel, "EnchantSelectedCopy", "当前选中：%s" % _selected_enchant_label(run))

func _render_potion_choice(parent: VBoxContainer, run: Dictionary) -> void:
	var panel := _new_reward_panel(parent, "PotionPanel")
	var alias := Control.new()
	alias.name = "RewardPanel"
	panel.add_child(alias)
	_render_screen_heading(panel, "选择药水", "先选一瓶药水，再点击一件非职业装备，修改它的基础触发点数。")
	var grid := GridContainer.new()
	grid.name = "RewardChoiceGrid"
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	panel.add_child(grid)
	for choice_value in _array(run, "potionChoices"):
		if choice_value is Dictionary:
			var choice: Dictionary = choice_value
			var id := str(choice.get("id", ""))
			var button := _choice_button("%s\n药水\n修改基础触发点数" % _fallback(str(choice.get("description", "")), id), _set_potion_choice.bind(id))
			button.name = "RewardChoice_%s" % id
			button.custom_minimum_size = Vector2(220, 116)
			grid.add_child(button)
	_add_label(panel, "PotionDisabledReason", "职业装备不可使用药水")

func _render_reward_empty_panel(parent: Node) -> void:
	var panel := _new_reward_panel(parent)
	_render_screen_heading(panel, "暂无奖励", "当前阶段没有可显示的奖励选择。")

func _ensure_reward_choice_web_children(run: Dictionary) -> void:
	var phase := str(run.get("phase", ""))
	if phase == "UPGRADE_CHOICE":
		var max_quality := _upgrade_shop_max_quality(str(run.get("shopType", "UPGRADE")))
		var card := find_child("RewardChoice_upgrade", true, false)
		if card != null:
			_ensure_choice_label(card, "RewardChoiceIcon_upgrade", "\u5347\u7ea7")
			_ensure_choice_label(card, "RewardChoiceName_upgrade", _shop_name(str(run.get("shopType", "UPGRADE"))))
			_ensure_choice_label(card, "RewardChoiceTag_upgrade", "\u53ef\u5347\u7ea7 %d \u4ef6" % _upgradeable_item_count(run, max_quality))
			_ensure_choice_label(card, "RewardChoiceCopy_upgrade", "%s\u53ca\u4ee5\u4e0a\u54c1\u8d28\u4e0d\u80fd\u5728\u672c\u5546\u5e97\u7ee7\u7eed\u63d0\u5347\u3002" % _quality_label(max_quality))
	elif phase == "ENCHANT_CHOICE":
		for choice_value in _array(run, "enchantChoices"):
			if choice_value is Dictionary:
				var choice: Dictionary = choice_value
				var id := str(choice.get("id", ""))
				var enchant: Dictionary = _dict(choice, "enchant")
				var card := find_child("RewardChoice_%s" % id, true, false)
				if card != null:
					_ensure_choice_label(card, "RewardChoiceIcon_%s" % id, "\u9644\u9b54")
					_ensure_choice_label(card, "RewardChoiceName_%s" % id, _fallback(str(enchant.get("label", "")), id))
					_ensure_choice_label(card, "RewardChoiceTag_%s" % id, "\u514d\u8d39")
					_ensure_choice_label(card, "RewardChoiceCopy_%s" % id, str(choice.get("description", "")))
		var enchant_panel := find_child("EnchantPanel", true, false)
		if enchant_panel != null:
			_ensure_choice_label(enchant_panel, "RewardDisabledReason", "\u5f53\u524d\u9009\u4e2d\uff1a%s" % _selected_enchant_label(run))
	elif phase == "POTION_CHOICE":
		for choice_value in _array(run, "potionChoices"):
			if choice_value is Dictionary:
				var choice: Dictionary = choice_value
				var id := str(choice.get("id", ""))
				var card := find_child("RewardChoice_%s" % id, true, false)
				if card != null:
					_ensure_choice_label(card, "RewardChoiceIcon_%s" % id, "\u836f\u6c34")
					_ensure_choice_label(card, "RewardChoiceName_%s" % id, _fallback(str(choice.get("description", "")), id))
					_ensure_choice_label(card, "RewardChoiceTag_%s" % id, "\u836f\u6c34")
					_ensure_choice_label(card, "RewardChoiceCopy_%s" % id, "\u4fee\u6539\u57fa\u7840\u89e6\u53d1\u70b9\u6570\uff1b\u4e4b\u540e\u4ecd\u4f1a\u88ab\u9057\u7269\u548c\u5176\u4ed6\u9053\u5177\u5f71\u54cd\u3002")
		var potion_panel := find_child("PotionPanel", true, false)
		if potion_panel != null:
			_ensure_choice_label(potion_panel, "RewardDisabledReason", "\u804c\u4e1a\u88c5\u5907\u4e0d\u53ef\u4f7f\u7528\u836f\u6c34")

func _ensure_choice_label(parent: Node, node_name: String, text: String) -> void:
	if parent.find_child(node_name, true, false) != null:
		return
	_add_choice_label(parent, node_name, text)

func _new_reward_panel(parent: Node, panel_name := "RewardPanel") -> VBoxContainer:
	var frame := PanelContainer.new()
	frame.name = "%sFrame" % panel_name
	frame.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	frame.size_flags_vertical = Control.SIZE_EXPAND_FILL
	frame.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(frame)
	var panel := VBoxContainer.new()
	panel.name = panel_name
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.add_theme_constant_override("separation", 10)
	frame.add_child(panel)
	return panel

func _render_screen_heading(parent: Node, title: String, description: String) -> void:
	var heading := VBoxContainer.new()
	heading.name = "ScreenHeading"
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_theme_constant_override("separation", 4)
	parent.add_child(heading)
	_add_label(heading, "ScreenHeadingTitle", title, HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(heading, "ScreenHeadingDescription", description, HORIZONTAL_ALIGNMENT_CENTER)

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
		var button := _action_button(_fallback(str(def.get("name", "")), "遗物槽 %d" % (slot + 1)), _select_inventory_relic.bind(relic_id) if not relic_id.is_empty() else _noop)
		button.name = "RelicSlot_%d" % slot
		button.custom_minimum_size = Vector2(74, 42)
		button.disabled = relic.is_empty()
		row.add_child(button)

func _render_selected_item_tip(parent: HBoxContainer, run: Dictionary) -> void:
	var item := _selected_item(run)
	if item.is_empty():
		return
	var def: Dictionary = _dict(item, "def")
	var title := _fallback(str(def.get("name", "")), str(item.get("defId", item.get("id", ""))))
	var floating_tip := PanelContainer.new()
	floating_tip.name = "FloatingTip"
	floating_tip.custom_minimum_size = Vector2(320, 244)
	floating_tip.size_flags_vertical = Control.SIZE_EXPAND_FILL
	floating_tip.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(floating_tip)

	var tip := VBoxContainer.new()
	tip.name = "RewardItemTip"
	tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tip.add_theme_constant_override("separation", 7)
	floating_tip.add_child(tip)

	var tags := HBoxContainer.new()
	tags.name = "RewardItemTipTags"
	tags.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tags.add_theme_constant_override("separation", 6)
	tip.add_child(tags)
	_add_label(tags, "RewardItemTipSizeTag", "%s格" % _fallback(_detail_size_text(def), "?"), HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(tags, "RewardItemTipQualityTag", _quality_label(str(item.get("quality", ""))), HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(tags, "RewardItemTipAreaTag", _area_label(str(item.get("area", ""))), HORIZONTAL_ALIGNMENT_CENTER)

	var identity := HBoxContainer.new()
	identity.name = "RewardItemTipIdentity"
	identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity.add_theme_constant_override("separation", 8)
	tip.add_child(identity)
	var art := Label.new()
	art.name = "RewardItemTipArt"
	art.text = ""
	art.custom_minimum_size = Vector2(54, 54)
	art.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
	identity.add_child(art)
	_add_label(identity, "RewardItemTipTitle", title)

	var size_preview := HBoxContainer.new()
	size_preview.name = "RewardItemTipSizePreview"
	size_preview.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_preview.add_theme_constant_override("separation", 8)
	tip.add_child(size_preview)
	_add_label(size_preview, "RewardItemTipGridPreview", _shop_size_preview_text(def))
	_add_label(size_preview, "RewardItemTipSizeText", "占用 %s 格" % _fallback(_detail_size_text(def), "?"))

	var trigger := _trigger_dice_text(def)
	if not trigger.is_empty():
		_add_label(tip, "RewardItemTipDice", "触发点数 %s" % trigger)
	else:
		_add_label(tip, "RewardItemTipDice", "触发点数 -")

	var description := _fallback(str(def.get("description", "")), str(item.get("description", "")))
	_add_label(tip, "RewardItemTipDescription", description)

	var actions := HBoxContainer.new()
	actions.name = "RewardItemTipActions"
	actions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_theme_constant_override("separation", 8)
	tip.add_child(actions)
	var apply_button := _action_button(_selected_item_action_label(run), _apply_selected_item_reward)
	apply_button.name = "ApplyRewardItemButton"
	apply_button.disabled = action_in_progress or not _selected_item_has_action(run)
	actions.add_child(apply_button)
	var close_button := _action_button("关闭", _close_item_tip)
	close_button.name = "CloseRewardItemTipButton"
	actions.add_child(close_button)

func _render_selected_relic_tip(parent: HBoxContainer, run: Dictionary) -> void:
	var relic := _selected_inventory_relic(run)
	if relic.is_empty():
		return
	var def: Dictionary = _dict(relic, "def")
	var title := _fallback(str(def.get("name", "")), str(relic.get("relicId", relic.get("id", ""))))
	var floating_tip := PanelContainer.new()
	floating_tip.name = "FloatingTip"
	floating_tip.custom_minimum_size = Vector2(320, 204)
	floating_tip.size_flags_vertical = Control.SIZE_EXPAND_FILL
	floating_tip.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	parent.add_child(floating_tip)

	var tip := VBoxContainer.new()
	tip.name = "RewardRelicTip"
	tip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tip.add_theme_constant_override("separation", 7)
	floating_tip.add_child(tip)

	var tags := HBoxContainer.new()
	tags.name = "RewardRelicTipTags"
	tags.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tags.add_theme_constant_override("separation", 6)
	tip.add_child(tags)
	_add_label(tags, "RewardRelicTipQualityTag", _quality_label(str(relic.get("quality", ""))), HORIZONTAL_ALIGNMENT_CENTER)
	for tag in _array(def, "tags"):
		_add_label(tags, "RewardRelicTipTag_%s" % _node_key(str(tag)), str(tag), HORIZONTAL_ALIGNMENT_CENTER)

	var identity := HBoxContainer.new()
	identity.name = "RewardRelicTipIdentity"
	identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity.add_theme_constant_override("separation", 8)
	tip.add_child(identity)
	var icon := TextureRect.new()
	icon.name = "RewardRelicTipIcon"
	icon.texture = _relic_texture(relic)
	icon.custom_minimum_size = Vector2(44, 44)
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	identity.add_child(icon)
	var identity_text := VBoxContainer.new()
	identity_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity.add_child(identity_text)
	_add_label(identity_text, "RewardRelicTipTitle", title)
	_add_label(identity_text, "RewardRelicTipId", str(relic.get("relicId", relic.get("id", ""))))

	_add_label(tip, "RewardRelicTipDescription", _fallback(str(def.get("description", "")), str(relic.get("description", ""))))
	var effect := str(def.get("effect", ""))
	if not effect.is_empty():
		_add_label(tip, "RewardRelicTipEffect", effect)

	var actions := HBoxContainer.new()
	actions.name = "RewardRelicTipActions"
	actions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_theme_constant_override("separation", 8)
	tip.add_child(actions)
	var close_button := _action_button("\u5173\u95ed", _close_relic_tip)
	close_button.name = "CloseRewardRelicTipButton"
	actions.add_child(close_button)

func _choice_button(text: String, callback: Callable) -> Button:
	var button := _action_button(text, callback)
	button.add_theme_stylebox_override("normal", WebUiTokens.paper_card_style())
	button.add_theme_stylebox_override("hover", WebUiTokens.resource_pill_style())
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return button

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

func _add_choice_label(parent: Node, node_name: String, text: String) -> Label:
	var label := _add_label(parent, node_name, text)
	label.custom_minimum_size = Vector2(0, 22)
	return label

func _set_shop_choice(shop_type: String) -> void:
	selected_shop_type = shop_type
	_render()

func _submit_shop_choice() -> void:
	if selected_shop_type.is_empty():
		return
	await _select_shop_choice(selected_shop_type)

func _select_shop_choice(shop_type: String) -> void:
	if session != null and session.has_method("select_shop_choice"):
		await session.call("select_shop_choice", shop_type)

func _set_class_reward_choice(def_id: String) -> void:
	selected_class_reward_id = def_id
	_render()

func _submit_class_reward_choice() -> void:
	if selected_class_reward_id.is_empty():
		return
	await _select_class_reward(selected_class_reward_id)

func _select_class_reward(def_id: String) -> void:
	if session != null and session.has_method("select_class_reward"):
		await session.call("select_class_reward", def_id)

func _set_relic_choice(relic_id: String) -> void:
	selected_relic_choice_id = relic_id
	_render()

func _submit_relic_choice() -> void:
	if selected_relic_choice_id.is_empty():
		return
	await _select_relic(selected_relic_choice_id)

func _select_relic(relic_id: String) -> void:
	if session != null and session.has_method("select_relic"):
		await session.call("select_relic", relic_id)

func _skip_upgrade_choice() -> void:
	if session != null and session.has_method("skip_upgrade_choice"):
		await session.call("skip_upgrade_choice")

func _set_enchant_choice(id: String) -> void:
	selected_enchant_id = id
	_render()

func _set_potion_choice(id: String) -> void:
	selected_potion_id = id
	_render()

func _select_item(item_id: String) -> void:
	selected_item_id = item_id
	selected_inventory_relic_id = ""
	_render()

func _close_item_tip() -> void:
	selected_item_id = ""
	_render()

func _select_inventory_relic(relic_id: String) -> void:
	selected_inventory_relic_id = "" if selected_inventory_relic_id == relic_id else relic_id
	selected_item_id = ""
	_render()

func _close_relic_tip() -> void:
	selected_inventory_relic_id = ""
	_render()

func _apply_selected_item_reward() -> void:
	if selected_item_id.is_empty() or action_in_progress:
		return
	var phase := str(_run().get("phase", ""))
	var item_id := selected_item_id
	action_in_progress = true
	if phase == "UPGRADE_CHOICE" and session != null and session.has_method("select_upgrade_item"):
		await session.call("select_upgrade_item", item_id)
	elif phase == "ENCHANT_CHOICE" and not selected_enchant_id.is_empty() and session != null and session.has_method("select_enchant"):
		await session.call("select_enchant", selected_enchant_id, item_id)
	elif phase == "POTION_CHOICE" and not selected_potion_id.is_empty() and session != null and session.has_method("select_potion"):
		await session.call("select_potion", selected_potion_id, item_id)
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

func _string_array_has(values: Array, expected: String) -> bool:
	if expected.is_empty():
		return false
	for value in values:
		if str(value) == expected:
			return true
	return false

func _choice_array_has_id(values: Array, key: String, expected: String) -> bool:
	if expected.is_empty():
		return false
	for value in values:
		if value is Dictionary and str((value as Dictionary).get(key, "")) == expected:
			return true
	return false

func _selected_item(run: Dictionary) -> Dictionary:
	if selected_item_id.is_empty():
		return {}
	for item_value in _array(run, "items"):
		if item_value is Dictionary and str((item_value as Dictionary).get("id", "")) == selected_item_id:
			return item_value
	return {}

func _selected_inventory_relic(run: Dictionary) -> Dictionary:
	if selected_inventory_relic_id.is_empty():
		return {}
	for relic_value in _array(run, "relics"):
		if relic_value is Dictionary:
			var relic: Dictionary = relic_value
			if str(relic.get("id", relic.get("relicId", ""))) == selected_inventory_relic_id:
				return relic
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

func _selected_item_has_action(run: Dictionary) -> bool:
	var phase := str(run.get("phase", ""))
	if phase == "UPGRADE_CHOICE":
		return true
	if phase == "ENCHANT_CHOICE":
		return not selected_enchant_id.is_empty()
	if phase == "POTION_CHOICE":
		return not selected_potion_id.is_empty()
	return false

func _selected_item_action_label(run: Dictionary) -> String:
	match str(run.get("phase", "")):
		"UPGRADE_CHOICE":
			return "升级"
		"ENCHANT_CHOICE":
			return "附魔到选中装备" if not selected_enchant_id.is_empty() else "先选择附魔"
		"POTION_CHOICE":
			return "药水给选中装备" if not selected_potion_id.is_empty() else "先选择药水"
		_:
			return "仅查看"

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

func _shop_name(shop_type: String) -> String:
	match shop_type:
		"GENERAL":
			return "装备店"
		"LARGE":
			return "大型装备店"
		"MEDIUM":
			return "中型装备店"
		"SMALL":
			return "小型装备店"
		"SMALL_DICE":
			return "小点数装备店"
		"BIG_DICE":
			return "大点数装备店"
		"RELIC":
			return "遗物店"
		"UPGRADE", "UPGRADE_SILVER":
			return "白银升级店"
		"UPGRADE_GOLD":
			return "黄金升级店"
		"UPGRADE_DIAMOND":
			return "钻石升级店"
		"POTION":
			return "药水店"
		_:
			return _fallback(shop_type, "商店")

func _shop_description(shop_type: String) -> String:
	match shop_type:
		"GENERAL":
			return "提供常规装备，适合补齐触发点和基础伤害。"
		"LARGE":
			return "更容易出现大型装备，适合围绕多格核心构筑。"
		"MEDIUM":
			return "偏向中型装备，兼顾站位和稳定收益。"
		"SMALL":
			return "偏向小型装备，方便填补空格和连锁触发。"
		"SMALL_DICE":
			return "偏向小点数触发装备，适合低点联动。"
		"BIG_DICE":
			return "偏向大点数触发装备，适合高点爆发。"
		"RELIC":
			return "选择一个遗物，改变长期构筑规则。"
		"UPGRADE", "UPGRADE_SILVER":
			return "免费升级至白银，适合强化早期核心装备。"
		"UPGRADE_GOLD":
			return "免费升级至黄金，适合把主力装备推到中后期强度。"
		"UPGRADE_DIAMOND":
			return "免费升级至钻石，让关键装备获得终阶收益。"
		"POTION":
			return "获得药水，给选中装备调整点数或强化触发。"
		_:
			return "进入该商店查看本回合可用内容。"

func _upgrade_shop_max_quality(shop_type: String) -> String:
	match shop_type:
		"UPGRADE_DIAMOND":
			return "DIAMOND"
		"UPGRADE_GOLD":
			return "GOLD"
		_:
			return "SILVER"

func _upgradeable_item_count(run: Dictionary, max_quality: String) -> int:
	var count := 0
	for item_value in _array(run, "items"):
		if item_value is Dictionary and _quality_rank(str((item_value as Dictionary).get("quality", ""))) < _quality_rank(max_quality):
			count += 1
	return count

func _quality_rank(quality: String) -> int:
	match quality:
		"BRONZE":
			return 1
		"SILVER":
			return 2
		"GOLD":
			return 3
		"DIAMOND":
			return 4
		_:
			return 0

func _selected_enchant_label(run: Dictionary) -> String:
	for choice_value in _array(run, "enchantChoices"):
		if choice_value is Dictionary and str((choice_value as Dictionary).get("id", "")) == selected_enchant_id:
			var enchant: Dictionary = _dict(choice_value, "enchant")
			return _fallback(str(enchant.get("label", "")), selected_enchant_id)
	return "请选择附魔"
