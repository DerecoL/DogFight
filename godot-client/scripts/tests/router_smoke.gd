extends SceneTree

func _init() -> void:
	var router_script := load("res://scripts/router/ScreenRouter.gd")
	if router_script == null:
		push_error("ScreenRouter.gd failed to load")
		quit(1)
		return
	var modal_script := load("res://scripts/router/ModalStack.gd")
	var toast_script := load("res://scripts/router/ToastBus.gd")
	if modal_script == null or toast_script == null:
		push_error("Overlay foundation scripts failed to load")
		quit(1)
		return
	var root := Control.new()
	root.name = "ScreenRoot"
	var login := Control.new()
	login.name = "LoginScreen"
	var run := Control.new()
	run.name = "RunScreen"
	var battle := Control.new()
	battle.name = "BattleReplayScreen"
	var plain := Node.new()
	plain.name = "PlainNode"
	root.add_child(login)
	root.add_child(run)
	root.add_child(battle)
	root.add_child(plain)
	var router = router_script.new()
	router.configure(root)
	router.register_screen("login", "LoginScreen")
	router.register_screen("run", "RunScreen")
	router.register_screen("battle", "BattleReplayScreen")
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
	router.clear_history()
	router.show_screen("login", false)
	router.show_screen("run")
	router.show_screen("battle")
	if not router.go_back() or router.current_screen_id != "run":
		push_error("ScreenRouter failed first multi-step back navigation")
		quit(1)
		return
	if not router.go_back() or router.current_screen_id != "login":
		push_error("ScreenRouter failed second multi-step back navigation")
		quit(1)
		return
	router.show_screen("login")
	router.show_screen("run")
	router.show_screen("battle")
	router.show_screen("run", false)
	if router.current_screen_id != "run":
		push_error("ScreenRouter failed to return to run without history")
		quit(1)
		return
	if router.go_back():
		push_error("ScreenRouter kept stale run history after battle return")
		quit(1)
		return
	var modal_stack = modal_script.new()
	var modal := Control.new()
	modal.name = "ConfirmModal"
	modal_stack.push_modal(modal, true)
	if modal_stack.depth() != 1 or not modal_stack.is_blocking():
		push_error("ModalStack failed to push blocking modal")
		quit(1)
		return
	modal_stack.pop_modal()
	if modal_stack.depth() != 0 or modal_stack.is_blocking():
		push_error("ModalStack failed to pop modal")
		quit(1)
		return
	var toast_bus = toast_script.new()
	toast_bus.push("保存成功", "success")
	var toast := toast_bus.pop_next()
	if str(toast.get("message", "")) != "保存成功" or str(toast.get("kind", "")) != "success":
		push_error("ToastBus failed to pop queued toast")
		quit(1)
		return
	root.free()
	router.free()
	quit(0)
