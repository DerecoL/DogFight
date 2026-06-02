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
	var parent := VBoxContainer.new()
	run_screen.add_child(parent)
	run_screen.call("_render_map_route", parent, {
		"currentNodeId": "n1",
		"availableNodeIds": ["n1"],
		"completedNodeIds": [],
		"nodes": [
			{"id": "n1", "layer": 0, "column": 0, "kind": "EVENT"},
			{"id": "n2", "layer": 1, "column": 0, "kind": "SHOP_EQUIPMENT"},
		],
	})
	await process_frame
	var board = _find_node(parent, "ParchmentMapBoard")
	if board == null:
		_fail("Map route must render a parchment board background")
		return
	if not board is TextureRect:
		_fail("ParchmentMapBoard must be a TextureRect")
		return
	var texture: Texture2D = (board as TextureRect).texture
	if texture == null or texture.get_width() <= 128:
		_fail("ParchmentMapBoard must use the migrated parchment texture")
		return
	var source := FileAccess.get_file_as_string("res://scripts/ui/RunScreen.gd")
	if not source.contains("res://assets/map/exploration-parchment-scroll.webp"):
		_fail("RunScreen must reference the migrated parchment map asset")
		return
	parent.queue_free()
	main.queue_free()
	for _frame in range(5):
		await process_frame
	quit(0)

func _find_node(node: Node, node_name: String) -> Node:
	if node.name == node_name:
		return node
	for child in node.get_children():
		var found := _find_node(child, node_name)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
