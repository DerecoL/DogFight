extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var main_scene = load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame

	if not main.call("open_screen", "mode_lobby"):
		_fail("Main should open playable mode lobby")
		return
	await process_frame
	await process_frame

	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null:
		_fail("LegacyRunScreen is missing")
		return
	if not legacy.visible:
		_fail("LegacyRunScreen should be visible for playable mode lobby")
		return

	var header = legacy.find_child("Header", true, false)
	if header == null:
		_fail("LegacyRunScreen must expose stable Header")
		return
	if _visible_option_button_count(header) > 0:
		_fail("Playable shell header must not expose old dog/mode/lucky dropdowns")
		return
	if _has_visible_button_text(header, "新建跑局"):
		_fail("Playable shell header must not expose old global create-run button")
		return
	if _has_visible_button_text(header, "刷新全部"):
		_fail("Playable shell header must not expose old global refresh button")
		return
	var text := _collect_visible_text(legacy)
	for part in ["模式大厅", "休闲模式", "天梯模式", "多人房间", "巅峰竞技场"]:
		if not text.contains(part):
			_fail("Playable lobby must still render mode entry: %s" % part)
			return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot legacy shell header Web mode smoke passed")
	quit(0)

func _visible_option_button_count(node: Node) -> int:
	var count := 0
	if node is OptionButton and (node as OptionButton).is_visible_in_tree():
		count += 1
	for child in node.get_children():
		count += _visible_option_button_count(child)
	return count

func _has_visible_button_text(node: Node, text: String) -> bool:
	if node is Button and (node as Button).is_visible_in_tree() and (node as Button).text.contains(text):
		return true
	for child in node.get_children():
		if _has_visible_button_text(child, text):
			return true
	return false

func _collect_visible_text(node: Node) -> String:
	var text := ""
	if node is CanvasItem and not (node as CanvasItem).is_visible_in_tree():
		return text
	if node is Label:
		text += (node as Label).text + "\n"
	if node is Button:
		text += (node as Button).text + "\n"
	for child in node.get_children():
		text += _collect_visible_text(child)
	return text

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
