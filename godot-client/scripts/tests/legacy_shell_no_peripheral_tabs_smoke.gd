extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var run_scene = load("res://scenes/RunScreen.tscn")
	if run_scene == null:
		_fail("RunScreen scene failed to load")
		return
	var run_screen = run_scene.instantiate()
	root.add_child(run_screen)
	await process_frame
	await process_frame
	if run_screen.has_method("_render_shell"):
		run_screen.call("_render_shell")
	await process_frame

	var nav_list = run_screen.get("nav_list") as VBoxContainer
	if nav_list == null:
		_fail("LegacyRunScreen must expose its navigation list for shell structure checks")
		return
	var tab_texts := _button_texts(nav_list)
	if tab_texts.size() > 1:
		_fail("LegacyRunScreen should only expose playable shell tabs, got %s" % ", ".join(tab_texts))
		return
	for peripheral in ["大厅", "账号", "成就", "每日", "商城", "排行", "巅峰", "赛季", "房间", "设置"]:
		if tab_texts.has(peripheral):
			_fail("LegacyRunScreen must not expose peripheral Web page tab: %s" % peripheral)
			return
	for required in ["跑局"]:
		if not tab_texts.has(required):
			_fail("LegacyRunScreen should keep playable tab: %s" % required)
			return

	run_screen.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot legacy shell no peripheral tabs smoke passed")
	quit(0)

func _button_texts(node: Node) -> Array[String]:
	var result: Array[String] = []
	for child in node.get_children():
		if child is Button:
			result.append((child as Button).text)
	return result

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
