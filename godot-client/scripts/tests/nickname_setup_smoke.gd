extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var session_source := FileAccess.get_file_as_string("res://scripts/state/GameSession.gd")
	for needle in [
		"var needs_nickname_setup := false",
		"_update_needs_nickname(response.data)",
		"run_screen.call_deferred(\"_show_nickname_setup_modal\")",
	]:
		if not session_source.contains(str(needle)):
			_fail("GameSession nickname setup wiring is missing: %s" % str(needle))
			return
	var run_source := FileAccess.get_file_as_string("res://scripts/ui/RunScreen.gd")
	for needle in [
		"func _show_nickname_setup_modal() -> void:",
		"func _submit_nickname_setup(input: LineEdit) -> void:",
		"_call_session(\"update_nickname\", [input.text])",
	]:
		if not run_source.contains(str(needle)):
			_fail("RunScreen nickname setup modal is missing: %s" % str(needle))
			return
	var main_scene := load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame
	var run_screen = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if run_screen != null and run_screen.has_method("bind_session"):
		run_screen.bind_session(main)
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if run_screen == null or modal_layer == null:
		_fail("RunScreen or ModalLayer is missing")
		return
	if not run_screen.has_method("_show_nickname_setup_modal"):
		_fail("RunScreen cannot show nickname setup modal")
		return
	run_screen.call("_show_nickname_setup_modal")
	await process_frame
	if modal_layer.get_child_count() != 1:
		_fail("Expected exactly one nickname setup modal")
		return
	var text := _collect_text(modal_layer)
	for part in ["设置昵称", "第一次进入需要设置 2-16 字昵称", "保存昵称", "退出登录"]:
		if not text.contains(str(part)):
			_fail("Nickname setup modal text missing: %s" % str(part))
			return
	if text.contains("关闭"):
		_fail("Nickname setup modal must not allow closing without setting a nickname")
		return
	var input := _find_line_edit(modal_layer)
	if input == null:
		_fail("Nickname setup modal must include a LineEdit")
		return
	if input.max_length != 16 or input.custom_minimum_size.x < 260.0:
		_fail("Nickname setup input must be stable and limited to 16 chars")
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot nickname setup smoke passed")
	quit(0)

func _collect_text(node: Node) -> String:
	var text := ""
	if node is Label:
		text += (node as Label).text + "\n"
	if node is Button:
		text += (node as Button).text + "\n"
	for child in node.get_children():
		text += _collect_text(child)
	return text

func _find_line_edit(node: Node) -> LineEdit:
	if node is LineEdit:
		return node as LineEdit
	for child in node.get_children():
		var result := _find_line_edit(child)
		if result != null:
			return result
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
