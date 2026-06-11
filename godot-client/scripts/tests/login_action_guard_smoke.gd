extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/LoginScreen.gd")
	for needle in [
		"var auth_in_progress := false",
		"if auth_in_progress:",
		"auth_in_progress = true",
		"auth_in_progress = false",
		"_set_busy(true)",
		"_set_busy(false)",
		"account_input.editable = not busy",
		"password_input.editable = not busy",
		"taptap_code_input.editable = not busy",
		"debug_auth_toggle.disabled = busy",
	]:
		if not source.contains(needle):
			_fail("LoginScreen action guard is missing: %s" % needle)
			return
	for signature in [
		"func _on_quick_start_pressed() -> void:",
		"func _on_taptap_pressed() -> void:",
		"func _submit_auth(action: String) -> void:",
	]:
		var body := _function_body(source, signature)
		if not body.contains("if auth_in_progress:"):
			_fail("%s must ignore repeated actions while auth is in flight" % signature)
			return

	var login_scene := load("res://scenes/LoginScreen.tscn")
	if login_scene == null:
		_fail("Login scene failed to load")
		return
	var login = login_scene.instantiate()
	root.add_child(login)
	await process_frame
	var debug_toggle = login.get_node_or_null("%DebugAuthToggle")
	var debug_group = login.get_node_or_null("%DebugAuthGroup")
	var quick_start = login.get_node_or_null("%QuickStartButton")
	var taptap_code = login.get_node_or_null("%TapTapCodeInput")
	var taptap_button = login.get_node_or_null("%TapTapButton")
	if not debug_toggle is Button or not debug_group is Control or not quick_start is Button or not taptap_code is LineEdit or not taptap_button is Button:
		_fail("Debug auth guard nodes are missing")
		return
	login.call("_set_busy", true)
	if not (debug_toggle as Button).disabled or not (quick_start as Button).disabled or not (taptap_button as Button).disabled:
		_fail("Busy state must disable debug auth buttons")
		return
	if (taptap_code as LineEdit).editable:
		_fail("Busy state must make TapTap code input read-only")
		return
	login.call("_set_busy", false)
	if (debug_group as Control).visible:
		_fail("Leaving busy must not force the folded debug group open")
		return
	if (debug_toggle as Button).disabled or (quick_start as Button).disabled or (taptap_button as Button).disabled:
		_fail("Leaving busy must re-enable debug auth buttons")
		return
	if not (taptap_code as LineEdit).editable:
		_fail("Leaving busy must restore TapTap code editing")
		return
	login.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot login action guard smoke passed")
	quit(0)

func _function_body(source: String, signature: String) -> String:
	var start := source.find(signature)
	if start < 0:
		return ""
	var next := source.find("\nfunc ", start + signature.length())
	if next < 0:
		return source.substr(start)
	return source.substr(start, next - start)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
