extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var main_scene := load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame
	var run_screen = main.get_node_or_null("ScreenRoot/RunScreen")
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	if not run_screen.has_method("_show_tutorial_modal"):
		_fail("RunScreen tutorial modal is missing")
		return
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	run_screen.call("_show_tutorial_modal")
	await process_frame
	if modal_layer.get_child_count() != 1:
		_fail("Tutorial modal was not pushed")
		return
	var text := _collect_text(modal_layer)
	for part in ["新手引导", "大厅", "选择狗狗", "查看商店", "放置装备", "观看战斗", "继续跑局"]:
		if not text.contains(part):
			_fail("Tutorial modal missing: %s" % part)
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot tutorial modal smoke passed")
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
