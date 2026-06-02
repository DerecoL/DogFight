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
var toast_layer: Control
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
		toast_layer = overlay_root.get_node_or_null("ToastLayer")
		if not toast_bus.toast_queued.is_connected(_show_toast):
			toast_bus.toast_queued.connect(_show_toast)
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
	return await _apply_auth_response(response)

func register(account: String, password: String) -> bool:
	var response := await api.post_json(ApiRoutes.register(), {"account": account, "password": password})
	return await _apply_auth_response(response)

func login_taptap(code: String) -> bool:
	var trimmed := code.strip_edges()
	if trimmed.is_empty():
		_raise_error("请输入 TapTap 授权码")
		return false
	var response := await api.post_json(ApiRoutes.taptap_login(), {"code": trimmed})
	return await _apply_auth_response(response)

func update_nickname(nickname: String) -> bool:
	var trimmed := nickname.strip_edges()
	if trimmed.length() < 2 or trimmed.length() > 16:
		_raise_error("昵称需要 2-16 个字符")
		return false
	var response := await api.post_json(ApiRoutes.profile_nickname(), {"nickname": trimmed})
	if not response.ok:
		_raise_error(str(response.error))
		return false
	current_user = response.data.get("user", current_user)
	store.set_user(current_user)
	user_changed.emit(current_user)
	if toast_bus != null:
		toast_bus.push("昵称已保存", "success")
	return true

func logout() -> bool:
	var response := await api.post_json(ApiRoutes.logout(), {})
	if not response.ok:
		_raise_error(str(response.error))
		return false
	current_user = {}
	api.cookie_header = ""
	store.set_user({})
	store.set_current_run({})
	if router != null:
		router.show_screen("login", false)
	run_changed.emit({})
	if toast_bus != null:
		toast_bus.push("已退出登录", "success")
	return true

func _apply_auth_response(response: Dictionary) -> bool:
	if not response.ok:
		_raise_error(str(response.error))
		return false
	current_user = response.data.get("user", {})
	store.set_user(current_user)
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
	return _apply_run_response(response, "创建跑局失败")

func load_run(run_id: String) -> bool:
	var response := await api.get_json(ApiRoutes.run_detail(run_id))
	if not response.ok:
		_raise_error(str(response.error))
		return false
	return _apply_run_response(response, "服务端没有返回跑局")

func select_map_node(node_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_map_select(run_store.run_id()), {"nodeId": node_id})

func resolve_map_event(choice_id := "") -> bool:
	var body := {}
	if not choice_id.is_empty():
		body["choiceId"] = choice_id
	return await _post_run_action(ApiRoutes.run_map_event(run_store.run_id()), body)

func complete_map_node() -> bool:
	return await _post_run_action(ApiRoutes.run_map_complete_node(run_store.run_id()), {})

func claim_monster_reward() -> bool:
	return await _post_run_action(ApiRoutes.run_monster_reward_claim(run_store.run_id()), {})

func skip_monster_reward() -> bool:
	return await _post_run_action(ApiRoutes.run_monster_reward_skip(run_store.run_id()), {})

func move_item(item_id: String, area: String, x: int, y: int) -> bool:
	return await _post_run_action(ApiRoutes.run_item_move(run_store.run_id()), {"itemId": item_id, "area": area, "x": x, "y": y})

func upgrade_item(item_id: String, target_item_id := "") -> bool:
	var body := {"itemId": item_id}
	if not target_item_id.is_empty():
		body["targetItemId"] = target_item_id
	return await _post_run_action(ApiRoutes.run_item_upgrade(run_store.run_id()), body)

func buy_offer(offer_id: String, area := "BAG") -> bool:
	return await _post_run_action(ApiRoutes.run_shop_buy(run_store.run_id()), {"offerId": offer_id, "area": area})

func sell_item(item_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_shop_sell(run_store.run_id()), {"itemId": item_id})

func reroll_shop() -> bool:
	return await _post_run_action(ApiRoutes.run_shop_reroll(run_store.run_id()), {})

func match_battle() -> bool:
	return await _post_run_action(ApiRoutes.run_battle_match(run_store.run_id()), {})

func select_shop_choice(shop_type: String) -> bool:
	return await _post_run_action(ApiRoutes.run_choice_select(run_store.run_id()), {"shopType": shop_type})

func select_upgrade_item(item_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_upgrade_select(run_store.run_id()), {"itemId": item_id})

func skip_upgrade_choice() -> bool:
	return await _post_run_action(ApiRoutes.run_upgrade_skip(run_store.run_id()), {})

func select_potion(potion_id: String, item_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_potion_select(run_store.run_id()), {"potionId": potion_id, "itemId": item_id})

func select_class_reward(def_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_class_reward_select(run_store.run_id()), {"defId": def_id})

func select_enchant(enchant_id: String, item_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_enchant_select(run_store.run_id()), {"enchantId": enchant_id, "itemId": item_id})

