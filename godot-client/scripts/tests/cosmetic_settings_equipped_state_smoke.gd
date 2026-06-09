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
	var run_screen = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if run_screen != null and run_screen.has_method("bind_session"):
		run_screen.bind_session(main)
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	run_screen.set("cosmetics_data", {
		"equipped": [
			{
				"slot": "TITLE",
				"catalogItemId": "title-paper-crown",
				"item": {
					"id": "title-paper-crown",
					"name": "纸冠头衔",
					"type": "TITLE",
					"rarity": "EPIC",
				},
			},
		],
		"inventory": [
			{
				"catalogItemId": "title-paper-crown",
				"item": {
					"id": "title-paper-crown",
					"name": "纸冠头衔",
					"description": "在账号面板展示纸冠称号",
					"type": "TITLE",
					"rarity": "EPIC",
					"price": 120,
				},
				"owned": true,
			},
		],
	})
	run_screen.set("current_tab", "设置")
	run_screen.call("_render_current_tab")
	await process_frame
	var screen_text := _collect_text(run_screen)
	for part in ["个人设置", "时装与展示", "称号", "纸冠头衔", "当前装备", "已装备"]:
		if not screen_text.contains(str(part)):
			_fail("Cosmetic settings missing equipped state: %s" % str(part))
			return
	run_screen.call("_show_cosmetic_modal", {
		"catalogItemId": "title-paper-crown",
		"owned": true,
		"item": {
			"id": "title-paper-crown",
			"name": "纸冠头衔",
			"description": "在账号面板展示纸冠称号",
			"type": "TITLE",
			"rarity": "EPIC",
			"price": 120,
		},
	})
	await process_frame
	_assert_modal_text(modal_layer, ["外观详情", "纸冠头衔", "称号", "史诗", "状态", "已装备"])
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot cosmetic settings equipped state smoke passed")
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
