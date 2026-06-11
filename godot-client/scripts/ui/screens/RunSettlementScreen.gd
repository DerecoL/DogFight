extends ShellBackedWebScreen

func _render_shell_content() -> void:
	_render()

func _render() -> void:
	var shell_content_root := content_container()
	for child in shell_content_root.get_children():
		shell_content_root.remove_child(child)
		child.queue_free()

	var page := Control.new()
	page.name = "SettlementPage"
	page.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	page.size_flags_vertical = Control.SIZE_EXPAND_FILL
	shell_content_root.add_child(page)

	var scroll := ScrollContainer.new()
	scroll.name = "SettlementScroll"
	scroll.set_anchors_preset(Control.PRESET_FULL_RECT)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	page.add_child(scroll)

	var margin := MarginContainer.new()
	margin.name = "SettlementMargin"
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_top", 22)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_bottom", 22)
	scroll.add_child(margin)

	var run := _run()
	if run.is_empty():
		_add_label(margin, "SettlementEmpty", "暂无跑局结算。", HORIZONTAL_ALIGNMENT_CENTER)
		return

	var layout := VBoxContainer.new()
	layout.name = "SettlementLayout"
	layout.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	layout.size_flags_vertical = Control.SIZE_EXPAND_FILL
	layout.add_theme_constant_override("separation", 12)
	margin.add_child(layout)

	var action_bar := HBoxContainer.new()
	action_bar.name = "SettlementActionBar"
	action_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	layout.add_child(action_bar)
	var action_spacer := Control.new()
	action_spacer.name = "SettlementActionSpacer"
	action_spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	action_bar.add_child(action_spacer)
	var hide_button := _icon_button("", _hide_settlement)
	hide_button.name = "SettlementHideButton"
	hide_button.custom_minimum_size = Vector2(WebUiTokens.touch_target_height(), WebUiTokens.touch_target_height())
	var hide_icon := Label.new()
	hide_icon.name = "SettlementHideIcon"
	hide_icon.text = "×"
	hide_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hide_icon.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hide_icon.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	hide_button.add_child(hide_icon)
	action_bar.add_child(hide_button)

	var card := PanelContainer.new()
	card.name = "SettlementCard"
	card.custom_minimum_size = Vector2(520, 0)
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.add_theme_stylebox_override("panel", WebUiTokens.paper_card_style())
	layout.add_child(card)

	var content := VBoxContainer.new()
	content.name = "SettlementCardContent"
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 12)
	card.add_child(content)

	var icon := Label.new()
	icon.name = "SettlementIcon"
	icon.text = "🏆"
	icon.custom_minimum_size = Vector2(0, 36)
	icon.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	icon.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	content.add_child(icon)

	_add_label(content, "SettlementTitle", "跑局结束", HORIZONTAL_ALIGNMENT_CENTER)

	var score_grid := GridContainer.new()
	score_grid.name = "SettlementScoreGrid"
	score_grid.columns = 3
	score_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	score_grid.add_theme_constant_override("h_separation", 8)
	score_grid.add_theme_constant_override("v_separation", 8)
	content.add_child(score_grid)
	_add_settlement_metric(score_grid, "SettlementWins", "胜场", str(int(run.get("wins", 0))))
	_add_settlement_metric(score_grid, "SettlementLosses", "败场", str(int(run.get("losses", 0))))
	_add_settlement_metric(score_grid, "SettlementScore", "积分", str(int(run.get("score", _run_score(run)))))

	var settlement := _dict(run, "ladderSettlement")
	if not settlement.is_empty():
		_render_ladder_settlement_summary(content, settlement)

	var battle := _dict(run, "lastBattle")
	if not battle.is_empty():
		_render_battle_review_dashboard(content, battle)

	var return_button := _action_button("返回大厅", _return_lobby)
	return_button.name = "ReturnLobbyButton"
	content.add_child(return_button)

