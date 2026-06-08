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
		_fail("Main scene must create a router")
		return
	if str(router.get("current_screen_id")) != "login":
		_fail("Fresh project startup must show login, got %s" % str(router.get("current_screen_id")))
		return

	var login = main.get_node_or_null("ScreenRoot/LoginScreen")
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if login == null or not login.visible:
		_fail("Fresh project startup must show LoginScreen")
		return
	if mode_lobby == null or mode_lobby.visible:
		_fail("Fresh project startup must not show ModeLobbyScreen before auth")
		return
	if legacy == null or legacy.visible:
		_fail("Fresh project startup must not show LegacyRunScreen before auth")
		return
	if _any_visible_placeholder(main):
		_fail("Fresh project startup must not show old placeholder panels")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot main startup screen state smoke passed")
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
