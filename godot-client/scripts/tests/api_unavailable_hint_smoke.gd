extends SceneTree

const ApiClient := preload("res://scripts/api/ApiClient.gd")

func _init() -> void:
	_run()

func _run() -> void:
	var api := ApiClient.new()
	api.configure("http://127.0.0.1:47999/api")
	api.timeout_seconds = 1.0
	root.add_child(api)
	await process_frame
	var response: Dictionary = await api.get_json("/me")
	if bool(response.get("ok", true)):
		_fail("Unavailable API request must fail")
		return
	var error := str(response.get("error", ""))
	for expected in ["本地服务未启动", "start-godot-dev.ps1"]:
		if not error.contains(expected):
			_fail("Unavailable API error must mention %s, got: %s" % [expected, error])
			return
	api.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot API unavailable hint smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
