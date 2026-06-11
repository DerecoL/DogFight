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

	screen.call("set_payload", {
		"user": {"nickname": "Tester"},
		"run": {},
		"history": {
			"totalRuns": 0,
			"totalWins": 0,
			"totalLosses": 0,
			"completedRuns": 0,
			"bestRun": null,
			"recentRuns": [],
		},
		"ladderProfile": null,
		"season": null,
	})
	await process_frame

	for node_name in [
		"ModeLobbyPanel",
		"ModeLobbyScroll",
		"ModeLobbyHero",
		"ModeLobbyHeading",
		"ModeLobbyTitle",
		"ModeLobbySubtitle",
		"ModeLobbyPrimaryModes",
		"ModeLobbySecondaryPanel",
		"ModeLobbyAccountStrip",
		"TutorialReplayButton",
		"ModeGrid",
		"CasualModeButton",
		"LadderModeButton",
		"DogfightModeButton",
		"PeakModeButton",
		"PlayerHistoryPanel",
		"HistorySummary",
		"HistoryRunList",
	]:
		if screen.find_child(node_name, true, false) == null:
			_fail("Missing mode lobby Web node: %s" % node_name)
			return

	var primary_modes := screen.find_child("ModeLobbyPrimaryModes", true, false) as Control
	var secondary_panel := screen.find_child("ModeLobbySecondaryPanel", true, false) as Control
	if primary_modes == null or secondary_panel == null:
		_fail("ModeLobby must split primary modes from secondary content")
		return
	if primary_modes.get_parent() != secondary_panel.get_parent() or primary_modes.get_index() > secondary_panel.get_index():
		_fail("ModeGrid must be visually prioritized before secondary history/account content")
		return

	var grid := screen.find_child("ModeGrid", true, false) as GridContainer
	if grid.columns != 2:
		_fail("ModeGrid must keep the Web two-column card grid")
		return
	if grid.size_flags_vertical != Control.SIZE_EXPAND_FILL:
		_fail("ModeGrid should reserve first-screen vertical priority")
		return

	var card_min := WebUiTokens.lobby_mode_card_min_size()
	for mode_id in ["CASUAL", "LADDER", "DOGFIGHT", "PEAK"]:
		var card := screen.find_child("ModeCard_%s" % mode_id, true, false) as PanelContainer
		if card == null:
			_fail("ModeLobby missing mode card: %s" % mode_id)
			return
		if card.custom_minimum_size.x < card_min.x or card.custom_minimum_size.y < card_min.y:
			_fail("Mode card %s must use the shared lobby card minimum size" % mode_id)
			return
		var card_style := card.get_theme_stylebox("panel") as StyleBoxFlat
		if card_style == null or card_style.bg_color != WebUiTokens.mode_card_style().bg_color:
			_fail("Mode card %s must use WebUiTokens.mode_card_style" % mode_id)
			return
		for child_name in [
			"ModeIcon_%s" % mode_id,
			"ModeCopy_%s" % mode_id,
			"ModeTitle_%s" % mode_id,
			"ModeDescription_%s" % mode_id,
		]:
			if screen.find_child(child_name, true, false) == null:
				_fail("ModeLobby mode card must mirror Web child: %s" % child_name)
				return
		var description := screen.find_child("ModeDescription_%s" % mode_id, true, false) as Label
		if description == null or description.custom_minimum_size.y < 56.0 or not description.clip_text:
			_fail("Mode description %s must keep a stable clipped text area" % mode_id)
			return
	for button_name in ["CasualModeButton", "LadderModeButton", "DogfightModeButton", "PeakModeButton"]:
		_assert_mode_action_button(screen, button_name)

	var source := FileAccess.get_file_as_string("res://scripts/ui/screens/ModeLobbyScreen.gd")
	for needle in ["open_screen", "open_run_lobby", "dogfight_rooms", "leaderboards", "apex"]:
		if not source.contains(needle):
			_fail("ModeLobbyScreen source missing interaction: %s" % str(needle))
			return
	if screen.find_child("StartRunButton", true, false) != null:
		_fail("ModeLobbyScreen must not expose direct start form controls")
		return

	screen.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot mode lobby Web text structure smoke passed")
	quit(0)

func _assert_mode_action_button(root_node: Node, node_name: String) -> void:
	var node := root_node.find_child(node_name, true, false)
	if not node is Button:
		_fail("%s should be a Web mode-action Button" % node_name)
		return
	var button := node as Button
	if button.text.contains("\n"):
		_fail("%s should only contain Web action text, got multiline card text" % node_name)
	if button.custom_minimum_size.y != WebUiTokens.touch_target_height():
		_fail("%s should keep the shared touch target height" % node_name)
	if not button.clip_text or button.text_overrun_behavior != TextServer.OVERRUN_TRIM_ELLIPSIS:
		_fail("%s should keep long active/continue text single-line and clipped" % node_name)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
