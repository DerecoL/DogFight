extends Control

signal user_changed(user: Dictionary)
signal run_changed(run: Dictionary)
signal error_raised(message: String)

const ApiClient := preload("res://scripts/api/ApiClient.gd")
const RunStore := preload("res://scripts/state/RunStore.gd")
const DEFAULT_API_BASE_URL := "http://127.0.0.1:4000/api"

var api_base_url: String = DEFAULT_API_BASE_URL
var api: ApiClient
var current_user: Dictionary = {}
var run_store: RunStore = RunStore.new()

func _ready() -> void:
	var override_url := OS.get_environment("DOGFIGHT_API_BASE_URL")
	if override_url.length() > 0:
		api_base_url = override_url.rstrip("/")
	api = ApiClient.new()
	api.configure(api_base_url)
	add_child(api)
	var login_screen := get_node_or_null("ScreenRoot/LoginScreen")
	if login_screen != null and login_screen.has_method("bind_session"):
		login_screen.bind_session(self)
		if login_screen.has_signal("login_succeeded") and not login_screen.login_succeeded.is_connected(_show_run_screen):
			login_screen.login_succeeded.connect(_show_run_screen)
	var run_screen := get_node_or_null("ScreenRoot/RunScreen")
	if run_screen != null and run_screen.has_method("bind_session"):
		run_screen.bind_session(self)

func login(account: String, password: String) -> bool:
	var response := await api.post_json("/auth/login", {"account": account, "password": password})
	if not response.ok:
		error_raised.emit(str(response.error))
		return false
	current_user = response.data.get("user", {})
	user_changed.emit(current_user)
	return await refresh_me()

func refresh_me() -> bool:
	var response := await api.get_json("/me")
	if not response.ok:
		error_raised.emit(str(response.error))
		return false
	current_user = response.data.get("user", current_user)
	user_changed.emit(current_user)
	var active_run := response.data.get("activeRun", null)
	if active_run is Dictionary:
		set_current_run(active_run)
	return true

func create_run(dog_type := "SHIBA", mode := "CASUAL", lucky_number: Variant = null) -> bool:
	var body := {"dogType": dog_type, "mode": mode}
	if lucky_number != null:
		body["luckyNumber"] = int(lucky_number)
	var response := await api.post_json("/runs", body)
	if not response.ok:
		error_raised.emit(str(response.error))
		return false
	var run := response.data.get("run", {})
	if run is Dictionary:
		set_current_run(run)
		return true
	error_raised.emit("创建跑局失败")
	return false

func set_current_run(run: Dictionary) -> void:
	run_store.set_run(run)
	run_changed.emit(run)

func _show_run_screen() -> void:
	var login_screen := get_node_or_null("ScreenRoot/LoginScreen")
	var run_screen := get_node_or_null("ScreenRoot/RunScreen")
	if run_screen == null:
		return
	if login_screen != null:
		login_screen.visible = false
	run_screen.visible = true
