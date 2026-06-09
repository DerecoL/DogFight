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
const FeedbackSoundBus := preload("res://scripts/router/FeedbackSoundBus.gd")
const WebUiScreenIds := preload("res://scripts/ui/web/WebUiScreenIds.gd")
const AppStore := preload("res://scripts/state/AppStore.gd")
const RunStore := preload("res://scripts/state/RunStore.gd")
const DEFAULT_API_BASE_URL := "http://127.0.0.1:4000/api"

var api_base_url: String = DEFAULT_API_BASE_URL
var api: ApiClient
var router: ScreenRouter
var modal_stack: ModalStack
var toast_bus: ToastBus
var feedback_sound_bus: FeedbackSoundBus
var toast_layer: Control
var loading_layer: Control
var current_user: Dictionary = {}
var needs_nickname_setup := false
var store: AppStore = AppStore.new()
var run_store: RunStore = store.run
var lobby_history_data: Dictionary = {}
var lobby_ladder_data: Dictionary = {}
var lobby_leaderboard_data: Dictionary = {}
var lobby_apex_data: Dictionary = {}
var lobby_dogfight_rooms_data: Dictionary = {}
var lobby_dogfight_active_room_data: Dictionary = {}

func _ready() -> void:
	var override_url := OS.get_environment("DOGFIGHT_API_BASE_URL")
	if override_url.length() > 0:
		api_base_url = override_url.rstrip("/")
	api = ApiClient.new()
	api.configure(api_base_url)
	add_child(api)
	feedback_sound_bus = FeedbackSoundBus.new()
	add_child(feedback_sound_bus)
	var screen_root := get_node_or_null("ScreenRoot")
	if screen_root != null:
		router = ScreenRouter.new()
		add_child(router)
		router.configure(screen_root)
		for screen_id in WebUiScreenIds.screen_ids():
			router.register_screen(screen_id, WebUiScreenIds.node_name_for(screen_id))
		router.register_screen(WebUiScreenIds.PLAYABLE_RUN, "LegacyRunScreen")
		router.show_screen(WebUiScreenIds.LOGIN, false)
	var overlay_root := get_node_or_null("OverlayRoot")
	if overlay_root != null:
		modal_stack = ModalStack.new()
		toast_bus = ToastBus.new()
		add_child(modal_stack)
		add_child(toast_bus)
		modal_stack.configure(overlay_root.get_node_or_null("ModalLayer"))
		toast_layer = overlay_root.get_node_or_null("ToastLayer")
		loading_layer = overlay_root.get_node_or_null("LoadingLayer")
		if not toast_bus.toast_queued.is_connected(_show_toast):
			toast_bus.toast_queued.connect(_show_toast)
		if loading_layer != null and not api.loading_changed.is_connected(_set_loading_visible):
			api.loading_changed.connect(_set_loading_visible)
		modal_stack.stack_changed.connect(func(_depth: int, blocking: bool) -> void:
			var blocking_layer := overlay_root.get_node_or_null("BlockingLayer")
			if blocking_layer != null:
				blocking_layer.visible = blocking
		)
	var login_screen := get_node_or_null("ScreenRoot/LoginScreen")
	for screen_id in WebUiScreenIds.screen_ids():
		_bind_screen_by_name(WebUiScreenIds.node_name_for(screen_id))
	if login_screen != null and login_screen.has_signal("login_succeeded") and not login_screen.login_succeeded.is_connected(_show_run_screen):
		login_screen.login_succeeded.connect(_show_run_screen)
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
	_update_needs_nickname(response.data)
	store.set_user(current_user)
	user_changed.emit(current_user)
	if toast_bus != null:
		toast_bus.push("昵称已保存", "success")
	if not needs_nickname_setup:
		_show_run_screen()
	return true

func logout() -> bool:
	var response := await api.post_json(ApiRoutes.logout(), {})
	if not response.ok:
		_raise_error(str(response.error))
		return false
	current_user = {}
	needs_nickname_setup = false
	lobby_history_data = {}
	lobby_ladder_data = {}
	lobby_leaderboard_data = {}
	lobby_apex_data = {}
	lobby_dogfight_rooms_data = {}
	lobby_dogfight_active_room_data = {}
	api.cookie_header = ""
	store.set_user({})
	store.set_current_run({})
	if router != null:
		router.show_screen(WebUiScreenIds.LOGIN, false)
	run_changed.emit({})
	if toast_bus != null:
		toast_bus.push("已退出登录", "success")
	return true

