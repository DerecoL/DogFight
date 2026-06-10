extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/screens/DogfightRoomDetailScreen.tscn")
	if scene == null:
		_fail("DogfightRoomDetailScreen scene failed to load")
		return
	var fake_session := FakeSession.new()
	var screen = scene.instantiate()
	root.add_child(fake_session)
	root.add_child(screen)
	await process_frame
	if screen.has_method("bind_session"):
		screen.call("bind_session", fake_session)
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
		_assert_has(screen, node_name)
	for avatar_name in ["DogfightMemberAvatar_member-host", "DogfightMemberAvatar_member-bot"]:
		var avatar = _find_by_name(screen, avatar_name) as TextureRect
		if avatar == null or avatar.texture == null:
			_fail("Standalone dogfight member DogBadge avatar missing texture: %s" % avatar_name)
			return

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

	var bot_member = _find_by_name(screen, "DogfightMember_member-bot") as Button
	if bot_member == null:
		_fail("Standalone dogfight bot member button missing")
		return
	bot_member.pressed.emit()
	await process_frame
	await process_frame
	if fake_session.request_path != "/dogfight/battles/battle-bot":
		_fail("Standalone dogfight member card must request member current battle, got: %s" % fake_session.request_path)
		return
	if fake_session.replay_battle_id != "battle-bot":
		_fail("Standalone dogfight member card must emit selected member battle replay")
		return
	if fake_session.finish_context_room_id != "room-detail" or fake_session.finish_context_battle_id != "battle-bot":
		_fail("Standalone dogfight member battle replay must keep dogfight room finish context")
		return

	fake_session.reset_capture()
	var battle_row = _find_by_name(screen, "DogfightBattleRow_battle-1") as Button
	if battle_row == null:
		_fail("Standalone dogfight battle row button missing")
		return
	battle_row.pressed.emit()
	await process_frame
	await process_frame
	if fake_session.request_path != "/dogfight/battles/battle-1":
		_fail("Standalone dogfight battle row must request Web battle detail, got: %s" % fake_session.request_path)
		return
	if fake_session.replay_battle_id != "battle-1":
		_fail("Standalone dogfight battle row must emit battle replay result")
		return
	if fake_session.finish_context_room_id != "room-detail" or fake_session.finish_context_battle_id != "battle-1":
		_fail("Standalone dogfight battle replay must keep dogfight room finish context")
		return

	screen.queue_free()
	fake_session.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot standalone dogfight room detail Web structure smoke passed")
	quit(0)

class FakeSession extends Node:
	var request_path := ""
	var replay_battle_id := ""
	var finish_context_room_id := ""
	var finish_context_battle_id := ""

	func reset_capture() -> void:
		request_path = ""
		replay_battle_id = ""
		finish_context_room_id = ""
		finish_context_battle_id = ""

	func dogfight_room_request(path: String, _method := "GET", _body: Dictionary = {}) -> Dictionary:
		request_path = path
		var battle_id := path.get_file()
		return {
			"ok": true,
			"data": {
				"battle": {
					"id": battle_id,
					"result": {
						"id": battle_id,
						"events": [],
					},
				},
			},
		}

	func start_battle_replay(battle: Dictionary) -> void:
		replay_battle_id = str(battle.get("id", ""))
		var finish_context = battle.get("_finishContext", {})
		if finish_context is Dictionary:
			finish_context_room_id = str(finish_context.get("roomId", ""))
			finish_context_battle_id = str(finish_context.get("battleId", ""))

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
				"currentBattleId": "battle-bot",
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
