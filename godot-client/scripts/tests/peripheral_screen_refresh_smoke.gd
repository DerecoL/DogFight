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
	var expectations := {
		"account": "AccountHistoryScreen",
		"achievements": "AchievementsScreen",
		"leaderboards": "LeaderboardsScreen",
		"apex": "ApexScreen",
		"season": "SeasonScreen",
		"dogfight_rooms": "DogfightRoomsScreen",
	}
	for screen_id in expectations.keys():
		main.call("open_screen", screen_id)
		await process_frame
		if str(router.get("current_screen_id")) != screen_id:
			_fail("%s should route standalone, got %s" % [screen_id, str(router.get("current_screen_id"))])
			return
		var screen = main.get_node_or_null("ScreenRoot/%s" % str(expectations[screen_id]))
		if screen == null or not screen.visible:
			_fail("%s screen should be visible" % screen_id)
			return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot peripheral screen refresh smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
