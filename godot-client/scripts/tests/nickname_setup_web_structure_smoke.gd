extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var screen_scene = load("res://scenes/screens/NicknameSetupScreen.tscn")
	if screen_scene == null:
		_fail("NicknameSetupScreen scene failed to load")
		return
	var screen = screen_scene.instantiate()
	root.add_child(screen)
	await process_frame

	for node_name in [
		"NicknameSetupRoot",
		"ScreenHeadingCentered",
		"NicknameTitle",
		"NicknameSubtitle",
		"NicknameForm",
		"NicknameField",
		"NicknameLabel",
		"NicknameInput",
		"NicknameStatus",
		"NicknameSubmitButton",
	]:
		if screen.find_child(node_name, true, false) == null:
			_fail("Missing nickname Web node: %s" % node_name)
			return

	var input := screen.find_child("NicknameInput", true, false) as LineEdit
	if input.max_length != 16:
		_fail("Nickname input max length must match Web maxLength=16")
		return
	if input.custom_minimum_size.x < 320.0 or input.custom_minimum_size.y < 44.0:
		_fail("Nickname input must keep a stable touch-sized Web form footprint")
		return

	var form := screen.find_child("NicknameForm", true, false) as VBoxContainer
	if form.custom_minimum_size.x < 420.0:
		_fail("NicknameForm must use a stable centered Web form width")
		return
	if form.find_child("LogoutButton", true, false) != null:
		_fail("NicknameForm must mirror Web and not include a logout button")
		return

	var submit := screen.find_child("NicknameSubmitButton", true, false) as Button
	if submit.text != "确认":
		_fail("Nickname submit button must mirror Web text")
		return

	var text := _collect_text(screen)
	for part in ["设置昵称", "昵称会显示在匹配和战斗记录里。", "昵称", "确认"]:
		if not text.contains(part):
			_fail("Nickname Web text missing: %s" % part)
			return
	for leaked in ["保存昵称", "退出登录"]:
		if text.contains(leaked):
			_fail("Nickname setup leaked non-Web text: %s" % leaked)
			return

	screen.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot nickname setup Web structure smoke passed")
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