func _apply_auth_response(response: Dictionary) -> bool:
	if not response.ok:
		_raise_error(str(response.error))
		return false
	current_user = response.data.get("user", {})
	_update_needs_nickname(response.data)
	store.set_user(current_user)
	return await refresh_me()

func refresh_me() -> bool:
	var response := await api.get_json(ApiRoutes.me())
	if not response.ok:
		_raise_error(str(response.error))
		return false
	current_user = response.data.get("user", current_user)
	_update_needs_nickname(response.data)
	store.set_user(current_user)
	user_changed.emit(current_user)
	var active_run = response.data.get("activeRun", null)
	if active_run is Dictionary:
		set_current_run(active_run)
	return true

func _update_needs_nickname(payload: Dictionary) -> void:
	if payload.has("needsNickname"):
		needs_nickname_setup = bool(payload.get("needsNickname", false))
		return
	var user = payload.get("user", current_user)
	if user is Dictionary and not (user as Dictionary).is_empty():
		var nickname = (user as Dictionary).get("nickname", null)
		needs_nickname_setup = nickname == null or str(nickname).strip_edges().is_empty()

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
	return await _post_run_action(ApiRoutes.run_map_select(run_store.run_id()), {"nodeId": node_id}, "select_map_node")

func resolve_map_event(choice_id := "") -> bool:
	var body := {}
	if not choice_id.is_empty():
		body["choiceId"] = choice_id
	return await _post_run_action(ApiRoutes.run_map_event(run_store.run_id()), body, "resolve_map_event")

func complete_map_node() -> bool:
	return await _post_run_action(ApiRoutes.run_map_complete_node(run_store.run_id()), {}, "complete_map_node")

func claim_monster_reward() -> bool:
	return await _post_run_action(ApiRoutes.run_monster_reward_claim(run_store.run_id()), {}, "claim_monster_reward")

func skip_monster_reward() -> bool:
	return await _post_run_action(ApiRoutes.run_monster_reward_skip(run_store.run_id()), {}, "skip_monster_reward")

func move_item(item_id: String, area: String, x: int, y: int) -> bool:
	return await _post_run_action(ApiRoutes.run_item_move(run_store.run_id()), {"itemId": item_id, "area": area, "x": x, "y": y}, "move_item")

func upgrade_item(item_id: String, target_item_id := "") -> bool:
	var body := {"itemId": item_id}
	if not target_item_id.is_empty():
		body["targetItemId"] = target_item_id
	return await _post_run_action(ApiRoutes.run_item_upgrade(run_store.run_id()), body, "upgrade_item")

func buy_offer(offer_id: String, area := "BAG") -> bool:
	return await _post_run_action(ApiRoutes.run_shop_buy(run_store.run_id()), {"offerId": offer_id, "area": area}, "buy_offer")

func sell_item(item_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_shop_sell(run_store.run_id()), {"itemId": item_id}, "sell_item")

func reroll_shop() -> bool:
	return await _post_run_action(ApiRoutes.run_shop_reroll(run_store.run_id()), {}, "reroll_shop")

func match_battle() -> bool:
	return await _post_run_action(ApiRoutes.run_battle_match(run_store.run_id()), {}, "match_battle")

func select_shop_choice(shop_type: String) -> bool:
	return await _post_run_action(ApiRoutes.run_choice_select(run_store.run_id()), {"shopType": shop_type}, "select_shop_choice")

func select_upgrade_item(item_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_upgrade_select(run_store.run_id()), {"itemId": item_id}, "select_upgrade_item")

func skip_upgrade_choice() -> bool:
	return await _post_run_action(ApiRoutes.run_upgrade_skip(run_store.run_id()), {}, "skip_upgrade_choice")

func select_potion(potion_id: String, item_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_potion_select(run_store.run_id()), {"potionId": potion_id, "itemId": item_id}, "select_potion")

func select_class_reward(def_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_class_reward_select(run_store.run_id()), {"defId": def_id}, "select_class_reward")

