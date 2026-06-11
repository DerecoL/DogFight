extends SceneTree

const WebUiTokens := preload("res://scripts/ui/web/WebUiTokens.gd")

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
	if input.name != "NicknameInput":
		_fail("NicknameSetupScreen must preserve the NicknameInput node name")
		return
	if input.max_length != 16 or input.custom_minimum_size.x < 420.0 or input.custom_minimum_size.y < WebUiTokens.touch_target_height():
		_fail("NicknameSetupScreen input must be stable, touch-sized, and limited to 16 chars")
		return

	for node_name in ["NicknameSetupRoot", "NicknameTitle", "NicknameSubtitle", "NicknameStatus", "NicknameSubmitButton"]:
		if screen.find_child(node_name, true, false) == null:
			_fail("NicknameSetupScreen must preserve key node: %s" % node_name)
			return

	var submit := screen.find_child("NicknameSubmitButton", true, false) as Button
	if submit == null or not submit.disabled:
		_fail("Nickname submit must start disabled until a valid nickname is typed")
		return
	input.text = "A"
	input.text_changed.emit(input.text)
	if not submit.disabled:
		_fail("Nickname submit must stay disabled for names shorter than 2 chars")
		return
	input.text = "AB"
	input.text_changed.emit(input.text)
	if submit.disabled:
		_fail("Nickname submit must enable once the trimmed nickname reaches 2 chars")
		return

	var source := FileAccess.get_file_as_string("res://scripts/ui/screens/NicknameSetupScreen.gd")
	for needle in [
		"func _submit_nickname() -> void:",
		"update_nickname",
		"action_in_progress",
		"nickname.length() < 2 or nickname.length() > 16",
	]:
		if not source.contains(str(needle)):
			_fail("NicknameSetupScreen interaction wiring is missing: %s" % needle)
			return

	var session_source := FileAccess.get_file_as_string("res://scripts/state/GameSession.gd")
	for needle in [
		"var needs_nickname_setup := false",
		"_update_needs_nickname(response.data)",
		"_show_run_screen()",
	]:
		if not session_source.contains(str(needle)):
			_fail("GameSession nickname setup routing is missing: %s" % needle)
			return

	screen.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot nickname setup smoke passed")
	quit(0)

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
