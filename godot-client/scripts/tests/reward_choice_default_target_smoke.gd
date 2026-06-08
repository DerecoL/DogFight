extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/ui/RunScreen.gd")
	if source.is_empty():
		_fail("RunScreen source is missing")
		return
	for needle in [
		"var selected_enchant_choice_id := \"\"",
		"var selected_potion_choice_id := \"\"",
		"func _active_enchant_choice_id() -> String:",
		"func _active_potion_choice_id() -> String:",
		"func _select_reward_target_or_item(item: Dictionary, label: String) -> void:",
		"await _select_enchant(_active_enchant_choice_id())",
		"await _select_potion(_active_potion_choice_id())",
	]:
		if not source.contains(str(needle)):
			_fail("RunScreen must support Web-style default reward target clicks: %s" % str(needle))
			return
	print("Godot reward choice default target smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
