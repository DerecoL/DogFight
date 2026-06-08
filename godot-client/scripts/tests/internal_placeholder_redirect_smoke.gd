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
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if router == null or legacy == null:
		_fail("Main must expose router and LegacyRunScreen")
		return
	for screen_id in [
		"mode_lobby",
		"run_shell",
		"exploration_map",
		"run_shop",
		"reward_choice",
		"run_settlement",
		"account_shop",
		"achievements",
		"leaderboards",
		"season",
		"dogfight_rooms",
		"dogfight_room_detail",
		"account_settings",
	]:
		if not main.call("open_screen", screen_id):
			_fail("open_screen should accept internal run screen id: %s" % screen_id)
			return
		await process_frame
		await process_frame
		if str(router.get("current_screen_id")) != "legacy_run":
			_fail("%s should redirect to playable shell, got %s" % [screen_id, str(router.get("current_screen_id"))])
			return
		if not legacy.visible:
			_fail("%s should show LegacyRunScreen" % screen_id)
			return
		if _any_visible_placeholder(main):
			_fail("%s must not show any visible placeholder panel" % screen_id)
			return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot internal placeholder redirect smoke passed")
	quit(0)

func _any_visible_placeholder(node: Node) -> bool:
	if node.name == "PlaceholderPanel" and node is CanvasItem and (node as CanvasItem).is_visible_in_tree():
		return true
	for child in node.get_children():
		if _any_visible_placeholder(child):
			return true
	return false

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