func select_enchant(enchant_id: String, item_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_enchant_select(run_store.run_id()), {"enchantId": enchant_id, "itemId": item_id}, "select_enchant")

func select_relic(relic_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_relic_select(run_store.run_id()), {"relicId": relic_id}, "select_relic")

func sell_relic(relic_id: String) -> bool:
	return await _post_run_action(ApiRoutes.run_relic_sell(run_store.run_id()), {"relicId": relic_id}, "sell_relic")

func settle_run() -> bool:
	return await _post_run_action(ApiRoutes.run_settle(run_store.run_id()), {}, "settle_run")

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
	return await _post_run_action(ApiRoutes.run_battle_finish(run_store.run_id()), {}, "finish_battle")

func finish_dogfight_room_battle(room_id: String, _battle_id := "", mark_ready := true) -> bool:
	if room_id.is_empty():
		_raise_error("房间战报缺少房间 ID")
		return false
	if not mark_ready:
		_show_playable_section(WebUiScreenIds.DOGFIGHT_ROOMS)
		return true
	var response := await api.post_json(ApiRoutes.dogfight_room_ready(room_id), {})
	if not response.ok:
		_raise_error(str(response.error))
		return false
	var run_screen := get_node_or_null("ScreenRoot/LegacyRunScreen")
	if run_screen != null and run_screen.has_method("_apply_room_response"):
		await run_screen.call("_apply_room_response", response, "ready_room")
	_show_playable_section(WebUiScreenIds.DOGFIGHT_ROOMS)
	return true

func _post_run_action(path: String, body: Dictionary, success_action := "") -> bool:
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
		_push_run_action_success(success_action)
	return ok

func _run_action_success_message(action: String) -> String:
	match action:
		"select_map_node":
			return "路线已选择"
		"resolve_map_event":
			return "事件已处理"
		"complete_map_node":
			return "节点已完成"
		"claim_monster_reward":
			return "奖励已领取"
		"skip_monster_reward":
			return "奖励已跳过"
		"move_item":
			return "装备已放置"
		"upgrade_item":
			return "装备已升级"
		"buy_offer":
			return "购买成功"
		"sell_item":
			return "出售成功"
		"reroll_shop":
			return "商店已刷新"
		"match_battle":
			return "对手已匹配"
		"select_shop_choice":
			return "商店已开启"
		"select_upgrade_item":
			return "升级已确认"
		"skip_upgrade_choice":
			return "升级已跳过"
		"select_potion":
			return "药水已应用"
		"select_class_reward":
			return "职业奖励已领取"
		"select_enchant":
			return "附魔已应用"
		"select_relic":
			return "遗物已领取"
		"sell_relic":
			return "遗物已出售"
		"settle_run":
			return "跑局已结算"
		"finish_battle":
			return "战斗已完成"
		_:
			return ""

func _push_run_action_success(action: String) -> void:
	if toast_bus == null:
		return
	var message := _run_action_success_message(action)
	if message.strip_edges().is_empty():
		return
	toast_bus.push(message, "success")

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
	_show_run_screen()

func sync_current_run_without_routing(run: Dictionary) -> void:
	store.set_current_run(run)

func open_screen(screen_id: String) -> bool:
	if screen_id == WebUiScreenIds.MODE_LOBBY:
		_show_mode_lobby_screen()
		return true
	if screen_id == WebUiScreenIds.LEADERBOARDS:
		_show_leaderboards_screen()
		return true
	if screen_id == WebUiScreenIds.APEX:
		_show_apex_screen()
		return true
	if screen_id == WebUiScreenIds.DOGFIGHT_ROOMS:
		_show_dogfight_rooms_screen()
		return true
	if screen_id == WebUiScreenIds.DOGFIGHT_ROOM_DETAIL:
		_show_dogfight_room_detail_screen()
		return true
	if screen_id == WebUiScreenIds.SEASON:
		_show_season_screen()
		return true
	if screen_id == WebUiScreenIds.ACCOUNT:
		_show_account_history_screen()
		return true
	if screen_id == WebUiScreenIds.PLAYABLE_RUN or _screen_uses_playable_run_shell(screen_id):
		_show_playable_run_screen()
		return true
	if _screen_uses_playable_shell(screen_id):
		_show_playable_section(screen_id)
		return true
	if WebUiScreenIds.screen_ids().has(screen_id):
		router.show_screen(screen_id, false)
		_apply_payload_to_screen(screen_id)
		if screen_id == WebUiScreenIds.MODE_LOBBY:
			call_deferred("_refresh_mode_lobby_payload")
		return true
	return false

