extends SceneTree

func _init() -> void:
	var session_script := load("res://scripts/state/GameSession.gd")
	var api_script := load("res://scripts/api/ApiClient.gd")
	var types_script := load("res://scripts/api/ApiTypes.gd")
	if session_script == null or api_script == null or types_script == null:
		push_error("Core Godot client scripts failed to load")
		quit(1)
		return
	var node := Control.new()
	node.set_script(session_script)
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
	var api = api_script.new()
	api.configure("http://example.test/api/")
	if api.base_url != "http://example.test/api":
		push_error("ApiClient.configure did not normalize base_url")
		quit(1)
		return
	var value = types_script.string_value({"phase": "SHOP"}, "phase", "MAP")
	if value != "SHOP":
		push_error("ApiTypes.string_value returned wrong value")
		quit(1)
		return
	api.free()
	node.free()
	quit(0)
