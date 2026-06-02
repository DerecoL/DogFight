extends SceneTree

func _init() -> void:
	var router_script := load("res://scripts/router/ScreenRouter.gd")
	if router_script == null:
		push_error("ScreenRouter.gd failed to load")
		quit(1)
		return
	var root := Control.new()
	root.name = "ScreenRoot"
	var login := Control.new()
	login.name = "LoginScreen"
	var run := Control.new()
	run.name = "RunScreen"
	var plain := Node.new()
	plain.name = "PlainNode"
	root.add_child(login)
	root.add_child(run)
	root.add_child(plain)
	var router = router_script.new()
	router.configure(root)
	router.register_screen("login", "LoginScreen")
	router.register_screen("run", "RunScreen")
	router.show_screen("login")
	if not login.visible or run.visible:
		push_error("ScreenRouter failed to show login")
		quit(1)
		return
	router.show_screen("run")
	if login.visible or not run.visible or router.current_screen_id != "run":
		push_error("ScreenRouter failed to show run")
		quit(1)
		return
	if not router.go_back() or router.current_screen_id != "login":
		push_error("ScreenRouter failed to go back")
		quit(1)
		return
	router.register_screen("plain", "PlainNode")
	if router.screens.has("plain"):
		push_error("ScreenRouter registered a non-CanvasItem node")
		quit(1)
		return
	router.show_screen("login")
	router.show_screen("login")
	if not router.back_stack.is_empty():
		push_error("ScreenRouter added same screen to back stack")
		quit(1)
		return
	router.show_screen("run", false)
	if not router.back_stack.is_empty():
		push_error("ScreenRouter added run transition to back stack when disabled")
		quit(1)
		return
	root.free()
	router.free()
	quit(0)