func _render_ladder_settlement_summary(parent: VBoxContainer, settlement: Dictionary) -> void:
	var summary := VBoxContainer.new()
	summary.name = "LadderSettlementSummary"
	summary.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	summary.add_theme_constant_override("separation", 4)
	summary.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
	parent.add_child(summary)

	_add_label(summary, "LadderSettlementTitle", "天梯结算")
	_add_label(
		summary,
		"LadderSettlementScoreLine",
		"%s %d -> %s %d  %s" % [
			_tier_label(str(settlement.get("beforeTier", ""))),
			int(settlement.get("beforeScore", 0)),
			_tier_label(str(settlement.get("afterTier", ""))),
			int(settlement.get("afterScore", 0)),
			_signed_int(int(settlement.get("delta", 0))),
		]
	)

	if settlement.has("baseScore") or settlement.has("tierTax") or settlement.has("lossPenalty"):
		var formula := "基础 %s - 段位税 %d - 败场 %d" % [
			_signed_int(int(settlement.get("baseScore", 0))),
			int(settlement.get("tierTax", 0)),
			int(settlement.get("lossPenalty", 0)),
		]
		if int(settlement.get("perfectBonus", 0)) > 0:
			formula += " + 完美 %d" % int(settlement.get("perfectBonus", 0))
		if int(settlement.get("newbieProtection", 0)) > 0:
			formula += " + 新手保护 %d" % int(settlement.get("newbieProtection", 0))
		formula += " = %s" % _signed_int(int(settlement.get("delta", 0)))
		_add_label(summary, "LadderSettlementFormula", formula)

func _render_battle_review_dashboard(parent: VBoxContainer, battle: Dictionary) -> void:
	var dashboard := VBoxContainer.new()
	dashboard.name = "BattleReviewDashboard"
	dashboard.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dashboard.add_theme_constant_override("separation", 8)
	dashboard.add_theme_stylebox_override("normal", WebUiTokens.paper_card_style())
	parent.add_child(dashboard)

	var heading := HBoxContainer.new()
	heading.name = "BattleReviewHeading"
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_theme_constant_override("separation", 8)
	dashboard.add_child(heading)
	_add_label(heading, "BattleReviewTitle", "战斗数据看板")

	var stats := _battle_review_stats(battle)
	if int(stats.get("systemDamage", 0)) > 0:
		_add_label(heading, "BattleReviewSystemDamageTag", "系统伤害 %d" % int(stats.get("systemDamage", 0)), HORIZONTAL_ALIGNMENT_RIGHT)
	var grid := GridContainer.new()
	grid.name = "BattleReviewSideGrid"
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	dashboard.add_child(grid)
	_render_battle_review_side(grid, "BattleReviewPlayer", "我方", stats["player"])
	_render_battle_review_side(grid, "BattleReviewOpponent", "对手", stats["opponent"])

func _render_battle_review_side(parent: Node, node_name: String, label: String, stats: Dictionary) -> void:
	var card := VBoxContainer.new()
	card.name = node_name
	card.custom_minimum_size = Vector2(220, 0)
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.add_theme_constant_override("separation", 6)
	card.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
	parent.add_child(card)
	var header := HBoxContainer.new()
	header.name = "%sHeader" % node_name
	header.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_theme_constant_override("separation", 8)
	card.add_child(header)
	_add_label(header, "%sSideLabel" % node_name, label)
	_add_label(header, "%sResultLabel" % node_name, str(stats.get("label", label)), HORIZONTAL_ALIGNMENT_RIGHT)
	var metrics := GridContainer.new()
	metrics.name = "%sMetrics" % node_name
	metrics.columns = 2
	metrics.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	metrics.add_theme_constant_override("h_separation", 6)
	metrics.add_theme_constant_override("v_separation", 6)
	card.add_child(metrics)
	_add_settlement_metric(metrics, "%sMetricDamage" % node_name, "伤害", str(int(stats.get("damage", 0))))
	_add_settlement_metric(metrics, "%sMetricHealing" % node_name, "治疗", str(int(stats.get("healing", 0))))
	_add_settlement_metric(metrics, "%sMetricShield" % node_name, "护盾", str(int(stats.get("shield", 0))))
	_add_settlement_metric(metrics, "%sMetricPoison" % node_name, "毒伤", str(int(stats.get("poisonDamage", 0))))
	_add_settlement_metric(metrics, "%sMetricStatuses" % node_name, "状态", str(int(stats.get("statusEvents", 0))))
	var top_item := VBoxContainer.new()
	top_item.name = "%sTopItem" % node_name
	top_item.custom_minimum_size = Vector2(0, 52)
	top_item.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top_item.add_theme_constant_override("separation", 2)
	top_item.add_theme_stylebox_override("normal", WebUiTokens.paper_card_style())
	card.add_child(top_item)
	_add_label(top_item, "%sTopItemLabel" % node_name, "最高贡献")
	_add_label(top_item, "%sTopItemValue" % node_name, _top_item_text(stats))

