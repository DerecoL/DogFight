extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene = load("res://scenes/screens/ModeLobbyScreen.tscn")
	if scene == null:
		_fail("ModeLobbyScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame

	var text := _collect_text(screen)
	for part in ["模式大厅", "选择本次要进入的竞技方式", "新手引导", "休闲模式", "天梯模式", "斗狗模式", "巅峰模式"]:
		if not text.contains(part):
			_fail("ModeLobbyScreen text missing: %s" % part)
			return
	if screen.find_child("ModeLobbyPanel", true, false) == null:
		_fail("ModeLobbyScreen must have stable panel root")
		return
	if screen.find_child("StartRunButton", true, false) != null:
		_fail("ModeLobbyScreen must not expose direct start form controls")
		return
	if _has_visible_button_text(screen, "退出登录"):
		_fail("ModeLobby component must not include logout; Web keeps it in TopBar")
		return
	for button_name in ["TutorialReplayButton", "CasualModeButton", "LadderModeButton", "DogfightModeButton", "PeakModeButton"]:
		if screen.find_child(button_name, true, false) == null:
			_fail("ModeLobbyScreen must expose Web-style mode entry: %s" % button_name)
			return
	var option_count := _count_option_buttons(screen)
	if option_count != 0:
		_fail("ModeLobbyScreen must match Web lobby structure without embedded dog/mode selectors")
		return
	var source := FileAccess.get_file_as_string("res://scripts/ui/screens/ModeLobbyScreen.gd")
	for needle in ["open_screen", "open_run_lobby", "replay_tutorial", "休闲模式", "天梯模式", "斗狗模式", "巅峰模式", "dogfight_rooms", "leaderboards", "apex"]:
		if not source.contains(str(needle)):
			_fail("ModeLobbyScreen source missing interaction: %s" % str(needle))
			return

	screen.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot mode lobby interaction smoke passed")
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

func _count_option_buttons(node: Node) -> int:
	var count := 0
	if node is OptionButton:
		count += 1
	for child in node.get_children():
		count += _count_option_buttons(child)
	return count

func _has_visible_button_text(node: Node, text: String) -> bool:
	if node is Button and (node as Button).is_visible_in_tree() and (node as Button).text.contains(text):
		return true
	for child in node.get_children():
		if _has_visible_button_text(child, text):
			return true
	return false

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
