extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/screens/NicknameSetupScreen.gd")
	for needle in [
		"var action_in_progress := false",
		"var logout_button: Button",
		"func _set_actions_disabled(disabled: bool) -> void:",
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
	var logout_body := _function_body(source, "func _logout")
	if not logout_body.contains("if action_in_progress:"):
		_fail("Nickname logout must not run while another action is in flight")
		return
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
