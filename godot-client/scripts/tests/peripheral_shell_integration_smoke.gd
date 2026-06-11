extends SceneTree

const SCREENS := [
	{
		"path": "res://scenes/screens/AccountSettingsScreen.tscn",
		"panel": "AccountSettingsPanel",
		"payload": {"user": {"nickname": "Settings User"}, "run": {"gold": 1}, "cosmeticsData": {}},
	},
	{
		"path": "res://scenes/screens/AccountShopScreen.tscn",
		"panel": "AccountShopPanel",
		"payload": {"user": {"nickname": "Shop User"}, "run": {"gold": 2}},
	},
	{
		"path": "res://scenes/screens/AchievementsScreen.tscn",
		"panel": "AchievementsPanel",
		"payload": {"user": {"nickname": "Achievements User"}, "run": {"gold": 3}, "achievementsData": {}, "dailyData": {}},
	},
	{
		"path": "res://scenes/screens/LeaderboardsScreen.tscn",
		"panel": "LadderScreen",
		"payload": {"user": {"nickname": "Leaderboards User"}, "run": {"gold": 4}, "ladderData": {}},
	},
	{
		"path": "res://scenes/screens/ApexScreen.tscn",
		"panel": "ApexPanel",
		"payload": {"user": {"nickname": "Apex User"}, "run": {"gold": 5}, "apexData": {}},
	},
	{
		"path": "res://scenes/screens/ModeLobbyScreen.tscn",
		"panel": "ModeLobbyPanel",
		"payload": {"user": {"nickname": "Lobby User"}, "run": {"gold": 6}},
	},
]

func _init() -> void:
	for config in SCREENS:
		var path := str(config.get("path", ""))
		var scene := load(path)
		if scene == null:
			_fail("Peripheral screen scene must load: %s" % path)
			return
		var screen = scene.instantiate()
		root.add_child(screen)
		await process_frame
		screen.call("set_payload", config.get("payload", {}))
		await process_frame

		var shell: Node = screen.find_child("WebShell", true, false)
		if shell == null:
			_fail("Peripheral screen must include WebShell: %s" % path)
			return
		var content: Node = shell.get_node_or_null("Root/Content")
		if content == null:
			_fail("Peripheral screen must expose WebShell content: %s" % path)
			return
		var panel_name := str(config.get("panel", ""))
		if content.find_child(panel_name, true, false) == null:
			_fail("Peripheral screen panel must render inside WebShell content: %s" % panel_name)
			return
		if screen.get_node_or_null(panel_name) != null:
			_fail("Peripheral screen must not render panel outside WebShell content: %s" % panel_name)
			return
		if _collect_text(shell).contains("\u91d1\u5e01") == false:
			_fail("Peripheral screen shell must render run resources: %s" % path)
			return

		screen.queue_free()
		for _frame in range(2):
			await process_frame

	print("Peripheral shell integration smoke passed")
	quit(0)

func _collect_text(node: Node) -> String:
	var parts: Array[String] = []
	_collect_text_into(node, parts)
	return "\n".join(parts)

func _collect_text_into(node: Node, parts: Array[String]) -> void:
	if node is Label or node is Button:
		parts.append(str(node.get("text")))
	for child in node.get_children():
		_collect_text_into(child, parts)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
