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
		_fail("Auth panel must use the shared modal panel style")
		return
	var quick_start = login.get_node_or_null("%QuickStartButton")
	if not quick_start is Button:
		_fail("Quick start button is missing")
		return
	if not (quick_start as Button).text.contains("快速开始"):
		_fail("Quick start button must be readable on first launch")
		return
	login.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot login visual shell smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
