extends SceneTree

func _init() -> void:
	var script := load("res://scripts/state/GameSession.gd")
	if script == null:
		push_error("GameSession.gd failed to load")
		quit(1)
		return
	var node := Control.new()
	node.set_script(script)
	if node.api_base_url != "http://127.0.0.1:4000/api":
		push_error("Unexpected default api_base_url")
		quit(1)
		return
	OS.set_environment("DOGFIGHT_API_BASE_URL", "http://127.0.0.1:4000/api/")
	node._ready()
	if node.api_base_url != "http://127.0.0.1:4000/api":
		push_error("Unexpected normalized api_base_url after _ready")
		quit(1)
		return
	quit(0)
