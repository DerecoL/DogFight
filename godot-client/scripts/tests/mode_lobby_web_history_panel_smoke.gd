extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene = load("res://scenes/screens/ModeLobbyScreen.tscn")
	if scene == null:
		_fail("ModeLobbyScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame

	for node_name in [
		"ModeLobbyScroll",
		"ModeLobbySecondaryPanel",
		"PlayerHistoryPanel",
		"HistorySummary",
		"HistoryLadderSlot",
		"HistoryBest",
		"AccountPanelActions",
		"HistoryRecentScroll",
		"HistoryRunList",
		"SeasonHistoryScroll",
		"SeasonHistoryList",
		"SeasonHistoryHeading",
	]:
		_assert_has(screen, node_name)
	for button_name in [
		"HistoryShopButton",
		"HistoryAchievementsButton",
		"HistorySettingsButton",
		"HistoryDetailButton",
	]:
		var button := _find_by_name(screen, button_name)
		if not button is Button:
			_fail("ModeLobbyScreen history panel missing shortcut: %s" % button_name)
			return

	var sample_history := {
		"totalRuns": 7,
		"totalWins": 9,
		"totalLosses": 5,
		"completedRuns": 4,
		"bestRun": {"dogType": "VERY_LONG_UNKNOWN_DOG_TYPE_SHOULD_NOT_GROW_HISTORY_PANEL", "wins": 5, "losses": 1, "round": 8},
		"recentRuns": [
			{"id": "r1", "dogType": "VERY_LONG_UNKNOWN_DOG_TYPE_SHOULD_BE_ELLIPSIZED_IN_RECENT_ROW", "wins": 5, "losses": 1, "round": 8, "status": "COMPLETED"},
			{"id": "r2", "dogType": "SAMOYED", "wins": 4, "losses": 2, "round": 7, "status": "ACTIVE"},
			{"id": "r3", "dogType": "MUTT", "wins": 3, "losses": 3, "round": 6, "status": "COMPLETED"},
			{"id": "r4", "dogType": "BULLY", "wins": 2, "losses": 3, "round": 5, "status": "FAILED"},
			{"id": "r5", "dogType": "EMPEROR", "wins": 1, "losses": 3, "round": 4, "status": "COMPLETED"},
			{"id": "r6", "dogType": "FROG", "wins": 0, "losses": 3, "round": 3, "status": "FAILED"},
		],
	}
	var long_season_name := "Season With A Very Long Name That Should Clip And Never Push The Secondary History Panel Taller"
	var sample_seasons := [
		{"id": "season-2-summary", "seasonName": long_season_name, "ladderTierLabel": "MASTER", "ladderScore": 620, "dogKingRank": 2, "apexRank": 5, "apexWins": 11, "apexLosses": 1, "apexSnapshot": {"dogs": [{"dogType": "SHIBA"}]}},
		{"id": "season-1-summary", "seasonName": "Season One", "ladderTierLabel": "GOLD_WITH_A_VERY_LONG_TIER_LABEL_THAT_SHOULD_CLIP", "ladderScore": 90, "dogKingRank": 0, "apexRank": 0},
		{"id": "season-0-summary", "seasonName": "Season Zero", "ladderTierLabel": "BRONZE", "ladderScore": 20, "dogKingRank": 0, "apexRank": 12, "apexWins": 3, "apexLosses": 4},
		{"id": "season-old-summary", "seasonName": "Older Season", "ladderTierLabel": "BRONZE", "ladderScore": 10, "dogKingRank": 0, "apexRank": 0},
	]
	screen.call("set_payload", {
		"user": {"nickname": "Tester"},
		"history": sample_history,
		"seasonSummaries": sample_seasons,
		"ladderProfile": {"tierLabel": "SILVER", "score": 120},
		"season": {"name": "Current Season With A Very Long Name That Should Not Grow Rank Meta"},
	})
	await process_frame
	await process_frame

	var secondary_panel := _find_by_name(screen, "ModeLobbySecondaryPanel") as Control
	var history_panel := _find_by_name(screen, "PlayerHistoryPanel") as Control
	if secondary_panel == null or history_panel == null or not _is_descendant_of(history_panel, secondary_panel):
		_fail("ModeLobbyScreen history panel must live in the secondary lobby area")
		return
	if history_panel.custom_minimum_size.y > 300.0:
		_fail("ModeLobbyScreen history panel should stay secondary and compact")
		return
	if history_panel.size.y > 320.0:
		_fail("ModeLobbyScreen history panel must not grow from long summary/history text")
		return
	_assert_clipped_label(screen, "HistoryRankMeta", 36.0)
	_assert_clipped_label(screen, "HistoryBestLabel", 60.0)
	var recent_scroll := _find_by_name(screen, "HistoryRecentScroll") as ScrollContainer
	var history_list := _find_by_name(screen, "HistoryRunList") as VBoxContainer
	if recent_scroll == null or history_list == null or history_list.get_parent() != recent_scroll:
		_fail("ModeLobbyScreen recent history rows must be clipped inside a stable scroll area")
		return
	if recent_scroll.custom_minimum_size.y < 104.0 or recent_scroll.custom_minimum_size.y > 128.0:
		_fail("ModeLobbyScreen recent history scroll height must stay stable")
		return
	var season_scroll := _find_by_name(screen, "SeasonHistoryScroll") as ScrollContainer
	var season_list := _find_by_name(screen, "SeasonHistoryList") as VBoxContainer
	if season_scroll == null or season_list == null or season_list.get_parent() != season_scroll:
		_fail("ModeLobbyScreen season history must be clipped inside a stable scroll area")
		return
	if season_scroll.custom_minimum_size.y < 136.0 or season_scroll.custom_minimum_size.y > 176.0:
		_fail("ModeLobbyScreen season history scroll height must stay stable")
		return
	if season_scroll.size.y > 176.0:
		_fail("ModeLobbyScreen season history scroll must clip long season cards")
		return
	var history_rows := _count_named_children(screen, "HistoryRunRow")
	if history_rows != 5:
		_fail("ModeLobbyScreen must limit recent lobby runs to five rows, got %d" % history_rows)
		return
	var season_rows := _count_named_children(screen, "SeasonHistoryCard_")
	if season_rows != 3:
		_fail("ModeLobbyScreen must mirror Web season history limit of three cards, got %d" % season_rows)
		return
	_assert_label_text(screen, "SeasonHistoryName_season-2-summary", long_season_name)
	_assert_label_text(screen, "SeasonHistoryName_season-1-summary", "Season One")
	_assert_label_text(screen, "SeasonHistoryName_season-0-summary", "Season Zero")
	_assert_clipped_label(screen, "SeasonHistoryName_season-2-summary", 20.0)
	_assert_clipped_label(screen, "SeasonHistoryLadder_season-1-summary", 20.0)
	var snapshot_button := _find_by_name(screen, "SeasonSnapshotAction_season-2-summary") as Button
	if snapshot_button == null:
		_fail("ModeLobbyScreen must render season snapshot action when apexSnapshot exists")
		return
	if not snapshot_button.clip_text or snapshot_button.text_overrun_behavior != TextServer.OVERRUN_TRIM_ELLIPSIS:
		_fail("Season snapshot action must use stable Web action button clipping")
		return
	if str(snapshot_button.get_meta("web_action_button_original_label", "")) != snapshot_button.text:
		_fail("Season snapshot action original label metadata must match visible text")
		return
	for leaked in ["宸呭嘲", "閰嶇疆", "蹇収"]:
		if snapshot_button.text.contains(leaked) or str(snapshot_button.get_meta("web_action_button_original_label", "")).contains(leaked):
			_fail("Season snapshot action label must not contain mojibake fragment: %s" % leaked)
			return
	screen.call("_set_actions_disabled", true)
	if not snapshot_button.disabled:
		_fail("Season snapshot action must be tracked by action guard")
		return
	screen.call("_set_actions_disabled", false)
	if snapshot_button.disabled:
		_fail("Season snapshot action guard should restore enabled state")
		return
	if _find_by_name(screen, "SeasonHistoryCard_season-old-summary") != null:
		_fail("ModeLobbyScreen should not render more than three season history cards")
		return

	screen.call("set_payload", {
		"user": {"nickname": "Newbie"},
		"history": {"totalRuns": 0, "totalWins": 0, "totalLosses": 0, "completedRuns": 0, "bestRun": null, "recentRuns": null},
		"ladderProfile": null,
		"season": null,
		"seasonSummaries": [],
	})
	await process_frame
	if _find_by_name(screen, "SeasonHistoryEmpty") == null:
		_fail("ModeLobbyScreen must render empty season history as a stable Web empty state")
		return

	screen.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot mode lobby Web history panel smoke passed")
	quit(0)

func _count_named_children(node: Node, target_name: String) -> int:
	var count := 0
	if str(node.name).begins_with(target_name):
		count += 1
	for child in node.get_children():
		count += _count_named_children(child, target_name)
	return count

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("ModeLobbyScreen must mirror Web history panel structure: %s" % node_name)

func _assert_label_text(root_node: Node, node_name: String, expected: String) -> void:
	var label := _find_by_name(root_node, node_name) as Label
	if label == null:
		_fail("Missing label: %s" % node_name)
		return
	if label.text != expected:
		_fail("Label %s should be %s, got %s" % [node_name, expected, label.text])

func _assert_clipped_label(root_node: Node, node_name: String, max_height: float) -> void:
	var label := _find_by_name(root_node, node_name) as Label
	if label == null:
		_fail("Missing label: %s" % node_name)
		return
	if label.custom_minimum_size.y > max_height:
		_fail("Label %s must keep a stable height" % node_name)
		return
	if not label.clip_text or label.text_overrun_behavior != TextServer.OVERRUN_TRIM_ELLIPSIS:
		_fail("Label %s must clip and ellipsize overflow" % node_name)

func _is_descendant_of(node: Node, ancestor: Node) -> bool:
	var parent := node.get_parent()
	while parent != null:
		if parent == ancestor:
			return true
		parent = parent.get_parent()
	return false

func _find_by_name(node: Node, node_name: String) -> Node:
	if node.name == node_name:
		return node
	for child in node.get_children():
		var found := _find_by_name(child, node_name)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
