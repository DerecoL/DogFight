extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/screens/DogfightRoomDetailScreen.tscn")
	if scene == null:
		_fail("DogfightRoomDetailScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame
	if screen.has_method("set_payload"):
		screen.call("set_payload", {"dogfightRoomData": _sample_room()})
	await process_frame

	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("DogfightRoomDetailScreen must be standalone and must not redirect to LegacyRunScreen")
		return

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
		"DogfightMember_member-bot",
		"DogfightPlayArea",
		"DogfightBattleDock",
		"DogfightBattleRow_battle-1",
	]:
		_assert_has(screen, node_name)

	var columns = _find_by_name(screen, "DogfightRoomColumns")
	if not columns is GridContainer:
		_fail("DogfightRoomColumns must use a three-column grid like the Web room view")
		return
	if int((columns as GridContainer).columns) != 3:
		_fail("DogfightRoomColumns must keep survivor/play/battle columns")
		return

	var text := _collect_text(screen)
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
		"房间当前跑局",
		"本轮场次",
		"第 3 回合 · 玩家对战 · 回放",
	]:
		if not text.contains(part):
			_fail("Standalone dogfight room detail Web text missing: %s" % part)
			return

	screen.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot standalone dogfight room detail Web structure smoke passed")
	quit(0)

func _sample_room() -> Dictionary:
	return {
		"id": "room-detail",
		"status": "ACTIVE",
		"phase": "SHOP",
		"currentRound": 3,
		"maxPlayers": 8,
		"isHost": true,
		"deadlineAt": Time.get_unix_time_from_system() + 30,
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
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing standalone dogfight room detail Web node: %s" % node_name)

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
