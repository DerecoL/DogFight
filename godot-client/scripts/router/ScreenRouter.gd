class_name ScreenRouter
extends Node

signal screen_changed(screen_id: String)

var screen_root: Node
var screens: Dictionary = {}
var current_screen_id := ""
var back_stack: Array[String] = []

func configure(root: Node) -> void:
	screen_root = root

func register_screen(screen_id: String, node_name: String) -> void:
	if screen_root == null:
		push_error("ScreenRouter.configure must be called before register_screen")
		return
	var node := screen_root.get_node_or_null(node_name)
	if node == null:
		push_error("Screen not found: %s" % node_name)
		return
	var screen := node as CanvasItem
	if screen == null:
		push_error("Screen must be a CanvasItem: %s" % node_name)
		return
	screens[screen_id] = screen
	screen.visible = false

func show_screen(screen_id: String, add_to_back_stack := true) -> void:
	if not screens.has(screen_id):
		push_error("Unknown screen: %s" % screen_id)
		return
	if add_to_back_stack and current_screen_id.length() > 0 and current_screen_id != screen_id:
		back_stack.append(current_screen_id)
	if not add_to_back_stack:
		back_stack.clear()
	_display_screen(screen_id)

func _display_screen(screen_id: String) -> void:
	for id in screens.keys():
		var node: CanvasItem = screens[id]
		node.visible = id == screen_id
	current_screen_id = screen_id
	screen_changed.emit(screen_id)

func go_back() -> bool:
	if back_stack.is_empty():
		return false
	var previous := back_stack.pop_back()
	_display_screen(previous)
	return true

func clear_history() -> void:
	back_stack.clear()
