class_name ModalStack
extends Node

signal stack_changed(depth: int, blocking: bool)

var modal_root: Node
var stack: Array[Node] = []
var blocking_flags: Array[bool] = []

func configure(root: Node) -> void:
	modal_root = root

func push_modal(modal: Node, blocking := false, report_errors := true) -> bool:
	if modal_root == null:
		if report_errors:
			push_error("ModalStack.configure must be called before push_modal")
		return false
	if modal.get_parent() != null:
		if report_errors:
			push_error("ModalStack only accepts unparented modal nodes")
		return false
	modal_root.add_child(modal)
	stack.append(modal)
	blocking_flags.append(blocking)
	_emit_change()
	return true

func pop_modal() -> Node:
	if stack.is_empty():
		return null
	var modal := stack.pop_back() as Node
	blocking_flags.pop_back()
	if modal != null and modal.get_parent() == modal_root:
		modal_root.remove_child(modal)
		modal.queue_free()
	_emit_change()
	return modal

func clear() -> void:
	while not stack.is_empty():
		pop_modal()

func depth() -> int:
	return stack.size()

func is_blocking() -> bool:
	return blocking_flags.any(func(value: bool) -> bool: return value)

func _emit_change() -> void:
	stack_changed.emit(depth(), is_blocking())
