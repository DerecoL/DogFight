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
	if run_screen != null and run_screen.has_method("bind_session"):
		run_screen.bind_session(main)
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if run_screen == null or modal_layer == null:
		_fail("Required nodes are missing")
		return
	run_screen.call("_show_snapshot_item_modal", {
		"id": "bag-item",
		"defId": "starter-1",
		"quality": "SILVER",
		"area": "BAG",
		"x": 2,
		"y": 0,
		"def": {"name": "背包牙咬", "description": "造成伤害", "triggerDice": [1]},
	})
	await process_frame
	var item_text := _collect_text(modal_layer)
	for expected in ["快照装备详情", "背包牙咬", "白银", "背包"]:
		if not item_text.contains(expected):
			_fail("Snapshot item area label missing: %s" % expected)
			return
	for raw_area in ["BAG", "EQUIPMENT"]:
		if item_text.contains(raw_area):
			_fail("Snapshot item leaked raw area: %s" % raw_area)
			return
	run_screen.call("_close_top_modal")
	await process_frame
	run_screen.call("_show_room_battle_modal", {
		"id": "battle-summary",
		"round": 3,
		"opponentKind": "PLAYER",
		"winnerSide": "player",
		"winnerParticipantId": "member-1",
	})
	await process_frame
	var battle_text := _collect_text(modal_layer)
	for expected in ["房间战报摘要", "玩家", "我方", "胜者成员 member-1"]:
		if not battle_text.contains(expected):
			_fail("Room battle label missing: %s" % expected)
			return
	for raw in ["PLAYER", "winnerParticipantId", "player"]:
		if battle_text.contains(raw):
			_fail("Room battle leaked raw enum: %s" % raw)
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot area room battle labels smoke passed")
	quit(0)

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