func select_relic(relic_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_relic_select(run_store.run_id()), {"relicId": relic_id})

func sell_relic(relic_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_relic_sell(run_store.run_id()), {"relicId": relic_id})

func settle_run() -> bool:
	return await _post_run_action(ApiRoutes.run_settle(run_store.run_id()), {})

func start_battle() -> bool:
	if not run_store.has_run():
		_raise_error("没有当前跑局")
		return false
	var response := await api.post_json(ApiRoutes.run_battle_start(run_store.run_id()), {})
	if not response.ok:
		_raise_error(str(response.error))
		return false
	_apply_run_response(response, "服务端没有返回跑局")
	var battle = response.data.get("battle", {})
	if battle is Dictionary:
		battle_started.emit(battle)
		return true
	_raise_error("服务端没有返回战斗结果")
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
	var ok := _apply_run_response(response, "服务端没有返回跑局")
	if ok:
		var summary: Variant = response.data.get("rewardSummary", {})
		if summary is Dictionary and not summary.is_empty():
			_show_reward_summary(summary)
	return ok

func _apply_run_response(response: Dictionary, fallback_error: String) -> bool:
	var run = response.data.get("run", {})
	if run is Dictionary and str(run.get("id", "")).length() > 0:
		set_current_run(run)
		return true
	_raise_error(fallback_error)
	return false

func set_current_run(run: Dictionary) -> void:
	store.set_current_run(run)
	run_changed.emit(run)

func _raise_error(message: String) -> void:
	store.raise_error(message)
	if toast_bus != null:
		toast_bus.push(message, "error")
	error_raised.emit(message)

func _show_toast(toast: Dictionary) -> void:
	if toast_layer == null:
		return
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(320, 44)
	panel.anchor_left = 1.0
	panel.anchor_right = 1.0
	panel.offset_left = -344.0
	panel.offset_right = -24.0
	panel.offset_top = 24.0 + toast_layer.get_child_count() * 52.0
	panel.offset_bottom = panel.offset_top + 44.0
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.modulate = _toast_color(str(toast.get("kind", "info")))
	var label := Label.new()
	label.text = str(toast.get("message", ""))
	label.custom_minimum_size = Vector2(0, 44)
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	panel.add_child(label)
	toast_layer.add_child(panel)
	var duration := float(toast.get("durationSeconds", 2.5))
	var tween := create_tween()
	tween.tween_interval(max(0.5, duration))
	tween.tween_property(panel, "modulate:a", 0.0, 0.24)
	tween.tween_callback(panel.queue_free)

func _show_reward_summary(summary: Dictionary) -> void:
	if modal_stack == null:
		if toast_bus != null:
			toast_bus.push(str(summary.get("title", "获得奖励")), "success")
		return
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(440, 320)
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.offset_left = -220.0
	panel.offset_right = 220.0
	panel.offset_top = -170.0
	panel.offset_bottom = 170.0
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	panel.add_child(box)
	var eyebrow := Label.new()
	eyebrow.text = "野怪结算" if str(summary.get("source", "")) == "MONSTER_BATTLE" else "事件完成"
	eyebrow.custom_minimum_size = Vector2(0, 26)
	box.add_child(eyebrow)
	var title := Label.new()
	title.text = str(summary.get("title", "获得奖励"))
	title.custom_minimum_size = Vector2(0, 34)
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(title)
	var entries_box := VBoxContainer.new()
	entries_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	entries_box.add_theme_constant_override("separation", 6)
	box.add_child(entries_box)
	var raw_entries: Variant = summary.get("entries", [])
	var entries: Array = raw_entries if raw_entries is Array else []
	if entries.is_empty():
		_add_reward_summary_line(entries_box, "没有获得奖励", "本次没有新的奖励")
	for entry in entries:
		if entry is Dictionary:
			_add_reward_summary_line(entries_box, str(entry.get("label", "奖励")), str(entry.get("detail", "")))
	var close_button := Button.new()
	close_button.text = "知道了"
	close_button.custom_minimum_size = Vector2(0, 42)
	close_button.pressed.connect(_close_top_modal)
	box.add_child(close_button)
	modal_stack.push_modal(panel, true)

func _add_reward_summary_line(parent: VBoxContainer, label: String, detail: String) -> void:
	var row := Label.new()
	row.custom_minimum_size = Vector2(0, 34)
	row.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	row.text = "%s：%s" % [label, detail]
	parent.add_child(row)

func _close_top_modal() -> void:
	if modal_stack != null:
		modal_stack.pop_modal()

func _toast_color(kind: String) -> Color:
	match kind:
		"error":
			return Color(1.0, 0.38, 0.34, 0.96)
		"success":
			return Color(0.42, 0.86, 0.48, 0.96)
		_:
			return Color(0.92, 0.82, 0.48, 0.96)

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
