extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var login_scene := load("res://scenes/LoginScreen.tscn")
	if login_scene == null:
		_fail("Login scene failed to load")
		return
	var login = login_scene.instantiate()
	root.add_child(login)
	await process_frame
	if not login.has_method("_on_error_raised"):
		_fail("LoginScreen error handler is missing")
		return
	login.call("_on_error_raised", "账号或密码错误")
	await process_frame
	var error_label = login.get_node_or_null("%ErrorLabel")
	if not error_label is Label:
		_fail("ErrorLabel is missing")
		return
	var text := (error_label as Label).text
	for expected in ["账号或密码错误", "注册", "快速开始"]:
		if not text.contains(expected):
			_fail("Login error hint missing: %s" % expected)
			return
	login.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot login error hint smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
