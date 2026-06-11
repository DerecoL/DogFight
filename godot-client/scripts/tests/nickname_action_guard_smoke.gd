extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/screens/NicknameSetupScreen.gd")
	for needle in [
		"var action_in_progress := false",
		"var submit_button: Button",
		"func _set_actions_disabled(disabled: bool) -> void:",
		"func _on_shell_logout_requested() -> void:",
	]:
		if not source.contains(needle):
			_fail("NicknameSetupScreen action guard structure is missing: %s" % needle)
			return
	var submit_body := _function_body(source, "func _submit_nickname")
	for needle in [
		"if action_in_progress:",
		"action_in_progress = true",
		"_set_actions_disabled(true)",
		"action_in_progress = false",
		"_set_actions_disabled(false)",
	]:
		if not submit_body.contains(needle):
			_fail("Nickname submit must be guarded while the request is in flight: %s" % needle)
			return
	var shell_logout_body := _function_body(source, "func _on_shell_logout_requested")
	if not shell_logout_body.contains("if action_in_progress:"):
		_fail("Nickname shell logout must not run while another action is in flight")
		return

	var screen_scene = load("res://scenes/screens/NicknameSetupScreen.tscn")
	if screen_scene == null:
		_fail("NicknameSetupScreen scene failed to load")
		return
	var screen = screen_scene.instantiate()
	var session := FakeSession.new()
	root.add_child(session)
	screen.bind_session(session)
	root.add_child(screen)
	await process_frame
	var input := screen.find_child("NicknameInput", true, false) as LineEdit
	var submit := screen.find_child("NicknameSubmitButton", true, false) as Button
	if input == null or submit == null:
		_fail("Nickname guard test requires input and submit nodes")
		return
	input.text = "Guarded"
	input.text_changed.emit(input.text)
	if submit.disabled:
		_fail("Nickname submit should enable for valid input before busy guard")
		return
	screen.set("action_in_progress", true)
	screen.call("_set_actions_disabled", false)
	if not submit.disabled:
		_fail("_set_actions_disabled(false) must not re-enable submit while action_in_progress is true")
		return
	if input.editable:
		_fail("Nickname input must remain non-editable while action_in_progress is true")
		return
	screen.set("action_in_progress", false)
	screen.call("_set_actions_disabled", false)
	if submit.disabled or not input.editable:
		_fail("_set_actions_disabled(false) must restore valid controls after busy guard clears")
		return
	screen.set("action_in_progress", true)
	screen.call("_on_shell_logout_requested")
	await process_frame
	if session.logout_count != 0:
		_fail("Shell logout must be ignored while nickname submit is in progress")
		return
	screen.set("action_in_progress", false)
	screen.call("_on_shell_logout_requested")
	await process_frame
	if session.logout_count != 1:
		_fail("Shell logout must still work when nickname submit is idle")
		return

	screen.queue_free()
	session.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot nickname action guard smoke passed")
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

class FakeSession:
	extends Node

	var logout_count := 0

	func logout() -> void:
		logout_count += 1
