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
