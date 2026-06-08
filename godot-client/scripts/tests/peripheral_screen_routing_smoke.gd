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

	if not main.has_method("open_screen"):
		_fail("GameSession must expose open_screen for mode lobby shortcuts")
		return
	var router = main.get("router")
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if router == null or legacy == null:
		_fail("Main must expose router and playable LegacyRunScreen")
		return

	var cases := {
		"account_shop": "商城",
		"achievements": "成就",
		"leaderboards": "排行",
		"season": "赛季",
		"dogfight_rooms": "房间",
		"account_settings": "设置",
	}
	for screen_id in cases.keys():
		main.call("open_screen", screen_id)
		await process_frame
		await process_frame
		if str(router.get("current_screen_id")) != "legacy_run":
			_fail("%s should route to playable shell, got %s" % [screen_id, str(router.get("current_screen_id"))])
			return
		if not legacy.visible:
			_fail("%s should show LegacyRunScreen" % screen_id)
			return
		if legacy.find_child("PlaceholderPanel", true, false) != null:
			_fail("%s must not show placeholder panel" % screen_id)
			return
		if not _collect_text(legacy).contains(str(cases[screen_id])):
			_fail("%s should show section label %s" % [screen_id, str(cases[screen_id])])
			return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot peripheral screen routing smoke passed")
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
