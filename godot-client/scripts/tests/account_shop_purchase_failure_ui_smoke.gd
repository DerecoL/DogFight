extends SceneTree

var main_node: Node
var seen_paths: Dictionary = {}
var seen_responses: Dictionary = {}

func _init() -> void:
	_run()

func _run() -> void:
	var main := await _new_logged_in_main()
	if main == null:
		return
	var router = main.get("router")
	if not await _wait_for_screen(router, "legacy_run"):
		_fail("Login should route to playable lobby")
		return
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null or not legacy.visible:
		_fail("LegacyRunScreen should be visible after login")
		return
	if not await _wait_for_idle(legacy):
		_fail("Initial lobby refresh should settle before account shop interaction")
		return

	seen_paths.clear()
	var shop_button := _find_button_containing(legacy, "商城")
	if shop_button == null:
		_fail("Playable shell must expose account shop entry")
		return
	shop_button.pressed.emit()
	if not await _wait_for_tab(legacy, "商城"):
		_fail("Account shop entry should open the Web-style shop tab, got %s" % str(legacy.get("current_tab")))
		return
	if not await _wait_for_paths(["/shop", "/cosmetics/me"]):
		_fail("Account shop tab should refresh shop and cosmetics data")
		return
	if not await _wait_for_idle(legacy):
		_fail("Account shop refresh should finish before item interaction")
		return
	if not _assert_account_shop_shell(main, legacy, "opened account shop"):
		return

	var catalog_button := _find_button_containing(legacy, "购买")
	if catalog_button == null:
		_fail("Zero-balance account shop should still expose purchasable catalog entries")
		return
	catalog_button.pressed.emit()
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	if not await _wait_for_modal(modal_layer):
		_fail("Catalog item click should open cosmetic detail modal")
		return
	var modal_text := _collect_text(modal_layer)
	for part in ["外观详情", "价格", "购买"]:
		if not modal_text.contains(part):
			_fail("Cosmetic purchase modal missing Web-style detail: %s" % part)
			return
	var purchase_button := _find_button_containing(modal_layer, "购买")
	if purchase_button == null:
		_fail("Cosmetic detail modal should expose purchase action")
		return

	seen_paths.clear()
	seen_responses.clear()
	purchase_button.pressed.emit()
	if not await _wait_for_path("/shop/purchase"):
		_fail("Cosmetic purchase action should POST /shop/purchase")
		return
	if bool(seen_responses.get("/shop/purchase", {}).get("ok", true)):
		_fail("Zero-balance cosmetic purchase should fail instead of mutating shop state")
		return
	if not await _wait_for_idle(legacy):
		_fail("Failed cosmetic purchase should restore interaction state")
		return
	if bool(legacy.get("action_in_progress")):
		_fail("Failed cosmetic purchase must not leave action_in_progress stuck")
		return
	if modal_layer.get_child_count() != 0:
		_fail("Failed cosmetic purchase should close the action modal")
		return
	if not _assert_account_shop_shell(main, legacy, "failed cosmetic purchase"):
		return
	var retry_button := _find_button_containing(legacy, "购买")
	if retry_button == null or retry_button.disabled:
		_fail("Failed cosmetic purchase should keep account shop buttons usable")
		return
	var status_label = legacy.get("status_label") as Label
	if status_label == null or not status_label.text.contains("Insufficient currency"):
		_fail("Failed cosmetic purchase should show backend error, got %s" % (status_label.text if status_label != null else "<missing>"))
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot account shop purchase failure UI smoke passed")
	quit(0)

