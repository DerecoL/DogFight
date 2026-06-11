extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/screens/ApexScreen.tscn")
	if scene == null:
		_fail("ApexScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame
	screen.call("set_payload", {"apexData": _apex_data()})
	await process_frame

	for node_name in [
		"ApexPanel",
		"ApexScreen",
		"ApexReport",
		"ApexReportTitle",
		"ApexReportSummary",
		"ApexLeaderboard",
		"ApexTabs",
		"ApexTab_overall",
		"ApexTab_daily",
		"ApexRankEntry_apex-overall",
	]:
		_assert_has(screen, node_name)
	var daily_tab := _find_by_name(screen, "ApexTab_daily") as Button
	if daily_tab == null:
		_fail("Apex daily tab is missing")
		return
	daily_tab.pressed.emit()
	await process_frame
	_assert_has(screen, "ApexDailyHint")

	screen.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot apex submit report smoke passed")
	quit(0)

func _apex_data() -> Dictionary:
	return {
		"season": {"name": "Season One"},
		"dailyBoardKey": "2026-06-02",
		"dailyResetHour": 5,
		"candidates": [
			{"id": "run-old", "dogType": "MUTT", "wins": 9, "losses": 3, "round": 12, "items": [], "relics": []},
		],
		"reports": {
			"overall": {"placementRank": 7, "battles": []},
			"daily": {"placementRank": null, "battles": []},
		},
		"entries": {
			"overall": {"id": "apex-overall", "name": "Apex Player", "dogType": "SHIBA", "wins": 12, "losses": 2, "round": 16, "rank": 7, "challengeWins": 3, "isMine": true, "items": [], "relics": []},
			"daily": {"id": "apex-daily", "name": "Apex Player", "dogType": "SHIBA", "wins": 12, "losses": 2, "round": 16, "rank": null, "challengeWins": 3, "isMine": true, "items": [], "relics": []},
		},
		"leaderboards": {
			"overall": [{"id": "apex-overall", "name": "Apex Player", "dogType": "SHIBA", "wins": 12, "losses": 2, "round": 16, "rank": 7, "challengeWins": 3, "isMine": true, "items": [], "relics": []}],
			"daily": [],
		},
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing Apex node: %s" % node_name)

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