func open_run_lobby(preferred_mode := "CASUAL") -> bool:
	_show_dog_select_screen(preferred_mode)
	return true

func replay_tutorial() -> bool:
	var run_screen := _show_playable_lobby_screen("CASUAL")
	if run_screen != null and run_screen.has_method("replay_tutorial"):
		run_screen.call("replay_tutorial")
		return true
	return false

func _screen_uses_playable_run_shell(screen_id: String) -> bool:
	return [
	].has(screen_id)

func _screen_uses_playable_shell(screen_id: String) -> bool:
	return [
	].has(screen_id)

func _bind_screen_by_name(node_name: String) -> void:
	var screen := get_node_or_null("ScreenRoot/%s" % node_name)
	if screen != null and screen.has_method("bind_session"):
		screen.bind_session(self)

func _raise_error(message: String) -> void:
	store.raise_error(message)
	if toast_bus != null:
		toast_bus.push(message, "error")
	error_raised.emit(message)

func _show_toast(toast: Dictionary) -> void:
	if feedback_sound_bus != null:
		feedback_sound_bus.play_toast(toast)
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

func _set_loading_visible(active: bool) -> void:
	if loading_layer != null:
		loading_layer.visible = active

func _show_reward_summary(summary: Dictionary) -> void:
	if modal_stack == null:
		if toast_bus != null:
			toast_bus.push(str(summary.get("title", "获得奖励")), "success")
		return
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(520, 390)
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.offset_left = -260.0
	panel.offset_right = 260.0
	panel.offset_top = -205.0
	panel.offset_bottom = 205.0
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	panel.add_child(box)
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 10)
	box.add_child(header)
	var emblem := TextureRect.new()
	emblem.custom_minimum_size = Vector2(54, 54)
	emblem.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	emblem.texture = _reward_summary_header_texture(str(summary.get("source", "")))
	header.add_child(emblem)
	var title_box := VBoxContainer.new()
	title_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title_box)
	var eyebrow := Label.new()
	eyebrow.text = "野怪结算" if str(summary.get("source", "")) == "MONSTER_BATTLE" else "事件完成"
	eyebrow.custom_minimum_size = Vector2(0, 26)
	title_box.add_child(eyebrow)
	var title := Label.new()
	title.text = str(summary.get("title", "获得奖励"))
	title.custom_minimum_size = Vector2(0, 34)
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title_box.add_child(title)
	var scroller := ScrollContainer.new()
	scroller.custom_minimum_size = Vector2(0, 210)
	scroller.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(scroller)
	var entries_box := VBoxContainer.new()
	entries_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	entries_box.add_theme_constant_override("separation", 6)
	scroller.add_child(entries_box)
	var raw_entries: Variant = summary.get("entries", [])
	var entries: Array = raw_entries if raw_entries is Array else []
	if entries.is_empty():
		_add_reward_summary_entry(entries_box, {"kind": "status", "label": "没有获得奖励", "detail": "本次没有新的奖励"})
	for entry in entries:
		if entry is Dictionary:
			_add_reward_summary_entry(entries_box, entry)
	var close_button := Button.new()
	close_button.text = "知道了"
	close_button.custom_minimum_size = Vector2(0, 42)
	close_button.pressed.connect(_close_top_modal)
	box.add_child(close_button)
	modal_stack.push_modal(panel, true)

func _add_reward_summary_entry(parent: VBoxContainer, entry: Dictionary) -> void:
	var row := HBoxContainer.new()
	row.custom_minimum_size = Vector2(0, 62)
	row.add_theme_constant_override("separation", 10)
	var icon := TextureRect.new()
	icon.custom_minimum_size = Vector2(48, 48)
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.texture = _reward_summary_entry_texture(entry)
	row.add_child(icon)
	var text_box := VBoxContainer.new()
	text_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(text_box)
	var label := Label.new()
	label.text = str(entry.get("label", "奖励"))
	label.custom_minimum_size = Vector2(0, 24)
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	text_box.add_child(label)
	var detail := Label.new()
	detail.text = str(entry.get("detail", ""))
	detail.custom_minimum_size = Vector2(0, 28)
	detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	text_box.add_child(detail)
	parent.add_child(row)

