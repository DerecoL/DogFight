extends Control

signal user_changed(user: Dictionary)
signal run_changed(run: Dictionary)
signal error_raised(message: String)
signal battle_started(battle: Dictionary)

const ApiClient := preload("res://scripts/api/ApiClient.gd")
const ApiRoutes := preload("res://scripts/api/ApiRoutes.gd")
const ScreenRouter := preload("res://scripts/router/ScreenRouter.gd")
const ModalStack := preload("res://scripts/router/ModalStack.gd")
const ToastBus := preload("res://scripts/router/ToastBus.gd")
const AppStore := preload("res://scripts/state/AppStore.gd")
const RunStore := preload("res://scripts/state/RunStore.gd")
const DEFAULT_API_BASE_URL := "http://127.0.0.1:4000/api"

var api_base_url: String = DEFAULT_API_BASE_URL
var api: ApiClient
var router: ScreenRouter
var modal_stack: ModalStack
var toast_bus: ToastBus
var current_user: Dictionary = {}
var store: AppStore = AppStore.new()
var run_store: RunStore = store.run

func _ready() -> void:
	var override_url := OS.get_environment("DOGFIGHT_API_BASE_URL")
	if override_url.length() > 0:
		api_base_url = override_url.rstrip("/")
	api = ApiClient.new()
	api.configure(api_base_url)
	add_child(api)
	var screen_root := get_node_or_null("ScreenRoot")
	if screen_root != null:
		router = ScreenRouter.new()
		add_child(router)
		router.configure(screen_root)
		router.register_screen("login", "LoginScreen")
		router.register_screen("run", "RunScreen")
		router.register_screen("battle", "BattleReplayScreen")
		router.show_screen("login", false)
	var overlay_root := get_node_or_null("OverlayRoot")
	if overlay_root != null:
		modal_stack = ModalStack.new()
		toast_bus = ToastBus.new()
		add_child(modal_stack)
		add_child(toast_bus)
		modal_stack.configure(overlay_root.get_node_or_null("ModalLayer"))
		modal_stack.stack_changed.connect(func(_depth: int, blocking: bool) -> void:
			var blocking_layer := overlay_root.get_node_or_null("BlockingLayer")
			if blocking_layer != null:
				blocking_layer.visible = blocking
		)
	var login_screen := get_node_or_null("ScreenRoot/LoginScreen")
	if login_screen != null and login_screen.has_method("bind_session"):
		login_screen.bind_session(self)
		if login_screen.has_signal("login_succeeded") and not login_screen.login_succeeded.is_connected(_show_run_screen):
			login_screen.login_succeeded.connect(_show_run_screen)
	var run_screen := get_node_or_null("ScreenRoot/RunScreen")
	if run_screen != null and run_screen.has_method("bind_session"):
		run_screen.bind_session(self)
	var battle_screen := get_node_or_null("ScreenRoot/BattleReplayScreen")
	if battle_screen != null and battle_screen.has_method("bind_session"):
		battle_screen.bind_session(self)
	if not battle_started.is_connected(_show_battle_screen):
		battle_started.connect(_show_battle_screen)
	if not run_changed.is_connected(_on_run_changed_for_screen):
		run_changed.connect(_on_run_changed_for_screen)

func login(account: String, password: String) -> bool:
	var response := await api.post_json(ApiRoutes.login(), {"account": account, "password": password})
	if not response.ok:
		_raise_error(str(response.error))
		return false
	current_user = response.data.get("user", {})
	store.set_user(current_user)
	user_changed.emit(current_user)
	return await refresh_me()

func refresh_me() -> bool:
	var response := await api.get_json(ApiRoutes.me())
	if not response.ok:
		_raise_error(str(response.error))
		return false
	current_user = response.data.get("user", current_user)
	store.set_user(current_user)
	user_changed.emit(current_user)
	var active_run = response.data.get("activeRun", null)
	if active_run is Dictionary:
		set_current_run(active_run)
	return true

func create_run(dog_type := "SHIBA", mode := "CASUAL", lucky_number: Variant = null) -> bool:
	var body := {"dogType": dog_type, "mode": mode}
	if lucky_number != null:
		body["luckyNumber"] = int(lucky_number)
	var response := await api.post_json(ApiRoutes.runs(), body)
	if not response.ok:
		_raise_error(str(response.error))
		return false
	var run = response.data.get("run", {})
	if run is Dictionary and str(run.get("id", "")).length() > 0:
		set_current_run(run)
		return true
	_raise_error("创建跑局失败")
	return false

func select_map_node(node_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_map_select(run_store.run_id()), {"nodeId": node_id})

func move_item(item_id: String, area: String, x: int, y: int) -> bool:
	return await _post_run_action(ApiRoutes.run_item_move(run_store.run_id()), {"itemId": item_id, "area": area, "x": x, "y": y})

func buy_offer(offer_id: String, area := "BAG") -> bool:
	return await _post_run_action(ApiRoutes.run_shop_buy(run_store.run_id()), {"offerId": offer_id, "area": area})

func sell_item(item_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_shop_sell(run_store.run_id()), {"itemId": item_id})

func reroll_shop() -> bool:
	return await _post_run_action(ApiRoutes.run_shop_reroll(run_store.run_id()), {})

func match_battle() -> bool:
	return await _post_run_action(ApiRoutes.run_battle_match(run_store.run_id()), {})

func start_battle() -> bool:
	if not run_store.has_run():
		_raise_error("没有当前跑局")
		return false
	var response := await api.post_json(ApiRoutes.run_battle_start(run_store.run_id()), {})
	if not response.ok:
		_raise_error(str(response.error))
		return false
	var run = response.data.get("run", {})
	if run is Dictionary and str(run.get("id", "")).length() > 0:
		set_current_run(run)
	var battle = response.data.get("battle", {})
	if battle is Dictionary:
		battle_started.emit(battle)
		return true
	_raise_error("服务器没有返回战斗结果")
	return false

func finish_battle() -> bool:
	return await _post_run_action(ApiRoutes.run_battle_finish(run_store.run_id()), {})

func _post_run_action(path: String, body: Dictionary) -> bool:
	if not run_store.has_run():
		_raise_error("没有当前跑局")
		return false
	var response := await api.post_json(path, body)
	if not response.ok:
		_raise_error(str(response.error))
		return false
	var run = response.data.get("run", {})
	if run is Dictionary and str(run.get("id", "")).length() > 0:
		set_current_run(run)
		return true
	_raise_error("服务器没有返回跑局")
	return false

func set_current_run(run: Dictionary) -> void:
	store.set_current_run(run)
	run_changed.emit(run)

func _raise_error(message: String) -> void:
	store.raise_error(message)
	if toast_bus != null:
		toast_bus.push(message, "error")
	error_raised.emit(message)

func _show_run_screen() -> void:
	if router != null:
		router.show_screen("run", false)
	var run_screen := get_node_or_null("ScreenRoot/RunScreen")
	if run_screen != null and run_screen.has_method("clear_error"):
		run_screen.call("clear_error")

func _show_battle_screen(battle: Dictionary) -> void:
	if router != null:
		router.show_screen("battle")
	var battle_screen := get_node_or_null("ScreenRoot/BattleReplayScreen")
	if battle_screen != null and battle_screen.has_method("start_replay"):
		battle_screen.start_replay(battle)

func _on_run_changed_for_screen(_run: Dictionary) -> void:
	if run_store.phase() != "BATTLE":
		_show_run_screen()
