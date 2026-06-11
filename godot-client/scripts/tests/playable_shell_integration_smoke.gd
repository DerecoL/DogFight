extends SceneTree

const SCREENS := [
	{
		"path": "res://scenes/screens/RunShellScreen.tscn",
		"panel": "RunShellScroll",
		"payload": {"user": {"nickname": "Run Shell User"}, "run": {"gold": 1, "phase": "PREP", "items": [], "relics": []}},
	},
	{
		"path": "res://scenes/screens/RunShopScreen.tscn",
		"panel": "RunShopScroll",
		"payload": {"user": {"nickname": "Run Shop User"}, "run": {"gold": 2, "phase": "SHOP", "shopItems": [], "items": [], "relics": []}},
	},
	{
		"path": "res://scenes/screens/DogSelectScreen.tscn",
		"panel": "DogSelectScroll",
		"payload": {"user": {"nickname": "Dog Select User"}, "run": {"gold": 3}},
	},
	{
		"path": "res://scenes/screens/ExplorationMapScreen.tscn",
		"panel": "ExplorationMapScroll",
		"payload": {"user": {"nickname": "Map User"}, "run": {"gold": 4, "mapState": {"nodes": []}}},
	},
]

func _init() -> void:
	for config in SCREENS:
		var path := str(config.get("path", ""))
		var scene := load(path)
		if scene == null:
			_fail("Playable screen scene must load: %s" % path)
			return
		var screen = scene.instantiate()
		root.add_child(screen)
		await process_frame
		screen.call("set_payload", config.get("payload", {}))
		await process_frame

		var shell: Node = screen.find_child("WebShell", true, false)
		if shell == null:
			_fail("Playable screen must include WebShell: %s" % path)
			return
		var content: Node = shell.get_node_or_null("Root/Content")
		if content == null:
			_fail("Playable screen must expose WebShell content: %s" % path)
			return
		var panel_name := str(config.get("panel", ""))
		if content.find_child(panel_name, true, false) == null:
			_fail("Playable screen panel must render inside WebShell content: %s" % panel_name)
			return
		if screen.get_node_or_null(panel_name) != null:
			_fail("Playable screen must not render panel outside WebShell content: %s" % panel_name)
			return
		if not _collect_text(shell).contains("\u91d1\u5e01"):
			_fail("Playable screen shell must render run resources: %s" % path)
			return

		screen.queue_free()
		for _frame in range(2):
			await process_frame

	print("Playable shell integration smoke passed")
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
