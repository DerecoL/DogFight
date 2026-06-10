extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var main_scene = load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame

	var router = main.get("router")
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if router == null or mode_lobby == null:
		_fail("Mode lobby history entry requires router and ModeLobbyScreen")
		return

	var history_button = mode_lobby.find_child("HistoryDetailButton", true, false) as Button
	if history_button == null:
		_fail("ModeLobbyScreen must expose Web-style HistoryDetailButton")
		return
	history_button.pressed.emit()
	await process_frame
	await process_frame

	if str(router.get("current_screen_id")) != "account":
		_fail("HistoryDetailButton should route to standalone account history, got %s" % str(router.get("current_screen_id")))
		return
	var account_history = main.get_node_or_null("ScreenRoot/AccountHistoryScreen")
	if account_history == null or not account_history.visible:
		_fail("HistoryDetailButton should show AccountHistoryScreen")
		return
	if account_history.find_child("AccountHistoryScreen", true, false) == null:
		_fail("HistoryDetailButton should render standalone account history content")
		return
	if account_history.find_child("PlaceholderPanel", true, false) != null:
		_fail("HistoryDetailButton must not show placeholder content")
		return
	var close_button := account_history.find_child("HistoryCloseButton", true, false) as Button
	if close_button == null or close_button.disabled:
		_fail("Account history close button should remain clickable like the Web overlay close button")
		return
	close_button.pressed.emit()
	await process_frame
	await process_frame
	if str(router.get("current_screen_id")) != "mode_lobby":
		_fail("HistoryCloseButton should return to standalone mode_lobby, got %s" % str(router.get("current_screen_id")))
		return
	if not mode_lobby.visible:
		_fail("HistoryCloseButton should show ModeLobbyScreen")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot mode lobby history entry smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
