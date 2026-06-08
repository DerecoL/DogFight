extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/RunScreen.gd")
	if source.is_empty():
		_fail("RunScreen source is missing")
		return
	var post_func := _function_body(source, "func _post_and_store")
	if post_func.is_empty():
		_fail("RunScreen must expose _post_and_store")
		return
	for needle in [
		"if action_in_progress",
		"action_in_progress = true",
		"_update_controls()",
		"action_in_progress = false",
	]:
		if not post_func.contains(str(needle)):
			_fail("_post_and_store must guard direct Web-style post actions with action_in_progress: %s" % str(needle))
			return
	print("Godot UI post action guard smoke passed")
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
