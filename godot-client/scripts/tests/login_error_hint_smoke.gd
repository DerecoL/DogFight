extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var login_scene := load("res://scenes/LoginScreen.tscn")
	if login_scene == null:
		_fail("Login scene failed to load")
		return
	var login = login_scene.instantiate()
	root.add_child(login)
	await process_frame
	if not login.has_method("_on_error_raised"):
		_fail("LoginScreen error handler is missing")
		return
	login.call("_on_error_raised", "account password rejected")
	await process_frame
	var error_label = login.get_node_or_null("%ErrorLabel")
	if not error_label is Label:
		_fail("ErrorLabel is missing")
		return
	var text := (error_label as Label).text
	if not text.contains("account password rejected"):
		_fail("Login error hint must preserve the original auth error")
		return
	var debug_toggle = login.get_node_or_null("%DebugAuthToggle")
	var debug_group = login.get_node_or_null("%DebugAuthGroup")
	if not debug_toggle is Button or not debug_group is Control:
		_fail("Debug auth foldout nodes are missing")
		return
	if not (debug_toggle as Button).is_visible_in_tree():
		_fail("Error hint must keep the folded debug auth toggle reachable")
		return
	if (debug_group as Control).is_visible_in_tree():
		_fail("Error hint must not expose folded debug auth entries as primary actions")
		return
	var quick_start = login.get_node_or_null("%QuickStartButton")
	if not quick_start is Button:
		_fail("QuickStartButton is missing")
		return
	if (quick_start as Button).is_visible_in_tree():
		_fail("Error hint may mention quick start, but must not expose it as a primary first-screen action")
		return
	login.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot login error hint smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