func _reward_summary_header_texture(source: String) -> Texture2D:
	if source == "MONSTER_BATTLE":
		return _texture("res://assets/map-icons/monster-battle.webp")
	return _texture("res://assets/map-icons/event.webp")

func _reward_summary_entry_texture(entry: Dictionary) -> Texture2D:
	var def_id := str(entry.get("defId", ""))
	if not def_id.is_empty():
		return _sticker_texture(def_id)
	match str(entry.get("kind", "")):
		"gold":
			return _texture("res://assets/sticker-icons/dog-gold-ingot.webp")
		"tolerance":
			return _texture("res://assets/map-icons/rest.webp")
		"choice", "upgrade":
			return _texture("res://assets/map-icons/shop-equipment.webp")
		_:
			return _texture("res://assets/map-icons/event.webp")

func _sticker_texture(asset_id: String) -> Texture2D:
	if asset_id.is_empty():
		return _texture("res://assets/sticker-icons/starter-1.webp")
	var texture := _texture("res://assets/sticker-icons/%s.webp" % asset_id)
	return texture if texture != null else _texture("res://assets/sticker-icons/starter-1.webp")

func _texture(path: String) -> Texture2D:
	var imported := ResourceLoader.load(path)
	if imported is Texture2D:
		return imported
	if not FileAccess.file_exists(path):
		return null
	var image := Image.new()
	if image.load(path) != OK:
		return null
	return ImageTexture.create_from_image(image)

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
	if router == null:
		return
	var target_screen := WebUiScreenIds.MODE_LOBBY
	if needs_nickname_setup:
		target_screen = WebUiScreenIds.NICKNAME_SETUP
	elif run_store != null and run_store.has_run():
		target_screen = WebUiScreenIds.screen_for_run_phase(run_store.phase())
	if target_screen == WebUiScreenIds.MODE_LOBBY:
		_show_mode_lobby_screen()
		return
	if target_screen == WebUiScreenIds.PLAYABLE_RUN:
		_show_playable_run_screen()
		return
	if target_screen == WebUiScreenIds.BATTLE_REPLAY:
		var last_battle := run_store.last_battle()
		if last_battle.is_empty():
			_show_playable_run_screen()
		else:
			_show_battle_screen(last_battle)
		return
	router.show_screen(target_screen, false)
	_apply_payload_to_screen(target_screen)

func _apply_payload_to_screen(screen_id: String) -> void:
	var target_node_name := WebUiScreenIds.node_name_for(screen_id)
	var target_node := get_node_or_null("ScreenRoot/%s" % target_node_name)
	if target_node != null and target_node.has_method("set_payload"):
		target_node.call("set_payload", _screen_payload())

func _screen_payload() -> Dictionary:
	var run_payload := run_store.run.duplicate(true) if run_store != null and run_store.has_run() else {}
	var payload := {"run": run_payload, "user": current_user.duplicate(true)}
	var history = lobby_history_data.get("history", {})
	payload["history"] = history.duplicate(true) if history is Dictionary else {}
	var season_summaries = lobby_history_data.get("seasonSummaries", [])
	payload["seasonSummaries"] = season_summaries.duplicate(true) if season_summaries is Array else []
	var ladder_profile = lobby_ladder_data.get("profile", {})
	payload["ladderProfile"] = ladder_profile.duplicate(true) if ladder_profile is Dictionary else {}
	var season = lobby_ladder_data.get("season", {})
	payload["season"] = season.duplicate(true) if season is Dictionary else {}
	payload["ladderData"] = lobby_ladder_data.duplicate(true)
	payload["leaderboardData"] = lobby_leaderboard_data.duplicate(true)
	payload["apexData"] = lobby_apex_data.duplicate(true)
	payload["dogfightRoomsData"] = lobby_dogfight_rooms_data.duplicate(true)
	payload["dogfightRoomData"] = lobby_dogfight_active_room_data.duplicate(true)
	return payload

