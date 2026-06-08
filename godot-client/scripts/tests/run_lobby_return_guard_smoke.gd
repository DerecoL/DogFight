extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/RunScreen.gd")
	for needle in [
		"var lobby_button: Button",
		"lobby_button = _button",
		"lobby_button.disabled = action_in_progress",
	]:
		if not source.contains(needle):
			_fail("RunScreen return-to-lobby control must be tracked by action guard: %s" % needle)
			return
	var body := _function_body(source, "func open_mode_lobby")
	if not body.contains("if action_in_progress:"):
		_fail("open_mode_lobby must ignore navigation while a run action is in flight")
		return
	print("Godot run lobby return guard smoke passed")
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
