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
	var responsive_script := load("res://scripts/ui/kit/Responsive.gd")
	var tokens_script := load("res://scripts/ui/kit/UiTokens.gd")
	if responsive_script == null or tokens_script == null:
		push_error("UI kit foundation scripts failed to load")
		quit(1)
		return
	if responsive_script.breakpoint_for_width(480) != "mobile":
		push_error("Responsive mobile breakpoint failed")
		quit(1)
		return
	if responsive_script.breakpoint_for_width(1280) != "desktop":
		push_error("Responsive desktop breakpoint failed")
		quit(1)
		return
	if tokens_script.touch_target_height() < 44:
		push_error("UiTokens touch target is too small")
		quit(1)
		return
	var overlay_scene := load("res://scenes/overlays/OverlayRoot.tscn")
	if overlay_scene == null:
		push_error("OverlayRoot scene failed to load")
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
	if router.register_screen("plain", "PlainNode", false) or router.screens.has("plain"):
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
	var modal_root := Control.new()
	modal_root.name = "ModalRoot"
	modal_stack.configure(modal_root)
	var modal := Control.new()
	modal.name = "ConfirmModal"
	modal_stack.push_modal(modal, true)
	if modal_stack.depth() != 1 or not modal_stack.is_blocking() or modal.get_parent() != modal_root:
		push_error("ModalStack failed to push blocking modal")
		quit(1)
		return
	modal_stack.pop_modal()
	if modal_stack.depth() != 0 or modal_stack.is_blocking():
		push_error("ModalStack failed to pop modal")
		quit(1)
		return
	var orphan_stack = modal_script.new()
	var orphan_modal := Control.new()
	if orphan_stack.push_modal(orphan_modal, true, false) or orphan_stack.depth() != 0 or orphan_stack.is_blocking():
		push_error("ModalStack accepted modal without configured root")
		quit(1)
		return
	orphan_modal.free()
	var parented_stack = modal_script.new()
	var other_modal_root := Control.new()
	parented_stack.configure(other_modal_root)
	var existing_parent := Control.new()
	var parented_modal := Control.new()
	existing_parent.add_child(parented_modal)
	if parented_stack.push_modal(parented_modal, true, false) or parented_stack.depth() != 0 or parented_stack.is_blocking() or parented_modal.get_parent() != existing_parent or not existing_parent.get_children().has(parented_modal):
		push_error("ModalStack accepted modal from unrelated parent")
		quit(1)
		return
	var overlay_root = overlay_scene.instantiate()
	var blocking_layer = overlay_root.get_node_or_null("BlockingLayer")
	var modal_layer = overlay_root.get_node_or_null("ModalLayer")
	var toast_layer = overlay_root.get_node_or_null("ToastLayer")
	if blocking_layer == null or modal_layer == null or toast_layer == null:
		push_error("OverlayRoot must include blocking, modal, and toast layers")
		quit(1)
		return
	if blocking_layer.get_index() >= modal_layer.get_index():
		push_error("OverlayRoot BlockingLayer must render below ModalLayer")
		quit(1)
		return
	if toast_layer.get_index() <= modal_layer.get_index():
		push_error("OverlayRoot ToastLayer must render above ModalLayer")
		quit(1)
		return
	overlay_root.free()
	modal_root.free()
	other_modal_root.free()
	existing_parent.free()
	var toast_bus = toast_script.new()
	toast_bus.push("保存成功", "success")
	var toast: Dictionary = toast_bus.pop_next()
	if str(toast.get("message", "")) != "保存成功" or str(toast.get("kind", "")) != "success":
		push_error("ToastBus failed to pop queued toast")
		quit(1)
		return
	root.free()
	router.free()
	modal_stack.free()
	orphan_stack.free()
	parented_stack.free()
	toast_bus.free()
	quit(0)
