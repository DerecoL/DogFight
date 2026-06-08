extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var main_scene = load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame

	var router = main.get("router")
	if router == null:
		_fail("Main session must expose router")
		return
	main.call("set_current_run", {
		"id": "lobby-return-smoke",
		"phase": "MAP",
		"status": "ACTIVE",
		"items": [],
		"relics": [],
		"shopItems": [],
	})
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "legacy_run":
		_fail("Run payload should show playable shell before returning lobby")
		return

	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null or not legacy.has_method("open_mode_lobby"):
		_fail("LegacyRunScreen must expose open_mode_lobby")
		return
	var text := _collect_text(legacy)
	if not text.contains("返回大厅"):
		_fail("LegacyRunScreen must render a return-to-lobby button")
		return
	legacy.call("open_mode_lobby")
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "legacy_run":
		_fail("open_mode_lobby should keep the playable shell visible, got %s" % str(router.get("current_screen_id")))
		return
	if main.get_node_or_null("ScreenRoot/ModeLobbyScreen").visible:
		_fail("open_mode_lobby must not show the old standalone ModeLobbyScreen")
		return
	if str(legacy.get("current_tab")) != "大厅":
		_fail("open_mode_lobby should route to the playable lobby tab")
		return
	if not _collect_text(legacy).contains("竞技方式"):
		_fail("open_mode_lobby should render playable mode entries")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot legacy shell lobby return smoke passed")
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