func _refresh_mode_lobby_payload() -> void:
	if api == null or current_user.is_empty() or router == null or str(router.get("current_screen_id")) != WebUiScreenIds.MODE_LOBBY:
		return
	var history_response := await api.get_json(ApiRoutes.runs_history())
	if bool(history_response.get("ok", false)):
		lobby_history_data = _response_data(history_response)
	var ladder_response := await api.get_json(ApiRoutes.ladder_me())
	if bool(ladder_response.get("ok", false)):
		lobby_ladder_data = _response_data(ladder_response)
	if router != null and str(router.get("current_screen_id")) == WebUiScreenIds.MODE_LOBBY:
		_apply_payload_to_screen(WebUiScreenIds.MODE_LOBBY)

func _show_mode_lobby_screen() -> void:
	if router == null:
		return
	router.show_screen(WebUiScreenIds.MODE_LOBBY, false)
	_apply_payload_to_screen(WebUiScreenIds.MODE_LOBBY)
	call_deferred("_refresh_mode_lobby_payload")

func _show_dog_select_screen(preferred_mode := "CASUAL") -> Node:
	if router == null:
		return null
	router.show_screen(WebUiScreenIds.DOG_SELECT, false)
	var payload := _screen_payload()
	payload["mode"] = preferred_mode
	var dog_select := get_node_or_null("ScreenRoot/%s" % WebUiScreenIds.node_name_for(WebUiScreenIds.DOG_SELECT))
	if dog_select != null and dog_select.has_method("set_payload"):
		dog_select.call("set_payload", payload)
	return dog_select

func _show_leaderboards_screen() -> void:
	if router == null:
		return
	router.show_screen(WebUiScreenIds.LEADERBOARDS, false)
	_apply_payload_to_screen(WebUiScreenIds.LEADERBOARDS)
	call_deferred("_refresh_leaderboards_payload")

func _show_apex_screen() -> void:
	if router == null:
		return
	router.show_screen(WebUiScreenIds.APEX, false)
	_apply_payload_to_screen(WebUiScreenIds.APEX)
	call_deferred("refresh_apex_payload")

func refresh_apex_payload() -> void:
	if api == null or current_user.is_empty() or router == null or str(router.get("current_screen_id")) != WebUiScreenIds.APEX:
		return
	var apex_response := await api.get_json(ApiRoutes.apex())
	if bool(apex_response.get("ok", false)):
		lobby_apex_data = _response_data(apex_response)
	if router != null and str(router.get("current_screen_id")) == WebUiScreenIds.APEX:
		_apply_payload_to_screen(WebUiScreenIds.APEX)

func submit_apex_candidate(run_id: String) -> bool:
	if api == null or run_id.strip_edges().is_empty():
		return false
	var response := await api.post_json(ApiRoutes.apex_submit(), {"runId": run_id})
	if not bool(response.get("ok", false)):
		_raise_error(str(response.get("error", "巅峰提交失败")))
		return false
	lobby_apex_data = _response_data(response)
	if router != null and str(router.get("current_screen_id")) == WebUiScreenIds.APEX:
		_apply_payload_to_screen(WebUiScreenIds.APEX)
	if toast_bus != null:
		toast_bus.push("巅峰记录已提交", "success")
	return true

func _refresh_leaderboards_payload() -> void:
	if api == null or current_user.is_empty() or router == null or str(router.get("current_screen_id")) != WebUiScreenIds.LEADERBOARDS:
		return
	var ladder_response := await api.get_json(ApiRoutes.ladder_me())
	if bool(ladder_response.get("ok", false)):
		lobby_ladder_data = _response_data(ladder_response)
	var leaderboard_response := await api.get_json(ApiRoutes.ladder_leaderboard())
	if bool(leaderboard_response.get("ok", false)):
		lobby_leaderboard_data = _response_data(leaderboard_response)
	if router != null and str(router.get("current_screen_id")) == WebUiScreenIds.LEADERBOARDS:
		_apply_payload_to_screen(WebUiScreenIds.LEADERBOARDS)

func _show_dogfight_rooms_screen() -> void:
	if router == null:
		return
	router.show_screen(WebUiScreenIds.DOGFIGHT_ROOMS, false)
	_apply_payload_to_screen(WebUiScreenIds.DOGFIGHT_ROOMS)
	call_deferred("_refresh_dogfight_rooms_payload")

