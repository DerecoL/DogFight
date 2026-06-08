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
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	run_screen.set("active_room", {
		"id": "room-dog-select",
		"status": "ACTIVE",
		"phase": "DOG_SELECT",
		"currentRound": 1,
		"isHost": false,
		"members": [
			{"id": "member-1", "nickname": "玩家A", "kind": "PLAYER", "wins": 0, "losses": 0, "ready": false},
			{"id": "bot-1", "nickname": "机器人", "kind": "BOT", "wins": 0, "losses": 0, "ready": false},
		],
		"battles": [],
	})
	run_screen.set("current_tab", "房间")
	run_screen.call("_render_current_tab")
	await process_frame
	var text := _collect_text(run_screen)
	for part in ["当前房间", "选狗阶段", "选择斗狗", "15 秒内锁定狗狗", "选择狗狗", "锁定斗狗"]:
		if not text.contains(str(part)):
			_fail("Room dog-select view missing: %s" % str(part))
			return
	if run_screen.find_child("RoomDogChoiceButton", true, false) == null:
		_fail("Room dog-select view must expose RoomDogChoiceButton")
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot room dog-select entry smoke passed")
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
