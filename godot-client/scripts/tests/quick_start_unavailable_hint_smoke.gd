extends SceneTree

const UNAVAILABLE_API_BASE_URL := "http://127.0.0.1:47999/api"
const MAX_LOCAL_API_TIMEOUT_SECONDS := 3.5

var main_node: Node
var api_finished := false

func _init() -> void:
	_run()

func _run() -> void:
	OS.set_environment("DOGFIGHT_API_BASE_URL", UNAVAILABLE_API_BASE_URL)
	var main_scene = load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	main_node = main
	root.add_child(main)
	await process_frame
	await process_frame

	var api = main.get("api")
	if api == null:
		_fail("Main scene must expose ApiClient")
		return
	if float(api.get("timeout_seconds")) > MAX_LOCAL_API_TIMEOUT_SECONDS:
		_fail("Local API timeout is too long for login recovery: %.2f" % float(api.get("timeout_seconds")))
		return
	if api.has_signal("request_finished"):
		api.request_finished.connect(func(_path: String, _ok: bool, _status: int, _payload: Dictionary) -> void:
			api_finished = true
		)

	var router = main.get("router")
	var login_screen = main.get_node_or_null("ScreenRoot/LoginScreen")
	if router == null or login_screen == null or not login_screen.has_method("_on_quick_start_pressed"):
		_fail("Quick start requires router and LoginScreen")
		return
	login_screen.call("_on_quick_start_pressed")

	for _frame in range(360):
		if api_finished and not bool(login_screen.get("auth_in_progress")):
			break
		await process_frame
	if not api_finished:
		_fail("Unavailable quick start request did not finish before the local API timeout")
		return
	if bool(login_screen.get("auth_in_progress")):
		_fail("Unavailable quick start must release the login busy state")
		return
	if str(router.get("current_screen_id")) != "login":
		_fail("Unavailable quick start must stay on LoginScreen")
		return
	var error_label = login_screen.get_node_or_null("%ErrorLabel")
	var error_text: String = error_label.text if error_label != null else ""
	for expected in ["start-godot-dev.ps1", "快速开始"]:
		if not error_text.contains(expected):
			_fail("Unavailable quick start error must mention %s, got: %s" % [expected, error_text])
			return
	var quick_start_button = login_screen.get_node_or_null("%QuickStartButton") as Button
	if quick_start_button == null or quick_start_button.disabled:
		_fail("Unavailable quick start must re-enable QuickStartButton")
		return

	print("Godot quick start unavailable hint smoke passed")
	_cleanup()
	for _frame in range(5):
		await process_frame
	quit(0)

func _cleanup() -> void:
	if main_node != null and is_instance_valid(main_node):
		main_node.queue_free()
	main_node = null

func _fail(message: String) -> void:
	push_error(message)
	_cleanup()
	quit(1)
