extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/RunScreen.gd")
	if source.is_empty():
		_fail("RunScreen source is missing")
		return
	if not source.contains("func _set_buttons_disabled"):
		_fail("RunScreen must expose recursive button disabling")
		return
	var body := _function_body(source, "func _update_controls")
	if body.is_empty():
		_fail("RunScreen missing _update_controls")
		return
	for needle in [
		"_set_buttons_disabled(content",
		"_modal_stack()",
		"_set_buttons_disabled(panel",
	]:
		if not body.contains(str(needle)):
			_fail("_update_controls must cover content and modal buttons: %s" % str(needle))
			return
	print("Godot modal action guard smoke passed")
	quit(0)

func _function_body(source: String, signature: String) -> String:
	var start := source.find(signature)
	if start < 0:
		return ""
	var next_func := source.find("\nfunc ", start + signature.length())
	if next_func < 0:
		return source.substr(start)
	return source.substr(start, next_func - start)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
