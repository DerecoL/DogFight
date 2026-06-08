extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/RunScreen.gd")
	var controls_body := _function_body(source, "func _update_controls")
	for needle in [
		"dog_type_select.disabled = action_in_progress",
		"mode_select.disabled = action_in_progress",
		"lucky_select.disabled = action_in_progress",
	]:
		if not controls_body.contains(needle):
			_fail("RunScreen header selector must be disabled while action is in flight: %s" % needle)
			return
	for signature in [
		"func _on_tab_pressed(tab: String) -> void:",
		"func _switch_tab(tab: String) -> void:",
	]:
		var body := _function_body(source, signature)
		if not body.contains("if action_in_progress:"):
			_fail("%s must ignore tab changes while a run action is in flight" % signature)
			return
	print("Godot run header action guard smoke passed")
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
