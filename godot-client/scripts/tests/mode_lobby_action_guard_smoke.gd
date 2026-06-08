extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/screens/ModeLobbyScreen.gd")
	for needle in [
		"var action_in_progress := false",
		"var action_buttons: Array[Button] = []",
		"func _track_action_button(button: Button) -> Button:",
		"func _set_actions_disabled(disabled: bool) -> void:",
	]:
		if not source.contains(needle):
			_fail("ModeLobbyScreen action guard structure is missing: %s" % needle)
			return
	var logout_body := _function_body(source, "func _logout")
	for needle in [
		"if action_in_progress:",
		"action_in_progress = true",
		"_set_actions_disabled(true)",
		"action_in_progress = false",
		"_set_actions_disabled(false)",
	]:
		if not logout_body.contains(needle):
			_fail("ModeLobby logout must disable lobby actions while in flight: %s" % needle)
			return
	for signature in [
		"func _enter_casual() -> void:",
		"func _enter_ladder() -> void:",
		"func _replay_tutorial() -> void:",
		"func _continue_run() -> void:",
		"func _open_screen(screen_id: String) -> void:",
	]:
		var body := _function_body(source, signature)
		if not body.contains("if action_in_progress:"):
			_fail("%s must ignore navigation while another lobby action is in flight" % signature)
			return
	print("Godot mode lobby action guard smoke passed")
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
