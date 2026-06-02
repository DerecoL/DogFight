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
	for method_name in ["_show_class_reward_modal", "_show_relic_choice_modal", "_show_enchant_choice_modal", "_show_potion_choice_modal"]:
		if not run_screen.has_method(method_name):
			_fail("%s is missing" % method_name)
			return
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	run_screen.call("_show_class_reward_modal", {
		"defId": "starter-1",
		"quality": "BRONZE",
		"def": {"name": "1点牙咬", "description": "命中 1 点时造成伤害", "triggerDice": [1], "tags": ["伤害"]},
	})
	await process_frame
	_assert_modal_text(modal_layer, ["职业装备奖励", "1点牙咬", "青铜", "触发点数", "领取职业装备"])
	run_screen.call("_close_top_modal")
	await process_frame
	run_screen.call("_show_relic_choice_modal", {
		"relicId": "v3-two-sided-gold-tag",
		"quality": "SILVER",
		"def": {"name": "双面金牌", "description": "商店折扣提高"},
	})
	await process_frame
	_assert_modal_text(modal_layer, ["遗物选择", "双面金牌", "白银", "商店折扣提高", "选择遗物"])
	run_screen.call("_close_top_modal")
	await process_frame
	run_screen.call("_show_enchant_choice_modal", {
		"id": "ench-1",
		"description": "相邻装备伤害 +2",
		"enchant": {"kind": "BUFF_NEIGHBOR_EFFECT", "target": "ADJACENT", "effect": "DAMAGE", "amount": 2, "label": "邻近伤害"},
	})
	await process_frame
	_assert_modal_text(modal_layer, ["附魔选择", "相邻装备伤害 +2", "邻近伤害", "强化相邻装备", "相邻", "攻击", "附魔到选中装备"])
	run_screen.call("_close_top_modal")
	await process_frame
	run_screen.call("_show_potion_choice_modal", {
		"id": "potion-1",
		"category": "ADD_ONE",
		"dice": [1, 3],
		"description": "增加 1、3 点触发",
	})
	await process_frame
	_assert_modal_text(modal_layer, ["药水选择", "增加一个点数", "1, 3", "增加 1、3 点触发", "药水给选中装备"])
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot reward choice detail smoke passed")
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
