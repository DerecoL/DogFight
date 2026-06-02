extends SceneTree

func _init() -> void:
	var sound_script := load("res://scripts/router/FeedbackSoundBus.gd")
	if sound_script == null:
		push_error("FeedbackSoundBus.gd failed to load")
		quit(1)
		return
	var bus = sound_script.new()
	for method_name in ["cue_for_toast_kind", "play_toast", "set_enabled"]:
		if not bus.has_method(method_name):
			push_error("FeedbackSoundBus is missing %s" % method_name)
			quit(1)
			return
	var success: Dictionary = bus.cue_for_toast_kind("success")
	var error: Dictionary = bus.cue_for_toast_kind("error")
	var reward: Dictionary = bus.cue_for_toast_kind("reward")
	if str(success.get("id", "")) != "ui-success" or str(error.get("id", "")) != "ui-failure" or str(reward.get("id", "")) != "ui-reward":
		push_error("FeedbackSoundBus toast cue mapping does not match the web UI feedback tones")
		quit(1)
		return
	if float(success.get("durationSeconds", 0.0)) <= 0.0 or float(success.get("durationSeconds", 1.0)) > 0.2:
		push_error("FeedbackSoundBus cues must stay short and lightweight")
		quit(1)
		return
	bus.set_enabled(false)
	if bus.play_toast({"kind": "success"}):
		push_error("FeedbackSoundBus must not play when disabled")
		quit(1)
		return
	var session_source := FileAccess.get_file_as_string("res://scripts/state/GameSession.gd")
	if not session_source.contains("FeedbackSoundBus") or not session_source.contains("feedback_sound_bus.play_toast"):
		push_error("GameSession must route toast feedback through FeedbackSoundBus")
		quit(1)
		return
	bus.free()
	quit(0)
