extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/LoginScreen.gd")
	for needle in [
		"var auth_in_progress := false",
		"if auth_in_progress:",
		"auth_in_progress = true",
		"auth_in_progress = false",
		"_set_busy(true)",
		"_set_busy(false)",
		"account_input.editable = not busy",
		"password_input.editable = not busy",
		"taptap_code_input.editable = not busy",
	]:
		if not source.contains(needle):
			_fail("LoginScreen action guard is missing: %s" % needle)
			return
	for signature in [
		"func _on_quick_start_pressed() -> void:",
		"func _on_taptap_pressed() -> void:",
		"func _submit_auth(action: String) -> void:",
	]:
		var body := _function_body(source, signature)
		if not body.contains("if auth_in_progress:"):
			_fail("%s must ignore repeated actions while auth is in flight" % signature)
			return
	print("Godot login action guard smoke passed")
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
