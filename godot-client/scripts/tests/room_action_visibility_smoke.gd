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
	run_screen.set("current_tab", "房间")

	run_screen.set("active_room", _room("WAITING", "LOBBY", false, false, false, false))
	run_screen.call("_render_current_tab")
	await process_frame
	_assert_no_button(run_screen, "开始房间")
	_assert_no_button(run_screen, "准备 / 完成本回合")
	_assert_no_button(run_screen, "选择当前狗狗")

	run_screen.set("active_room", _room("WAITING", "LOBBY", true, false, false, false))
	run_screen.call("_render_current_tab")
	await process_frame
	_assert_button(run_screen, "开始房间")
	_assert_no_button(run_screen, "准备 / 完成本回合")
	_assert_no_button(run_screen, "选择当前狗狗")

	run_screen.set("active_room", _room("ACTIVE", "DOG_SELECT", false, false, false, false))
	run_screen.call("_render_current_tab")
	await process_frame
	_assert_no_button(run_screen, "开始房间")
	_assert_no_button(run_screen, "准备 / 完成本回合")
	_assert_no_button(run_screen, "选择当前狗狗")
	_assert_button(run_screen, "锁定斗狗")

	run_screen.set("active_room", _room("ACTIVE", "SHOP", false, true, false, false))
	run_screen.call("_render_current_tab")
	await process_frame
	_assert_button(run_screen, "准备 / 完成本回合")
	_assert_no_button(run_screen, "开始房间")
	_assert_no_button(run_screen, "选择当前狗狗")

	run_screen.set("active_room", _room("ACTIVE", "SHOP", false, true, true, false))
	run_screen.call("_render_current_tab")
	await process_frame
	_assert_no_button(run_screen, "准备 / 完成本回合")

	run_screen.set("active_room", _room("ACTIVE", "BATTLE", false, true, false, true))
	run_screen.call("_render_current_tab")
	await process_frame
	_assert_no_button(run_screen, "准备 / 完成本回合")

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot room action visibility smoke passed")
	quit(0)

func _room(status: String, phase: String, is_host: bool, with_run: bool, member_ready: bool, member_eliminated: bool) -> Dictionary:
	var room := {
		"id": "room-action-%s-%s" % [status, phase],
		"status": status,
		"phase": phase,
		"currentRound": 2,
		"isHost": is_host,
		"members": [
			{"id": "member-1", "nickname": "玩家A", "kind": "PLAYER", "wins": 1, "losses": 0, "ready": member_ready, "eliminated": member_eliminated, "runId": "run-1"},
		],
		"battles": [],
		"currentRunMember": {"id": "member-1", "ready": member_ready, "eliminated": member_eliminated, "runId": "run-1"},
	}
	if with_run:
		room["currentRun"] = {
			"id": "run-1",
			"mode": "DOGFIGHT",
			"phase": phase,
			"status": "ACTIVE",
			"dogType": "SHIBA",
			"round": 2,
			"wins": 1,
			"losses": 0,
			"gold": 8,
			"items": [],
			"relics": [],
			"shopItems": [],
		}
	return room

func _assert_button(root_node: Node, text: String) -> void:
	var button := _find_button(root_node, text)
	if button == null:
		_fail("Missing button: %s" % text)
		return
	if button.disabled:
		_fail("Button should be enabled: %s" % text)

func _assert_no_button(root_node: Node, text: String) -> void:
	var button := _find_button(root_node, text)
	if button != null and not button.disabled:
		_fail("Button should not be available: %s" % text)

func _find_button(node: Node, text: String) -> Button:
	if node is Button and (node as Button).text == text:
		return node as Button
	for child in node.get_children():
		var found := _find_button(child, text)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
