extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var tokens = load("res://scripts/ui/kit/UiTokens.gd")
	if tokens == null or not tokens.has_method("paper_panel_style"):
		_fail("UiTokens must expose reusable paper panel styles")
		return
	var login_scene := load("res://scenes/LoginScreen.tscn")
	if login_scene == null:
		_fail("LoginScreen scene failed to load")
		return
	var login = login_scene.instantiate()
	root.add_child(login)
	await process_frame
	var auth_panel = login.get_node_or_null("%AuthPanel")
	if not auth_panel is PanelContainer or (auth_panel as PanelContainer).get_theme_stylebox("panel") == null:
		_fail("Login auth panel must use a custom paper style")
		return
	var login_button = login.get_node_or_null("%LoginButton")
	var account_input = login.get_node_or_null("%AccountInput")
	if not login_button is Button or (login_button as Button).get_theme_stylebox("normal") == null:
		_fail("Login buttons must use custom styles")
		return
	if not account_input is LineEdit or (account_input as LineEdit).get_theme_stylebox("normal") == null:
		_fail("Login inputs must use custom styles")
		return
	login.queue_free()
	for _frame in range(2):
		await process_frame

	var main_scene := load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame
	var run_screen = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if run_screen != null and run_screen.has_method("bind_session"):
		run_screen.bind_session(main)
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	var styled_panel := _first_styled_panel(run_screen)
	if styled_panel == null:
		_fail("RunScreen sections must use custom paper card styles")
		return
	var styled_button := _first_styled_button(run_screen)
	if styled_button == null:
		_fail("RunScreen buttons must use custom styles")
		return
	if not run_screen.has_method("_show_cosmetic_modal"):
		_fail("RunScreen detail modal method missing")
		return
	run_screen.call("_show_cosmetic_modal", {"id": "title-crown", "name": "纸冠头衔", "type": "TITLE", "rarity": "EPIC", "price": 120})
	await process_frame
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null or modal_layer.get_child_count() != 1:
		_fail("Detail modal was not pushed")
		return
	var modal_panel = modal_layer.get_child(0)
	if not modal_panel is PanelContainer or (modal_panel as PanelContainer).get_theme_stylebox("panel") == null:
		_fail("Detail modals must use custom paper styles")
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot UI visual style smoke passed")
	quit(0)

func _first_styled_panel(node: Node) -> PanelContainer:
	if node is PanelContainer and (node as PanelContainer).get_theme_stylebox("panel") != null:
		return node as PanelContainer
	for child in node.get_children():
		var found := _first_styled_panel(child)
		if found != null:
			return found
	return null

func _first_styled_button(node: Node) -> Button:
	if node is Button and (node as Button).get_theme_stylebox("normal") != null:
		return node as Button
	for child in node.get_children():
		var found := _first_styled_button(child)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
