extends SceneTree

var screen_node: Node

func _init() -> void:
	_run()

func _run() -> void:
	var scene = load("res://scenes/RunScreen.tscn")
	if scene == null:
		_fail("RunScreen scene failed to load")
		return
	var screen = scene.instantiate()
	screen_node = screen
	root.add_child(screen)
	await process_frame
	await process_frame

	screen.call("show_run_lobby", "CASUAL")
	await process_frame
	await process_frame

	var dog_select = screen.find_child("DogSelectScreen", true, false)
	if dog_select == null:
		_fail("Run lobby must render a Web-style DogSelectScreen root")
		return
	for node_name in ["ScreenHeading", "DogSelect", "DogCardGrid", "DogDetailPanel", "StartRunButton"]:
		if dog_select.find_child(node_name, true, false) == null:
			_fail("DogSelectScreen missing Web node: %s" % node_name)
			return
	var grid = dog_select.find_child("DogCardGrid", true, false) as GridContainer
	if grid == null or grid.columns != 4:
		_fail("DogCardGrid should use four columns like Web, got %s" % (str(grid.columns) if grid != null else "<missing>"))
		return
	for dog_type in ["SHIBA", "SAMOYED", "MUTT", "BULLY", "EMPEROR", "FROG"]:
		var card = dog_select.find_child("DogCard_%s" % dog_type, true, false)
		if card == null:
			_fail("DogCardGrid missing card for %s" % dog_type)
			return
	if _visible_option_button_count(dog_select) > 0:
		_fail("DogSelectScreen must not expose the old dropdown run creation controls")
		return
	var selected = dog_select.find_child("DogCard_SHIBA", true, false) as Button
	if selected == null or not selected.button_pressed:
		_fail("DogSelectScreen should select SHIBA by default")
		return
	var start_buttons := _visible_named_button_count(screen, "StartRunButton")
	if start_buttons != 1:
		_fail("DogSelect flow should expose one Web start action, got %d" % start_buttons)
		return

	screen.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot dog select Web structure smoke passed")
	quit(0)

func _visible_option_button_count(node: Node) -> int:
	var count := 0
	if node is OptionButton and (node as OptionButton).is_visible_in_tree():
		count += 1
	for child in node.get_children():
		count += _visible_option_button_count(child)
	return count

func _visible_named_button_count(node: Node, node_name: String) -> int:
	var count := 0
	if node.name == node_name and node is Button:
		count += 1
	for child in node.get_children():
		count += _visible_named_button_count(child, node_name)
	return count

func _fail(message: String) -> void:
	push_error(message)
	if screen_node != null:
		screen_node.queue_free()
	quit(1)
