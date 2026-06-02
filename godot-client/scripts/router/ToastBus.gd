class_name ToastBus
extends Node

signal toast_queued(toast: Dictionary)

var queue: Array[Dictionary] = []

func push(message: String, kind := "info", duration_seconds := 2.5) -> void:
	var toast := {
		"message": message,
		"kind": kind,
		"durationSeconds": duration_seconds,
	}
	queue.append(toast)
	toast_queued.emit(toast.duplicate(true))

func pop_next() -> Dictionary:
	if queue.is_empty():
		return {}
	return queue.pop_front().duplicate(true)

func clear() -> void:
	queue.clear()
