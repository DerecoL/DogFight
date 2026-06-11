extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	DisplayServer.window_set_size(WebUiTokens.safe_content_size_16_9())
	var main_scene = load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame

	var router = main.get("router")
	if router == null:
		_fail("Main must expose router")
		return
	router.call("show_screen", "mode_lobby", false)
	await process_frame
	await process_frame
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if mode_lobby == null or not mode_lobby.visible:
		_fail("Standalone mode lobby should show ModeLobbyScreen")
		return
	var tutorial_button = mode_lobby.find_child("TutorialReplayButton", true, false) as Button
	if tutorial_button == null:
		_fail("Standalone mode lobby must expose TutorialReplayButton")
		return
	var lobby_panel := mode_lobby.find_child("ModeLobbyPanel", true, false) as Control
	if lobby_panel == null:
		_fail("Standalone mode lobby must expose ModeLobbyPanel")
		return
	var panel_rect_before := lobby_panel.get_global_rect()
	tutorial_button.pressed.emit()
	await process_frame
	await process_frame

	if str(router.get("current_screen_id")) != "mode_lobby":
		_fail("Tutorial entry should stay on standalone mode_lobby, got %s" % str(router.get("current_screen_id")))
		return
	if not mode_lobby.visible:
		_fail("Tutorial entry should keep ModeLobbyScreen visible")
		return
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy != null and legacy.visible:
		_fail("Tutorial entry must not open LegacyRunScreen")
		return
	for node_name in ["CasualTutorialGuide", "TutorialCoachCard", "TutorialTag", "TutorialTitle", "TutorialTask", "TutorialSkipButton"]:
		if mode_lobby.find_child(node_name, true, false) == null:
			_fail("Standalone tutorial guide missing node: %s" % node_name)
			return
	var tutorial_guide := mode_lobby.find_child("CasualTutorialGuide", true, false) as Control
	var primary_modes := mode_lobby.find_child("ModeLobbyPrimaryModes", true, false) as Control
	var history_panel := mode_lobby.find_child("PlayerHistoryPanel", true, false) as Control
	if tutorial_guide == null or not tutorial_guide.visible:
		_fail("Tutorial overlay should be visible after pressing TutorialReplayButton")
		return
	if tutorial_guide.z_index < WebUiTokens.layer_overlay():
		_fail("Tutorial overlay z_index must use the overlay layer")
		return
	if primary_modes != null and tutorial_guide.z_index <= primary_modes.z_index:
		_fail("Tutorial overlay must render above primary mode cards")
		return
	if history_panel != null and tutorial_guide.z_index <= history_panel.z_index:
		_fail("Tutorial overlay must render above the history panel")
		return
	if tutorial_guide.get_parent() is VBoxContainer:
		_fail("Tutorial overlay must not participate in VBoxContainer flow layout")
		return
	var panel_rect_after := lobby_panel.get_global_rect()
	if panel_rect_after != panel_rect_before:
		_fail("Tutorial overlay visibility must not change ModeLobbyPanel rect")
		return
	var guide_rect := tutorial_guide.get_global_rect()
	var safe_viewport_rect := Rect2(Vector2.ZERO, Vector2(WebUiTokens.safe_content_size_16_9()))
	if not safe_viewport_rect.encloses(guide_rect):
		_fail("Tutorial overlay global rect must stay inside the 16:9 safe viewport, guide=%s viewport=%s" % [str(guide_rect), str(safe_viewport_rect)])
		return
	var text := _collect_text(mode_lobby)
	for part in ["新手引导", "先从休闲模式熟悉一局", "点击开始休闲模式", "跳过引导"]:
		if not text.contains(part):
			_fail("Standalone tutorial guide missing text: %s" % part)
			return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot mode lobby tutorial entry smoke passed")
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
