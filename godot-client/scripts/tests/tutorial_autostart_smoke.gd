extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/RunScreen.gd")
	for needle in [
		"TUTORIAL_STATUS_PATH",
		"func _maybe_auto_show_tutorial() -> void:",
		"_set_tutorial_status_for_user(user_id, \"active\")",
		"call_deferred(\"_show_tutorial_modal\", true)",
	]:
		if not source.contains(str(needle)):
			_fail("Tutorial autostart wiring is missing: %s" % str(needle))
			return
	var main_scene := load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame
	var run_screen = main.get_node_or_null("ScreenRoot/RunScreen")
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if run_screen == null or modal_layer == null:
		_fail("RunScreen or ModalLayer is missing")
		return
	for method_name in ["_maybe_auto_show_tutorial", "_tutorial_status_for_user", "_set_tutorial_status_for_user", "_tutorial_skip_for_current_user"]:
		if not run_screen.has_method(method_name):
			_fail("%s is missing" % method_name)
			return
	var user_id := "tutorial-smoke-%d" % int(Time.get_unix_time_from_system())
	run_screen.set("me_data", {"user": {"id": user_id, "account": "tutorial-smoke", "nickname": "引导玩家"}})
	run_screen.set("current_tab", "大厅")
	run_screen.call("_set_tutorial_status_for_user", user_id, "idle")
	run_screen.call("_maybe_auto_show_tutorial")
	await process_frame
	await process_frame
	if modal_layer.get_child_count() != 1:
		_fail("Tutorial autostart modal was not pushed")
		return
	var text := _collect_text(modal_layer)
	for part in ["新手引导", "大厅", "跳过引导", "进入跑局页"]:
		if not text.contains(str(part)):
			_fail("Tutorial autostart modal missing: %s" % str(part))
			return
	if text.contains("关闭"):
		_fail("Autostart tutorial must require an explicit start or skip")
		return
	var status := str(run_screen.call("_tutorial_status_for_user", user_id))
	if status != "active":
		_fail("Autostart tutorial should mark status active, got %s" % status)
		return
	run_screen.call("_tutorial_skip_for_current_user")
	await process_frame
	status = str(run_screen.call("_tutorial_status_for_user", user_id))
	if status != "skipped":
		_fail("Skipping tutorial should persist skipped status, got %s" % status)
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot tutorial autostart smoke passed")
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
