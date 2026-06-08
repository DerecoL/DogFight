extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var screen_scene = load("res://scenes/screens/NicknameSetupScreen.tscn")
	if screen_scene == null:
		_fail("NicknameSetupScreen scene failed to load")
		return
	var screen = screen_scene.instantiate()
	root.add_child(screen)
	await process_frame

	var input := _find_line_edit(screen)
	if input == null:
		_fail("NicknameSetupScreen must include a LineEdit")
		return
	if input.max_length != 16 or input.custom_minimum_size.x < 260.0 or input.custom_minimum_size.y < 44.0:
		_fail("NicknameSetupScreen input must be stable, touch-sized, and limited to 16 chars")
		return

	var text := _collect_text(screen)
	for part in ["设置昵称", "2-16", "保存昵称", "退出登录"]:
		if not text.contains(str(part)):
			_fail("NicknameSetupScreen text missing: %s" % str(part))
			return

	var source := FileAccess.get_file_as_string("res://scripts/ui/screens/NicknameSetupScreen.gd")
	for needle in [
		"func _submit_nickname() -> void:",
		"update_nickname",
		"func _logout() -> void:",
	]:
		if not source.contains(str(needle)):
			_fail("NicknameSetupScreen interaction wiring is missing: %s" % str(needle))
			return

	var session_source := FileAccess.get_file_as_string("res://scripts/state/GameSession.gd")
	for needle in [
		"var needs_nickname_setup := false",
		"_update_needs_nickname(response.data)",
		"_show_run_screen()",
	]:
		if not session_source.contains(str(needle)):
			_fail("GameSession nickname setup routing is missing: %s" % str(needle))
			return

	screen.queue_free()
	for _frame in range(2):
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
