extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/BattleReplayScreen.tscn")
	if scene == null:
		_fail("BattleReplayScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame
	if not screen.has_method("_update_speed_buttons"):
		_fail("BattleReplayScreen must update active speed buttons")
		return
	var buttons = screen.get("speed_buttons")
	if not buttons is Dictionary or (buttons as Dictionary).size() != 3:
		_fail("BattleReplayScreen must keep the 1x/2x/4x speed buttons")
		return
	screen.call("_set_speed", 2.0)
	await process_frame
	_assert_speed_state(screen, 2)
	screen.call("_set_speed", 4.0)
	await process_frame
	_assert_speed_state(screen, 4)
	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle speed state smoke passed")
	quit(0)

func _assert_speed_state(screen: Node, expected: int) -> void:
	var buttons: Dictionary = screen.get("speed_buttons")
	for speed in [1, 2, 4]:
		var button = buttons.get(speed, null)
		if not button is Button:
			_fail("Missing speed button %dx" % speed)
			return
		var pressed := (button as Button).button_pressed
		if pressed != (speed == expected):
			_fail("Speed %dx pressed state mismatch: %s" % [speed, str(pressed)])
			return

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