func _add_settlement_metric(parent: Node, node_name: String, title: String, value: String) -> void:
	var metric := VBoxContainer.new()
	metric.name = node_name
	metric.custom_minimum_size = Vector2(110, 64)
	metric.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	metric.add_theme_constant_override("separation", 2)
	metric.add_theme_stylebox_override("normal", WebUiTokens.resource_pill_style())
	parent.add_child(metric)
	_add_label(metric, "%sLabel" % node_name, title, HORIZONTAL_ALIGNMENT_CENTER)
	_add_label(metric, "%sValue" % node_name, value, HORIZONTAL_ALIGNMENT_CENTER)

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

func _icon_button(text: String, callback: Callable) -> Button:
	var button := _action_button(text, callback)
	button.size_flags_horizontal = Control.SIZE_SHRINK_END
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

func _battle_review_stats(battle: Dictionary) -> Dictionary:
	var winner := str(battle.get("winner", ""))
	var player_snapshot := _dict(battle, "playerSnapshot")
	var opponent_snapshot := _dict(battle, "opponentSnapshot")
	var stats := {
		"systemDamage": 0,
		"player": _new_review_side("player", player_snapshot, "胜利" if winner == "player" else "失败" if winner == "opponent" else "平局"),
		"opponent": _new_review_side("opponent", opponent_snapshot, "胜利" if winner == "opponent" else "失败" if winner == "player" else "平局"),
	}
	for event_value in _array(battle, "events"):
		if not event_value is Dictionary:
			continue
		var event: Dictionary = event_value
		var kind := str(event.get("kind", "")).to_upper()
		var effect_type := str(event.get("effectType", "")).to_upper()
		var actor := _normalize_review_side(str(event.get("actor", event.get("side", ""))))
		if kind == "POISON" or effect_type == "POISON":
			if kind == "POISON":
				if str(event.get("target", "")) == "both":
					stats["systemDamage"] = int(stats["systemDamage"]) + abs(min(0, _hp_delta_for_side(event, "player"))) + abs(min(0, _hp_delta_for_side(event, "opponent")))
				elif str(event.get("target", "")) == "player":
					stats["opponent"]["poisonDamage"] = int(stats["opponent"]["poisonDamage"]) + abs(min(0, _hp_delta_for_side(event, "player")))
				else:
					stats["player"]["poisonDamage"] = int(stats["player"]["poisonDamage"]) + abs(min(0, _hp_delta_for_side(event, "opponent")))
			elif not actor.is_empty():
				stats[actor]["statusEvents"] = int(stats[actor]["statusEvents"]) + 1
			continue
		if actor.is_empty():
			continue
		var actor_stats: Dictionary = stats[actor]
		var actor_delta := _hp_delta_for_side(event, actor)
		var target_side := str(event.get("target", ""))
		if target_side != "player" and target_side != "opponent":
			target_side = _opposite_side(actor)
		var target_delta := _hp_delta_for_side(event, target_side)
		var amount := int(event.get("amount", 0))
		if effect_type == "DAMAGE" or kind == "DAMAGE":
			var damage: int = abs(min(0, target_delta)) if target_delta != 0 else max(amount, 0)
			actor_stats["damage"] = int(actor_stats["damage"]) + damage
			_add_item_contribution(actor_stats, event, damage)
		elif effect_type == "HEAL" or kind == "HEAL":
			var healing: int = max(0, actor_delta) if actor_delta != 0 else max(amount, 0)
			actor_stats["healing"] = int(actor_stats["healing"]) + healing
			_add_item_contribution(actor_stats, event, healing)
		elif _is_shield_event(event):
			var shield: int = max(amount, 0)
			actor_stats["shield"] = int(actor_stats["shield"]) + shield
			_add_item_contribution(actor_stats, event, shield)
		elif _is_status_event(event):
			actor_stats["statusEvents"] = int(actor_stats["statusEvents"]) + 1
	return stats