func _show_dogfight_room_detail_screen() -> void:
	if router == null:
		return
	router.show_screen(WebUiScreenIds.DOGFIGHT_ROOM_DETAIL, false)
	_apply_payload_to_screen(WebUiScreenIds.DOGFIGHT_ROOM_DETAIL)
	call_deferred("_refresh_dogfight_room_detail_payload")

func _show_season_screen() -> void:
	if router == null:
		return
	router.show_screen(WebUiScreenIds.SEASON, false)
	_apply_payload_to_screen(WebUiScreenIds.SEASON)
	call_deferred("_refresh_season_payload")

func _show_account_history_screen() -> void:
	if router == null:
		return
	router.show_screen(WebUiScreenIds.ACCOUNT, false)
	_apply_payload_to_screen(WebUiScreenIds.ACCOUNT)
	call_deferred("_refresh_account_history_payload")

func _refresh_account_history_payload() -> void:
	if api == null or router == null or str(router.get("current_screen_id")) != WebUiScreenIds.ACCOUNT:
		return
	var history_response := await api.get_json(ApiRoutes.runs_history())
	if bool(history_response.get("ok", false)):
		lobby_history_data = _response_data(history_response)
	if router != null and str(router.get("current_screen_id")) == WebUiScreenIds.ACCOUNT:
		_apply_payload_to_screen(WebUiScreenIds.ACCOUNT)

func _refresh_season_payload() -> void:
	if api == null or current_user.is_empty() or router == null or str(router.get("current_screen_id")) != WebUiScreenIds.SEASON:
		return
	var ladder_response := await api.get_json(ApiRoutes.ladder_me())
	if bool(ladder_response.get("ok", false)):
		lobby_ladder_data = _response_data(ladder_response)
	var history_response := await api.get_json(ApiRoutes.runs_history())
	if bool(history_response.get("ok", false)):
		lobby_history_data = _response_data(history_response)
	if router != null and str(router.get("current_screen_id")) == WebUiScreenIds.SEASON:
		_apply_payload_to_screen(WebUiScreenIds.SEASON)

func _refresh_dogfight_rooms_payload() -> void:
	if api == null or router == null or str(router.get("current_screen_id")) != WebUiScreenIds.DOGFIGHT_ROOMS:
		return
	var rooms_response := await api.get_json(ApiRoutes.dogfight_rooms())
	if bool(rooms_response.get("ok", false)):
		lobby_dogfight_rooms_data = _response_data(rooms_response)
	if router != null and str(router.get("current_screen_id")) == WebUiScreenIds.DOGFIGHT_ROOMS:
		_apply_payload_to_screen(WebUiScreenIds.DOGFIGHT_ROOMS)

func _refresh_dogfight_room_detail_payload() -> void:
	if api == null or router == null or str(router.get("current_screen_id")) != WebUiScreenIds.DOGFIGHT_ROOM_DETAIL:
		return
	var room_id := str(lobby_dogfight_active_room_data.get("id", ""))
	if room_id.is_empty():
		_apply_payload_to_screen(WebUiScreenIds.DOGFIGHT_ROOM_DETAIL)
		return
	var room_response := await api.get_json(ApiRoutes.dogfight_room(room_id))
	if bool(room_response.get("ok", false)):
		var data := _response_data(room_response)
		var room: Variant = data.get("room", {})
		if room is Dictionary:
			lobby_dogfight_active_room_data = room.duplicate(true)
	if router != null and str(router.get("current_screen_id")) == WebUiScreenIds.DOGFIGHT_ROOM_DETAIL:
		_apply_payload_to_screen(WebUiScreenIds.DOGFIGHT_ROOM_DETAIL)

