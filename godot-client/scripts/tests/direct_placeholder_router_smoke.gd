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
	if str(router.get("current_screen_id")) != "mode_lobby":
		_fail("Direct router display of mode_lobby should stay on mode_lobby, got %s" % str(router.get("current_screen_id")))
		return
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if mode_lobby == null or not mode_lobby.visible:
		_fail("Direct router display of mode_lobby should show ModeLobbyScreen")
		return
	if mode_lobby.find_child("ModeLobbyPanel", true, false) == null:
		_fail("ModeLobbyScreen must show the playable lobby panel")
		return
	if _any_visible_placeholder(main):
		_fail("Direct router display of mode_lobby must not show a placeholder panel")
		return

	for screen_id in [
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
		router.call("show_screen", screen_id, false)
		if not await _wait_for_screen(router, "legacy_run"):
			_fail("Direct router display of %s should redirect to playable UI, got %s" % [screen_id, str(router.get("current_screen_id"))])
			return
		if _any_visible_placeholder(main):
			_fail("Direct router display of %s must not show a placeholder panel" % screen_id)
			return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot direct placeholder router smoke passed")
	quit(0)

func _wait_for_screen(router: Node, screen_id: String) -> bool:
	for _frame in range(20):
		if str(router.get("current_screen_id")) == screen_id:
			return true
		await process_frame
	return false

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
