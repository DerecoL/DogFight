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
	main.call("open_screen", "account_shop")
	await _wait_for_idle(main)

	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null:
		_fail("LegacyRunScreen is missing")
		return
	var cases := {
		"成就": ["/achievements"],
		"商城": ["/shop", "/cosmetics/me"],
		"排行": ["/ladder/me", "/ladder/leaderboard"],
		"巅峰": ["/apex"],
		"赛季": ["/ladder/me", "/runs/history"],
		"房间": ["/dogfight/rooms"],
	}
	for tab in cases.keys():
		seen_paths.clear()
		legacy.call("_on_tab_pressed", tab)
		if not await _wait_for_paths(cases[tab]):
			_fail("Tab %s did not refresh required API paths: %s" % [tab, ",".join(cases[tab])])
			return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot legacy tab refresh smoke passed")
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

func _wait_for_idle(main: Node) -> void:
	for _frame in range(180):
		var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
		if legacy != null and not bool(legacy.get("action_in_progress")):
			return
		await process_frame

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
