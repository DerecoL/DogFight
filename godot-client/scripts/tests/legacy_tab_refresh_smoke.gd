extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/Main.tscn")
	if scene == null:
		_fail("Main scene failed to load")
		return
	var main = scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame

	var router = main.get("router")
	if router == null:
		_fail("Main must expose router")
		return
	for screen_id in ["leaderboards", "apex", "season", "dogfight_rooms", "account"]:
		if not main.call("open_screen", screen_id):
			_fail("open_screen should accept %s" % screen_id)
			return
		await process_frame
		if str(router.get("current_screen_id")) != screen_id:
			_fail("open_screen(%s) should route to standalone screen, got %s" % [screen_id, str(router.get("current_screen_id"))])
			return
		var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
		if legacy != null and legacy.visible:
			_fail("Standalone peripheral route %s must not show LegacyRunScreen" % screen_id)
			return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot legacy tab refresh smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
