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
	for part in ["模式大厅", "当前账号", "犬种", "模式", "开始跑局", "继续跑局", "退出登录"]:
		if not text.contains(str(part)):
			_fail("ModeLobbyScreen text missing: %s" % str(part))
			return
	if screen.get_node_or_null("ModeLobbyPanel") == null:
		_fail("ModeLobbyScreen must have stable panel root")
		return
	if screen.find_child("StartRunButton", true, false) == null:
		_fail("ModeLobbyScreen must expose StartRunButton")
		return
	for button_name in ["CasualModeButton", "LadderModeButton", "DogfightModeButton", "PeakModeButton"]:
		if screen.find_child(button_name, true, false) == null:
			_fail("ModeLobbyScreen must expose Web-style mode entry: %s" % button_name)
			return
	var option_count := _count_option_buttons(screen)
	if option_count < 3:
		_fail("ModeLobbyScreen must expose dog, mode, and lucky number selectors")
		return
	var source := FileAccess.get_file_as_string("res://scripts/ui/screens/ModeLobbyScreen.gd")
	for needle in ["create_run", "logout", "open_screen", "休闲模式", "天梯模式", "斗狗模式", "巅峰模式", "account_shop", "achievements", "leaderboards", "dogfight_rooms", "account_settings", "SHIBA", "SAMOYED", "MUTT", "BULLY", "EMPEROR", "FROG", "CASUAL", "LADDER"]:
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

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
