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
	if run_screen == null or not run_screen.has_method("_show_map_node_modal"):
		_fail("RunScreen map node modal is missing")
		return
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	run_screen.call("_show_map_node_modal", {
		"id": "m0-l0-c0",
		"layer": 0,
		"column": 0,
		"kind": "MONSTER_BATTLE",
		"monster": {
			"name": "训练野怪",
			"dogType": "SHIBA",
			"round": 1,
			"equipment": [
				{"id": "monster-bite", "defId": "starter-1", "quality": "BRONZE", "area": "EQUIPMENT", "x": 0, "y": 0},
				{"id": "monster-bite-2", "defId": "starter-2", "quality": "BRONZE", "area": "EQUIPMENT", "x": 1, "y": 0},
			],
			"possibleRewards": [
				{"defId": "starter-1", "quality": "BRONZE"},
				{"defId": "starter-2", "quality": "BRONZE"},
			],
		},
	})
	await process_frame
	if modal_layer.get_child_count() != 1:
		_fail("Map node modal was not pushed")
		return
	var text := _collect_text(modal_layer)
	if not text.contains("野怪装备栏") or not text.contains("可能掉落") or not text.contains("训练野怪"):
		_fail("Map node modal did not render monster equipment and rewards")
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot map node modal smoke passed")
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
