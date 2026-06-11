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
		"DebugAuthToggle",
		"DebugAuthGroup",
		"QuickStartButton",
		"TapTapCodeInput",
		"TapTapButton",
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
	for child in auth_buttons.get_children():
		if child.name not in ["LoginButton", "RegisterButton"]:
			_fail("AuthButtons must only contain primary login/register actions")
			return

	var debug_toggle := login.find_child("DebugAuthToggle", true, false) as Button
	var debug_group := login.find_child("DebugAuthGroup", true, false) as Control
	if debug_toggle.get_parent().name != "Form" or debug_group.get_parent().name != "Form":
		_fail("Debug auth foldout must live outside the primary AuthButtons row")
		return
	if debug_group.visible:
		_fail("DebugAuthGroup must be folded by default")
		return
	for node_name in ["QuickStartButton", "TapTapCodeInput", "TapTapButton"]:
		var debug_child: Node = login.find_child(node_name, true, false)
		if debug_child == null or not debug_group.is_ancestor_of(debug_child):
			_fail("%s must stay inside DebugAuthGroup" % node_name)
			return

	var required_text_nodes := ["AppTitle", "AppSubtitle", "LanguageLabel", "AccountLabel", "PasswordLabel", "LoginButton", "RegisterButton"]
	for node_name in required_text_nodes:
		var node: Node = login.find_child(node_name, true, false)
		var text := ""
		if node is Label:
			text = (node as Label).text
		elif node is Button:
			text = (node as Button).text
		if text.strip_edges().is_empty():
			_fail("Login Web auth text node must remain populated: %s" % node_name)
			return

	login.queue_free()
	for _frame in range(3):
		await process_frame
	print("Godot login Web auth structure smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
