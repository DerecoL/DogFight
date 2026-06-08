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
	if not body.contains("var manages_progress := not action_in_progress"):
		_fail("_refresh_rooms must decide whether it owns the action guard")
		return
	if not body.contains("action_in_progress = true") or not body.contains("action_in_progress = false"):
		_fail("_refresh_rooms must manage action_in_progress around manual refreshes")
		return
	if not body.contains("_update_controls()") or not body.contains("_refresh_rooms_payload()"):
		_fail("_refresh_rooms must disable controls while refreshing room payload")
		return
	var payload_body := _function_body(source, "func _refresh_rooms_payload")
	if payload_body.is_empty():
		_fail("RunScreen missing _refresh_rooms_payload")
		return
	if not payload_body.contains("_refresh_active_room()") or not payload_body.contains("ApiRoutes.dogfight_rooms()"):
		_fail("_refresh_rooms_payload must refresh active room details and room list data")
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
