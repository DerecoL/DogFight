extends SceneTree

func _init() -> void:
	var overlay_scene := load("res://scenes/overlays/OverlayRoot.tscn")
	if overlay_scene == null:
		_fail("OverlayRoot scene must load")
		return
	var overlay = overlay_scene.instantiate()
	root.add_child(overlay)
	await process_frame
	if not overlay is CanvasLayer:
		_fail("OverlayRoot must be CanvasLayer")
		return
	var overlay_canvas := overlay as CanvasLayer
	if overlay_canvas.layer != 20:
		_fail("OverlayRoot CanvasLayer layer must be 20")
		return

	var expected_order := [
		"BlockingLayer",
		"DragLayer",
		"BattleFxLayer",
		"TipLayer",
		"ToastLayer",
		"ModalLayer",
		"ConfirmLayer",
		"LoadingLayer",
	]
	var previous_index := -1
	for layer_name in expected_order:
		var layer := overlay.get_node_or_null(layer_name)
		if layer == null:
			_fail("OverlayRoot missing layer: %s" % layer_name)
			return
		if not layer is Control:
			_fail("Overlay layer must be Control: %s" % layer_name)
			return
		var control_layer := layer as Control
		if not _is_fullscreen_control(control_layer):
			_fail("Overlay layer must keep stable fullscreen anchors/grow: %s" % layer_name)
			return
		var index := control_layer.get_index()
		if index <= previous_index:
			_fail("Overlay layer order is wrong at %s" % layer_name)
			return
		previous_index = index

	var blocking := overlay.get_node_or_null("BlockingLayer") as Control
	var drag := overlay.get_node_or_null("DragLayer") as Control
	var fx := overlay.get_node_or_null("BattleFxLayer") as Control
	var tips := overlay.get_node_or_null("TipLayer") as Control
	var loading := overlay.get_node_or_null("LoadingLayer") as Control
	if blocking.visible:
		_fail("BlockingLayer must be hidden by default")
		return
	if loading.visible:
		_fail("LoadingLayer must be hidden by default")
		return
	if blocking.mouse_filter != Control.MOUSE_FILTER_STOP:
		_fail("BlockingLayer must stop input when visible")
		return
	if drag.mouse_filter != Control.MOUSE_FILTER_IGNORE:
		_fail("DragLayer must ignore input by default")
		return
	if fx.mouse_filter != Control.MOUSE_FILTER_IGNORE:
		_fail("BattleFxLayer must ignore input by default")
		return
	if tips.mouse_filter != Control.MOUSE_FILTER_IGNORE:
		_fail("TipLayer must ignore input by default")
		return
	if loading.mouse_filter != Control.MOUSE_FILTER_STOP:
		_fail("LoadingLayer must stop input when visible")
		return

	overlay.queue_free()
	for _frame in range(2):
		await process_frame
	print("Web UI overlay layers smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)

func _is_fullscreen_control(layer: Control) -> bool:
	return layer.anchor_left == 0.0 \
		and layer.anchor_top == 0.0 \
		and layer.anchor_right == 1.0 \
		and layer.anchor_bottom == 1.0 \
		and layer.grow_horizontal == Control.GROW_DIRECTION_BOTH \
		and layer.grow_vertical == Control.GROW_DIRECTION_BOTH
