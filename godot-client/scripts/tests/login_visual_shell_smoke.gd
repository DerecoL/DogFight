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
	var background = login.get_node_or_null("%BackgroundImage")
	if not background is TextureRect:
		_fail("Login screen must render a migrated background image")
		return
	if (background as TextureRect).texture == null:
		_fail("Login background texture is missing")
		return
	if (background as TextureRect).stretch_mode != TextureRect.STRETCH_KEEP_ASPECT_COVERED:
		_fail("Login background must cover the viewport")
		return
	var auth_panel = login.get_node_or_null("%AuthPanel")
	if not auth_panel is PanelContainer:
		_fail("Login screen must contain a centered auth panel")
		return
	if (auth_panel as PanelContainer).get_theme_stylebox("panel") == null:
		_fail("Auth panel must use the shared paper panel style")
		return
	var debug_toggle = login.get_node_or_null("%DebugAuthToggle")
	if not debug_toggle is Button:
		_fail("Login screen must expose a folded debug auth toggle")
		return
	if not (debug_toggle as Button).visible or not (debug_toggle as Button).is_visible_in_tree():
		_fail("Debug auth toggle must be visible by default")
		return
	var debug_group = login.get_node_or_null("%DebugAuthGroup")
	if not debug_group is Control:
		_fail("Login screen must contain a debug auth group")
		return
	if (debug_group as Control).visible or (debug_group as Control).is_visible_in_tree():
		_fail("Debug auth group must be folded by default")
		return
	var quick_start = login.get_node_or_null("%QuickStartButton")
	var taptap_code = login.get_node_or_null("%TapTapCodeInput")
	var taptap_button = login.get_node_or_null("%TapTapButton")
	if not quick_start is Button or not taptap_code is LineEdit or not taptap_button is Button:
		_fail("Folded debug auth controls are missing")
		return
	if (quick_start as Button).is_visible_in_tree():
		_fail("Quick start button must not be a first-launch primary entry")
		return
	if (taptap_code as LineEdit).is_visible_in_tree() or (taptap_button as Button).is_visible_in_tree():
		_fail("TapTap auth controls must be folded by default")
		return
	(debug_toggle as Button).pressed.emit()
	await process_frame
	if not (debug_group as Control).visible or not (quick_start as Button).is_visible_in_tree():
		_fail("Debug auth group and quick start must be visible after expanding")
		return
	if not (taptap_code as LineEdit).is_visible_in_tree() or not (taptap_button as Button).is_visible_in_tree():
		_fail("TapTap auth controls must be visible after expanding")
		return
	login.call("_on_error_raised", "Local service is unavailable. Run scripts/start-godot-dev.ps1 before login, register, or quick start.")
	await process_frame
	var error_scroll = login.find_child("ErrorScroll", true, false)
	if not error_scroll is ScrollContainer:
		_fail("Login error hint must stay in a stable non-overflowing error area")
		return
	var scrollbar := (error_scroll as ScrollContainer).get_v_scroll_bar()
	if scrollbar != null and scrollbar.visible:
		_fail("Login error hint must not create an internal scrollbar in the auth panel")
		return
	var panel_bottom := (auth_panel as Control).get_global_rect().end.y
	for control in [debug_toggle, debug_group, quick_start, taptap_code, taptap_button]:
		var control_rect := (control as Control).get_global_rect()
		if control_rect.end.y > panel_bottom + 0.5:
			_fail("%s must remain inside the stable auth panel after long errors" % control.name)
			return
	login.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot login visual shell smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
