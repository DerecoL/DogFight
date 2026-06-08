extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/RunScreen.gd")
	if source.is_empty():
		_fail("RunScreen source is missing")
		return
	if not source.contains("func _guarded_fetch_into"):
		_fail("RunScreen must expose a guarded fetch helper")
		return
	var body := _function_body(source, "func _refresh_rooms")
	if body.is_empty():
		_fail("RunScreen missing _refresh_rooms")
		return
	var raw_check_body := body.replace("_guarded_fetch_into(", "")
	if raw_check_body.contains("_fetch_into("):
		_fail("_refresh_rooms must not call _fetch_into directly without action guard")
		return
	if not body.contains("_guarded_fetch_into("):
		_fail("_refresh_rooms must use guarded fetch")
		return
	print("Godot room refresh guard smoke passed")
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