func _new_review_side(side: String, snapshot: Dictionary, result: String) -> Dictionary:
	var item_names := {}
	for item_value in _array(snapshot, "items"):
		if item_value is Dictionary:
			var item: Dictionary = item_value
			var item_id := str(item.get("id", ""))
			if not item_id.is_empty():
				item_names[item_id] = _snapshot_item_name(item)
	return {
		"side": side,
		"label": _fallback(str(snapshot.get("name", "")), "我方" if side == "player" else "对手"),
		"damage": 0,
		"healing": 0,
		"shield": 0,
		"poisonDamage": 0,
		"statusEvents": 0,
		"itemContribution": {},
		"itemNames": item_names,
	}

func _snapshot_item_name(item: Dictionary) -> String:
	var def := _dict(item, "def")
	return _fallback(str(def.get("name", "")), _fallback(str(item.get("defId", "")), str(item.get("id", ""))))

func _normalize_review_side(side: String) -> String:
	return side if side == "player" or side == "opponent" else ""

func _opposite_side(side: String) -> String:
	return "opponent" if side == "player" else "player"

func _hp_delta_for_side(event: Dictionary, side: String) -> int:
	if str(event.get("target", "")) == "both":
		return int(event.get("sourceHpDelta", 0)) if side == "player" else int(event.get("targetHpDelta", 0))
	if str(event.get("actor", "")) == "system":
		if str(event.get("target", "")) == side:
			return int(event.get("sourceHpDelta", 0)) if side == "player" else int(event.get("targetHpDelta", 0))
		return 0
	if str(event.get("actor", "")) == side or str(event.get("side", "")) == side:
		return int(event.get("sourceHpDelta", 0))
	if str(event.get("target", "")) == side:
		return int(event.get("targetHpDelta", 0))
	return 0

func _add_item_contribution(stats: Dictionary, event: Dictionary, amount: int) -> void:
	var item_id := str(event.get("itemId", ""))
	if item_id.is_empty() or amount <= 0:
		return
	var contributions: Dictionary = stats["itemContribution"]
	contributions[item_id] = int(contributions.get(item_id, 0)) + amount

func _is_shield_event(event: Dictionary) -> bool:
	var text := str(event.get("text", ""))
	return str(event.get("effectType", "")).to_upper() == "UTILITY" and (
		_array(event, "statusChanged").has("shield")
		or text.contains("护盾")
		or text.to_lower().contains("shield")
	)

func _is_status_event(event: Dictionary) -> bool:
	var text := str(event.get("text", ""))
	return not _array(event, "statusChanged").is_empty() or str(event.get("effectType", "")).to_upper() == "POISON" or text.contains("中毒") or text.to_lower().contains("poison") or text.to_lower().contains("weak") or text.to_lower().contains("freeze")

func _top_item_text(stats: Dictionary) -> String:
	var contributions: Dictionary = stats.get("itemContribution", {})
	var top_id := ""
	var top_value := 0
	for item_id in contributions.keys():
		var value := int(contributions[item_id])
		if value > top_value:
			top_id = str(item_id)
			top_value = value
	if top_id.is_empty():
		return "暂无"
	var names: Dictionary = stats.get("itemNames", {})
	return "%s · %d" % [str(names.get(top_id, top_id)), top_value]

func _hide_settlement() -> void:
	visible = false

func _return_lobby() -> void:
	if session != null and session.has_method("open_run_lobby"):
		session.call("open_run_lobby", "CASUAL")
	elif session != null and session.has_method("open_screen"):
		session.call("open_screen", "mode_lobby")

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

func _run_score(run: Dictionary) -> int:
	return int(run.get("wins", 0)) * 100 - int(run.get("losses", 0)) * 50 + int(run.get("gold", 0))

func _tier_label(tier: String) -> String:
	match tier:
		"BRONZE":
			return "青铜"
		"SILVER":
			return "白银"
		"GOLD":
			return "黄金"
		"PLATINUM":
			return "铂金"
		"DIAMOND":
			return "钻石"
		"MASTER":
			return "大师"
		_:
			return tier

func _signed_int(value: int) -> String:
	if value > 0:
		return "+%d" % value
	return str(value)
