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
	for method_name in ["_show_map_monster_item_modal", "_show_map_reward_modal"]:
		if not run_screen.has_method(method_name):
			_fail("%s is missing" % method_name)
			return
	run_screen.call("_show_map_node_modal", _monster_node())
	await process_frame
	if modal_layer.get_child_count() != 1:
		_fail("Map node modal was not pushed")
		return
	var equipment_button := _find_button(modal_layer, "野怪牙咬")
	if equipment_button == null or equipment_button.disabled:
		_fail("Monster equipment button must be clickable")
		return
	equipment_button.pressed.emit()
	await process_frame
	var text := _collect_text(modal_layer)
	for part in ["野怪装备详情", "野怪牙咬", "白银", "触发点数", "造成 5 点伤害"]:
		if not text.contains(str(part)):
			_fail("Monster equipment detail missing: %s" % str(part))
			return
	_pop_modal(main)
	await process_frame
	var reward_button := _find_button(modal_layer, "奖励牙咬")
	if reward_button == null or reward_button.disabled:
		_fail("Map reward preview button must be clickable")
		return
	reward_button.pressed.emit()
	await process_frame
	text = _collect_text(modal_layer)
	for part in ["地图掉落预览", "奖励牙咬", "黄金", "造成 7 点伤害"]:
		if not text.contains(str(part)):
			_fail("Map reward detail missing: %s" % str(part))
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot map node detail interactions smoke passed")
	quit(0)

func _monster_node() -> Dictionary:
	return {
		"id": "m0-l0-c0",
		"layer": 0,
		"column": 0,
		"kind": "MONSTER_BATTLE",
		"monster": {
			"name": "训练野怪",
			"dogType": "SHIBA",
			"round": 1,
			"equipment": [
				{
					"id": "monster-bite",
					"defId": "starter-1",
					"quality": "SILVER",
					"area": "EQUIPMENT",
					"x": 0,
					"y": 0,
					"triggerDice": 1,
					"def": {"name": "野怪牙咬", "size": 1, "description": "造成 5 点伤害"},
				},
			],
			"possibleRewards": [
				{
					"defId": "starter-2",
					"quality": "GOLD",
					"def": {"name": "奖励牙咬", "size": 1, "description": "造成 7 点伤害"},
				},
			],
		},
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
