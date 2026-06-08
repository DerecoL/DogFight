extends SceneTree

var seen_paths: Dictionary = {}

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

	var api = main.get("api")
	if api == null or not api.has_signal("request_finished"):
		_fail("Main API client must emit request_finished")
		return
	api.request_finished.connect(func(path: String, _ok: bool, _status: int, _payload: Dictionary) -> void:
		seen_paths[path] = true
	)

	var expectations := {
		"account_shop": ["/shop", "/cosmetics/me"],
		"achievements": ["/achievements"],
		"leaderboards": ["/ladder/me", "/ladder/leaderboard"],
		"apex": ["/apex"],
		"dogfight_rooms": ["/dogfight/rooms"],
	}
	for screen_id in expectations.keys():
		seen_paths.clear()
		main.call("open_screen", screen_id)
		if not await _wait_for_paths(expectations[screen_id]):
			_fail("%s did not refresh required API paths: %s" % [screen_id, ",".join(expectations[screen_id])])
			return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot peripheral screen refresh smoke passed")
	quit(0)

func _wait_for_paths(paths: Array) -> bool:
	for _frame in range(180):
		var complete := true
		for path in paths:
			if not seen_paths.has(str(path)):
				complete = false
				break
		if complete:
			return true
		await process_frame
	return false

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
