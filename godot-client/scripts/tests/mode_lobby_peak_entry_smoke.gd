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
		_fail("Main must expose router")
		return
	router.call("show_screen", "mode_lobby", false)
	await process_frame
	await process_frame
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if mode_lobby == null or not mode_lobby.visible:
		_fail("Standalone mode lobby should show ModeLobbyScreen")
		return
	var peak_button = mode_lobby.find_child("PeakModeButton", true, false) as Button
	if peak_button == null:
		_fail("Standalone mode lobby must expose PeakModeButton")
		return
	peak_button.pressed.emit()
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "apex":
		_fail("Peak entry should route to standalone apex, got %s" % str(router.get("current_screen_id")))
		return
	var apex = main.get_node_or_null("ScreenRoot/ApexScreen")
	if apex == null or not apex.visible:
		_fail("Peak entry should show ApexScreen")
		return
	if apex.find_child("ApexScreen", true, false) == null:
		_fail("Peak entry should render standalone Apex content")
		return
	if apex.find_child("PlaceholderPanel", true, false) != null:
		_fail("Peak entry must not show placeholder content")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot mode lobby peak entry smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
