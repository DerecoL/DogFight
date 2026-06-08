extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/RunScreen.gd")
	var call_body := _function_body(source, "func _call_session")
	if not source.contains("func _call_session(method: String, args: Array) -> bool:"):
		_fail("_call_session must return whether the session action succeeded")
		return
	for needle in [
		"return false",
		"return ok",
	]:
		if not call_body.contains(needle):
			_fail("_call_session must return success/failure: %s" % needle)
			return
	var history_body := _function_body(source, "func _on_history_run_pressed")
	for needle in [
		"var ok: bool = await _call_session",
		"if not ok:",
		"return",
	]:
		if not history_body.contains(needle):
			_fail("History run click must only switch to run tab after load_run succeeds: %s" % needle)
			return
	print("Godot history load failure guard smoke passed")
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
