class_name ModalStack
extends Node

signal stack_changed(depth: int, blocking: bool)

var modal_root: Node
var stack: Array[Node] = []
var blocking_flags: Array[bool] = []

func configure(root: Node) -> void:
	modal_root = root

func push_modal(modal: Node, blocking := false) -> void:
	if modal_root != null and modal.get_parent() == null:
		modal_root.add_child(modal)
	stack.append(modal)
	blocking_flags.append(blocking)
	_emit_change()

func pop_modal() -> Node:
	if stack.is_empty():
		return null
	var modal := stack.pop_back()
	blocking_flags.pop_back()
	if modal != null and modal.get_parent() != null:
		modal.get_parent().remove_child(modal)
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