func dogfight_room_request(path: String, method := "GET", body: Dictionary = {}) -> Dictionary:
	if api == null:
		return {"ok": false, "status": 0, "error": "API client is not ready", "data": {}}
	var response: Dictionary
	if method.to_upper() == "POST":
		response = await api.post_json(path, body)
	else:
		response = await api.get_json(path)
	if bool(response.get("ok", false)):
		var data := _response_data(response)
		var room: Variant = data.get("room", {})
		if room is Dictionary:
			lobby_dogfight_active_room_data = room.duplicate(true)
		elif path.ends_with("/leave"):
			lobby_dogfight_active_room_data = {}
		if data.has("rooms"):
			lobby_dogfight_rooms_data = data
		elif path == ApiRoutes.dogfight_rooms():
			lobby_dogfight_rooms_data = data
		else:
			var rooms_response := await api.get_json(ApiRoutes.dogfight_rooms())
			if bool(rooms_response.get("ok", false)):
				lobby_dogfight_rooms_data = _response_data(rooms_response)
	if router != null and str(router.get("current_screen_id")) == WebUiScreenIds.DOGFIGHT_ROOMS:
		_apply_payload_to_screen(WebUiScreenIds.DOGFIGHT_ROOMS)
	return response

func _response_data(response: Dictionary) -> Dictionary:
	var value = response.get("data", {})
	return value if value is Dictionary else {}

func _show_playable_run_screen() -> void:
	var run_screen := get_node_or_null("ScreenRoot/LegacyRunScreen")
	if run_screen != null and run_screen.has_method("bind_session") and run_screen.get("session") == null:
		run_screen.bind_session(self)
	if router != null:
		router.show_screen(WebUiScreenIds.PLAYABLE_RUN, false)
	if run_screen != null and run_screen.has_method("show_run_phase"):
		run_screen.call("show_run_phase")

func _show_playable_lobby_screen(preferred_mode := "CASUAL") -> Node:
	var run_screen := get_node_or_null("ScreenRoot/LegacyRunScreen")
	if run_screen != null and run_screen.has_method("bind_session") and run_screen.get("session") == null:
		run_screen.bind_session(self)
	if router != null:
		router.show_screen(WebUiScreenIds.PLAYABLE_RUN, false)
	if run_screen != null and run_screen.has_method("show_run_lobby"):
		run_screen.call("show_run_lobby", preferred_mode)
	return run_screen

func _show_playable_mode_lobby_screen() -> void:
	var run_screen := get_node_or_null("ScreenRoot/LegacyRunScreen")
	if run_screen != null and run_screen.has_method("bind_session") and run_screen.get("session") == null:
		run_screen.bind_session(self)
	if router != null:
		router.show_screen(WebUiScreenIds.PLAYABLE_RUN, false)
	if run_screen != null and run_screen.has_method("show_named_section"):
		run_screen.call("show_named_section", WebUiScreenIds.MODE_LOBBY)

func _show_playable_section(screen_id: String) -> void:
	var run_screen := get_node_or_null("ScreenRoot/LegacyRunScreen")
	if run_screen != null and run_screen.has_method("bind_session") and run_screen.get("session") == null:
		run_screen.bind_session(self)
	if run_screen != null and screen_id == WebUiScreenIds.DOGFIGHT_ROOM_DETAIL:
		run_screen.set("active_room", lobby_dogfight_active_room_data.duplicate(true))
	if router != null:
		router.show_screen(WebUiScreenIds.PLAYABLE_RUN, false)
	if run_screen != null and run_screen.has_method("show_named_section"):
		run_screen.call("show_named_section", screen_id)
	if run_screen != null and screen_id in [WebUiScreenIds.DOGFIGHT_ROOMS, WebUiScreenIds.DOGFIGHT_ROOM_DETAIL] and run_screen.has_method("refresh_rooms_section"):
		run_screen.call("refresh_rooms_section")

func _show_battle_screen(battle: Dictionary) -> void:
	if router != null:
		router.show_screen(WebUiScreenIds.BATTLE_REPLAY)
	var battle_screen := get_node_or_null("ScreenRoot/BattleReplayScreen")
	if battle_screen != null and battle_screen.has_method("start_replay"):
		if battle_screen.has_method("configure_cosmetics"):
			var run_screen := get_node_or_null("ScreenRoot/LegacyRunScreen")
			if run_screen != null:
				var cosmetics = run_screen.get("cosmetics_data")
				if cosmetics is Dictionary:
					battle_screen.configure_cosmetics(cosmetics)
		battle_screen.start_replay(battle)

func _on_run_changed_for_screen(_run: Dictionary) -> void:
	if current_user.is_empty():
		return
	if run_store.phase() != "BATTLE":
		_show_run_screen()
