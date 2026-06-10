extends SceneTree

const ShellBackedWebScreenScript := preload("res://scripts/ui/web/ShellBackedWebScreen.gd")

func _init() -> void:
	var screen := ShellBackedWebScreenScript.new()
	root.add_child(screen)
	await process_frame

	if screen.find_child("WebShell", true, false) == null:
		_fail("ShellBackedWebScreen must create WebShell")
		return
	if not screen.content_container() is VBoxContainer:
		_fail("ShellBackedWebScreen.content_container must return a VBoxContainer")
		return
	if screen.content_container().name != "Content":
		_fail("ShellBackedWebScreen.content_container must expose WebShell content")
		return

	var child := Label.new()
	child.name = "ShellBackedChild"
	screen.content_container().add_child(child)
	screen.set_payload({"user": {"nickname": "Shell Tester"}, "run": {"gold": 7}})
	await process_frame
	if screen.find_child("ShellBackedChild", true, false) != null:
		_fail("ShellBackedWebScreen must clear content on payload render")
		return
	if not _collect_text(screen).contains("Shell Tester"):
		_fail("ShellBackedWebScreen must sync user payload into shell")
		return
	if not _collect_text(screen).contains("\u91d1\u5e01 7"):
		_fail("ShellBackedWebScreen must sync run payload into shell")
		return

	screen.queue_free()
	print("Shell backed web screen smoke passed")
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
