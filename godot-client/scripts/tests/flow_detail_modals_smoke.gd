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
	var run_screen = main.get_node_or_null("ScreenRoot/RunScreen")
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	for method_name in ["_show_room_member_modal", "_show_room_battle_modal", "_show_ladder_settlement_modal", "_show_season_summary_modal"]:
		if not run_screen.has_method(method_name):
			_fail("%s is missing" % method_name)
			return
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	run_screen.call("_show_room_member_modal", {
		"id": "member-1",
		"nickname": "玩家A",
		"kind": "PLAYER",
		"isHost": true,
		"ready": false,
		"eliminated": false,
		"dogType": "SHIBA",
		"wins": 3,
		"losses": 1,
		"round": 4,
		"gold": 9,
		"phase": "SHOP",
		"status": "ACTIVE",
	})
	await process_frame
	_assert_modal_text(modal_layer, ["房间成员详情", "玩家A", "房主", "柴犬", "3胜 / 1负", "金币 9"])
	run_screen.call("_close_top_modal")
	await process_frame
	run_screen.call("_show_room_battle_modal", {
		"id": "battle-1",
		"round": 2,
		"opponentKind": "PLAYER",
		"winnerSide": "A",
		"winnerParticipantId": "member-1",
		"createdAt": "2026-06-02T06:00:00.000Z",
	})
	await process_frame
	_assert_modal_text(modal_layer, ["房间战报摘要", "第 2 回合", "玩家", "胜者成员 member-1", "battle-1", "载入战报"])
	run_screen.call("_close_top_modal")
	await process_frame
	run_screen.call("_show_ladder_settlement_modal", {
		"id": "settle-1",
		"beforeTier": "GOLD",
		"beforeScore": 82,
		"afterTier": "PLATINUM",
		"afterScore": 16,
		"delta": 34,
		"rawDelta": 42,
		"baseScore": 36,
		"tierTax": -5,
		"lossPenalty": -3,
		"perfectBonus": 6,
		"newbieProtection": 0,
		"wins": 12,
		"losses": 2,
	})
	await process_frame
	_assert_modal_text(modal_layer, ["天梯结算详情", "黄金 82", "铂金 16", "+34", "原始变化", "42", "完美奖励", "6"])
	run_screen.call("_close_top_modal")
	await process_frame
	run_screen.call("_show_season_summary_modal", {
		"seasonName": "第一赛季",
		"ladderTierLabel": "钻石",
		"ladderScore": 220,
		"ladderHighestTierLabel": "大师",
		"ladderGamesPlayed": 14,
		"ladderTotalWins": 33,
		"ladderTotalLosses": 8,
		"dogKingRank": 7,
		"apexRank": 4,
		"apexDogType": "SHIBA",
		"apexWins": 12,
		"apexLosses": 3,
		"apexRound": 16,
		"apexChallengeWins": 5,
	})
	await process_frame
	_assert_modal_text(modal_layer, ["赛季记录详情", "第一赛季", "钻石 220", "大师", "犬王第 7 名", "巅峰第 4 名", "柴犬"])
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot flow detail modals smoke passed")
	quit(0)

func _assert_modal_text(modal_layer: Node, expected: Array) -> void:
	if modal_layer.get_child_count() != 1:
		_fail("Expected exactly one modal, got %d" % modal_layer.get_child_count())
		return
	var text := _collect_text(modal_layer)
	for part in expected:
		var value := str(part)
		if not text.contains(value):
			_fail("Modal text missing: %s" % value)
			return

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
