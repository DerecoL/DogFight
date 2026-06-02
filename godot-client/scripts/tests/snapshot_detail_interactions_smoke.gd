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
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if run_screen == null or modal_layer == null:
		_fail("RunScreen or ModalLayer is missing")
		return
	for method_name in ["_show_snapshot_item_modal", "_show_snapshot_relic_modal"]:
		if not run_screen.has_method(method_name):
			_fail("%s is missing" % method_name)
			return
	run_screen.call("_show_snapshot_modal", _snapshot(), "历史对局配置")
	await process_frame
	if modal_layer.get_child_count() != 1:
		_fail("Snapshot modal was not pushed")
		return
	var item_button := _find_button(modal_layer, "历史牙咬")
	if item_button == null or item_button.disabled:
		_fail("Snapshot item button must be clickable")
		return
	item_button.pressed.emit()
	await process_frame
	var text := _collect_text(modal_layer)
	for part in ["快照装备详情", "历史牙咬", "白银", "触发点数", "造成 5 点伤害", "EQUIPMENT"]:
		if not text.contains(str(part)):
			_fail("Snapshot item detail missing: %s" % str(part))
			return
	_pop_modal(main)
	await process_frame
	var relic_button := _find_button(modal_layer, "历史遗物")
	if relic_button == null or relic_button.disabled:
		_fail("Snapshot relic button must be clickable")
		return
	relic_button.pressed.emit()
	await process_frame
	text = _collect_text(modal_layer)
	for part in ["快照遗物详情", "历史遗物", "黄金", "额外装备槽"]:
		if not text.contains(str(part)):
			_fail("Snapshot relic detail missing: %s" % str(part))
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot snapshot detail interactions smoke passed")
	quit(0)

func _snapshot() -> Dictionary:
	return {
		"id": "history-run-1",
		"mode": "CASUAL",
		"dogType": "SHIBA",
		"wins": 2,
		"losses": 1,
		"round": 4,
		"items": [
			{
				"id": "history-bite",
				"defId": "starter-1",
				"quality": "SILVER",
				"area": "EQUIPMENT",
				"x": 0,
				"y": 0,
				"triggerDice": 1,
				"def": {"name": "历史牙咬", "size": 1, "description": "造成 5 点伤害"},
			},
		],
		"relics": [
			{
				"id": "history-relic",
				"relicId": "extra-slot",
				"quality": "GOLD",
				"def": {"name": "历史遗物", "description": "额外装备槽", "effect": "EXTRA_EQUIPMENT_REDUCED_EFFECT"},
			},
		],
	}

func _find_button(node: Node, text_part: String) -> Button:
	if node is Button and (node as Button).text.contains(text_part):
		return node as Button
	for child in node.get_children():
		var result := _find_button(child, text_part)
		if result != null:
			return result
	return null

func _collect_text(node: Node) -> String:
	var text := ""
	if node is Label:
		text += (node as Label).text + "\n"
	if node is Button:
		text += (node as Button).text + "\n"
	for child in node.get_children():
		text += _collect_text(child)
	return text

func _pop_modal(main: Node) -> void:
	var stack = main.get("modal_stack")
	if stack != null and stack.has_method("pop_modal"):
		stack.pop_modal()

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