func _new_logged_in_main() -> Node:
	var main_scene = load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return null
	var main = main_scene.instantiate()
	main_node = main
	root.add_child(main)
	await process_frame
	await process_frame
	var api = main.get("api")
	if api == null or not api.has_signal("request_finished"):
		_fail("Main API client must emit request_finished")
		return null
	api.request_finished.connect(func(path: String, _ok: bool, _status: int, _payload: Dictionary) -> void:
		seen_paths[path] = true
		seen_responses[path] = {"ok": _ok, "status": _status, "payload": _payload}
	)
	var router = main.get("router")
	var login_screen = main.get_node_or_null("ScreenRoot/LoginScreen")
	if router == null or login_screen == null:
		_fail("Main must expose router and LoginScreen")
		return null
	var account_input = login_screen.get_node_or_null("%AccountInput") as LineEdit
	var password_input = login_screen.get_node_or_null("%PasswordInput") as LineEdit
	if account_input == null or password_input == null:
		_fail("LoginScreen must expose account and password inputs")
		return null
	account_input.text = "godot-shop-fail-%d-%d" % [int(Time.get_unix_time_from_system()), Time.get_ticks_usec()]
	password_input.text = "dogdice"
	await login_screen.call("_on_register_pressed")
	if not await _wait_for_screen(router, "nickname_setup"):
		_fail("Register should route to nickname setup")
		return null
	var nickname_screen = main.get_node_or_null("ScreenRoot/NicknameSetupScreen")
	var nickname_input := _find_line_edit(nickname_screen)
	if nickname_input == null:
		_fail("NicknameSetupScreen must expose nickname input")
		return null
	nickname_input.text = "商城失败烟测"
	await nickname_screen.call("_submit_nickname")
	return main

func _assert_account_shop_shell(main: Node, legacy: Node, context: String) -> bool:
	if str(legacy.get("current_tab")) != "商城":
		_fail("%s should stay on account shop tab, got %s" % [context, str(legacy.get("current_tab"))])
		return false
	if not legacy.visible:
		_fail("%s should keep LegacyRunScreen visible" % context)
		return false
	if main.get_node_or_null("ScreenRoot/AccountShopScreen").visible:
		_fail("%s must not show the old standalone AccountShopScreen" % context)
		return false
	if legacy.find_child("PlaceholderPanel", true, false) != null:
		_fail("%s must not show placeholder content" % context)
		return false
	var text := _collect_text(legacy)
	for part in ["账号商城 / 外观", "钱包", "常驻区", "精选轮换区"]:
		if not text.contains(part):
			_fail("%s missing Web-style account shop section: %s" % [context, part])
			return false
	return true

func _wait_for_screen(router: Node, screen_id: String) -> bool:
	for _frame in range(240):
		if str(router.get("current_screen_id")) == screen_id:
			return true
		await process_frame
	return false

func _wait_for_tab(legacy: Node, tab: String) -> bool:
	for _frame in range(240):
		if str(legacy.get("current_tab")) == tab:
			return true
		await process_frame
	return false

func _wait_for_paths(paths: Array) -> bool:
	for _frame in range(600):
		var complete := true
		for path in paths:
			if not seen_paths.has(str(path)):
				complete = false
				break
		if complete:
			return true
		await process_frame
	return false

func _wait_for_path(path: String) -> bool:
	for _frame in range(600):
		if seen_paths.has(path):
			return true
		await process_frame
	return false

func _wait_for_idle(legacy: Node) -> bool:
	for _frame in range(600):
		if legacy != null and not bool(legacy.get("action_in_progress")):
			return true
		await process_frame
	return false

func _wait_for_modal(modal_layer: Node) -> bool:
	for _frame in range(180):
		if modal_layer.get_child_count() > 0:
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

func _find_button_containing(node: Node, text: String) -> Button:
	if node == null:
		return null
	if node is Button and (node as Button).is_visible_in_tree() and not (node as Button).disabled and (node as Button).text.contains(text):
		return node as Button
	for child in node.get_children():
		var result := _find_button_containing(child, text)
		if result != null:
			return result
	return null

func _collect_text(node: Node) -> String:
	var text := ""
	if node is CanvasItem and not (node as CanvasItem).is_visible_in_tree():
		return text
	if node is Label:
		text += (node as Label).text + "\n"
	if node is Button:
		text += (node as Button).text + "\n"
	for child in node.get_children():
		text += _collect_text(child)
	return text

func _fail(message: String) -> void:
	push_error(message)
	if main_node != null:
		main_node.queue_free()
	quit(1)
