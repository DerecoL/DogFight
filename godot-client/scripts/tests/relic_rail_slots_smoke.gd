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
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	if not main.has_method("set_current_run"):
		_fail("Main session does not expose set_current_run")
		return
	main.call("set_current_run", _run_with_relics())
	run_screen.set("current_tab", "跑局")
	run_screen.call("_render_current_tab")
	await process_frame
	var text := _collect_text(run_screen)
	for part in ["遗物", "6槽，重复获得升级", "遗物槽 1", "遗物槽 6", "空遗物槽 2", "双面金牌", "GOLD", "成长徽章", "SILVER"]:
		if not text.contains(str(part)):
			_fail("Relic rail missing: %s" % str(part))
			return
	var relic_button := _find_button(run_screen, "双面金牌")
	if relic_button == null:
		_fail("Relic slot button is missing")
		return
	relic_button.pressed.emit()
	await process_frame
	_assert_modal_text(modal_layer, ["遗物详情", "双面金牌", "GOLD", "商店折扣提高", "出售遗物"])
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot relic rail slots smoke passed")
	quit(0)

func _run_with_relics() -> Dictionary:
	return {
		"id": "relic-run",
		"mode": "CASUAL",
		"phase": "SHOP",
		"status": "ACTIVE",
		"dogType": "SHIBA",
		"round": 4,
		"wins": 2,
		"losses": 0,
		"gold": 12,
		"items": [],
		"shopItems": [],
		"relics": [
			{
				"id": "relic-gold",
				"relicId": "v3-two-sided-gold-tag",
				"slot": 0,
				"quality": "GOLD",
				"def": {"name": "双面金牌", "description": "商店折扣提高"},
			},
			{
				"id": "relic-growth",
				"relicId": "v3-growth-badge",
				"slot": 3,
				"quality": "SILVER",
				"def": {"name": "成长徽章", "description": "每回合成长"},
			},
		],
	}

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

func _find_button(node: Node, needle: String) -> Button:
	if node is Button and (node as Button).text.contains(needle):
		return node as Button
	for child in node.get_children():
		var found := _find_button(child, needle)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
