extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene = load("res://scenes/screens/LeaderboardsScreen.tscn")
	if scene == null:
		_fail("LeaderboardsScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame

	screen.call("set_payload", _payload(false))
	await process_frame

	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("LeaderboardsScreen must be standalone and must not redirect to LegacyRunScreen")
		return

	for node_name in [
		"LadderScreen",
		"LadderHeading",
		"LadderHeadingTitle",
		"LadderHeadingSubtitle",
		"LadderLayout",
		"CurrentTierPanel",
		"LadderProgress",
		"DogKingLeaderboardPanel",
		"LadderBoard",
		"LadderRow_1",
		"LadderRow_2",
		"LadderStart",
		"DogSelectScreen",
		"DogCardGrid",
		"DogDetailPanel",
		"StartLadderRunButton",
		"RecentSettlementsPanel",
		"RecentSettlementsBoard",
		"LadderSettlementLine_settle-1",
	]:
		_assert_has(screen, node_name)

	var layout := screen.find_child("LadderLayout", true, false) as GridContainer
	if layout == null or layout.columns != 2:
		_fail("LadderLayout must use the Web two-panel grid")
		return

	var grid := screen.find_child("DogCardGrid", true, false) as GridContainer
	if grid == null or grid.columns != 4:
		_fail("Standalone ladder DogCardGrid should use four columns like Web")
		return
	if grid.get_child_count() != 8:
		_fail("Standalone ladder DogCardGrid should mirror Web's fixed 8 dog slots, got %d" % grid.get_child_count())
		return
	for dog_type in ["SHIBA", "SAMOYED", "MUTT", "BULLY", "EMPEROR", "FROG"]:
		var card = screen.find_child("LadderDogCard_%s" % dog_type, true, false) as Button
		if card == null:
			_fail("Standalone ladder DogCardGrid missing card for %s" % dog_type)
			return
		for child_name in [
			"LadderDogCardArtFrame_%s" % dog_type,
			"LadderDogCardDogBadge_%s" % dog_type,
			"LadderDogCardAvatar_%s" % dog_type,
			"LadderDogCardArt_%s" % dog_type,
			"LadderDogCardName_%s" % dog_type,
			"LadderDogCardCopy_%s" % dog_type,
		]:
			if card.find_child(child_name, true, false) == null:
				_fail("Standalone ladder DogCard should mirror Web card child: %s" % child_name)
				return
		var avatar = card.find_child("LadderDogCardAvatar_%s" % dog_type, true, false) as TextureRect
		if avatar == null or avatar.texture == null:
			_fail("Standalone ladder DogCardGrid card must render Web DogBadge avatar for %s" % dog_type)
			return
	for index in [6, 7]:
		_assert_has(screen, "LadderDogCardPlaceholder_%d" % index)
	_assert_has(screen, "DogDetailDogBadge")
	var detail_avatar = screen.find_child("DogDetailAvatar", true, false) as TextureRect
	if detail_avatar == null or detail_avatar.texture == null:
		_fail("Standalone ladder DogDetailPanel must render selected dog DogBadge avatar")
		return

	var progress := screen.find_child("LadderProgress", true, false) as ProgressBar
	if progress == null or int(progress.value) != 100:
		_fail("Dog king ladder progress should be capped at 100")
		return

	var text := _collect_text(screen)
	for part in ["Top Dog", "My Dog", "+34"]:
		if not text.contains(part):
			_fail("Standalone ladder text missing payload value: %s" % part)
			return

	screen.call("set_payload", _payload(true))
	await process_frame
	if screen.find_child("StartLadderRunButton", true, false) != null:
		_fail("Standalone active LADDER run must not expose StartLadderRunButton")
		return
	if screen.find_child("DogCardGrid", true, false) != null:
		_fail("Standalone active LADDER run must not expose a fresh dog picker")
		return
	if screen.find_child("ContinueLadderRunButton", true, false) == null:
		_fail("Standalone active LADDER run should expose ContinueLadderRunButton")
		return

	screen.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot standalone leaderboards ladder Web structure smoke passed")
	quit(0)

func _payload(active_ladder: bool) -> Dictionary:
	var payload := {
		"ladderData": {
			"season": {"name": "S1"},
			"profile": {
				"tier": "DOG_KING" if not active_ladder else "SILVER",
				"tierLabel": "DOG_KING" if not active_ladder else "SILVER",
				"score": 720 if not active_ladder else 180,
				"gamesPlayed": 30 if not active_ladder else 4,
				"totalWins": 21 if not active_ladder else 3,
				"totalLosses": 9 if not active_ladder else 1,
			},
			"recentSettlements": [
				{"id": "settle-1", "wins": 12, "losses": 2, "beforeTier": "MASTER", "beforeScore": 486, "afterTier": "DOG_KING", "afterScore": 20, "delta": 34},
			] if not active_ladder else [],
		},
		"leaderboardData": {
			"playerRank": 2 if not active_ladder else null,
			"leaderboard": [
				{"rank": 1, "title": "DOG_KING", "name": "Top Dog", "profile": {"score": 880}},
				{"rank": 2, "title": "DOG_KING", "name": "My Dog", "profile": {"score": 720}},
			] if not active_ladder else [],
		},
	}
	if active_ladder:
		payload["run"] = {"id": "active-ladder", "mode": "LADDER", "phase": "SHOP", "status": "ACTIVE"}
	return payload

func _assert_has(root_node: Node, node_name: String) -> void:
	if root_node.find_child(node_name, true, false) == null:
		_fail("Missing standalone ladder Web node: %s" % node_name)

func _collect_text(node: Node) -> String:
	var text := ""
	if node is Label:
		text += (node as Label).text + "\n"
	if node is Button:
		text += (node as Button).text + "\n"
	for child in node.get_children():
		text += _collect_text(child)
	return text

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
