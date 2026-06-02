extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/RunScreen.gd")
	for needle in [
		"SETTINGS_PATH",
		"func _music_enabled_preference() -> bool:",
		"func _set_music_enabled_preference(enabled: bool) -> void:",
		"_set_music_enabled_preference(false)",
		"_set_music_enabled_preference(true)",
	]:
		if not source.contains(str(needle)):
			_fail("Music preference wiring is missing: %s" % str(needle))
			return
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
	for method_name in ["_music_enabled_preference", "_set_music_enabled_preference"]:
		if not run_screen.has_method(method_name):
			_fail("%s is missing" % method_name)
			return
	run_screen.call("_set_music_enabled_preference", false)
	if bool(run_screen.call("_music_enabled_preference")):
		_fail("Music preference should persist disabled")
		return
	run_screen.call("_set_music_enabled_preference", true)
	if not bool(run_screen.call("_music_enabled_preference")):
		_fail("Music preference should persist enabled")
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot music preference smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
