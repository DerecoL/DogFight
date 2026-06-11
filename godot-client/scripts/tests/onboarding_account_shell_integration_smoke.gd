extends SceneTree

const SCREENS := [
	{
		"path": "res://scenes/screens/NicknameSetupScreen.tscn",
		"panel": "NicknameSetupRoot",
		"payload": {"user": {"nickname": ""}, "run": {"gold": 1}},
	},
	{
		"path": "res://scenes/screens/AccountHistoryScreen.tscn",
		"panel": "AccountHistoryPanel",
		"payload": {"user": {"nickname": "History User"}, "run": {"gold": 2}, "history": {"recentRuns": []}},
	},
]

func _init() -> void:
	for config in SCREENS:
		var path := str(config.get("path", ""))
		var scene := load(path)
		if scene == null:
			_fail("Onboarding/account screen scene must load: %s" % path)
			return
		var screen = scene.instantiate()
		root.add_child(screen)
		await process_frame
		screen.call("set_payload", config.get("payload", {}))
		await process_frame

		var shell: Node = screen.find_child("WebShell", true, false)
		if shell == null:
			_fail("Onboarding/account screen must include WebShell: %s" % path)
			return
		var content: Node = shell.get_node_or_null("Root/Content")
		if content == null:
			_fail("Onboarding/account screen must expose WebShell content: %s" % path)
			return
		var panel_name := str(config.get("panel", ""))
		if content.find_child(panel_name, true, false) == null:
			_fail("Onboarding/account screen panel must render inside WebShell content: %s" % panel_name)
			return
		if screen.get_node_or_null(panel_name) != null:
			_fail("Onboarding/account screen must not render panel outside WebShell content: %s" % panel_name)
			return
		if not _collect_text(shell).contains("\u91d1\u5e01"):
			_fail("Onboarding/account screen shell must render run resources: %s" % path)
			return

		screen.queue_free()
		for _frame in range(2):
			await process_frame

	print("Onboarding/account shell integration smoke passed")
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
