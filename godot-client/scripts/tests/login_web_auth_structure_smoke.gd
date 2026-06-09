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

	for node_name in [
		"AuthShell",
		"AuthPanel",
		"BrandBlock",
		"GameLogo",
		"BrandText",
		"AppTitle",
		"AppSubtitle",
		"LanguageSelector",
		"LanguageZhButton",
		"LanguageEnButton",
		"AccountField",
		"AccountLabel",
		"AccountInput",
		"PasswordField",
		"PasswordLabel",
		"PasswordInput",
		"ErrorLabel",
		"AuthButtons",
		"LoginButton",
		"RegisterButton",
	]:
		if login.find_child(node_name, true, false) == null:
			_fail("Missing login Web auth node: %s" % node_name)
			return

	var shell := login.find_child("AuthShell", true, false) as Control
	if shell.anchor_right != 1.0 or shell.anchor_bottom != 1.0:
		_fail("AuthShell must fill the viewport like Web auth-shell")
		return

	var panel := login.find_child("AuthPanel", true, false) as PanelContainer
	if panel.custom_minimum_size.x < 460.0 or panel.custom_minimum_size.y < 520.0:
		_fail("AuthPanel must use a stable Web auth-panel size")
		return

	var logo := login.find_child("GameLogo", true, false) as TextureRect
	if logo.texture == null or logo.custom_minimum_size.x < 90.0 or logo.custom_minimum_size.y < 90.0:
		_fail("GameLogo must mirror the Web brand image")
		return

	var auth_buttons := login.find_child("AuthButtons", true, false) as HBoxContainer
	if auth_buttons.get_child_count() != 2:
		_fail("AuthButtons must mirror the Web login/register row")
		return

	var text := _collect_text(login)
	for part in ["狗骰对战", "摆好装备", "语言", "中文", "English", "账号", "密码", "登录", "注册"]:
		if not text.contains(part):
			_fail("Login Web auth text missing: %s" % part)
			return

	login.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot login Web auth structure smoke passed")
	quit(0)

func _collect_text(node: Node) -> String:
	var text := ""
	if node is Label:
		text += (node as Label).text + "\n"
	if node is Button:
		text += (node as Button).text + "\n"
	for child in node.get_children():
		text += _collect_text(child)
	return text

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
