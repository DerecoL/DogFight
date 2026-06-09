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

	if not main.call("open_screen", "mode_lobby"):
		_fail("Main should open standalone mode lobby")
		return
	await process_frame
	await process_frame

	var router = main.get("router")
	if router == null or str(router.get("current_screen_id")) != "mode_lobby":
		_fail("open_screen(mode_lobby) should route to mode_lobby, got %s" % (str(router.get("current_screen_id")) if router != null else "<missing>"))
		return
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if mode_lobby == null or not mode_lobby.visible:
		_fail("open_screen(mode_lobby) should show ModeLobbyScreen")
		return
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy != null and legacy.visible:
		_fail("open_screen(mode_lobby) must not show LegacyRunScreen")
		return
	for node_name in ["ModeLobbyPanel", "ModeLobbyScroll", "ModeGrid", "CasualModeButton", "LadderModeButton", "DogfightModeButton", "PeakModeButton"]:
		if mode_lobby.find_child(node_name, true, false) == null:
			_fail("Standalone mode lobby missing Web node: %s" % node_name)
			return
	if _visible_option_button_count(mode_lobby) > 0:
		_fail("Standalone mode lobby must not expose old dog/mode/lucky dropdowns")
		return
	if _has_visible_button_text(mode_lobby, "新建跑局"):
		_fail("Standalone mode lobby must not expose old global create-run button")
		return
	if _has_visible_button_text(mode_lobby, "刷新全部"):
		_fail("Standalone mode lobby must not expose old global refresh button")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot standalone mode lobby Web mode smoke passed")
	quit(0)

func _visible_option_button_count(node: Node) -> int:
	var count := 0
	if node is OptionButton and (node as OptionButton).is_visible_in_tree():
		count += 1
	for child in node.get_children():
		count += _visible_option_button_count(child)
	return count

func _has_visible_button_text(node: Node, text: String) -> bool:
	if node is Button and (node as Button).is_visible_in_tree() and (node as Button).text.contains(text):
		return true
	for child in node.get_children():
		if _has_visible_button_text(child, text):
			return true
	return false

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
