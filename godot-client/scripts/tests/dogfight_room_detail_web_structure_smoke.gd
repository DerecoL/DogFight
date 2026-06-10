extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var main_scene := load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame
	var run_screen = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	if run_screen.has_method("bind_session"):
		run_screen.bind_session(main)
	run_screen.set("active_room", {
		"id": "room-detail",
		"status": "ACTIVE",
		"phase": "SHOP",
		"currentRound": 3,
		"maxPlayers": 8,
		"isHost": true,
		"members": [
			{
				"id": "member-host",
				"nickname": "房主烟测",
				"kind": "PLAYER",
				"isHost": true,
				"dogType": "SHIBA",
				"wins": 2,
				"losses": 1,
				"ready": false,
				"eliminated": false,
				"runId": "run-detail",
			},
			{
				"id": "member-bot",
				"nickname": "训练机器人",
				"kind": "BOT",
				"isHost": false,
				"dogType": "SAMOYED",
				"wins": 1,
				"losses": 2,
				"ready": true,
				"eliminated": false,
			},
			{
				"id": "member-waiting",
				"nickname": "waiting-player",
				"kind": "PLAYER",
				"isHost": false,
				"wins": 0,
				"losses": 0,
				"ready": false,
				"eliminated": false,
			},
		],
		"battles": [
			{"id": "battle-1", "round": 3, "opponentKind": "PLAYER"},
		],
		"currentRunMember": {
			"id": "member-host",
			"nickname": "房主烟测",
			"kind": "PLAYER",
			"wins": 2,
			"losses": 1,
			"ready": false,
			"eliminated": false,
			"runId": "run-detail",
		},
		"currentRun": {
			"id": "run-detail",
			"mode": "DOGFIGHT",
			"phase": "SHOP",
			"status": "ACTIVE",
			"dogType": "SHIBA",
			"round": 3,
			"wins": 2,
			"losses": 1,
			"gold": 12,
			"items": [],
			"relics": [],
			"shopType": "GENERAL",
			"refreshCost": 1,
			"shopItems": [],
		},
	})
	run_screen.set("current_tab", "房间")
	run_screen.call("_render_current_tab")
	await process_frame

	for node_name in [
		"DogfightRoomDetailScreen",
		"DogfightRoomToolbar",
		"DogfightRoomBackButton",
		"DogfightRoomRefreshButton",
		"DogfightRoomStatus",
		"DogfightPhaseTrack",
		"DogfightRunStats",
		"DogfightReadyButton",
		"DogfightRoomColumns",
		"DogfightSurvivorBoard",
		"DogfightMember_member-host",
		"DogfightMemberDogBadge_member-host",
		"DogfightMemberAvatar_member-host",
		"DogfightMember_member-bot",
		"DogfightMemberDogBadge_member-bot",
		"DogfightMemberAvatar_member-bot",
		"DogfightMember_member-waiting",
		"DogfightMemberPaw_member-waiting",
		"DogfightPlayArea",
		"DogfightBattleDock",
		"DogfightBattleRow_battle-1",
	]:
		_assert_has(run_screen, node_name)
	for avatar_name in ["DogfightMemberAvatar_member-host", "DogfightMemberAvatar_member-bot"]:
		var avatar = _find_by_name(run_screen, avatar_name) as TextureRect
		if avatar == null or avatar.texture == null:
			_fail("Dogfight member DogBadge avatar missing texture: %s" % avatar_name)
			return

	var columns = _find_by_name(run_screen, "DogfightRoomColumns")
	if not columns is GridContainer:
		_fail("DogfightRoomColumns must use a three-column grid like the Web room view")
		return
	if int((columns as GridContainer).columns) != 3:
		_fail("DogfightRoomColumns must keep survivor/play/battle columns")
		return

	var text := _collect_text(run_screen)
	for part in [
		"返回房间列表",
		"刷新房间",
		"商店阶段 · 第 3 回合",
		"阶段倒计时",
		"选狗阶段",
		"商店阶段",
		"战斗阶段",
		"金币 12",
		"2胜 1败",
		"第 3 回合",
		"调整中",
		"剩余存活",
		"完成本回合",
		"房间玩家",
		"房主烟测 · 房主",
		"柴犬 · 玩家 · 2胜 1败",
		"训练机器人",
		"萨摩耶 · 参赛者 · 1胜 2败",
		"本轮场次",
		"第 3 回合 · 玩家对战 · 回放",
	]:
		if not text.contains(part):
			_fail("Dogfight room detail Web text missing: %s" % part)
			return

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot dogfight room detail Web structure smoke passed")
	quit(0)

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing dogfight room detail Web node: %s" % node_name)

func _find_by_name(node: Node, node_name: String) -> Node:
	if node.name == node_name:
		return node
	for child in node.get_children():
		var found := _find_by_name(child, node_name)
		if found != null:
			return found
	return null

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
