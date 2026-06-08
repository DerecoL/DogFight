extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/RunScreen.gd")
	if source.is_empty():
		_fail("RunScreen source is missing")
		return
	if not source.contains("func _guarded_api_post") or not source.contains("func _guarded_api_get"):
		_fail("RunScreen must expose guarded API helpers for direct room actions")
		return
	for function_name in [
		"_create_room",
		"_match_room",
		"_enter_or_view_room",
		"_leave_active_room",
		"_room_action",
		"_load_room_battle",
	]:
		var body := _function_body(source, "func %s" % function_name)
		if body.is_empty():
			_fail("RunScreen missing room action function: %s" % function_name)
			return
		var raw_check_body := body.replace("_guarded_api_post(", "").replace("_guarded_api_get(", "")
		if raw_check_body.contains("_api_post(") or raw_check_body.contains("_api_get("):
			_fail("%s must not call raw API helpers without action guard" % function_name)
			return
		if not body.contains("_guarded_api_post(") and not body.contains("_guarded_api_get("):
			_fail("%s must use a guarded API helper" % function_name)
			return
	print("Godot room direct action guard smoke passed")
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
