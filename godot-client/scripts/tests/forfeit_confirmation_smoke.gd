extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/RunScreen.gd")
	if not source.contains("_show_forfeit_modal.bind(run)"):
		_fail("RunScreen forfeit action must open a confirmation modal")
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
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	for method_name in ["_show_forfeit_modal", "_confirm_forfeit_from_modal"]:
		if not run_screen.has_method(method_name):
			_fail("%s is missing" % method_name)
			return
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	run_screen.call("_show_forfeit_modal", {
		"id": "run-forfeit",
		"mode": "CASUAL",
		"phase": "SHOP",
		"dogType": "SHIBA",
		"round": 4,
		"wins": 2,
		"losses": 1,
		"gold": 7,
	})
	await process_frame
	_assert_modal_text(modal_layer, ["放弃并结算当前跑局", "柴犬", "第 4 回合", "2 胜 / 1 败", "不会额外增加失败", "确认放弃并结算", "继续跑局"])
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot forfeit confirmation smoke passed")
	quit(0)

func _assert_modal_text(modal_layer: Node, expected: Array) -> void:
	if modal_layer.get_child_count() != 1:
		_fail("Expected exactly one modal, got %d" % modal_layer.get_child_count())
		return
	var text := _collect_text(modal_layer)
	for part in expected:
		var value := str(part)
		if not text.contains(value):
			_fail("Modal text missing: %s" % value)
			return

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
