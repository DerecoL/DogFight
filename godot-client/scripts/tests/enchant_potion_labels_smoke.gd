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
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if run_screen == null or modal_layer == null:
		_fail("Required nodes are missing")
		return
	run_screen.call("_show_enchant_choice_modal", {
		"id": "enchant-left-shield",
		"description": "触发时使左侧装备下次增加护盾 +5。",
		"enchant": {
			"kind": "BUFF_NEIGHBOR_EFFECT",
			"target": "LEFT",
			"effect": "SHIELD",
			"amount": 5,
			"label": "左侧护盾强化",
		},
	})
	await process_frame
	var enchant_text := _collect_text(modal_layer)
	for expected in ["附魔选择", "左侧护盾强化", "强化相邻装备", "左侧", "增加护盾", "5"]:
		if not enchant_text.contains(expected):
			_fail("Enchant label missing: %s" % expected)
			return
	for raw in ["BUFF_NEIGHBOR_EFFECT", "LEFT", "SHIELD"]:
		if enchant_text.contains(raw):
			_fail("Enchant modal leaked raw enum: %s" % raw)
			return
	run_screen.call("_close_top_modal")
	await process_frame
	run_screen.call("_show_potion_choice_modal", {
		"id": "potion-all",
		"category": "REPLACE_ALL",
		"dice": [1, 2, 3, 4, 5, 6],
		"description": "改为全点数 1/2/3/4/5/6 触发。",
	})
	await process_frame
	var potion_text := _collect_text(modal_layer)
	for expected in ["药水选择", "改为全点数", "1, 2, 3, 4, 5, 6"]:
		if not potion_text.contains(expected):
			_fail("Potion label missing: %s" % expected)
			return
	if potion_text.contains("REPLACE_ALL"):
		_fail("Potion modal leaked raw category")
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot enchant potion labels smoke passed")
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
