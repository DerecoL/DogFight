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
	for method_name in ["_maybe_show_reward_ceremony", "_show_reward_ceremony", "_ceremony_key"]:
		if not run_screen.has_method(method_name):
			_fail("%s is missing" % method_name)
			return
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	var class_run := {
		"id": "run-class",
		"phase": "CLASS_REWARD",
		"round": 3,
		"dogType": "SHIBA",
		"classRewardChoices": [
			{"defId": "starter-1", "quality": "BRONZE", "def": {"name": "1点牙咬", "size": 2, "triggerDice": [1]}},
			{"defId": "starter-2", "quality": "SILVER", "def": {"name": "2点护爪", "size": 1, "triggerDice": [2]}},
		],
	}
	run_screen.call("_maybe_show_reward_ceremony", class_run)
	await process_frame
	_assert_modal_text(modal_layer, ["职业觉醒", "柴犬", "专属装备授予", "1点牙咬", "2格", "点击继续"])
	run_screen.call("_close_top_modal")
	await process_frame
	run_screen.call("_maybe_show_reward_ceremony", class_run)
	await process_frame
	if modal_layer.get_child_count() != 0:
		_fail("Reward ceremony should only open once for the same run round")
		return
	var enchant_run := {
		"id": "run-enchant",
		"phase": "ENCHANT_CHOICE",
		"round": 5,
		"dogType": "FROG",
		"enchantChoices": [
			{"id": "ench-1", "description": "相邻装备伤害 +2", "enchant": {"label": "邻近伤害"}},
			{"id": "ench-2", "description": "本装备获得护盾", "enchant": {"label": "护盾纹路"}},
		],
	}
	run_screen.call("_maybe_show_reward_ceremony", enchant_run)
	await process_frame
	_assert_modal_text(modal_layer, ["免费附魔", "神秘附魔商店", "邻近伤害", "相邻装备伤害 +2", "点击继续"])
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot reward ceremony smoke passed")
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
