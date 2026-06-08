extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var main_scene = load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame
	var api = main.get("api")
	var loading_layer = main.get_node_or_null("OverlayRoot/LoadingLayer") as Control
	if api == null or not api.has_signal("loading_changed") or loading_layer == null:
		_fail("Main must expose API loading signal and LoadingLayer")
		return
	if loading_layer.visible:
		_fail("LoadingLayer must be hidden before API loading starts")
		return
	api.loading_changed.emit(true)
	await process_frame
	if not loading_layer.visible:
		_fail("LoadingLayer must become visible when API loading starts")
		return
	api.loading_changed.emit(false)
	await process_frame
	if loading_layer.visible:
		_fail("LoadingLayer must hide when API loading ends")
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot loading layer binding smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
