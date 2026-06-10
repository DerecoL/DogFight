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
		"PlayerHistoryPanel",
		"HistorySummary",
		"HistoryLadderSlot",
		"HistoryBest",
		"AccountPanelActions",
		"HistoryRunList",
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
		"bestRun": {"dogType": "SHIBA", "wins": 5, "losses": 1, "round": 8},
		"recentRuns": [
			{"id": "r1", "dogType": "SHIBA", "wins": 5, "losses": 1, "round": 8, "status": "COMPLETED"},
			{"id": "r2", "dogType": "SAMOYED", "wins": 4, "losses": 2, "round": 7, "status": "ACTIVE"},
			{"id": "r3", "dogType": "MUTT", "wins": 3, "losses": 3, "round": 6, "status": "COMPLETED"},
			{"id": "r4", "dogType": "BULLY", "wins": 2, "losses": 3, "round": 5, "status": "FAILED"},
			{"id": "r5", "dogType": "EMPEROR", "wins": 1, "losses": 3, "round": 4, "status": "COMPLETED"},
			{"id": "r6", "dogType": "FROG", "wins": 0, "losses": 3, "round": 3, "status": "FAILED"},
		],
	}
	var sample_seasons := [
		{"id": "season-2-summary", "seasonName": "Season Two", "ladderTierLabel": "MASTER", "ladderScore": 620, "dogKingRank": 2, "apexRank": 5, "apexWins": 11, "apexLosses": 1},
		{"id": "season-1-summary", "seasonName": "Season One", "ladderTierLabel": "GOLD", "ladderScore": 90, "dogKingRank": 0, "apexRank": 0},
		{"id": "season-0-summary", "seasonName": "Season Zero", "ladderTierLabel": "BRONZE", "ladderScore": 20, "dogKingRank": 0, "apexRank": 12, "apexWins": 3, "apexLosses": 4},
		{"id": "season-old-summary", "seasonName": "Older Season", "ladderTierLabel": "BRONZE", "ladderScore": 10, "dogKingRank": 0, "apexRank": 0},
	]
	screen.call("set_payload", {
		"user": {"nickname": "Tester"},
		"history": sample_history,
		"seasonSummaries": sample_seasons,
		"ladderProfile": {"tierLabel": "SILVER", "score": 120},
		"season": {"name": "Current Season"},
	})
	await process_frame

	var history_rows := _count_named_children(screen, "HistoryRunRow")
	if history_rows != 5:
		_fail("ModeLobbyScreen must limit recent lobby runs to five rows, got %d" % history_rows)
		return
	var season_rows := _count_named_children(screen, "SeasonHistoryCard_")
	if season_rows != 3:
		_fail("ModeLobbyScreen must mirror Web season history limit of three cards, got %d" % season_rows)
		return
	_assert_label_text(screen, "SeasonHistoryName_season-2-summary", "Season Two")
	_assert_label_text(screen, "SeasonHistoryName_season-1-summary", "Season One")
	_assert_label_text(screen, "SeasonHistoryName_season-0-summary", "Season Zero")
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
