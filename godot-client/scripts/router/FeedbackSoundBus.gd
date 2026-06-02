class_name FeedbackSoundBus
extends Node

const SAMPLE_RATE := 22050.0

var enabled := true
var player: AudioStreamPlayer

func set_enabled(next_enabled: bool) -> void:
	enabled = next_enabled

func cue_for_toast_kind(kind: String) -> Dictionary:
	match kind:
		"success":
			return _cue("ui-success", "sine", 500.0, 680.0, 0.09, 0.045)
		"reward":
			return _cue("ui-reward", "sine", 620.0, 880.0, 0.15, 0.055)
		"error", "danger", "failure":
			return _cue("ui-failure", "square", 180.0, 120.0, 0.12, 0.05)
		"battle-start":
			return _cue("ui-battle-start", "triangle", 260.0, 540.0, 0.17, 0.055)
		_:
			return _cue("ui-info", "triangle", 360.0, 520.0, 0.08, 0.04)

func play_toast(toast: Dictionary) -> bool:
	return play_cue(cue_for_toast_kind(str(toast.get("kind", "info"))))

func cue_for_battle_event(event: Dictionary) -> Dictionary:
	var effect_type: String = str(event.get("effectType", event.get("kind", ""))).to_upper()
	var text: String = str(event.get("text", "")).to_lower()
	var statuses: String = str(event.get("statusChanged", "")).to_lower()
	if effect_type == "DAMAGE":
		return _battle_cue("damage")
	if effect_type == "HEAL":
		return _battle_cue("heal")
	if effect_type == "POISON" or text.contains("poison") or text.contains("中毒"):
		return _battle_cue("poison")
	if text.contains("freeze") or text.contains("冻结") or statuses.contains("freeze"):
		return _battle_cue("freeze")
	if text.contains("weak") or text.contains("虚弱") or statuses.contains("weak"):
		return _battle_cue("weak")
	if text.contains("miss") or text.contains("闪避") or text.contains("未命中"):
		return _battle_cue("miss")
	if effect_type == "THORNS" or text.contains("反伤") or text.contains("thorns"):
		return _battle_cue("thorns")
	if effect_type == "UTILITY" and (text.contains("shield") or text.contains("护盾") or statuses.contains("shield")):
		return _battle_cue("shield")
	if event.has("roll"):
		return _battle_cue("roll")
	return _battle_cue("utility")

func play_battle_event(event: Dictionary) -> bool:
	return play_cue(cue_for_battle_event(event))

func play_cue(cue: Dictionary) -> bool:
	if not enabled or cue.is_empty() or DisplayServer.get_name() == "headless":
		return false
	_ensure_player()
	if player == null:
		return false
	if not player.playing:
		player.play()
	var playback: AudioStreamGeneratorPlayback = player.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback == null:
		return false
	var duration := float(cue.get("durationSeconds", 0.1))
	var frames: int = max(1, int(SAMPLE_RATE * duration))
	var start_frequency := float(cue.get("frequencyHz", 360.0))
	var end_frequency := float(cue.get("endFrequencyHz", start_frequency))
	var volume := float(cue.get("volume", 0.04))
	var wave := str(cue.get("wave", "sine"))
	var phase := 0.0
	for index in range(frames):
		var t: float = float(index) / float(frames)
		var frequency: float = lerp(start_frequency, end_frequency, t)
		phase += TAU * frequency / SAMPLE_RATE
		var envelope: float = sin(PI * t)
		var sample: float = _wave_sample(wave, phase) * volume * max(0.0, envelope)
		playback.push_frame(Vector2(sample, sample))
	return true

func _ensure_player() -> void:
	if player != null:
		return
	player = AudioStreamPlayer.new()
	player.name = "FeedbackSoundPlayer"
	var stream := AudioStreamGenerator.new()
	stream.mix_rate = SAMPLE_RATE
	stream.buffer_length = 0.08
	player.stream = stream
	player.volume_db = -8.0
	add_child(player)

func _cue(id: String, wave: String, frequency: float, end_frequency: float, duration: float, volume: float) -> Dictionary:
	return {
		"id": id,
		"wave": wave,
		"frequencyHz": frequency,
		"endFrequencyHz": end_frequency,
		"durationSeconds": duration,
		"volume": volume,
	}

func _battle_cue(kind: String) -> Dictionary:
	match kind:
		"roll":
			return _cue("battle-roll", "triangle", 280.0, 520.0, 0.13, 0.06)
		"damage":
			return _cue("battle-damage", "square", 170.0, 90.0, 0.12, 0.07)
		"heal":
			return _cue("battle-heal", "sine", 520.0, 760.0, 0.18, 0.055)
		"shield":
			return _cue("battle-shield", "triangle", 420.0, 620.0, 0.16, 0.055)
		"poison":
			return _cue("battle-poison", "sawtooth", 190.0, 150.0, 0.17, 0.045)
		"weak":
			return _cue("battle-weak", "sawtooth", 230.0, 140.0, 0.15, 0.045)
		"freeze":
			return _cue("battle-freeze", "sine", 700.0, 460.0, 0.18, 0.05)
		"thorns":
			return _cue("battle-thorns", "square", 360.0, 210.0, 0.11, 0.055)
		"miss":
			return _cue("battle-miss", "triangle", 120.0, 80.0, 0.12, 0.045)
		_:
			return _cue("battle-utility", "triangle", 340.0, 440.0, 0.12, 0.045)

func _wave_sample(wave: String, phase: float) -> float:
	match wave:
		"square":
			return 1.0 if sin(phase) >= 0.0 else -1.0
		"sawtooth":
			return 2.0 * (phase / TAU - floor(phase / TAU + 0.5))
		"triangle":
			return 2.0 * abs(2.0 * (phase / TAU - floor(phase / TAU + 0.5))) - 1.0
		_:
			return sin(phase)
