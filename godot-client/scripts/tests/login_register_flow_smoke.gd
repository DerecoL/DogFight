extends SceneTree

var main_node: Node

func _init() -> void:
	_run()

func _run() -> void:
	var main_scene = load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	main_node = main
	root.add_child(main)
	await process_frame
	await process_frame

	var router = main.get("router")
	var login_screen = main.get_node_or_null("ScreenRoot/LoginScreen")
	if router == null or login_screen == null:
		_fail("Login flow requires router and LoginScreen")
		return
	var account_input = login_screen.get_node_or_null("%AccountInput") as LineEdit
	var password_input = login_screen.get_node_or_null("%PasswordInput") as LineEdit
	if account_input == null or password_input == null:
		_fail("LoginScreen must expose account and password inputs")
		return

	var account := "godot-login-flow-%d" % Time.get_ticks_msec()
	account_input.text = account
	password_input.text = "dogdice"
	await login_screen.call("_on_register_pressed")
	if not await _wait_for_screen(router, "nickname_setup"):
		_fail("Register should route new account to nickname_setup, got %s" % str(router.get("current_screen_id")))
		return

	var nickname_screen = main.get_node_or_null("ScreenRoot/NicknameSetupScreen")
	var nickname_input := _find_line_edit(nickname_screen)
	if nickname_input == null:
		_fail("NicknameSetupScreen must expose nickname input")
		return
	nickname_input.text = "登录烟测"
	await nickname_screen.call("_submit_nickname")
	if not await _wait_for_screen(router, "mode_lobby"):
		_fail("Nickname submit should route to mode_lobby, got %s" % str(router.get("current_screen_id")))
		return

	if not await main.call("logout"):
		_fail("Logout failed after registration")
		return
	if not await _wait_for_screen(router, "login"):
		_fail("Logout should route back to login, got %s" % str(router.get("current_screen_id")))
		return

	account_input.text = account
	password_input.text = "dogdice"
	await login_screen.call("_on_login_pressed")
	if not await _wait_for_screen(router, "mode_lobby"):
		_fail("Login with saved nickname should route to mode_lobby, got %s" % str(router.get("current_screen_id")))
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot login/register flow smoke passed")
	quit(0)

func _wait_for_screen(router: Node, screen_id: String) -> bool:
	for _frame in range(180):
		if str(router.get("current_screen_id")) == screen_id:
			return true
		await process_frame
	return false

func _find_line_edit(node: Node) -> LineEdit:
	if node == null:
		return null
	if node is LineEdit:
		return node as LineEdit
	for child in node.get_children():
		var result := _find_line_edit(child)
		if result != null:
			return result
	return null

func _cleanup() -> void:
	if main_node != null and is_instance_valid(main_node):
		main_node.queue_free()
	main_node = null

func _fail(message: String) -> void:
	push_error(message)
	_cleanup()
	quit(1)
