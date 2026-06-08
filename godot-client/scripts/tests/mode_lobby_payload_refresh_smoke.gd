extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var source := FileAccess.get_file_as_string("res://scripts/state/GameSession.gd")
	if source.is_empty():
		_fail("GameSession source is missing")
		return
	for needle in [
		"var lobby_history_data: Dictionary",
		"var lobby_ladder_data: Dictionary",
		"func _screen_payload() -> Dictionary:",
		"payload[\"history\"]",
		"payload[\"ladderProfile\"]",
		"payload[\"season\"]",
		"func _refresh_mode_lobby_payload() -> void:",
		"ApiRoutes.runs_history()",
		"ApiRoutes.ladder_me()",
	]:
		if not source.contains(str(needle)):
			_fail("GameSession must refresh Web-style mode lobby payload: %s" % str(needle))
			return
	print("Godot mode lobby payload refresh smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
