extends SceneTree

func _init() -> void:
	var sound_script := load("res://scripts/router/FeedbackSoundBus.gd")
	if sound_script == null:
		push_error("FeedbackSoundBus.gd failed to load")
		quit(1)
		return
	var bus = sound_script.new()
	if not bus.has_method("cue_for_battle_event") or not bus.has_method("play_battle_event"):
		push_error("FeedbackSoundBus must expose battle event sound cues")
		quit(1)
		return
	var cases := [
		[{"roll": 6, "kind": "ROLL"}, "battle-roll"],
		[{"effectType": "DAMAGE", "targetHpDelta": -6}, "battle-damage"],
		[{"effectType": "HEAL", "sourceHpDelta": 5}, "battle-heal"],
		[{"effectType": "UTILITY", "amount": 4, "statusChanged": ["shield"]}, "battle-shield"],
		[{"effectType": "POISON", "targetHpDelta": -2}, "battle-poison"],
		[{"effectType": "UTILITY", "text": "冻结 1 秒"}, "battle-freeze"],
	]
	for test_case in cases:
		var cue: Dictionary = bus.cue_for_battle_event(test_case[0])
		if str(cue.get("id", "")) != str(test_case[1]):
			push_error("Wrong battle cue: expected %s got %s" % [str(test_case[1]), str(cue.get("id", ""))])
			quit(1)
			return
	bus.set_enabled(false)
	if bus.play_battle_event({"effectType": "DAMAGE"}):
		push_error("FeedbackSoundBus must not play battle cues when disabled")
		quit(1)
		return
	var battle_source := FileAccess.get_file_as_string("res://scripts/ui/BattleReplayScreen.gd")
	if not battle_source.contains("_play_battle_sound(event)") or not battle_source.contains("feedback_sound_bus.play_battle_event"):
		push_error("BattleReplayScreen must route replay events through FeedbackSoundBus")
		quit(1)
		return
	bus.free()
	quit(0)
