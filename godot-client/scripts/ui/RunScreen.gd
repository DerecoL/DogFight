extends Control

const ApiClient := preload("res://scripts/api/ApiClient.gd")
const ApiRoutes := preload("res://scripts/api/ApiRoutes.gd")
const UiTokens := preload("res://scripts/ui/kit/UiTokens.gd")

const TAB_LOBBY := "大厅"
const TAB_RUN := "跑局"
const TAB_ACCOUNT := "账号"
const TAB_ACHIEVEMENTS := "成就"
const TAB_DAILY := "每日"
const TAB_SHOP := "商城"
const TAB_LEADERBOARDS := "排行"
const TAB_APEX := "巅峰"
const TAB_SEASON := "赛季"
const TAB_ROOMS := "房间"
const TAB_SETTINGS := "设置"

const DOG_TYPES := ["SHIBA", "SAMOYED", "MUTT", "BULLY", "EMPEROR", "FROG"]
const DOG_NAMES := {
	"SHIBA": "柴犬",
	"SAMOYED": "萨摩耶",
	"MUTT": "土狗",
	"BULLY": "恶霸",
	"EMPEROR": "狗皇帝",
	"FROG": "祖灵",
}
const DOG_TRAITS := {
	"SHIBA": "20% 概率改掷为小点 1/2/3",
	"SAMOYED": "20% 概率改掷为大点 4/5/6",
	"MUTT": "20% 概率额外投掷一次",
	"BULLY": "大型物品触发时有概率翻倍",
	"EMPEROR": "指定天命数字，命中时有爆发上限",
	"FROG": "围绕蓄水池和雨季构筑持续收益",
}
const MODE_NAMES := {
	"CASUAL": "休闲模式",
	"LADDER": "天梯模式",
}
const QUALITY_NAMES := {
	"BRONZE": "青铜",
	"SILVER": "白银",
	"GOLD": "黄金",
	"DIAMOND": "钻石",
}

const DOG_TAGS := {
	"SHIBA": ["小点", "连击"],
	"SAMOYED": ["大点", "爆发"],
	"MUTT": ["额外投掷", "循环"],
	"BULLY": ["大型装备", "翻倍"],
	"EMPEROR": ["天命", "爆发上限"],
	"FROG": ["雨季", "蓄水"],
}
const DOG_STRATEGIES := {
	"SHIBA": "更容易把低点数变成稳定触发，适合围绕小点数装备滚雪球。",
	"SAMOYED": "偏向高点数触发和单次爆发，适合高品质伤害装备。",
	"MUTT": "通过额外投掷获得更多触发机会，适合多件低门槛装备。",
	"BULLY": "围绕大型装备与翻倍收益构筑，成型后爆发更高。",
	"EMPEROR": "围绕一个幸运数字堆叠收益，需要提前选择天命数字。",
	"FROG": "依靠雨季与蓄水逐步累积收益，越到后期越稳定。",
}

const TUTORIAL_STATUS_PATH := "user://dogfight_tutorial.cfg"
const TUTORIAL_SECTION := "casual_tutorial"
const SETTINGS_PATH := "user://dogfight_settings.cfg"
const SETTINGS_SECTION := "settings"
const MUSIC_ENABLED_KEY := "background_music_enabled"
const ROOM_LOCKED_RUN_METHODS := [
	"buy_offer",
	"claim_monster_reward",
	"complete_map_node",
	"match_battle",
	"move_item",
	"reroll_shop",
	"resolve_map_event",
	"select_class_reward",
	"select_enchant",
	"select_potion",
	"select_relic",
	"select_shop_choice",
	"select_upgrade_item",
	"sell_item",
	"sell_relic",
	"skip_monster_reward",
	"skip_upgrade_choice",
	"upgrade_item",
]

var session: Node
var current_tab := TAB_LOBBY
var action_in_progress := false
var selected_item_id := ""
var selected_item_label := ""
var selected_item: Dictionary = {}
var selected_relic_id := ""
var selected_relic: Dictionary = {}
var selected_enchant_choice_id := ""
var selected_potion_choice_id := ""
var selected_room_id := ""
var active_room: Dictionary = {}
var history_tab := "ALL"
var selected_history_run_id := ""
var dismissed_ceremonies: Dictionary = {}
var nickname_setup_modal_open := false
var tutorial_modal_open := false
var tutorial_auto_checked_for_user := ""

var root: VBoxContainer
var background_rect: TextureRect
var title_label: Label
var status_label: Label
var profile_badge_label: Label
var profile_name_label: Label
var profile_title_label: Label
var lobby_button: Button
var refresh_button: Button
var dog_type_select: OptionButton
var mode_select: OptionButton
var lucky_select: OptionButton
var create_run_button: Button
var nav_list: VBoxContainer
var content_scroll: ScrollContainer
var content: VBoxContainer
var music_player: AudioStreamPlayer

var me_data: Dictionary = {}
var achievements_data: Dictionary = {}
var daily_data: Dictionary = {}
var meta_shop_data: Dictionary = {}
var cosmetics_data: Dictionary = {}
var ladder_data: Dictionary = {}
var leaderboard_data: Dictionary = {}
var apex_data: Dictionary = {}
var history_data: Dictionary = {}
var rooms_data: Dictionary = {}

func bind_session(next_session: Node) -> void:
	if session != null:
		if session.has_signal("run_changed") and session.run_changed.is_connected(_on_run_changed):
			session.run_changed.disconnect(_on_run_changed)
		if session.has_signal("user_changed") and session.user_changed.is_connected(_on_user_changed):
			session.user_changed.disconnect(_on_user_changed)
		if session.has_signal("error_raised") and session.error_raised.is_connected(_on_error_raised):
			session.error_raised.disconnect(_on_error_raised)
	session = next_session
	if session != null:
		if session.has_signal("run_changed") and not session.run_changed.is_connected(_on_run_changed):
			session.run_changed.connect(_on_run_changed)
		if session.has_signal("user_changed") and not session.user_changed.is_connected(_on_user_changed):
			session.user_changed.connect(_on_user_changed)
		if session.has_signal("error_raised") and not session.error_raised.is_connected(_on_error_raised):
			session.error_raised.connect(_on_error_raised)

func _ready() -> void:
	_build_layout()
	_render_shell()

func clear_error() -> void:
	if status_label != null:
		status_label.text = ""

func show_run_phase() -> void:
	current_tab = TAB_RUN
	_render_shell()

func show_run_lobby(preferred_mode := "CASUAL") -> void:
	for index in range(mode_select.item_count):
		if str(mode_select.get_item_metadata(index)) == preferred_mode:
			mode_select.select(index)
			break
	current_tab = TAB_RUN
	_render_shell()
	call_deferred("_refresh_current_section")

func replay_tutorial() -> void:
	for index in range(mode_select.item_count):
		if str(mode_select.get_item_metadata(index)) == "CASUAL":
			mode_select.select(index)
			break
	current_tab = TAB_LOBBY
	_render_shell()
	call_deferred("_show_tutorial_modal")

func show_named_section(section_id: String) -> void:
	match section_id:
		"account":
			current_tab = TAB_ACCOUNT
		"account_shop":
			current_tab = TAB_SHOP
		"achievements":
			current_tab = TAB_ACHIEVEMENTS
		"leaderboards":
			current_tab = TAB_LEADERBOARDS
		"apex":
			current_tab = TAB_APEX
		"season":
			current_tab = TAB_SEASON
		"dogfight_rooms", "dogfight_room_detail":
			current_tab = TAB_ROOMS
		"account_settings":
			current_tab = TAB_SETTINGS
		_:
			current_tab = TAB_LOBBY
	_render_shell()
	if current_tab == TAB_ROOMS:
		call_deferred("_refresh_rooms_payload")
	else:
		call_deferred("_refresh_current_section")

func refresh_rooms_section() -> void:
	await _refresh_rooms_payload()

func _build_layout() -> void:
	var background := TextureRect.new()
	background.name = "Background"
	background_rect = background
	background.set_anchors_preset(Control.PRESET_FULL_RECT)
	background.texture = _texture("res://assets/backgrounds/storybook-dog-park.webp")
	background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	background.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	background.modulate = Color(0.55, 0.55, 0.55, 1.0)
	add_child(background)
	var wash := ColorRect.new()
	wash.name = "PaperWash"
	wash.set_anchors_preset(Control.PRESET_FULL_RECT)
	wash.color = Color(0.18, 0.11, 0.06, 0.36)
	wash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(wash)

	music_player = AudioStreamPlayer.new()
	music_player.name = "BackgroundMusic"
	if DisplayServer.get_name() != "headless" and FileAccess.file_exists("res://assets/audio/the-final-inventory.mp3"):
		var imported_audio := ResourceLoader.load("res://assets/audio/the-final-inventory.mp3")
		if imported_audio is AudioStream:
			music_player.stream = imported_audio
		else:
			var audio := AudioStreamMP3.new()
			audio.data = FileAccess.get_file_as_bytes("res://assets/audio/the-final-inventory.mp3")
			music_player.stream = audio
	music_player.volume_db = -18.0
	add_child(music_player)
	if music_player.stream != null and _music_enabled_preference():
		music_player.play()

	root = VBoxContainer.new()
	root.name = "HubRoot"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_theme_constant_override("separation", 10)
	add_child(root)

	var header := HBoxContainer.new()
	header.name = "Header"
	header.custom_minimum_size = Vector2(0, 58)
	header.add_theme_constant_override("separation", 10)
	root.add_child(header)

	lobby_button = _button("返回大厅", 96)
	lobby_button.pressed.connect(open_mode_lobby)
	header.add_child(lobby_button)

	title_label = Label.new()
	title_label.text = "狗骰乱斗 Godot 工作台"
	title_label.custom_minimum_size = Vector2(180, 44)
	title_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	header.add_child(title_label)

	var profile_card := HBoxContainer.new()
	profile_card.name = "ProfileCard"
	profile_card.custom_minimum_size = Vector2(188, 44)
	profile_card.add_theme_constant_override("separation", 6)
	header.add_child(profile_card)
	profile_badge_label = Label.new()
	profile_badge_label.name = "ProfileAvatar"
	profile_badge_label.custom_minimum_size = Vector2(34, 34)
	profile_badge_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	profile_badge_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	profile_card.add_child(profile_badge_label)
	var profile_text := VBoxContainer.new()
	profile_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	profile_card.add_child(profile_text)
	profile_name_label = Label.new()
	profile_name_label.clip_text = true
	profile_name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	profile_text.add_child(profile_name_label)
	profile_title_label = Label.new()
	profile_title_label.clip_text = true
	profile_title_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	profile_text.add_child(profile_title_label)

	var run_creation_state := HBoxContainer.new()
	run_creation_state.name = "RunCreationState"
	run_creation_state.visible = false
	header.add_child(run_creation_state)

	dog_type_select = OptionButton.new()
	dog_type_select.custom_minimum_size = Vector2(132, 36)
	for dog_type in DOG_TYPES:
		var index := dog_type_select.item_count
		dog_type_select.add_item(_dog_name(dog_type))
		dog_type_select.set_item_metadata(index, dog_type)
	_apply_button_style(dog_type_select)
	run_creation_state.add_child(dog_type_select)

	mode_select = OptionButton.new()
	mode_select.custom_minimum_size = Vector2(112, 36)
	for mode in ["CASUAL", "LADDER"]:
		var mode_index := mode_select.item_count
		mode_select.add_item(_mode_name(mode))
		mode_select.set_item_metadata(mode_index, mode)
	_apply_button_style(mode_select)
	run_creation_state.add_child(mode_select)

	lucky_select = OptionButton.new()
	lucky_select.custom_minimum_size = Vector2(96, 36)
	lucky_select.add_item("无幸运")
	for lucky in range(1, 7):
		lucky_select.add_item("幸运 %d" % lucky)
	_apply_button_style(lucky_select)
	run_creation_state.add_child(lucky_select)

	create_run_button = _button("新建跑局", 118)
	create_run_button.pressed.connect(_on_create_run_pressed)
	run_creation_state.add_child(create_run_button)

	refresh_button = _button("刷新全部", 104)
	refresh_button.pressed.connect(_refresh_all)
	run_creation_state.add_child(refresh_button)

	status_label = Label.new()
	status_label.custom_minimum_size = Vector2(0, 44)
	status_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	status_label.clip_text = true
	status_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	header.add_child(status_label)

	var body := HBoxContainer.new()
	body.name = "Body"
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 10)
	root.add_child(body)

	nav_list = VBoxContainer.new()
	nav_list.custom_minimum_size = Vector2(128, 0)
	nav_list.add_theme_constant_override("separation", 8)
	body.add_child(nav_list)

	content_scroll = ScrollContainer.new()
	content_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	body.add_child(content_scroll)

	content = VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 10)
	content_scroll.add_child(content)

func _render_shell() -> void:
	_apply_equipped_cosmetic_shell()
	_clear_children(nav_list)
	for tab in [TAB_LOBBY, TAB_RUN, TAB_ACCOUNT, TAB_ACHIEVEMENTS, TAB_DAILY, TAB_SHOP, TAB_LEADERBOARDS, TAB_APEX, TAB_SEASON, TAB_ROOMS, TAB_SETTINGS]:
		var button := _button(tab, 0)
		button.custom_minimum_size = Vector2(0, 42)
		button.disabled = action_in_progress
		button.toggle_mode = true
		button.button_pressed = tab == current_tab
		button.pressed.connect(_on_tab_pressed.bind(tab))
		nav_list.add_child(button)
	_render_current_tab()

func _refresh_all() -> void:
	if action_in_progress or session == null:
		return
	action_in_progress = true
	_update_controls()
	status_label.text = "正在同步网页版数据..."
	await _fetch_into("me", ApiRoutes.me())
	await _fetch_into("achievements", ApiRoutes.achievements())
	await _fetch_into("daily", ApiRoutes.daily_tasks())
	await _fetch_into("shop", ApiRoutes.shop())
	await _fetch_into("cosmetics", ApiRoutes.cosmetics_me())
	await _fetch_into("ladder", ApiRoutes.ladder_me())
	await _fetch_into("leaderboard", ApiRoutes.ladder_leaderboard())
	await _fetch_into("apex", ApiRoutes.apex())
	await _fetch_into("history", ApiRoutes.runs_history())
	await _fetch_into("rooms", ApiRoutes.dogfight_rooms())
	status_label.text = "已同步"
	action_in_progress = false
	_update_controls()
	_render_shell()
	_maybe_auto_show_tutorial()

func _fetch_into(key: String, path: String) -> void:
	var response: Dictionary = await _api_get(path)
	if not bool(response.get("ok", false)):
		status_label.text = "%s 同步失败：%s" % [key, str(response.get("error", ""))]
		return
	match key:
		"me":
			me_data = _data(response)
			var active_run = me_data.get("activeRun", null)
			if active_run is Dictionary and session != null and session.has_method("set_current_run"):
				session.set_current_run(active_run)
		"achievements":
			achievements_data = _data(response)
		"daily":
			daily_data = _data(response)
		"shop":
			meta_shop_data = _data(response)
		"cosmetics":
			cosmetics_data = _data(response)
		"ladder":
			ladder_data = _data(response)
		"leaderboard":
			leaderboard_data = _data(response)
		"apex":
			apex_data = _data(response)
		"history":
			history_data = _data(response)
		"rooms":
			rooms_data = _data(response)

func _guarded_fetch_into(key: String, path: String) -> void:
	if action_in_progress:
		return
	action_in_progress = true
	_update_controls()
	await _fetch_into(key, path)
	action_in_progress = false
	_update_controls()

func _render_current_tab() -> void:
	if content == null:
		return
	_clear_children(content)
	match current_tab:
		TAB_LOBBY:
			_render_lobby_tab()
		TAB_RUN:
			_render_run_tab()
		TAB_ACCOUNT:
			_render_account_tab()
		TAB_ACHIEVEMENTS:
			_render_achievements_tab()
		TAB_DAILY:
			_render_daily_tab()
		TAB_SHOP:
			_render_shop_tab()
		TAB_LEADERBOARDS:
			_render_leaderboards_tab()
		TAB_APEX:
			_render_apex_tab()
		TAB_SEASON:
			_render_season_tab()
		TAB_ROOMS:
			_render_rooms_tab()
		TAB_SETTINGS:
			_render_settings_tab()

func _render_lobby_tab() -> void:
	var history := _section("模式大厅")
	var best_run: Dictionary = _dict(history_data, "bestRun")
	var total_wins := int(history_data.get("totalWins", 0))
	var total_losses := int(history_data.get("totalLosses", 0))
	var total_battles: int = max(1, total_wins + total_losses)
	_add_line(history, "个人战绩", "%d 胜 / %d 负 · 共 %d 局 · 胜率 %d%%" % [total_wins, total_losses, int(history_data.get("totalRuns", 0)), int(round(float(total_wins) / float(total_battles) * 100.0))])
	if best_run.is_empty():
		_add_line(history, "最佳成绩", "暂无对局")
	else:
		_add_line(history, "最佳成绩", "%s · %d胜 %d负 · 第%d回合" % [_dog_name(str(best_run.get("dogType", ""))), int(best_run.get("wins", 0)), int(best_run.get("losses", 0)), int(best_run.get("round", 0))])
	var shortcuts := HBoxContainer.new()
	shortcuts.add_theme_constant_override("separation", 8)
	history.add_child(shortcuts)
	shortcuts.add_child(_action_button("商城", _switch_tab.bind(TAB_SHOP)))
	shortcuts.add_child(_action_button("成就", _switch_tab.bind(TAB_ACHIEVEMENTS)))
	shortcuts.add_child(_action_button("个人设置", _switch_tab.bind(TAB_SETTINGS)))
	shortcuts.add_child(_action_button("战绩详情", _show_history_modal))

	var modes := _section("竞技方式")
	_render_dog_picker(modes)
	var casual_label: String = "继续休闲模式" if _current_run_mode() == "CASUAL" else "开始休闲模式"
	var ladder_label: String = "继续天梯模式" if _current_run_mode() == "LADDER" else "进入天梯模式"
	modes.add_child(_mode_button("休闲模式", "标准跑局，完成后的狗可提交巅峰竞技场。", casual_label, _start_mode.bind("CASUAL")))
	modes.add_child(_mode_button("天梯模式", "进入独立匹配池，整局结算赛季积分。", ladder_label, _start_mode.bind("LADDER")))
	modes.add_child(_mode_button("多人房间", "创建、匹配、加入房间并查看多人战报。", "进入斗狗模式", _switch_tab.bind(TAB_ROOMS)))
	modes.add_child(_mode_button("巅峰竞技场", "提交完成局并查看总榜/当日榜配置。", "进入巅峰模式", _switch_tab.bind(TAB_APEX)))
	modes.add_child(_mode_button("新手引导", "按网页版教学顺序说明大厅、选狗、商店、放置、战斗和继续跑局。", "重播新手引导", _show_tutorial_modal))

func _render_account_tab() -> void:
	var card := _section("账号面板")
	var user: Dictionary = _dict(me_data, "user")
	var account: Dictionary = _dict(me_data, "account")
	var wallet: Dictionary = _dict(account, "wallet")
	_add_line(card, "账号", _fallback(str(user.get("account", "")), "未登录"))
	_add_line(card, "昵称", _fallback(str(user.get("nickname", "")), "未设置"))
	_add_line(card, "钱包", "余额 %d / 今日获得 %d" % [int(wallet.get("balance", 0)), int(wallet.get("dailyEarned", 0))])
	var profile_row := HBoxContainer.new()
	profile_row.add_theme_constant_override("separation", 8)
	card.add_child(profile_row)
	var nickname_input := LineEdit.new()
	nickname_input.placeholder_text = "输入 2-16 字昵称"
	nickname_input.text = str(user.get("nickname", ""))
	nickname_input.max_length = 16
	nickname_input.custom_minimum_size = Vector2(220, 38)
	nickname_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_apply_input_style(nickname_input)
	profile_row.add_child(nickname_input)
	profile_row.add_child(_action_button("保存昵称", _save_nickname.bind(nickname_input)))
	card.add_child(_action_button("退出登录", _call_session.bind("logout", [])))
	var history_card := _section("跑局记录")
	_add_line(history_card, "总跑局", str(int(history_data.get("totalRuns", 0))))
	_add_line(history_card, "完成 / 放弃", "%d / %d" % [int(history_data.get("completedRuns", 0)), int(history_data.get("abandonedRuns", 0))])
	_add_line(history_card, "胜负", "%d 胜 / %d 负" % [int(history_data.get("totalWins", 0)), int(history_data.get("totalLosses", 0))])
	for run in _array(history_data, "recentRuns").slice(0, 8):
		if run is Dictionary:
			var row := _button("%s  %s  %d-%d  第%d回合" % [_mode_name(str(run.get("mode", ""))), _run_status_label(str(run.get("status", ""))), int(run.get("wins", 0)), int(run.get("losses", 0)), int(run.get("round", 0))], 0)
			row.pressed.connect(_on_history_run_pressed.bind(str(run.get("id", ""))))
			history_card.add_child(row)
			history_card.add_child(_action_button("查看配置：" + str(run.get("id", "")), _show_snapshot_modal.bind(run, "历史对局配置")))

func _render_run_tab() -> void:
	var store: Object = _run_store()
	if store == null or not store.has_method("has_run") or not store.has_run():
		var picker := _section("选择狗狗伙伴")
		_add_line(picker, "说明", "每个狗狗都有独特的被动特性和策略玩法。")
		_render_dog_picker(picker)
		picker.add_child(_action_button("开始一局", _on_create_run_pressed))
		return
	var run: Dictionary = store.get("run")
	var phase := str(run.get("phase", ""))
	if phase == "MAP":
		_render_web_map_run(run)
		_maybe_show_reward_ceremony(run)
		return
	if phase == "SHOP":
		_render_web_shop_run(run)
		_maybe_show_reward_ceremony(run)
		return
	if phase == "CHOICE":
		_render_web_shop_choice_run(run)
		return
	if ["CLASS_REWARD", "RELIC_CHOICE", "UPGRADE_CHOICE", "ENCHANT_CHOICE", "POTION_CHOICE"].has(phase):
		_render_web_reward_run(run)
		_maybe_show_reward_ceremony(run)
		return
	if phase == "COMPLETE" or str(run.get("status", "")) == "COMPLETE":
		_render_web_settlement_run(run)
		return
	var summary := _section("当前跑局")
	_add_line(summary, "阶段", "%s / %s" % [_run_phase_label(str(run.get("phase", ""))), _run_status_label(str(run.get("status", "")))])
	_add_line(summary, "犬种", "%s  幸运号 %s" % [_dog_name(str(run.get("dogType", ""))), str(run.get("luckyNumber", "-"))])
	_add_line(summary, "进度", "第 %d 回合 · %d 胜 %d 负 · 金币 %d" % [int(run.get("round", 0)), int(run.get("wins", 0)), int(run.get("losses", 0)), int(run.get("gold", 0))])
	_render_run_actions(run, summary)
	_render_settlement_summary(run)
	_render_reward_choices(run)
	_render_inventory(run)
	_render_map_or_shop_detail(run)
	_maybe_show_reward_ceremony(run)

func _render_playable_root() -> VBoxContainer:
	var root := VBoxContainer.new()
	root.name = "PlayableRunScreen"
	root.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	root.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_theme_constant_override("separation", 12)
	content.add_child(root)
	return root

func _render_run_summary_topbar(parent: VBoxContainer, run: Dictionary) -> void:
	var panel := PanelContainer.new()
	panel.name = "RunSummaryTopbar"
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.custom_minimum_size = Vector2(0, 92)
	panel.add_theme_stylebox_override("panel", UiTokens.paper_panel_style())
	parent.add_child(panel)
	var row := HBoxContainer.new()
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 12)
	panel.add_child(row)
	var identity := VBoxContainer.new()
	identity.name = "RunIdentity"
	identity.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity.add_theme_constant_override("separation", 4)
	row.add_child(identity)
	var title := Label.new()
	title.text = "%s · %s" % [_dog_name(str(run.get("dogType", ""))), _run_phase_label(str(run.get("phase", "")))]
	title.custom_minimum_size = Vector2(0, 30)
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.add_theme_color_override("font_color", UiTokens.ink_color())
	identity.add_child(title)
	_add_plain_line(identity, "第 %d 回合 · 幸运骰 %s" % [int(run.get("round", 0)), str(run.get("luckyNumber", "-"))])
	var stats := HBoxContainer.new()
	stats.name = "RunResourcePills"
	stats.add_theme_constant_override("separation", 8)
	row.add_child(stats)
	_add_resource_pill(stats, "胜场", "%d/12" % int(run.get("wins", 0)))
	_add_resource_pill(stats, "容错", "%d/3" % max(0, 3 - int(run.get("losses", 0))))
	_add_resource_pill(stats, "金币", str(int(run.get("gold", 0))))
	var actions := VBoxContainer.new()
	actions.name = "RunActionRail"
	actions.custom_minimum_size = Vector2(220, 0)
	actions.add_theme_constant_override("separation", 4)
	row.add_child(actions)
	_render_run_actions(run, actions)

func _add_resource_pill(parent: HBoxContainer, label: String, value: String) -> void:
	var pill := Label.new()
	pill.custom_minimum_size = Vector2(82, 42)
	pill.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pill.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	pill.text = "%s\n%s" % [label, value]
	pill.add_theme_color_override("font_color", UiTokens.ink_color())
	parent.add_child(pill)

func _render_web_map_run(run: Dictionary) -> void:
	var root := _render_playable_root()
	_render_run_summary_topbar(root, run)
	var screen := VBoxContainer.new()
	screen.name = "ExplorationMapScreen"
	screen.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	screen.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(screen)
	var overlay := PanelContainer.new()
	overlay.name = "ExplorationMapOverlay"
	overlay.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	overlay.size_flags_vertical = Control.SIZE_EXPAND_FILL
	overlay.add_theme_stylebox_override("panel", UiTokens.paper_panel_style())
	screen.add_child(overlay)
	var shell := VBoxContainer.new()
	shell.name = "ExplorationMapShell"
	shell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	shell.size_flags_vertical = Control.SIZE_EXPAND_FILL
	shell.add_theme_constant_override("separation", 10)
	overlay.add_child(shell)
	var topbar := HBoxContainer.new()
	topbar.name = "ExplorationMapTopbar"
	topbar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	topbar.custom_minimum_size = Vector2(0, 64)
	topbar.add_theme_constant_override("separation", 12)
	shell.add_child(topbar)
	var title := VBoxContainer.new()
	title.name = "MapTitlePlacard"
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	topbar.add_child(title)
	_add_plain_line(title, "探索地图")
	var map_state: Dictionary = _dict(run, "mapState")
	var layer_count := _map_layer_count(map_state)
	_add_plain_line(title, "第 %d 张地图 · 共 %d 层" % [int(map_state.get("mapIndex", 0)) + 1, layer_count])
	var stats := HBoxContainer.new()
	stats.name = "MapRunStats"
	stats.add_theme_constant_override("separation", 8)
	topbar.add_child(stats)
	_add_resource_pill(stats, "胜场", "%d/12" % int(run.get("wins", 0)))
	_add_resource_pill(stats, "容错", "%d/3" % max(0, 3 - int(run.get("losses", 0))))
	_add_resource_pill(stats, "金币", str(int(run.get("gold", 0))))
	var route_board := HBoxContainer.new()
	route_board.name = "ExplorationMapRouteBoard"
	route_board.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	route_board.size_flags_vertical = Control.SIZE_EXPAND_FILL
	route_board.add_theme_constant_override("separation", 10)
	shell.add_child(route_board)
	var canvas := VBoxContainer.new()
	canvas.name = "MapRouteCanvas"
	canvas.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	canvas.size_flags_vertical = Control.SIZE_EXPAND_FILL
	canvas.custom_minimum_size = Vector2(520, 390)
	canvas.add_theme_constant_override("separation", 8)
	route_board.add_child(canvas)
	var route_layer := VBoxContainer.new()
	route_layer.name = "MapRouteLayer"
	route_layer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	route_layer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	canvas.add_child(route_layer)
	_render_map_route(route_layer, map_state)
	var toolbar := HBoxContainer.new()
	toolbar.name = "MapDrawingToolbar"
	toolbar.add_theme_constant_override("separation", 6)
	canvas.add_child(toolbar)
	for tool_label in ["查看节点", "画笔", "橡皮", "清空草稿"]:
		var tool := _button(tool_label, 92)
		tool.disabled = tool_label == "清空草稿"
		toolbar.add_child(tool)
	var detail := VBoxContainer.new()
	detail.name = "MapNodeDetailPanel"
	detail.custom_minimum_size = Vector2(300, 0)
	detail.size_flags_vertical = Control.SIZE_EXPAND_FILL
	detail.add_theme_constant_override("separation", 8)
	route_board.add_child(detail)
	_render_map_detail_panel(detail, map_state)
	var reward_inventory := VBoxContainer.new()
	reward_inventory.name = "MapRewardInventory"
	reward_inventory.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	reward_inventory.add_theme_constant_override("separation", 8)
	shell.add_child(reward_inventory)
	var inventory := VBoxContainer.new()
	inventory.name = "InventoryBoard"
	inventory.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	inventory.add_theme_constant_override("separation", 8)
	reward_inventory.add_child(inventory)
	_render_inventory_board(inventory, run, true)

func _render_map_detail_panel(parent: VBoxContainer, map_state: Dictionary) -> void:
	var current_node := _map_current_node(map_state)
	if str(current_node.get("kind", "")) == "EVENT" and not _dict(current_node, "event").is_empty():
		var event: Dictionary = _dict(current_node, "event")
		_add_plain_line(parent, _fallback(str(event.get("title", "")), "事件"))
		_add_plain_line(parent, str(event.get("description", "")))
		parent.add_child(_run_action_button("处理事件", _call_session.bind("resolve_map_event", [])))
	if not _dict(map_state, "pendingReward").is_empty():
		_add_plain_line(parent, "待领取掉落")
		parent.add_child(_run_action_button("领取怪物奖励", _call_session.bind("claim_monster_reward", [])))
		parent.add_child(_run_action_button("跳过怪物奖励", _call_session.bind("skip_monster_reward", [])))
	if not current_node.is_empty():
		_add_plain_line(parent, _map_node_title(current_node))
		var monster: Dictionary = _dict(current_node, "monster")
		if not monster.is_empty():
			_add_line(parent, "对手", "%s · %s" % [str(monster.get("name", "")), _dog_name(str(monster.get("dogType", "")))])
			_render_map_monster_equipment(parent, monster)
			_render_map_reward_preview(parent, _variant_array(monster.get("possibleRewards", [])))

func _map_layer_count(map_state: Dictionary) -> int:
	var count := 1
	for node in _array(map_state, "nodes"):
		if node is Dictionary:
			count = max(count, int((node as Dictionary).get("layer", 0)) + 1)
	return count

func _render_web_shop_run(run: Dictionary) -> void:
	var root := _render_playable_root()
	_render_run_summary_topbar(root, run)
	var workbench := HBoxContainer.new()
	workbench.name = "ShopWorkbench"
	workbench.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	workbench.size_flags_vertical = Control.SIZE_EXPAND_FILL
	workbench.add_theme_constant_override("separation", 12)
	root.add_child(workbench)
	var shelf := VBoxContainer.new()
	shelf.name = "ShopShelf"
	shelf.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	shelf.size_flags_vertical = Control.SIZE_EXPAND_FILL
	shelf.add_theme_constant_override("separation", 8)
	workbench.add_child(shelf)
	var shop_type := str(run.get("shopType", "GENERAL"))
	_add_line(shelf, _shop_name(shop_type), _shop_description(shop_type))
	var shop_actions := HBoxContainer.new()
	shop_actions.name = "ShopActions"
	shop_actions.add_theme_constant_override("separation", 8)
	shelf.add_child(shop_actions)
	var sell_zone := Label.new()
	sell_zone.name = "SellDropZone"
	sell_zone.text = "拖到这里出售"
	sell_zone.custom_minimum_size = Vector2(128, 38)
	sell_zone.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	sell_zone.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	shop_actions.add_child(sell_zone)
	shop_actions.add_child(_run_action_button("刷新 %d 金币" % int(run.get("refreshCost", 0)), _call_session.bind("reroll_shop", [])))
	_add_line(shelf, "提示", "点击商品查看详情，确认后再购买。")
	var offer_row := VBoxContainer.new()
	offer_row.name = "OfferRow"
	offer_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	offer_row.add_theme_constant_override("separation", 8)
	shelf.add_child(offer_row)
	for offer in _array(run, "shopItems"):
		if offer is Dictionary:
			_render_shop_offer_card(offer_row, run, offer)
			var card := offer_row.get_child(offer_row.get_child_count() - 1)
			card.name = "ShopCard_%s" % str((offer as Dictionary).get("offerId", offer_row.get_child_count()))
	var match_button := _shop_progression_button(run)
	match_button.name = "MatchButton"
	shelf.add_child(match_button)
	var inventory := VBoxContainer.new()
	inventory.name = "InventoryBoard"
	inventory.custom_minimum_size = Vector2(420, 0)
	inventory.size_flags_vertical = Control.SIZE_EXPAND_FILL
	inventory.add_theme_constant_override("separation", 8)
	workbench.add_child(inventory)
	_render_inventory_board(inventory, run, true)

func _render_screen_heading(parent: VBoxContainer, title: String, description: String) -> void:
	var heading := VBoxContainer.new()
	heading.name = "ScreenHeading"
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_theme_constant_override("separation", 4)
	parent.add_child(heading)
	var title_label := Label.new()
	title_label.text = title
	title_label.custom_minimum_size = Vector2(0, 32)
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title_label.add_theme_color_override("font_color", UiTokens.ink_color())
	heading.add_child(title_label)
	var description_label := Label.new()
	description_label.text = description
	description_label.custom_minimum_size = Vector2(0, 28)
	description_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	description_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	description_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	description_label.add_theme_color_override("font_color", UiTokens.ink_color())
	heading.add_child(description_label)

func _render_web_shop_choice_run(run: Dictionary) -> void:
	var root := _render_playable_root()
	_render_run_summary_topbar(root, run)
	var screen := VBoxContainer.new()
	screen.name = "ShopChoiceScreen"
	screen.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	screen.size_flags_vertical = Control.SIZE_EXPAND_FILL
	screen.add_theme_constant_override("separation", 12)
	root.add_child(screen)
	_render_screen_heading(screen, "选择本回合要访问的商店", "不同商店提供不同类型的道具，选择适合你战术的商店")
	var grid := GridContainer.new()
	grid.name = "ChoiceGrid"
	grid.columns = 3
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	screen.add_child(grid)
	var choices := _array(run, "choices")
	for index in range(9):
		if index < choices.size():
			var shop_type := str(choices[index])
			var button := _button("%s\n%s\n进入 %s" % [_shop_name(shop_type), _shop_description(shop_type), _shop_name(shop_type)], 0)
			button.name = "ChoiceCard_%s" % shop_type
			button.custom_minimum_size = Vector2(176, 126)
			button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			button.pressed.connect(_call_session.bind("select_shop_choice", [shop_type]))
			grid.add_child(button)
		else:
			var placeholder := Label.new()
			placeholder.name = "ChoicePlaceholder_%d" % (index + 1)
			placeholder.text = "空商店位 %d" % (index + 1)
			placeholder.custom_minimum_size = Vector2(176, 126)
			placeholder.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
			placeholder.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			grid.add_child(placeholder)
	var submit := _disabled_action_button("进入商店")
	submit.name = "ChoiceSubmit"
	if not choices.is_empty():
		var first_shop := str(choices[0])
		submit.text = "进入 %s" % _shop_name(first_shop)
		submit.disabled = action_in_progress or _room_current_run_action_locked()
		submit.pressed.connect(_call_session.bind("select_shop_choice", [first_shop]))
	screen.add_child(submit)

func _render_web_reward_run(run: Dictionary) -> void:
	var phase := str(run.get("phase", ""))
	var root := _render_playable_root()
	_render_run_summary_topbar(root, run)
	if phase == "RELIC_CHOICE":
		_render_relic_choice_select(root, run)
		return
	var workbench := HBoxContainer.new()
	workbench.name = "RewardWorkbench"
	workbench.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	workbench.size_flags_vertical = Control.SIZE_EXPAND_FILL
	workbench.add_theme_constant_override("separation", 12)
	root.add_child(workbench)
	match phase:
		"CLASS_REWARD":
			_render_class_reward_select(workbench, run)
		"UPGRADE_CHOICE":
			workbench.name = "RewardWorkbench"
			var upgrade := VBoxContainer.new()
			upgrade.name = "UpgradeWorkbench"
			upgrade.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			upgrade.size_flags_vertical = Control.SIZE_EXPAND_FILL
			workbench.add_child(upgrade)
			_render_upgrade_choice_select(upgrade, run)
		"ENCHANT_CHOICE":
			var enchant := VBoxContainer.new()
			enchant.name = "EnchantWorkbench"
			enchant.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			enchant.size_flags_vertical = Control.SIZE_EXPAND_FILL
			workbench.add_child(enchant)
			_render_enchant_choice_select(enchant, run)
		"POTION_CHOICE":
			var potion := VBoxContainer.new()
			potion.name = "PotionWorkbench"
			potion.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			potion.size_flags_vertical = Control.SIZE_EXPAND_FILL
			workbench.add_child(potion)
			_render_potion_choice_select(potion, run)
		_:
			_render_reward_empty_panel(workbench)
	if phase != "RELIC_CHOICE":
		var inventory := VBoxContainer.new()
		inventory.name = "InventoryBoard"
		inventory.custom_minimum_size = Vector2(420, 0)
		inventory.size_flags_vertical = Control.SIZE_EXPAND_FILL
		inventory.add_theme_constant_override("separation", 8)
		workbench.add_child(inventory)
		_render_inventory_board(inventory, run, true)

func _new_reward_panel(parent: VBoxContainer, panel_name: String = "RewardPanel") -> VBoxContainer:
	var panel := VBoxContainer.new()
	panel.name = panel_name
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.add_theme_constant_override("separation", 10)
	parent.add_child(panel)
	return panel

func _render_class_reward_select(parent: HBoxContainer, run: Dictionary) -> void:
	var selector := VBoxContainer.new()
	selector.name = "ClassRewardSelect"
	selector.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	selector.size_flags_vertical = Control.SIZE_EXPAND_FILL
	parent.add_child(selector)
	var panel := _new_reward_panel(selector)
	_render_screen_heading(panel, "选择职业装备", "先整理背包，再选择一个职业装备放入背包。")
	var grid := GridContainer.new()
	grid.name = "RewardChoiceGrid"
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	panel.add_child(grid)
	var choices := _array(run, "classRewardChoices")
	for choice in choices:
		if choice is Dictionary:
			var def: Dictionary = _dict(choice, "def")
			var def_id := str(choice.get("defId", ""))
			var button := _button("%s\n%s" % [_fallback(str(def.get("name", "")), def_id), _fallback(str(def.get("description", "")), str(choice.get("quality", "")))], 0)
			button.name = "RewardChoice_%s" % def_id
			button.custom_minimum_size = Vector2(220, 128)
			button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			button.pressed.connect(_show_class_reward_modal.bind(choice))
			grid.add_child(button)
	var submit := _disabled_action_button("领取职业装备")
	submit.name = "ChoiceSubmit"
	if not choices.is_empty() and choices[0] is Dictionary:
		var first_id := str((choices[0] as Dictionary).get("defId", ""))
		if not first_id.is_empty():
			submit.disabled = action_in_progress or _room_current_run_action_locked()
			submit.pressed.connect(_call_session.bind("select_class_reward", [first_id]))
	panel.add_child(submit)

func _render_relic_choice_select(parent: VBoxContainer, run: Dictionary) -> void:
	var selector := VBoxContainer.new()
	selector.name = "RelicChoiceSelect"
	selector.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	selector.size_flags_vertical = Control.SIZE_EXPAND_FILL
	selector.add_theme_constant_override("separation", 10)
	parent.add_child(selector)
	var panel := _new_reward_panel(selector)
	_render_screen_heading(panel, "选择遗物", "免费选择一个遗物；重复遗物会直接升级。")
	var grid_wrap := VBoxContainer.new()
	grid_wrap.name = "ChoiceGrid"
	grid_wrap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_child(grid_wrap)
	var grid := GridContainer.new()
	grid.name = "RelicChoiceGrid"
	grid.columns = 3
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	grid_wrap.add_child(grid)
	var choices := _array(run, "relicChoices")
	for choice in choices:
		if choice is Dictionary:
			var def: Dictionary = _dict(choice, "def")
			var relic_id := str(choice.get("relicId", ""))
			var button := _button("%s\n%s" % [_fallback(str(def.get("name", "")), relic_id), _fallback(str(def.get("description", "")), str(choice.get("quality", "")))], 0)
			button.name = "RelicChoice_%s" % relic_id
			button.custom_minimum_size = Vector2(190, 132)
			button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			button.pressed.connect(_show_relic_choice_modal.bind(choice))
			grid.add_child(button)
	var submit := _disabled_action_button("获得遗物")
	submit.name = "ChoiceSubmit"
	if not choices.is_empty() and choices[0] is Dictionary:
		var first_id := str((choices[0] as Dictionary).get("relicId", ""))
		if not first_id.is_empty():
			submit.disabled = action_in_progress or _room_current_run_action_locked()
			submit.pressed.connect(_call_session.bind("select_relic", [first_id]))
	panel.add_child(submit)

func _render_upgrade_choice_select(parent: VBoxContainer, run: Dictionary) -> void:
	var panel := _new_reward_panel(parent, "UpgradePanel")
	var alias := Control.new()
	alias.name = "RewardPanel"
	panel.add_child(alias)
	_render_screen_heading(panel, "选择升级装备", "点击装备栏或背包中可升级的装备，免费提升 1 个品质。")
	var grid := GridContainer.new()
	grid.name = "RewardChoiceGrid"
	grid.columns = 1
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_child(grid)
	var card := _button("%s\n%s" % [_shop_name(str(run.get("shopType", "UPGRADE"))), "选择装备后确认升级"], 0)
	card.name = "RewardChoice_upgrade"
	card.custom_minimum_size = Vector2(220, 120)
	card.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	grid.add_child(card)
	if selected_item_id.is_empty():
		panel.add_child(_disabled_action_button("先选中装备再升级"))
	else:
		panel.add_child(_run_action_button("升级选中装备", _select_upgrade_item))
	var submit := _run_action_button("跳过升级", _call_session.bind("skip_upgrade_choice", []))
	submit.name = "ChoiceSubmit"
	panel.add_child(submit)

func _render_enchant_choice_select(parent: VBoxContainer, run: Dictionary) -> void:
	var panel := _new_reward_panel(parent, "EnchantPanel")
	var alias := Control.new()
	alias.name = "RewardPanel"
	panel.add_child(alias)
	_render_screen_heading(panel, "选择附魔", "选中一个附魔后，点击装备栏或背包中的任意装备施加。")
	_render_named_choice_grid(panel, _array(run, "enchantChoices"), "RewardChoice_", func(choice: Dictionary) -> String:
		return str(choice.get("id", ""))
	, func(choice: Dictionary) -> String:
		return _enchant_choice_label(choice)
	, func(choice: Dictionary) -> Callable:
		return _show_enchant_choice_modal.bind(choice)
	)

func _render_potion_choice_select(parent: VBoxContainer, run: Dictionary) -> void:
	var panel := _new_reward_panel(parent, "PotionPanel")
	var alias := Control.new()
	alias.name = "RewardPanel"
	panel.add_child(alias)
	_render_screen_heading(panel, "选择药水", "先选一瓶药水，再点击一件非职业装备修改基础触发点数。")
	_render_named_choice_grid(panel, _array(run, "potionChoices"), "RewardChoice_", func(choice: Dictionary) -> String:
		return str(choice.get("id", ""))
	, func(choice: Dictionary) -> String:
		return _potion_choice_label(choice)
	, func(choice: Dictionary) -> Callable:
		return _show_potion_choice_modal.bind(choice)
	)

func _render_named_choice_grid(parent: VBoxContainer, choices: Array, node_prefix: String, id_resolver: Callable, label_resolver: Callable, action_resolver: Callable) -> void:
	var grid := GridContainer.new()
	grid.name = "RewardChoiceGrid"
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	parent.add_child(grid)
	for choice in choices:
		if choice is Dictionary:
			var choice_id := str(id_resolver.call(choice))
			var label := str(label_resolver.call(choice))
			var button := _button(label, 0)
			button.name = "%s%s" % [node_prefix, choice_id]
			button.custom_minimum_size = Vector2(220, 112)
			button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			button.pressed.connect(action_resolver.call(choice))
			grid.add_child(button)

func _render_reward_empty_panel(parent: HBoxContainer) -> void:
	var panel := VBoxContainer.new()
	panel.name = "RewardPanel"
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(panel)
	_render_screen_heading(panel, "奖励", "暂无可选奖励。")

func _render_web_settlement_run(run: Dictionary) -> void:
	var root := _render_playable_root()
	var page := VBoxContainer.new()
	page.name = "SettlementPage"
	page.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	page.size_flags_vertical = Control.SIZE_EXPAND_FILL
	page.add_theme_constant_override("separation", 12)
	root.add_child(page)
	var hide_button := _button("隐藏结算", 96)
	hide_button.name = "SettlementHideButton"
	hide_button.disabled = true
	page.add_child(hide_button)
	var card := VBoxContainer.new()
	card.name = "SettlementCard"
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.size_flags_vertical = Control.SIZE_EXPAND_FILL
	card.add_theme_constant_override("separation", 12)
	page.add_child(card)
	var icon := Label.new()
	icon.name = "SettlementIcon"
	icon.text = "Trophy"
	icon.custom_minimum_size = Vector2(0, 38)
	icon.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	icon.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	card.add_child(icon)
	var title := Label.new()
	title.name = "SettlementTitle"
	title.text = "跑局结束"
	title.custom_minimum_size = Vector2(0, 40)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.add_theme_color_override("font_color", UiTokens.ink_color())
	card.add_child(title)
	var legacy_summary := VBoxContainer.new()
	legacy_summary.name = "SettlementLegacySummary"
	legacy_summary.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	legacy_summary.add_theme_constant_override("separation", 4)
	card.add_child(legacy_summary)
	_add_plain_line(legacy_summary, "跑局结算")
	_add_line(legacy_summary, "最终战绩", "%d 胜 / %d 负 · 第 %d 回合" % [int(run.get("wins", 0)), int(run.get("losses", 0)), int(run.get("round", 0))])
	_add_line(legacy_summary, "最终分数", str(int(run.get("score", _run_score(run)))))
	_add_line(legacy_summary, "资源", "金币 %d · 装备 %d · 遗物 %d" % [int(run.get("gold", 0)), _array(run, "items").size(), _array(run, "relics").size()])
	var score_grid := GridContainer.new()
	score_grid.name = "SettlementScoreGrid"
	score_grid.columns = 3
	score_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	score_grid.add_theme_constant_override("h_separation", 10)
	score_grid.add_theme_constant_override("v_separation", 10)
	card.add_child(score_grid)
	_add_settlement_metric(score_grid, "SettlementWins", "胜场", str(int(run.get("wins", 0))))
	_add_settlement_metric(score_grid, "SettlementLosses", "败场", str(int(run.get("losses", 0))))
	_add_settlement_metric(score_grid, "SettlementScore", "积分", str(int(run.get("score", _run_score(run)))))
	var settlement: Dictionary = _dict(run, "ladderSettlement")
	if not settlement.is_empty():
		_render_ladder_settlement_summary(card, settlement)
	var battle: Dictionary = _dict(run, "lastBattle")
	if not battle.is_empty():
		_render_battle_review_dashboard(card, battle)
	var return_button := _action_button("返回大厅", _switch_tab.bind(TAB_LOBBY))
	return_button.name = "ReturnLobbyButton"
	card.add_child(return_button)

func _add_settlement_metric(parent: GridContainer, node_name: String, label: String, value: String) -> void:
	var metric := VBoxContainer.new()
	metric.name = node_name
	metric.custom_minimum_size = Vector2(120, 74)
	metric.add_theme_constant_override("separation", 3)
	parent.add_child(metric)
	var label_node := Label.new()
	label_node.text = label
	label_node.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label_node.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label_node.custom_minimum_size = Vector2(0, 26)
	metric.add_child(label_node)
	var value_node := Label.new()
	value_node.text = value
	value_node.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	value_node.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	value_node.custom_minimum_size = Vector2(0, 36)
	metric.add_child(value_node)

func _render_ladder_settlement_summary(parent: VBoxContainer, settlement: Dictionary) -> void:
	var summary := VBoxContainer.new()
	summary.name = "LadderSettlementSummary"
	summary.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	summary.add_theme_constant_override("separation", 4)
	parent.add_child(summary)
	_add_line(summary, "天梯结算", "%s %d -> %s %d  %s" % [_tier_label(str(settlement.get("beforeTier", ""))), int(settlement.get("beforeScore", 0)), _tier_label(str(settlement.get("afterTier", ""))), int(settlement.get("afterScore", 0)), _signed_int(int(settlement.get("delta", 0)))])
	summary.add_child(_action_button("查看天梯结算详情", _show_ladder_settlement_modal.bind(settlement)))

func _render_battle_review_dashboard(parent: VBoxContainer, battle: Dictionary) -> void:
	var dashboard := VBoxContainer.new()
	dashboard.name = "BattleReviewDashboard"
	dashboard.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dashboard.add_theme_constant_override("separation", 8)
	parent.add_child(dashboard)
	_add_plain_line(dashboard, "战斗复盘")
	var side_grid := GridContainer.new()
	side_grid.name = "BattleReviewSideGrid"
	side_grid.columns = 2
	side_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	side_grid.add_theme_constant_override("h_separation", 10)
	dashboard.add_child(side_grid)
	_render_battle_review_side(side_grid, "BattleReviewPlayer", "我方", _battle_review_damage(battle, ["player", "PLAYER", "我方"]))
	_render_battle_review_side(side_grid, "BattleReviewOpponent", "对手", _battle_review_damage(battle, ["opponent", "OPPONENT", "对手"]))

func _render_battle_review_side(parent: GridContainer, node_name: String, label: String, damage: int) -> void:
	var card := VBoxContainer.new()
	card.name = node_name
	card.custom_minimum_size = Vector2(180, 86)
	card.add_theme_constant_override("separation", 4)
	parent.add_child(card)
	_add_plain_line(card, label)
	_add_line(card, "伤害", str(damage))

func _battle_review_damage(battle: Dictionary, side_aliases: Array) -> int:
	var total := 0
	for event in _array(battle, "events"):
		if not event is Dictionary:
			continue
		var side := str((event as Dictionary).get("side", ""))
		if side_aliases.has(side):
			total += int((event as Dictionary).get("amount", 0))
	return total

func _render_inventory_board(parent: VBoxContainer, run: Dictionary, include_toolbar: bool) -> void:
	parent.name = "InventoryBoard"
	if include_toolbar:
		var toolbar := HBoxContainer.new()
		toolbar.name = "InventoryToolbar"
		toolbar.add_theme_constant_override("separation", 8)
		parent.add_child(toolbar)
		toolbar.add_child(_action_button("查看选中详情", _show_selected_detail_modal))
		if _can_sell_item_action(run, selected_item_id):
			toolbar.add_child(_run_action_button("出售选中装备", _call_selected_item.bind("sell_item")))
		if _can_upgrade_item_action(run, selected_item_id):
			toolbar.add_child(_run_action_button("合成升级选中", _call_selected_item.bind("upgrade_item")))
		_add_line(parent, "当前选中", _fallback(selected_item_label, "无"))
	var equipment := VBoxContainer.new()
	equipment.name = "EquipmentBoard"
	equipment.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	equipment.add_theme_constant_override("separation", 6)
	parent.add_child(equipment)
	_render_item_grid(equipment, "装备栏", "EQUIPMENT", run, _equipment_slot_count(run))
	var relic_rail := VBoxContainer.new()
	relic_rail.name = "RelicRail"
	relic_rail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	relic_rail.add_theme_constant_override("separation", 6)
	parent.add_child(relic_rail)
	_render_relic_rail(relic_rail, run)
	var bag := VBoxContainer.new()
	bag.name = "BagBoard"
	bag.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bag.add_theme_constant_override("separation", 6)
	parent.add_child(bag)
	_render_item_grid(bag, "背包", "BAG", run, 12)
	if include_toolbar and not selected_relic_id.is_empty():
		parent.add_child(_run_action_button("出售选中遗物", _call_session.bind("sell_relic", [selected_relic_id])))

func _render_run_actions(run: Dictionary, card: VBoxContainer) -> void:
	var phase := str(run.get("phase", ""))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	card.add_child(row)
	if phase == "PREP":
		row.add_child(_action_button("匹配对手", _call_session.bind("match_battle", [])))
	elif phase == "MATCH":
		row.add_child(_action_button("开始战斗", _call_session.bind("start_battle", [])))
	elif phase == "BATTLE":
		row.add_child(_action_button("完成结算", _call_session.bind("finish_battle", [])))
	if str(run.get("status", "")) == "ACTIVE" and phase != "BATTLE":
		row.add_child(_action_button("放弃并结算", _show_forfeit_modal.bind(run)))

func _render_settlement_summary(run: Dictionary) -> void:
	if str(run.get("phase", "")) != "COMPLETE" and str(run.get("status", "")) != "COMPLETE":
		return
	var card := _section("跑局结算")
	_add_line(card, "最终战绩", "%d 胜 / %d 负 · 第 %d 回合" % [int(run.get("wins", 0)), int(run.get("losses", 0)), int(run.get("round", 0))])
	_add_line(card, "最终分数", str(int(run.get("score", _run_score(run)))))
	_add_line(card, "资源", "金币 %d · 装备 %d · 遗物 %d" % [int(run.get("gold", 0)), _array(run, "items").size(), _array(run, "relics").size()])
	var settlement: Dictionary = _dict(run, "ladderSettlement")
	if not settlement.is_empty():
		_add_line(card, "天梯结算", "%s %d -> %s %d  %s" % [_tier_label(str(settlement.get("beforeTier", ""))), int(settlement.get("beforeScore", 0)), _tier_label(str(settlement.get("afterTier", ""))), int(settlement.get("afterScore", 0)), _signed_int(int(settlement.get("delta", 0)))])
		card.add_child(_action_button("查看天梯结算详情", _show_ladder_settlement_modal.bind(settlement)))

func _run_score(run: Dictionary) -> int:
	return int(run.get("wins", 0)) * 100 - int(run.get("losses", 0)) * 20 + int(run.get("round", 0)) * 5 + int(run.get("gold", 0))

func _apex_rank_text(rank_value) -> String:
	if rank_value == null:
		return "未上榜"
	var rank := int(rank_value)
	return "未上榜" if rank <= 0 else "第 %d 名" % rank

func _render_reward_choices(run: Dictionary) -> void:
	var choices: Array = _array(run, "choices")
	var relics: Array = _array(run, "relicChoices")
	var classes: Array = _array(run, "classRewardChoices")
	var enchants: Array = _array(run, "enchantChoices")
	var potions: Array = _array(run, "potionChoices")
	if choices.is_empty() and relics.is_empty() and classes.is_empty() and enchants.is_empty() and potions.is_empty() and str(run.get("phase", "")) != "UPGRADE_CHOICE":
		return
	var card := _section("奖励 / 选择")
	if not choices.is_empty():
		_render_shop_choice_panel(card, choices)
	for relic in relics:
		if relic is Dictionary:
			var def: Dictionary = _dict(relic, "def")
			card.add_child(_action_button("查看遗物：%s" % _fallback(str(def.get("name", "")), str(relic.get("relicId", ""))), _show_relic_choice_modal.bind(relic)))
		else:
			card.add_child(_run_action_button("选择遗物：%s" % str(relic), _call_session.bind("select_relic", [str(relic)])))
	for item in classes:
		if item is Dictionary:
			var item_def: Dictionary = _dict(item, "def")
			card.add_child(_action_button("查看职业装备：%s" % _fallback(str(item_def.get("name", "")), str(item.get("defId", ""))), _show_class_reward_modal.bind(item)))
	for enchant in enchants:
		if enchant is Dictionary:
			card.add_child(_action_button("查看附魔：%s" % _enchant_choice_label(enchant), _show_enchant_choice_modal.bind(enchant)))
	for potion in potions:
		if potion is Dictionary:
			card.add_child(_action_button("查看药水：%s" % _potion_choice_label(potion), _show_potion_choice_modal.bind(potion)))
	if str(run.get("phase", "")) == "UPGRADE_CHOICE":
		if selected_item_id.is_empty():
			card.add_child(_disabled_action_button("先选中装备再升级"))
		else:
			card.add_child(_run_action_button("升级选中装备", _select_upgrade_item))
		card.add_child(_run_action_button("跳过升级", _call_session.bind("skip_upgrade_choice", [])))

func _render_shop_choice_panel(parent: VBoxContainer, choices: Array) -> void:
	_add_line(parent, "选择本回合要访问的商店", "不同商店提供不同类型的道具，选择适合你战术的商店")
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 8)
	parent.add_child(grid)
	for index in range(9):
		if index < choices.size():
			var shop_type := str(choices[index])
			var box := VBoxContainer.new()
			box.custom_minimum_size = Vector2(176, 126)
			box.add_theme_constant_override("separation", 4)
			grid.add_child(box)
			_add_line(box, _shop_choice_icon(shop_type) + " " + _shop_name(shop_type), _shop_description(shop_type))
			box.add_child(_run_action_button("进入 %s" % _shop_name(shop_type), _call_session.bind("select_shop_choice", [shop_type])))
		else:
			var placeholder := Label.new()
			placeholder.text = "空商店位 %d" % (index + 1)
			placeholder.custom_minimum_size = Vector2(176, 126)
			placeholder.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
			placeholder.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			grid.add_child(placeholder)

func _shop_name(shop_type: String) -> String:
	match shop_type:
		"GENERAL":
			return "装备店"
		"LARGE":
			return "大型装备店"
		"MEDIUM":
			return "中型装备店"
		"SMALL":
			return "小型装备店"
		"SMALL_DICE":
			return "小点数装备店"
		"BIG_DICE":
			return "大点数装备店"
		"RELIC":
			return "遗物店"
		"UPGRADE", "UPGRADE_SILVER":
			return "白银升级店"
		"UPGRADE_GOLD":
			return "黄金升级店"
		"UPGRADE_DIAMOND":
			return "钻石升级店"
		"POTION":
			return "药水店"
		_:
			return _fallback(shop_type, "商店")

func _shop_description(shop_type: String) -> String:
	match shop_type:
		"GENERAL":
			return "提供常规装备，适合补齐触发点和基础伤害。"
		"LARGE":
			return "更容易出现大型装备，适合围绕多格核心构筑。"
		"MEDIUM":
			return "偏向中型装备，兼顾站位和稳定收益。"
		"SMALL":
			return "偏向小型装备，方便填补空格和连锁触发。"
		"SMALL_DICE":
			return "偏向小点数触发装备，适合柴犬和低点连动。"
		"BIG_DICE":
			return "偏向大点数触发装备，适合萨摩耶和高点爆发。"
		"RELIC":
			return "选择一个遗物，改变长期构筑规则。"
		"UPGRADE", "UPGRADE_SILVER":
			return "免费升级至白银，适合强化早期核心装备。"
		"UPGRADE_GOLD":
			return "免费升级至黄金，适合把主力装备推到中后期强度。"
		"UPGRADE_DIAMOND":
			return "免费升级至钻石，让关键装备获得终阶收益。"
		"POTION":
			return "获得药水，给选中装备调整点数或强化触发。"
		_:
			return "进入该商店查看本回合可用内容。"

func _shop_choice_icon(shop_type: String) -> String:
	match shop_type:
		"RELIC":
			return "[遗]"
		"UPGRADE", "UPGRADE_SILVER", "UPGRADE_GOLD", "UPGRADE_DIAMOND":
			return "[升]"
		"POTION":
			return "[药]"
		"LARGE":
			return "[大]"
		"MEDIUM":
			return "[中]"
		"SMALL":
			return "[小]"
		"SMALL_DICE":
			return "[小点]"
		"BIG_DICE":
			return "[大点]"
		_:
			return "[装]"

func _ceremony_key(run: Dictionary) -> String:
	var phase := str(run.get("phase", ""))
	if phase != "CLASS_REWARD" and phase != "ENCHANT_CHOICE":
		return ""
	var run_id := str(run.get("id", ""))
	if run_id.is_empty():
		run_id = str(run.get("mode", "run"))
	return "%s:%s:%d" % [run_id, phase, int(run.get("round", 0))]

func _maybe_show_reward_ceremony(run: Dictionary) -> void:
	var key := _ceremony_key(run)
	if key.is_empty() or dismissed_ceremonies.has(key):
		return
	if _modal_stack() == null:
		return
	var phase := str(run.get("phase", ""))
	if phase == "CLASS_REWARD" and _array(run, "classRewardChoices").is_empty():
		return
	if phase == "ENCHANT_CHOICE" and _array(run, "enchantChoices").is_empty():
		return
	dismissed_ceremonies[key] = true
	_show_reward_ceremony(run)

func _show_reward_ceremony(run: Dictionary) -> void:
	var phase := str(run.get("phase", ""))
	var is_enchant := phase == "ENCHANT_CHOICE"
	var round := int(run.get("round", 0))
	var title := "免费附魔" if is_enchant else ("终阶觉醒" if round >= 6 else "职业觉醒")
	var modal := _modal_panel(title, Vector2(620, 520))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	if is_enchant:
		_render_detail_header(box, _texture("res://assets/map-icons/event.webp"), "神秘附魔商店", "第 %d 回合 路 免费附魔" % round)
		_add_line(box, "说明", "选择一种附魔，再点击任意装备施加；升级后会保留目标装备上的附魔。")
		_add_ceremony_enchant_preview(box, _array(run, "enchantChoices"))
	else:
		var dog_type := str(run.get("dogType", ""))
		var dog_label := _dog_name(dog_type)
		_render_detail_header(box, _dog_texture(dog_type), title, "第 %d 回合 路 %s 专属装备授予" % [round, dog_label])
		if round >= 6:
			_add_line(box, "说明", "终阶职业装备已经解锁，构筑的核心能力将在这一回合定型。")
		else:
			_add_line(box, "说明", "职业路线开始成型，选择一件专属装备改变接下来的战斗节奏。")
		_add_ceremony_class_preview(box, _array(run, "classRewardChoices"))
	box.add_child(_action_button("点击继续", _close_top_modal))
	_push_modal(modal["panel"])

func _add_ceremony_class_preview(parent: VBoxContainer, choices: Array) -> void:
	_add_line(parent, "本次可选职业装备", "")
	for choice in choices:
		if choice is Dictionary:
			var def: Dictionary = _dict(choice, "def")
			var name := _fallback(str(def.get("name", "")), str(choice.get("defId", "")))
			var size_text := _detail_size_text(def)
			var dice_text := _detail_array_text(def.get("triggerDice", def.get("dice", [])))
			var detail := "%s格" % size_text if not size_text.is_empty() else "尺寸待同步"
			if not dice_text.is_empty():
				detail += " 路 触发 %s" % dice_text
			_add_line(parent, name, detail)

func _add_ceremony_enchant_preview(parent: VBoxContainer, choices: Array) -> void:
	_add_line(parent, "本次可选附魔", "")
	for choice in choices:
		if choice is Dictionary:
			var enchant: Dictionary = _dict(choice, "enchant")
			var label := _fallback(str(enchant.get("label", "")), str(choice.get("id", "")))
			_add_line(parent, label, str(choice.get("description", "")))

func _render_inventory(run: Dictionary) -> void:
	var card := _section("装备 / 背包 / 遗物")
	var toolbar := HBoxContainer.new()
	toolbar.add_theme_constant_override("separation", 8)
	card.add_child(toolbar)
	toolbar.add_child(_action_button("查看选中详情", _show_selected_detail_modal))
	if _can_sell_item_action(run, selected_item_id):
		toolbar.add_child(_run_action_button("出售选中装备", _call_selected_item.bind("sell_item")))
	if _can_upgrade_item_action(run, selected_item_id):
		toolbar.add_child(_run_action_button("合成升级选中", _call_selected_item.bind("upgrade_item")))
	_add_line(card, "当前选中", _fallback(selected_item_label, "无"))
	_render_item_grid(card, "装备栏", "EQUIPMENT", run, _equipment_slot_count(run))
	_render_relic_rail(card, run)
	_render_item_grid(card, "背包", "BAG", run, 12)
	if not selected_relic_id.is_empty():
		card.add_child(_run_action_button("出售选中遗物", _call_session.bind("sell_relic", [selected_relic_id])))

func _render_map_or_shop_detail(run: Dictionary) -> void:
	var phase := str(run.get("phase", ""))
	if phase == "MAP":
		_render_map_or_shop(run)
		return
	if phase != "SHOP":
		return
	var shop_card := _section("跑局商店")
	var shop_type := str(run.get("shopType", "GENERAL"))
	_add_line(shop_card, _shop_name(shop_type), _shop_description(shop_type))
	shop_card.add_child(_run_action_button("刷新 %d 金币" % int(run.get("refreshCost", 0)), _call_session.bind("reroll_shop", [])))
	shop_card.add_child(_shop_progression_button(run))
	_add_line(shop_card, "提示", "点击商品查看详情，确认后再购买。")
	for offer in _array(run, "shopItems"):
		if offer is Dictionary:
			_render_shop_offer_card(shop_card, run, offer)

func _shop_progression_button(run: Dictionary) -> Button:
	var map_state: Dictionary = _dict(run, "mapState")
	var current_node := _map_current_node(map_state)
	if not current_node.is_empty():
		var label := "进入战斗" if str(current_node.get("kind", "")) == "PLAYER_BATTLE" else "返回地图"
		return _run_action_button(label, _call_session.bind("complete_map_node", []))
	return _run_action_button("匹配对手", _call_session.bind("match_battle", []))

func _render_shop_offer_card(parent: VBoxContainer, run: Dictionary, offer: Dictionary) -> void:
	var def: Dictionary = _dict(offer, "def")
	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(0, 118)
	box.add_theme_constant_override("separation", 4)
	parent.add_child(box)
	var header := _action_button("%s  %s格" % [_offer_label(offer), _detail_size_text(def)], _show_offer_modal.bind(offer))
	_apply_button_icon(header, _offer_texture(offer))
	box.add_child(header)
	var owned_count := _shop_offer_owned_count(run, offer)
	if owned_count > 0:
		_add_plain_line(box, "已拥有 x%d" % owned_count)
	_add_plain_line(box, "价格 %s" % _shop_offer_price_text(offer))
	var missing_gold := int(offer.get("price", 0)) - int(run.get("gold", 0))
	if missing_gold > 0:
		_add_plain_line(box, "金币不足，还差 %d 金币" % missing_gold)
	var trigger := _map_preview_trigger_text(offer)
	if not trigger.is_empty():
		_add_line(box, "触发点数", trigger)
	var description := _fallback(str(def.get("description", "")), str(offer.get("description", "")))
	if not description.is_empty():
		_add_line(box, "效果", description)

func _shop_offer_owned_count(run: Dictionary, offer: Dictionary) -> int:
	var def_id := str(offer.get("defId", ""))
	if def_id.is_empty():
		return 0
	var count := 0
	for item in _array(run, "items"):
		if item is Dictionary and str(item.get("defId", "")) == def_id:
			count += 1
	return count

func _shop_offer_price_text(offer: Dictionary) -> String:
	var text := "%d" % int(offer.get("price", 0))
	var discount := float(offer.get("discount", 1.0))
	if discount > 0.0 and discount < 1.0:
		text += " · %d折" % int(round(discount * 10.0))
	return text

func _render_map_or_shop(run: Dictionary) -> void:
	var phase := str(run.get("phase", ""))
	if phase == "MAP":
		var card := _section("探索地图")
		var map_state: Dictionary = _dict(run, "mapState")
		_add_line(card, "当前节点", str(map_state.get("currentNodeId", "无")))
		_render_map_route(card, map_state)
		var current_node := _map_current_node(map_state)
		if str(current_node.get("kind", "")) == "EVENT" and not _dict(current_node, "event").is_empty():
			card.add_child(_run_action_button("处理事件", _call_session.bind("resolve_map_event", [])))
		if not _dict(map_state, "pendingReward").is_empty():
			card.add_child(_run_action_button("领取怪物奖励", _call_session.bind("claim_monster_reward", [])))
			card.add_child(_run_action_button("跳过怪物奖励", _call_session.bind("skip_monster_reward", [])))
	else:
		var shop_card := _section("跑局商店")
		_add_line(shop_card, "类型 / 刷新费", "%s / %d" % [_shop_name(str(run.get("shopType", ""))), int(run.get("refreshCost", 0))])
		shop_card.add_child(_run_action_button("刷新跑局商店", _call_session.bind("reroll_shop", [])))
		for offer in _array(run, "shopItems"):
			if offer is Dictionary:
				var offer_button := _action_button("%s  价格 %d" % [_offer_label(offer), int(offer.get("price", 0))], _show_offer_modal.bind(offer))
				_apply_button_icon(offer_button, _offer_texture(offer))
				shop_card.add_child(offer_button)

func _render_achievements_tab() -> void:
	_render_daily_tasks_section("每日任务")
	var card := _section("成就与每日任务")
	var wallet: Dictionary = _dict(achievements_data, "wallet")
	_add_line(card, "长期目标", "余额 %d / 今日获得 %d" % [int(wallet.get("balance", 0)), int(wallet.get("dailyEarned", 0))])
	_add_line(card, "分类", _achievement_category_summary(_array(achievements_data, "achievements")))
	for achievement in _array(achievements_data, "achievements"):
		if achievement is Dictionary:
			card.add_child(_action_button(_achievement_button_label(achievement), _show_achievement_modal.bind(achievement)))

func _render_daily_tab() -> void:
	_render_daily_tasks_section("每日任务")

func _render_daily_tasks_section(title: String) -> void:
	var card := _section(title)
	var wallet: Dictionary = _dict(daily_data, "wallet")
	_add_line(card, "日期 / 钱包", "%s · 余额 %d" % [str(daily_data.get("dateKey", "")), int(wallet.get("balance", 0))])
	var refresh_used := bool(daily_data.get("refreshUsed", false))
	var refresh_button := _action_button("今日已刷新" if refresh_used else "刷新每日任务", _refresh_daily)
	refresh_button.disabled = refresh_button.disabled or refresh_used
	card.add_child(refresh_button)
	for task in _array(daily_data, "tasks"):
		if task is Dictionary:
			var def: Dictionary = _dict(task, "def")
			var text := "%s  %d/%d  奖励 %d" % [_fallback(str(def.get("title", "")), str(task.get("taskId", ""))), int(task.get("progress", 0)), int(task.get("target", 0)), _reward_amount(task, def)]
			var ready := int(task.get("progress", 0)) >= int(task.get("target", 0))
			var claimed := not str(task.get("claimedAt", "")).is_empty()
			if claimed:
				card.add_child(_action_button("已领取 " + text, _show_daily_task_modal.bind(task)))
			elif ready:
				card.add_child(_action_button("可领取 " + text, _show_daily_task_modal.bind(task)))
			else:
				card.add_child(_action_button("未完成 " + text, _show_daily_task_modal.bind(task)))

func _render_shop_tab() -> void:
	var card := _section("账号商城 / 外观")
	var wallet: Dictionary = _dict(meta_shop_data, "wallet")
	_add_line(card, "钱包", "余额 %d / 今日获得 %d" % [int(wallet.get("balance", 0)), int(wallet.get("dailyEarned", 0))])
	var sections: Dictionary = _dict(meta_shop_data, "sections")
	for section_name in ["permanent", "featured"]:
		_add_line(card, _shop_catalog_section_label(section_name), "")
		for item in _array(sections, section_name):
			if item is Dictionary:
				card.add_child(_action_button(_shop_catalog_button_label(item), _show_cosmetic_modal.bind(item)))

func _render_leaderboards_tab() -> void:
	var ladder_card := _section("天梯排行榜")
	var player_profile: Dictionary = _dict(leaderboard_data, "playerProfile")
	_add_line(ladder_card, "当前段位", "%d 局 · %d胜 %d负" % [int(player_profile.get("gamesPlayed", 0)), int(player_profile.get("totalWins", 0)), int(player_profile.get("totalLosses", 0))])
	_add_line(ladder_card, _tier_display_label(player_profile), "%d分" % int(player_profile.get("score", 0)))
	_add_line(ladder_card, "积分进度", _ladder_score_text(player_profile))
	var player_rank = leaderboard_data.get("playerRank", null)
	_add_line(ladder_card, "犬王积分榜", "你的犬王排名：第 %d 名" % int(player_rank) if player_rank != null else "进入犬王后参与排名")
	var leaderboard := _array(leaderboard_data, "leaderboard")
	if leaderboard.is_empty():
		_add_line(ladder_card, "榜单", "还没有犬王，先冲上大师 500 分。")
	for entry in leaderboard:
		if entry is Dictionary:
			var entry_profile: Dictionary = _dict(entry, "profile")
			_add_line(ladder_card, "#%d" % int(entry.get("rank", 0)), "%s  %s  %d" % [str(entry.get("title", "")), str(entry.get("name", "")), int(entry_profile.get("score", 0))])
	var ladder_start := _section("选择天梯狗狗")
	if _current_run_mode() == "LADDER":
		_add_line(ladder_start, "当前天梯", "已有进行中的天梯跑局，继续当前跑局后再结算积分。")
		var continue_ladder_button := _action_button("继续天梯模式", _switch_tab.bind(TAB_RUN))
		continue_ladder_button.name = "ContinueLadderRunButton"
		ladder_start.add_child(continue_ladder_button)
	else:
		_add_line(ladder_start, "说明", "开始天梯会进入独立匹配池，并按整局表现结算。")
		_render_dog_picker(ladder_start)
		var start_ladder_button := _action_button("开始天梯", _start_ladder_run)
		start_ladder_button.name = "StartLadderRunButton"
		ladder_start.add_child(start_ladder_button)
func _render_apex_tab() -> void:
	var apex_card := _section("巅峰竞技场")
	var season: Dictionary = _dict(apex_data, "season")
	_add_line(apex_card, "巅峰赛季", str(season.get("name", "读取中")))
	_add_line(apex_card, "说明", "保存战斗结束后的死数据，自动从榜尾向上挑战，失败后固定在当前名次。")
	var leaderboards: Dictionary = _dict(apex_data, "leaderboards")
	var reports: Dictionary = _dict(apex_data, "reports")
	var submitted_entries: Dictionary = _dict(apex_data, "entries")
	var submitted_overall: Dictionary = _dict(submitted_entries, "overall")
	if not submitted_overall.is_empty() and not reports.is_empty():
		_add_line(apex_card, "提交结果", "%s 已投入巅峰榜" % str(submitted_overall.get("name", "巅峰记录")))
		_add_line(apex_card, "排名", "总榜%s，当日榜%s。新记录防守连胜从 %d 开始" % [_apex_rank_text(_dict(reports, "overall").get("placementRank", null)), _apex_rank_text(_dict(reports, "daily").get("placementRank", null)), int(submitted_overall.get("challengeWins", 0))])
	var candidates := _array(apex_data, "candidates")
	_add_line(apex_card, "可提交完成局", str(candidates.size()) if not candidates.is_empty() else "先在休闲模式完成一局，再回来冲榜。")
	for candidate in candidates:
		if candidate is Dictionary:
			var run_id := str(candidate.get("id", ""))
			var candidate_text := _apex_run_summary_label(candidate)
			apex_card.add_child(_action_button("提交巅峰 " + candidate_text, _submit_apex_candidate.bind(run_id)))
	for board_name in ["overall", "daily"]:
		if board_name == "daily":
			_add_line(apex_card, "当日榜", "每日 %02d:00 更新 · %s" % [int(apex_data.get("dailyResetHour", 5)), str(apex_data.get("dailyBoardKey", ""))])
		else:
			_add_line(apex_card, "总榜", "初始种子会随玩家提交逐步下移")
		for entry in _array(leaderboards, board_name).slice(0, 20):
			if entry is Dictionary:
				var marker := "我的记录" if bool(entry.get("isMine", false)) else ("种子" if bool(entry.get("isSeed", false)) else "防守连胜 %d" % int(entry.get("challengeWins", 0)))
				var entry_label := "查看配置  #%s  %s  %s  %s" % [str(entry.get("rank", "-")), str(entry.get("name", "")), _apex_run_summary_label(entry), marker]
				apex_card.add_child(_action_button(entry_label, _show_snapshot_modal.bind(entry, "巅峰配置详情")))

func _render_season_tab() -> void:
	var card := _section("赛季")
	var season: Dictionary = _dict(ladder_data, "season")
	var profile: Dictionary = _dict(ladder_data, "profile")
	_add_line(card, "当前赛季", "%s  %s - %s" % [str(season.get("name", season.get("id", ""))), str(season.get("startsAt", "")), str(season.get("endsAt", ""))])
	_add_line(card, "我的天梯", "%s  %d分  胜负 %d/%d" % [_tier_display_label(profile), int(profile.get("score", 0)), int(profile.get("wins", 0)), int(profile.get("losses", 0))])
	for settlement in _array(ladder_data, "recentSettlements"):
		if settlement is Dictionary:
			card.add_child(_action_button("结算 %s -> %s  %+d" % [_tier_label(str(settlement.get("beforeTier", ""))), _tier_label(str(settlement.get("afterTier", ""))), int(settlement.get("delta", 0))], _show_ladder_settlement_modal.bind(settlement)))
	var summaries := _array(history_data, "seasonSummaries")
	_add_line(card, "赛季历史", "%d 个已结束赛季" % summaries.size() if summaries.size() > 0 else "赛季结束后会保存在这里")
	if summaries.is_empty():
		_add_line(card, "暂无赛季历史", "")
	for summary in summaries:
		if summary is Dictionary:
			card.add_child(_action_button(_season_summary_button_label(summary), _show_season_summary_modal.bind(summary)))
			var snapshot: Dictionary = _dict(summary, "apexSnapshot")
			if not snapshot.is_empty():
				card.add_child(_action_button("巅峰配置快照", _show_snapshot_modal.bind(snapshot, "赛季巅峰快照")))

func _render_rooms_tab() -> void:
	var card := _section("多人房间")
	var room_toolbar := HBoxContainer.new()
	room_toolbar.add_theme_constant_override("separation", 8)
	card.add_child(room_toolbar)
	room_toolbar.add_child(_action_button("创建房间", _create_room))
	room_toolbar.add_child(_action_button("随机匹配", _match_room))
	room_toolbar.add_child(_action_button("刷新房间", _refresh_rooms))
	_add_line(card, "说明", "玩家席位先进入房间，开局后统一选择斗狗；不足 8 人由机器人补齐。")
	if not active_room.is_empty():
		var detail := _section("当前房间")
		_add_line(detail, "状态", _room_summary_label(active_room))
		detail.add_child(_action_button("离开房间", _leave_active_room))
		if _can_start_room_action(active_room):
			detail.add_child(_action_button("开始房间", _room_action.bind("start", {})))
		if _can_ready_room_action(active_room):
			detail.add_child(_action_button("准备 / 完成本回合", _room_action.bind("ready", {})))
		var current_battle_id := _current_room_battle_id(active_room)
		if not current_battle_id.is_empty():
			detail.add_child(_action_button("载入当前战报", _load_room_battle.bind(current_battle_id)))
		for member in _array(active_room, "members"):
			if member is Dictionary:
				var member_name := str(member.get("nickname", member.get("kind", "")))
				var member_kind := _room_member_kind_label(str(member.get("kind", "")))
				var host_mark := " · 房主" if bool(member.get("isHost", false)) else ""
				detail.add_child(_action_button("%s  %s%s  %d-%d  %s" % [member_name, member_kind, host_mark, int(member.get("wins", 0)), int(member.get("losses", 0)), _room_member_status(member)], _show_room_member_modal.bind(member)))
		for battle in _array(active_room, "battles"):
			if battle is Dictionary:
				detail.add_child(_action_button("战报摘要 第%d回合 %s" % [int(battle.get("round", 0)), str(battle.get("id", ""))], _show_room_battle_modal.bind(battle)))
		var room_run: Dictionary = _dict(active_room, "currentRun")
		if not room_run.is_empty():
			_render_room_current_run(room_run)
		elif str(active_room.get("phase", "")) == "DOG_SELECT":
			_render_room_dog_select()
	_add_line(card, "房间列表", "")
	for room in _array(rooms_data, "rooms"):
		if room is Dictionary:
			var room_id := str(room.get("id", ""))
			var text := "%s 的房间  %s  真人 %d/%d  存活 %d/%d  %s" % [str(room.get("hostName", "")), _room_summary_label(room), int(room.get("memberCount", 0)), int(room.get("maxPlayers", 0)), int(room.get("aliveCount", 0)), int(room.get("targetPlayerCount", 0)), _room_list_action_label(room)]
			card.add_child(_action_button(text, _enter_or_view_room.bind(room_id, str(room.get("status", "")))))

func _render_room_dog_select() -> void:
	var card := _section("选择斗狗")
	_add_line(card, "说明", "15 秒内锁定狗狗；超时会自动随机。")
	_render_dog_picker(card)
	var choice_button := _action_button("锁定斗狗", _choose_room_dog)
	choice_button.name = "RoomDogChoiceButton"
	card.add_child(choice_button)

func _render_room_current_run(run: Dictionary) -> void:
	var card := _section("房间当前跑局")
	_add_line(card, "阶段", "%s / %s" % [_room_phase_label(str(run.get("phase", ""))), _room_status_label(str(run.get("status", "")))])
	_add_line(card, "犬种", "%s  幸运号 %s" % [_dog_name(str(run.get("dogType", ""))), str(run.get("luckyNumber", "-"))])
	_add_line(card, "进度", "第 %d 回合 · %d 胜 %d 负 · 金币 %d" % [int(run.get("round", 0)), int(run.get("wins", 0)), int(run.get("losses", 0)), int(run.get("gold", 0))])
	_render_reward_choices(run)
	_render_inventory(run)
	_render_map_or_shop_detail(run)

func _render_settings_tab() -> void:
	var card := _section("个人设置 / 时装展示")
	var equipped := _array(cosmetics_data, "equipped")
	if equipped.is_empty():
		_add_line(card, "当前外观", "全部使用默认外观")
	else:
		for entry in equipped:
			if entry is Dictionary:
				var cosmetic_type := str(entry.get("slot", entry.get("cosmeticType", _cosmetic_type(entry))))
				_add_line(card, _cosmetic_type_label(cosmetic_type), "%s · 已装备" % _cosmetic_display_name(entry))
	card.add_child(_action_button("音乐：" + ("开" if music_player != null and music_player.playing else "关"), _toggle_music))
	card.add_child(_action_button("刷新个人外观", _refresh_cosmetics))
	var groups := _section("按类型选择外观")
	for cosmetic_type in ["TITLE", "AVATAR", "BACKGROUND", "DOG_SKIN", "BATTLE_EFFECT"]:
		var cosmetic_label := _cosmetic_type_label(cosmetic_type)
		_add_line(groups, cosmetic_label, "默认外观可直接恢复")
		if _is_default_cosmetic_equipped(cosmetic_type):
			groups.add_child(_disabled_action_button("已选择 默认 " + cosmetic_label))
		else:
			groups.add_child(_action_button("选择默认 " + cosmetic_label, _unequip_cosmetic.bind(cosmetic_type)))
		for item in _array(cosmetics_data, "inventory"):
			if item is Dictionary and _cosmetic_type(item) == cosmetic_type:
				groups.add_child(_action_button(("%s %s" % ["已装备" if _is_cosmetic_equipped(item) else "查看", _cosmetic_display_name(item)]), _show_cosmetic_modal.bind(item)))

func _on_create_run_pressed() -> void:
	var dog_type := _selected_dog_type()
	var mode := _selected_mode()
	var lucky: Variant = null
	if dog_type == "EMPEROR":
		if lucky_select.selected <= 0:
			lucky_select.select(1)
		lucky = lucky_select.selected
	var ok: bool = await _call_session("create_run", [dog_type, mode, lucky])
	if ok:
		current_tab = TAB_RUN
		_render_shell()

func _on_history_run_pressed(run_id: String) -> void:
	if run_id.is_empty():
		return
	var ok: bool = await _call_session("load_run", [run_id])
	if not ok:
		return
	current_tab = TAB_RUN
	_render_shell()

func open_mode_lobby() -> void:
	if action_in_progress:
		return
	if session != null and session.has_method("open_screen"):
		session.call("open_screen", "mode_lobby")

func _on_tab_pressed(tab: String) -> void:
	if action_in_progress:
		return
	current_tab = tab
	_render_shell()
	call_deferred("_refresh_current_section")

func _switch_tab(tab: String) -> void:
	if action_in_progress:
		return
	current_tab = tab
	_render_shell()
	call_deferred("_refresh_current_section")

func _current_run_mode() -> String:
	var store: Object = _run_store()
	if store == null or not store.has_method("has_run") or not store.has_run():
		return ""
	var run: Dictionary = store.get("run")
	return str(run.get("mode", ""))

func _start_mode(mode: String) -> void:
	for index in range(mode_select.item_count):
		if str(mode_select.get_item_metadata(index)) == mode:
			mode_select.select(index)
			break
	if _current_run_mode() == mode:
		current_tab = TAB_RUN
		_render_shell()
		return
	if mode == "LADDER":
		_switch_tab(TAB_LEADERBOARDS)
		return
	current_tab = TAB_RUN
	_render_shell()
	call_deferred("_refresh_current_section")

func _start_ladder_run() -> void:
	for index in range(mode_select.item_count):
		if str(mode_select.get_item_metadata(index)) == "LADDER":
			mode_select.select(index)
			break
	current_tab = TAB_RUN
	await _on_create_run_pressed()

func _render_dog_picker(parent: VBoxContainer) -> void:
	var screen := VBoxContainer.new()
	screen.name = "DogSelectScreen"
	screen.add_theme_constant_override("separation", 14)
	screen.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(screen)

	var heading := VBoxContainer.new()
	heading.name = "ScreenHeading"
	heading.add_theme_constant_override("separation", 4)
	screen.add_child(heading)
	var title := Label.new()
	title.text = "选择你的狗狗伙伴"
	title.custom_minimum_size = Vector2(0, 32)
	heading.add_child(title)
	var subtitle := Label.new()
	subtitle.text = "每个狗狗都有独特的被动特性和策略玩法"
	subtitle.custom_minimum_size = Vector2(0, 28)
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	heading.add_child(subtitle)

	var dog_select := HBoxContainer.new()
	dog_select.name = "DogSelect"
	dog_select.add_theme_constant_override("separation", 18)
	dog_select.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	screen.add_child(dog_select)

	var dog_grid := GridContainer.new()
	dog_grid.name = "DogCardGrid"
	dog_grid.columns = 4
	dog_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dog_grid.add_theme_constant_override("h_separation", 12)
	dog_grid.add_theme_constant_override("v_separation", 12)
	dog_select.add_child(dog_grid)
	for dog_type in DOG_TYPES:
		dog_grid.add_child(_dog_card_button(dog_type))

	_render_dog_detail_panel(dog_select)

func _dog_card_button(dog_type: String) -> Button:
	var selected: bool = _selected_dog_type() == dog_type
	var label := "%s\n%s\n%s" % [_dog_name(dog_type), str(DOG_TRAITS.get(dog_type, "")), " / ".join(_dog_tags(dog_type))]
	var button := _button(label, 0)
	button.name = "DogCard_%s" % dog_type
	button.custom_minimum_size = Vector2(140, 150)
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button.toggle_mode = true
	button.button_pressed = selected
	_apply_button_icon(button, _dog_texture(dog_type))
	button.pressed.connect(_select_dog_type.bind(dog_type))
	return button

func _render_dog_detail_panel(parent: Node) -> void:
	var dog_type := _selected_dog_type()
	var panel := PanelContainer.new()
	panel.name = "DogDetailPanel"
	panel.custom_minimum_size = Vector2(360, 0)
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", UiTokens.paper_panel_style())
	parent.add_child(panel)

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	panel.add_child(box)

	var art := TextureRect.new()
	art.name = "DogDetailArt"
	art.custom_minimum_size = Vector2(0, 120)
	art.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	art.texture = _dog_texture(dog_type)
	box.add_child(art)

	var title := Label.new()
	title.name = "DogDetailName"
	title.text = _dog_name(dog_type)
	title.custom_minimum_size = Vector2(0, 32)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)

	_add_detail_box(box, "被动特性", str(DOG_TRAITS.get(dog_type, "")))
	_add_detail_box(box, "策略说明", str(DOG_STRATEGIES.get(dog_type, "")))

	var tags := Label.new()
	tags.name = "DogTagRow"
	tags.text = " / ".join(_dog_tags(dog_type))
	tags.custom_minimum_size = Vector2(0, 28)
	tags.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(tags)

	if dog_type == "EMPEROR":
		var lucky := HBoxContainer.new()
		lucky.name = "LuckyNumberPicker"
		lucky.add_theme_constant_override("separation", 6)
		box.add_child(lucky)
		for number in range(1, 7):
			var button := _button(str(number), 36)
			button.name = "LuckyNumber%d" % number
			button.toggle_mode = true
			button.button_pressed = lucky_select != null and lucky_select.selected == number
			button.pressed.connect(_select_lucky_number.bind(number))
			lucky.add_child(button)

	var start := _action_button("开始一局", _on_create_run_pressed)
	start.name = "StartRunButton"
	start.custom_minimum_size = Vector2(0, 44)
	box.add_child(start)

func _add_detail_box(parent: Node, title_text: String, body_text: String) -> void:
	var box := VBoxContainer.new()
	box.name = "DetailBox"
	box.add_theme_constant_override("separation", 4)
	parent.add_child(box)
	var title := Label.new()
	title.text = title_text
	title.custom_minimum_size = Vector2(0, 24)
	box.add_child(title)
	var body := Label.new()
	body.text = body_text
	body.custom_minimum_size = Vector2(0, 44)
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(body)

func _dog_tags(dog_type: String) -> Array:
	var tags = DOG_TAGS.get(dog_type, [])
	return tags if tags is Array else []

func _select_lucky_number(number: int) -> void:
	if lucky_select != null:
		lucky_select.select(number)
	_render_shell()

func _select_dog_type(dog_type: String) -> void:
	for index in range(dog_type_select.item_count):
		if str(dog_type_select.get_item_metadata(index)) == dog_type:
			dog_type_select.select(index)
			break
	if dog_type == "EMPEROR" and lucky_select.selected <= 0:
		lucky_select.select(1)
	_render_shell()

func _dog_name(dog_type: String) -> String:
	return str(DOG_NAMES.get(dog_type, dog_type))

func _mode_name(mode: String) -> String:
	return str(MODE_NAMES.get(mode, mode))

func _quality_label(quality: String) -> String:
	return str(QUALITY_NAMES.get(quality, quality))

func _selected_dog_type() -> String:
	if dog_type_select == null or dog_type_select.item_count == 0:
		return DOG_TYPES[0]
	var metadata = dog_type_select.get_item_metadata(dog_type_select.selected)
	if metadata != null:
		return str(metadata)
	return str(dog_type_select.get_item_text(dog_type_select.selected))

func _selected_mode() -> String:
	if mode_select == null or mode_select.item_count == 0:
		return "CASUAL"
	var metadata = mode_select.get_item_metadata(mode_select.selected)
	if metadata != null:
		return str(metadata)
	return str(mode_select.get_item_text(mode_select.selected))

func _dog_texture(dog_type: String) -> Texture2D:
	if dog_type == "FROG":
		return _texture("res://assets/dogs/zuling.jpg")
	return _texture("res://assets/dogs/%s.webp" % dog_type.to_lower())

func _on_run_changed(_run: Dictionary) -> void:
	_render_current_tab()

func _on_user_changed(_user: Dictionary) -> void:
	tutorial_auto_checked_for_user = ""
	call_deferred("_refresh_all")

func _on_error_raised(message: String) -> void:
	status_label.text = message

func _call_session(method: String, args: Array) -> bool:
	if action_in_progress or session == null or not session.has_method(method):
		return false
	if _room_run_method_locked(method):
		_show_error("本回合已完成，等待房间进入下一阶段。")
		return false
	action_in_progress = true
	_update_controls()
	var ok: bool = await session.callv(method, args)
	if ok and method != "logout":
		await _refresh_after_action()
	action_in_progress = false
	_update_controls()
	if ok and method != "logout":
		_render_shell()
	return ok

func _refresh_after_action() -> void:
	await _fetch_into("me", ApiRoutes.me())
	await _fetch_into("history", ApiRoutes.runs_history())
	if current_tab == TAB_ACHIEVEMENTS:
		await _fetch_into("achievements", ApiRoutes.achievements())
		await _fetch_into("daily", ApiRoutes.daily_tasks())
	elif current_tab == TAB_DAILY:
		await _fetch_into("daily", ApiRoutes.daily_tasks())
	elif current_tab == TAB_ROOMS:
		await _refresh_active_room()
	_render_shell()

func _refresh_current_section() -> void:
	if action_in_progress or session == null:
		return
	action_in_progress = true
	_update_controls()
	match current_tab:
		TAB_ACCOUNT:
			await _fetch_into("me", ApiRoutes.me())
			await _fetch_into("history", ApiRoutes.runs_history())
		TAB_ACHIEVEMENTS:
			await _fetch_into("achievements", ApiRoutes.achievements())
			await _fetch_into("daily", ApiRoutes.daily_tasks())
		TAB_DAILY:
			await _fetch_into("daily", ApiRoutes.daily_tasks())
		TAB_SHOP:
			await _fetch_into("shop", ApiRoutes.shop())
			await _fetch_into("cosmetics", ApiRoutes.cosmetics_me())
		TAB_LEADERBOARDS:
			await _fetch_into("ladder", ApiRoutes.ladder_me())
			await _fetch_into("leaderboard", ApiRoutes.ladder_leaderboard())
		TAB_APEX:
			await _fetch_into("apex", ApiRoutes.apex())
		TAB_SEASON:
			await _fetch_into("ladder", ApiRoutes.ladder_me())
			await _fetch_into("history", ApiRoutes.runs_history())
		TAB_ROOMS:
			await _refresh_active_room()
		TAB_SETTINGS:
			await _fetch_into("cosmetics", ApiRoutes.cosmetics_me())
	action_in_progress = false
	_update_controls()
	_render_shell()

func _claim_achievement(achievement_id: String) -> void:
	await _post_and_store(ApiRoutes.achievement_claim(achievement_id), {}, "achievements", "claim_achievement")

func _refresh_daily() -> void:
	await _post_and_store(ApiRoutes.daily_tasks_refresh(), {}, "daily", "refresh_daily")

func _claim_daily(task_id: String) -> void:
	await _post_and_store(ApiRoutes.daily_task_claim(task_id), {}, "daily", "claim_daily")

func _save_nickname(input: LineEdit) -> void:
	await _call_session("update_nickname", [input.text])

func _show_nickname_setup_modal() -> void:
	if nickname_setup_modal_open:
		return
	var modal := _modal_panel("设置昵称", Vector2(500, 340), false)
	if modal.is_empty():
		return
	nickname_setup_modal_open = true
	var panel: PanelContainer = modal["panel"]
	panel.tree_exited.connect(func() -> void:
		nickname_setup_modal_open = false
	)
	var box: VBoxContainer = modal["box"]
	var intro := Label.new()
	intro.text = "第一次进入需要设置 2-16 字昵称"
	intro.custom_minimum_size = Vector2(0, 40)
	intro.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(intro)
	var input := LineEdit.new()
	input.placeholder_text = "输入 2-16 字昵称"
	input.max_length = 16
	input.custom_minimum_size = Vector2(300, 42)
	input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_apply_input_style(input)
	box.add_child(input)
	var hint := Label.new()
	hint.text = "昵称会显示在排行榜、多人房间和战报中。"
	hint.custom_minimum_size = Vector2(0, 48)
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(hint)
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 8)
	box.add_child(actions)
	var save := _action_button("保存昵称", _submit_nickname_setup.bind(input))
	save.custom_minimum_size = Vector2(160, 42)
	actions.add_child(save)
	var logout := _action_button("退出登录", _logout_from_nickname_setup)
	logout.custom_minimum_size = Vector2(130, 42)
	actions.add_child(logout)
	input.text_submitted.connect(func(_text: String) -> void:
		_submit_nickname_setup(input)
	)
	_push_modal(panel)
	input.call_deferred("grab_focus")

func _submit_nickname_setup(input: LineEdit) -> void:
	var trimmed := input.text.strip_edges()
	if trimmed.length() < 2 or trimmed.length() > 16:
		_show_error("昵称需要 2-16 个字符")
		return
	_close_top_modal()
	await _call_session("update_nickname", [input.text])

func _logout_from_nickname_setup() -> void:
	_close_top_modal()
	await _call_session("logout", [])

func _purchase_shop_item(catalog_item_id: String) -> void:
	await _post_and_store(ApiRoutes.shop_purchase(), {"catalogItemId": catalog_item_id}, "shop", "purchase_shop_item")
	await _fetch_into("cosmetics", ApiRoutes.cosmetics_me())
	_render_shell()

func _equip_cosmetic(catalog_item_id: String) -> void:
	await _post_and_store(ApiRoutes.cosmetics_equip(), {"catalogItemId": catalog_item_id}, "cosmetics", "equip_cosmetic")

func _unequip_cosmetic(cosmetic_type: String) -> void:
	await _post_and_store(ApiRoutes.cosmetics_equip(), {"catalogItemId": null, "cosmeticType": cosmetic_type}, "cosmetics", "unequip_cosmetic")

func _submit_apex_candidate(run_id: String) -> void:
	if run_id.is_empty():
		return
	await _post_and_store(ApiRoutes.apex_submit(), {"runId": run_id}, "apex", "submit_apex")

func _refresh_cosmetics() -> void:
	await _guarded_fetch_into("cosmetics", ApiRoutes.cosmetics_me())
	_render_shell()

func _music_enabled_preference() -> bool:
	var config := ConfigFile.new()
	if config.load(SETTINGS_PATH) != OK:
		return true
	return bool(config.get_value(SETTINGS_SECTION, MUSIC_ENABLED_KEY, true))

func _set_music_enabled_preference(enabled: bool) -> void:
	var config := ConfigFile.new()
	config.load(SETTINGS_PATH)
	config.set_value(SETTINGS_SECTION, MUSIC_ENABLED_KEY, enabled)
	config.save(SETTINGS_PATH)

func _toggle_music() -> void:
	if music_player == null or music_player.stream == null:
		status_label.text = "当前环境没有可播放音乐"
		return
	if music_player.playing:
		music_player.stop()
		_set_music_enabled_preference(false)
	else:
		music_player.play()
		_set_music_enabled_preference(true)
	_render_shell()

func _refresh_rooms() -> void:
	var manages_progress := not action_in_progress
	if manages_progress:
		action_in_progress = true
		_update_controls()
	await _refresh_rooms_payload()
	if manages_progress:
		action_in_progress = false
		_update_controls()
	_render_shell()

func _refresh_rooms_payload() -> void:
	if active_room.is_empty():
		await _fetch_into("rooms", ApiRoutes.dogfight_rooms())
	else:
		await _refresh_active_room()

func _refresh_active_room() -> void:
	var room_id := str(active_room.get("id", ""))
	if room_id.is_empty():
		await _fetch_into("rooms", ApiRoutes.dogfight_rooms())
		return
	var response: Dictionary = await _api_get(ApiRoutes.dogfight_room(room_id))
	if bool(response.get("ok", false)):
		var data: Dictionary = _data(response)
		active_room = _dict(data, "room")
		_sync_room_run(active_room)
	await _fetch_into("rooms", ApiRoutes.dogfight_rooms())

func _create_room() -> void:
	var response: Dictionary = await _guarded_api_post(ApiRoutes.dogfight_rooms(), {})
	await _apply_room_response(response, "create_room")

func _match_room() -> void:
	var response: Dictionary = await _guarded_api_post(ApiRoutes.dogfight_match(), {})
	await _apply_room_response(response, "match_room")

func _enter_or_view_room(room_id: String, status: String) -> void:
	if room_id.is_empty():
		return
	var path := ApiRoutes.dogfight_room(room_id)
	var response: Dictionary
	if status == "WAITING":
		response = await _guarded_api_post(ApiRoutes.dogfight_room_join(room_id), {})
	else:
		response = await _guarded_api_get(path)
	await _apply_room_response(response, "enter_room" if status == "WAITING" else "")

func _leave_active_room() -> void:
	var room_id := str(active_room.get("id", ""))
	if room_id.is_empty():
		return
	var response: Dictionary = await _guarded_api_post(ApiRoutes.dogfight_room_leave(room_id), {})
	if bool(response.get("ok", false)):
		active_room = {}
		_push_ui_action_success("leave_room")
		await _refresh_rooms()
	else:
		_show_error(str(response.get("error", "")))

func _room_action(action: String, body: Dictionary) -> void:
	var room_id := str(active_room.get("id", ""))
	if room_id.is_empty():
		return
	var path := ""
	match action:
		"start":
			path = ApiRoutes.dogfight_room_start(room_id)
		"ready":
			path = ApiRoutes.dogfight_room_ready(room_id)
		"dog-choice":
			path = ApiRoutes.dogfight_room_dog_choice(room_id)
	if path.is_empty():
		return
	var response: Dictionary = await _guarded_api_post(path, body)
	await _apply_room_response(response, "%s_room" % action)

func _choose_room_dog() -> void:
	var dog_type := _selected_dog_type()
	var body := {"dogType": dog_type}
	if dog_type == "EMPEROR":
		if lucky_select.selected <= 0:
			lucky_select.select(1)
		body["luckyNumber"] = lucky_select.selected
	await _room_action("dog-choice", body)

func _load_room_battle(battle_id: String) -> void:
	var response: Dictionary = await _guarded_api_get(ApiRoutes.dogfight_battle(battle_id))
	if not bool(response.get("ok", false)):
		_show_error(str(response.get("error", "")))
		return
	var data: Dictionary = _data(response)
	var battle: Dictionary = _dict(data, "battle")
	if session != null and session.has_signal("battle_started"):
		var result := _dict(battle, "result")
		result["_finishContext"] = _room_battle_finish_context(battle_id)
		session.battle_started.emit(result)

func _apply_room_response(response: Dictionary, success_action := "") -> void:
	if not bool(response.get("ok", false)):
		_show_error(str(response.get("error", "")))
		return
	var data: Dictionary = _data(response)
	active_room = _dict(data, "room")
	_sync_room_run(active_room)
	current_tab = TAB_ROOMS
	_push_ui_action_success(success_action)
	await _refresh_rooms()

func _sync_room_run(room: Dictionary) -> void:
	var room_run: Dictionary = _dict(room, "currentRun")
	if room_run.is_empty() or session == null:
		return
	if session.has_method("sync_current_run_without_routing"):
		session.sync_current_run_without_routing(room_run)
	elif session.has_method("set_current_run"):
		session.set_current_run(room_run)

func _post_and_store(path: String, body: Dictionary, target: String, success_action := "") -> void:
	if action_in_progress:
		return
	action_in_progress = true
	_update_controls()
	var response: Dictionary = await _api_post(path, body)
	action_in_progress = false
	if not bool(response.get("ok", false)):
		_update_controls()
		_show_error(str(response.get("error", "")))
		return
	match target:
		"achievements":
			achievements_data = _data(response)
		"daily":
			daily_data = _data(response)
		"shop":
			meta_shop_data = _data(response)
		"cosmetics":
			cosmetics_data = _data(response)
		"apex":
			apex_data = _data(response)
	_push_ui_action_success(success_action)
	_render_shell()

func _ui_action_success_message(action: String) -> String:
	match action:
		"claim_achievement":
			return "成就奖励已领取"
		"refresh_daily":
			return "每日任务已刷新"
		"claim_daily":
			return "每日奖励已领取"
		"purchase_shop_item":
			return "商城购买成功"
		"equip_cosmetic":
			return "外观已装备"
		"unequip_cosmetic":
			return "外观已恢复默认"
		"submit_apex":
			return "巅峰记录已提交"
		"create_room":
			return "房间已创建"
		"match_room":
			return "已匹配房间"
		"enter_room":
			return "已进入房间"
		"leave_room":
			return "已离开房间"
		"start_room":
			return "房间战斗已开始"
		"ready_room":
			return "房间状态已更新"
		"dog-choice_room", "choose_room_dog":
			return "房间狗狗已选择"
		_:
			return ""

func _push_ui_action_success(action: String) -> void:
	var message := _ui_action_success_message(action)
	if message.strip_edges().is_empty() or session == null:
		return
	var toast_bus: Object = session.get("toast_bus") as Object
	if toast_bus != null and toast_bus.has_method("push"):
		toast_bus.push(message, "success")

func _show_history_modal() -> void:
	var runs := _history_runs_for_tab(history_tab)
	if selected_history_run_id.is_empty() and not runs.is_empty() and runs[0] is Dictionary:
		selected_history_run_id = str((runs[0] as Dictionary).get("id", ""))
	var selected_run := _selected_history_run(runs)
	var modal := _modal_panel("个人战绩详情", Vector2(760, 560))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_add_line(box, "总局数", "%d 局 · 进行中 %d · 完成 %d · 放弃 %d" % [
		int(history_data.get("totalRuns", 0)),
		int(history_data.get("activeRuns", 0)),
		int(history_data.get("completedRuns", 0)),
		int(history_data.get("abandonedRuns", 0)),
	])
	_add_line(box, "总胜负", "%d 胜 / %d 负" % [int(history_data.get("totalWins", 0)), int(history_data.get("totalLosses", 0))])
	var best_run: Dictionary = _dict(history_data, "bestRun")
	if not best_run.is_empty():
		_add_line(box, "最佳成绩", "%s · %d胜 %d败 · 第%d回合" % [_dog_name(str(best_run.get("dogType", ""))), int(best_run.get("wins", 0)), int(best_run.get("losses", 0)), int(best_run.get("round", 0))])
	var tabs := HBoxContainer.new()
	tabs.add_theme_constant_override("separation", 6)
	box.add_child(tabs)
	for tab in _history_mode_tabs():
		if tab is Dictionary:
			var tab_id := str(tab.get("id", "ALL"))
			var count := _history_tab_count(tab_id)
			var button := _button("%s %d" % [str(tab.get("label", tab_id)), count], 108)
			button.toggle_mode = true
			button.button_pressed = history_tab == tab_id
			button.pressed.connect(_select_history_tab.bind(tab_id))
			tabs.add_child(button)
	var layout := HBoxContainer.new()
	layout.add_theme_constant_override("separation", 10)
	box.add_child(layout)
	var browser := VBoxContainer.new()
	browser.custom_minimum_size = Vector2(280, 0)
	browser.size_flags_vertical = Control.SIZE_EXPAND_FILL
	browser.add_theme_constant_override("separation", 6)
	layout.add_child(browser)
	_add_line(browser, "历史对局列表", "%s · %d 条记录" % [_history_tab_label(history_tab), runs.size()])
	if runs.is_empty():
		_add_line(browser, "空状态", "%s暂无记录" % _history_tab_label(history_tab))
	for run in runs.slice(0, 16):
		if run is Dictionary:
			var run_id := str(run.get("id", ""))
			var row_text := "%s  %d胜 %d败  第%d回合" % [
				_dog_name(str(run.get("dogType", ""))),
				int(run.get("wins", 0)),
				int(run.get("losses", 0)),
				int(run.get("round", 0)),
			]
			var row := _button(("%s  " % _run_status_label(str(run.get("status", "")))) + row_text, 260)
			row.toggle_mode = true
			row.button_pressed = run_id == selected_history_run_id
			row.pressed.connect(_select_history_run.bind(run_id))
			browser.add_child(row)
	var detail := VBoxContainer.new()
	detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail.size_flags_vertical = Control.SIZE_EXPAND_FILL
	detail.add_theme_constant_override("separation", 6)
	layout.add_child(detail)
	_render_history_run_details(detail, selected_run)
	_push_modal(modal["panel"])

func _history_mode_tabs() -> Array:
	return [
		{"id": "ALL", "label": "全部"},
		{"id": "CASUAL", "label": "休闲"},
		{"id": "DOGFIGHT", "label": "斗狗"},
		{"id": "PEAK", "label": "巅峰"},
		{"id": "LADDER", "label": "天梯"},
	]

func _history_tab_label(tab_id: String) -> String:
	for tab in _history_mode_tabs():
		if tab is Dictionary and str(tab.get("id", "")) == tab_id:
			return str(tab.get("label", tab_id))
	return tab_id

func _history_tab_count(tab_id: String) -> int:
	return _history_runs_for_tab(tab_id).size()

func _history_runs_for_tab(tab_id: String) -> Array:
	var runs := _array(history_data, "recentRuns")
	if tab_id == "ALL":
		return runs
	var filtered: Array = []
	for run in runs:
		if run is Dictionary and str(run.get("mode", "")) == tab_id:
			filtered.append(run)
	return filtered

func _selected_history_run(runs: Array) -> Dictionary:
	for run in runs:
		if run is Dictionary and str(run.get("id", "")) == selected_history_run_id:
			return run
	if not runs.is_empty() and runs[0] is Dictionary:
		var first: Dictionary = runs[0]
		selected_history_run_id = str(first.get("id", ""))
		return first
	selected_history_run_id = ""
	return {}

func _select_history_tab(tab_id: String) -> void:
	history_tab = tab_id
	selected_history_run_id = ""
	_close_top_modal()
	_show_history_modal()

func _select_history_run(run_id: String) -> void:
	selected_history_run_id = run_id
	_close_top_modal()
	_show_history_modal()

func _render_history_run_details(parent: VBoxContainer, run: Dictionary) -> void:
	_add_line(parent, "对局详情", "")
	if run.is_empty():
		_add_line(parent, "没有可查看的对局", "开始或完成一局后，会在这里显示装备和遗物详情。")
		return
	_add_line(parent, _history_tab_label(str(run.get("mode", ""))), "%s · %d胜 %d败" % [_dog_name(str(run.get("dogType", ""))), int(run.get("wins", 0)), int(run.get("losses", 0))])
	_add_line(parent, "状态", "%s · 第%d回合 · %s" % [_run_status_label(str(run.get("status", ""))), int(run.get("round", 0)), str(run.get("updatedAt", ""))])
	_render_snapshot_items(parent, "历史装备栏", _filter_area(_array(run, "items"), "EQUIPMENT"))
	var relics := _array(run, "relics")
	var bag := _filter_area(_array(run, "items"), "BAG")
	_add_line(parent, "遗物 / 背包", "遗物 %d 个 · 背包物品 %d 个" % [relics.size(), bag.size()])
	for relic in relics.slice(0, 6):
		if relic is Dictionary:
			var relic_def: Dictionary = _dict(relic, "def")
			var relic_title := _fallback(str(relic_def.get("name", "")), str(relic.get("relicId", "")))
			parent.add_child(_action_button("%s  %s" % [relic_title, _quality_label(str(relic.get("quality", "")))], _show_snapshot_relic_modal.bind(relic)))

func _run_status_label(status: String) -> String:
	match status:
		"ACTIVE":
			return "进行中"
		"COMPLETE":
			return "已完成"
		"ABANDONED":
			return "已换狗"
		_:
			return "已记录"

func _run_phase_label(phase: String) -> String:
	match phase:
		"MAP":
			return "探索地图"
		"SHOP":
			return "跑局商店"
		"CHOICE":
			return "选择商店"
		"CLASS_REWARD":
			return "职业奖励"
		"ENCHANT_CHOICE":
			return "选择附魔"
		"RELIC_CHOICE":
			return "选择遗物"
		"UPGRADE_CHOICE":
			return "选择升级"
		"POTION_CHOICE":
			return "选择药水"
		"PREP":
			return "备战"
		"MATCH":
			return "匹配完成"
		"BATTLE":
			return "战斗中"
		"COMPLETE":
			return "结算完成"
		_:
			return _fallback(phase, "未知阶段")

func _show_snapshot_modal(snapshot: Dictionary, title: String) -> void:
	var modal := _modal_panel(title, Vector2(620, 520))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_add_line(box, "战绩", "%s · %d胜 %d负 · 第%d回合" % [_dog_name(str(snapshot.get("dogType", snapshot.get("mode", "")))), int(snapshot.get("wins", 0)), int(snapshot.get("losses", 0)), int(snapshot.get("round", 0))])
	if snapshot.has("name"):
		_add_line(box, "名称", str(snapshot.get("name", "")))
	if snapshot.has("rank"):
		_add_line(box, "排名", "#%s · 防守连胜 %d" % [str(snapshot.get("rank", "-")), int(snapshot.get("challengeWins", 0))])
	_render_snapshot_items(box, "装备栏", _filter_area(_array(snapshot, "items"), "EQUIPMENT"))
	_render_snapshot_items(box, "背包", _filter_area(_array(snapshot, "items"), "BAG"))
	var relics := _array(snapshot, "relics")
	_add_line(box, "遗物", "%d 个" % relics.size())
	for relic in relics.slice(0, 10):
		if relic is Dictionary:
			var relic_def: Dictionary = _dict(relic, "def")
			var relic_title := _fallback(str(relic_def.get("name", "")), str(relic.get("relicId", "")))
			box.add_child(_action_button("%s  %s" % [relic_title, _quality_label(str(relic.get("quality", "")))], _show_snapshot_relic_modal.bind(relic)))
	_push_modal(modal["panel"])

func _render_snapshot_items(parent: VBoxContainer, title: String, items: Array) -> void:
	_add_line(parent, title, "%d 件" % items.size())
	for item in items.slice(0, 12):
		if item is Dictionary:
			var def: Dictionary = _dict(item, "def")
			var title_text := _fallback(str(def.get("name", "")), str(item.get("defId", item.get("id", ""))))
			var button := _action_button("%s  %s  (%d,%d)" % [title_text, _quality_label(str(item.get("quality", ""))), int(item.get("x", 0)), int(item.get("y", 0))], _show_snapshot_item_modal.bind(item))
			button.icon = _item_texture(item)
			button.expand_icon = true
			parent.add_child(button)

func _show_snapshot_item_modal(item: Dictionary) -> void:
	var def: Dictionary = _dict(item, "def")
	var title := _fallback(str(def.get("name", "")), str(item.get("defId", item.get("id", ""))))
	var modal := _modal_panel("快照装备详情", Vector2(560, 500))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_render_detail_header(box, _item_texture(item), title, "快照装备 · %s" % _quality_label(str(item.get("quality", ""))))
	_add_item_def_details(box, def, str(item.get("quality", "")), str(item.get("defId", item.get("id", ""))))
	_add_line(box, "触发点数", _map_preview_trigger_text(item))
	_add_line(box, "位置", "%s  (%d,%d)" % [_area_label(str(item.get("area", ""))), int(item.get("x", 0)), int(item.get("y", 0))])
	_push_modal(modal["panel"])

func _show_snapshot_relic_modal(relic: Dictionary) -> void:
	var def: Dictionary = _dict(relic, "def")
	var title := _fallback(str(def.get("name", "")), str(relic.get("relicId", relic.get("id", ""))))
	var modal := _modal_panel("快照遗物详情", Vector2(520, 420))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_render_detail_header(box, _relic_texture(relic), title, "快照遗物 · %s" % _quality_label(str(relic.get("quality", ""))))
	_add_line(box, "品质", _quality_label(str(relic.get("quality", ""))))
	var description := _detail_description(def)
	if not description.is_empty():
		_add_line(box, "说明", description)
	var effect := str(def.get("effect", ""))
	if not effect.is_empty():
		_add_line(box, "效果", effect)
	_push_modal(modal["panel"])

func _current_user_id() -> String:
	var user: Dictionary = _dict(me_data, "user")
	var user_id := str(user.get("id", ""))
	if user_id.is_empty() and session != null:
		var current = session.get("current_user")
		if current is Dictionary:
			user_id = str((current as Dictionary).get("id", ""))
	return user_id

func _tutorial_status_for_user(user_id: String) -> String:
	if user_id.is_empty():
		return "idle"
	var config := ConfigFile.new()
	if config.load(TUTORIAL_STATUS_PATH) != OK:
		return "idle"
	return str(config.get_value(TUTORIAL_SECTION, user_id, "idle"))

func _set_tutorial_status_for_user(user_id: String, status: String) -> void:
	if user_id.is_empty():
		return
	var config := ConfigFile.new()
	config.load(TUTORIAL_STATUS_PATH)
	config.set_value(TUTORIAL_SECTION, user_id, status)
	config.save(TUTORIAL_STATUS_PATH)

func _maybe_auto_show_tutorial() -> void:
	var user_id := _current_user_id()
	if user_id.is_empty() or user_id == tutorial_auto_checked_for_user:
		return
	tutorial_auto_checked_for_user = user_id
	if current_tab != TAB_LOBBY:
		return
	if _tutorial_status_for_user(user_id) != "idle":
		return
	_set_tutorial_status_for_user(user_id, "active")
	call_deferred("_show_tutorial_modal", true)

func _show_tutorial_modal(auto_started := false) -> void:
	if tutorial_modal_open:
		return
	var modal := _modal_panel("新手引导", Vector2(600, 540), not auto_started)
	if modal.is_empty():
		return
	tutorial_modal_open = true
	var panel: PanelContainer = modal["panel"]
	panel.tree_exited.connect(func() -> void:
		tutorial_modal_open = false
	)
	var box: VBoxContainer = modal["box"]
	_add_line(box, "大厅", "先选择休闲、天梯、多人房间或巅峰竞技场。")
	_add_line(box, "选择狗狗", "每种狗有独立特性；狗皇帝需要选择幸运数字。")
	_add_line(box, "查看商店", "点击商品先看详情、触发点数和效果，再确认购买。")
	_add_line(box, "放置装备", "选中装备后点击装备栏或背包格子移动；详情弹窗可出售或升级。")
	_add_line(box, "观看战斗", "战斗回放会显示血量、护盾、状态、蓄水池、触发装备和结算看板。")
	_add_line(box, "继续跑局", "战斗后领取奖励、处理地图节点，再进入下一轮商店或战斗。")
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.add_child(_action_button("进入跑局页", _tutorial_go_run_tab))
	if auto_started:
		row.add_child(_action_button("跳过引导", _tutorial_skip_for_current_user))
	else:
		row.add_child(_action_button("关闭", _close_top_modal))
	box.add_child(row)
	_push_modal(modal["panel"])

func _tutorial_go_run_tab() -> void:
	_close_top_modal()
	_switch_tab(TAB_RUN)

func _tutorial_skip_for_current_user() -> void:
	_set_tutorial_status_for_user(_current_user_id(), "skipped")
	_close_top_modal()

func _show_room_member_modal(member: Dictionary) -> void:
	var modal := _modal_panel("房间成员详情", Vector2(520, 460))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	var name := str(member.get("nickname", member.get("kind", "")))
	_add_line(box, "昵称", name)
	_add_line(box, "席位", "%s%s" % [_room_member_kind_label(str(member.get("kind", ""))), " · 房主" if bool(member.get("isHost", false)) else ""])
	_add_line(box, "犬种", _dog_name(str(member.get("dogType", ""))))
	_add_line(box, "战绩", "%d胜 / %d负 · 第%d回合" % [int(member.get("wins", 0)), int(member.get("losses", 0)), int(member.get("round", 0))])
	_add_line(box, "经济", "金币 %d" % int(member.get("gold", 0)))
	_add_line(box, "阶段", "%s / %s" % [_room_phase_label(str(member.get("phase", ""))), _room_status_label(str(member.get("status", "")))])
	_add_line(box, "状态", _room_member_status(member))
	var battle_id := str(member.get("currentBattleId", ""))
	if not battle_id.is_empty():
		box.add_child(_action_button("载入当前战报", _load_room_battle_from_modal.bind(battle_id)))
	_push_modal(modal["panel"])

func _show_room_battle_modal(battle: Dictionary) -> void:
	var modal := _modal_panel("房间战报摘要", Vector2(520, 420))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	var battle_id := str(battle.get("id", ""))
	_add_line(box, "战报", battle_id)
	_add_line(box, "回合", "第 %d 回合" % int(battle.get("round", 0)))
	_add_line(box, "对手", _opponent_kind_label(str(battle.get("opponentKind", ""))))
	_add_line(box, "胜者", "%s / 胜者成员 %s" % [_battle_side_label(str(battle.get("winnerSide", ""))), str(battle.get("winnerParticipantId", ""))])
	var created_at := str(battle.get("createdAt", ""))
	if not created_at.is_empty():
		_add_line(box, "时间", created_at)
	if not battle_id.is_empty():
		box.add_child(_action_button("载入战报", _load_room_battle_from_modal.bind(battle_id)))
	_push_modal(modal["panel"])

func _show_ladder_settlement_modal(settlement: Dictionary) -> void:
	var modal := _modal_panel("天梯结算详情", Vector2(560, 480))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_add_line(box, "段位", "%s %d -> %s %d" % [_tier_label(str(settlement.get("beforeTier", ""))), int(settlement.get("beforeScore", 0)), _tier_label(str(settlement.get("afterTier", ""))), int(settlement.get("afterScore", 0))])
	_add_line(box, "变化", _signed_int(int(settlement.get("delta", 0))))
	_add_line(box, "胜负", "%d胜 / %d负" % [int(settlement.get("wins", 0)), int(settlement.get("losses", 0))])
	_add_line(box, "原始变化", str(int(settlement.get("rawDelta", 0))))
	_add_line(box, "基础分", str(int(settlement.get("baseScore", 0))))
	_add_line(box, "段位税", _signed_int(int(settlement.get("tierTax", 0))))
	_add_line(box, "失败惩罚", _signed_int(int(settlement.get("lossPenalty", 0))))
	_add_line(box, "完美奖励", str(int(settlement.get("perfectBonus", 0))))
	_add_line(box, "新手保护", str(int(settlement.get("newbieProtection", 0))))
	var created_at := str(settlement.get("createdAt", ""))
	if not created_at.is_empty():
		_add_line(box, "时间", created_at)
	_push_modal(modal["panel"])

func _show_season_summary_modal(summary: Dictionary) -> void:
	var modal := _modal_panel("赛季记录详情", Vector2(560, 500))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_add_line(box, "赛季", str(summary.get("seasonName", summary.get("seasonId", ""))))
	_add_line(box, "天梯", "%s %s" % [_fallback(str(summary.get("ladderTierLabel", "")), "未参赛"), str(summary.get("ladderScore", ""))])
	_add_line(box, "最高段位", _fallback(str(summary.get("ladderHighestTierLabel", "")), "无"))
	_add_line(box, "天梯战绩", "%d 局 · %d胜 / %d负" % [int(summary.get("ladderGamesPlayed", 0)), int(summary.get("ladderTotalWins", 0)), int(summary.get("ladderTotalLosses", 0))])
	var dog_king_rank := int(summary.get("dogKingRank", 0))
	if dog_king_rank > 0:
		_add_line(box, "犬王", "犬王第 %d 名" % dog_king_rank)
	var apex_rank := int(summary.get("apexRank", 0))
	if apex_rank > 0:
		_add_line(box, "巅峰", "巅峰第 %d 名 · %s · %d胜 / %d负 · 第%d回合 · 防守连胜 %d" % [apex_rank, _dog_name(str(summary.get("apexDogType", ""))), int(summary.get("apexWins", 0)), int(summary.get("apexLosses", 0)), int(summary.get("apexRound", 0)), int(summary.get("apexChallengeWins", 0))])
	var snapshot: Dictionary = _dict(summary, "apexSnapshot")
	if not snapshot.is_empty():
		box.add_child(_action_button("查看巅峰快照", _show_snapshot_modal.bind(snapshot, "赛季巅峰快照")))
	_push_modal(modal["panel"])

func _show_cosmetic_modal(raw_item: Dictionary) -> void:
	var item: Dictionary = _cosmetic_item(raw_item)
	var title := _cosmetic_display_name(raw_item)
	var is_equipped := _is_cosmetic_equipped(raw_item)
	var modal := _modal_panel("外观详情", Vector2(520, 460))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_add_line(box, "名称", title)
	_add_line(box, "类型", _cosmetic_type_label(_cosmetic_type(raw_item)))
	_add_line(box, "稀有度", _rarity_label(str(item.get("rarity", ""))))
	_add_line(box, "价格", "%d" % int(item.get("price", 0)))
	var description := str(item.get("description", ""))
	if not description.is_empty():
		_add_line(box, "说明", description)
	_add_line(box, "状态", _cosmetic_status_label(raw_item))
	var catalog_item_id := _cosmetic_catalog_id(raw_item)
	if not catalog_item_id.is_empty():
		if bool(item.get("owned", raw_item.get("owned", false))):
			if is_equipped:
				var equipped_button := _button("已装备", 120)
				equipped_button.disabled = true
				box.add_child(equipped_button)
			else:
				box.add_child(_action_button("装备", _cosmetic_action_from_modal.bind("equip", catalog_item_id)))
		else:
			box.add_child(_action_button("购买", _cosmetic_action_from_modal.bind("purchase", catalog_item_id)))
	_push_modal(modal["panel"])

func _show_achievement_modal(achievement: Dictionary) -> void:
	var title := _fallback(str(achievement.get("title", "")), str(achievement.get("id", "")))
	var modal := _modal_panel("成就详情", Vector2(520, 420))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_add_line(box, "名称", title)
	var description := str(achievement.get("description", ""))
	if not description.is_empty():
		_add_line(box, "说明", description)
	var category := str(achievement.get("category", ""))
	if not category.is_empty():
		_add_line(box, "分类", category)
	if bool(achievement.get("hidden", false)):
		_add_line(box, "可见性", "隐藏成就")
	_add_line(box, "进度", "%d/%d" % [int(achievement.get("progress", 0)), int(achievement.get("target", 0))])
	_add_line(box, "奖励", "%d" % int(achievement.get("reward", 0)))
	_add_line(box, "状态", _claim_status_label(bool(achievement.get("claimable", false)), bool(achievement.get("claimed", false)), int(achievement.get("progress", 0)), int(achievement.get("target", 0))))
	var achievement_id := str(achievement.get("id", ""))
	if bool(achievement.get("claimable", false)) and not achievement_id.is_empty():
		box.add_child(_action_button("领取奖励", _achievement_action_from_modal.bind(achievement_id)))
	_push_modal(modal["panel"])

func _show_daily_task_modal(task: Dictionary) -> void:
	var def: Dictionary = _dict(task, "def")
	var title := _fallback(str(def.get("title", "")), str(task.get("taskId", "")))
	var modal := _modal_panel("每日任务详情", Vector2(520, 420))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_add_line(box, "名称", title)
	var description := str(def.get("description", ""))
	if not description.is_empty():
		_add_line(box, "说明", description)
	_add_line(box, "进度", "%d/%d" % [int(task.get("progress", 0)), int(task.get("target", 0))])
	_add_line(box, "奖励", "%d" % _reward_amount(task, def))
	var ready := int(task.get("progress", 0)) >= int(task.get("target", 0))
	var claimed := not str(task.get("claimedAt", "")).is_empty()
	_add_line(box, "状态", _claim_status_label(ready and not claimed, claimed, int(task.get("progress", 0)), int(task.get("target", 0))))
	var task_id := str(task.get("taskId", ""))
	if ready and not claimed and not task_id.is_empty():
		box.add_child(_action_button("领取奖励", _daily_action_from_modal.bind(task_id)))
	_push_modal(modal["panel"])

func _cosmetic_item(raw_item: Dictionary) -> Dictionary:
	var nested: Dictionary = _dict(raw_item, "item")
	if nested.is_empty():
		return raw_item
	var merged := nested.duplicate(true)
	for key in ["catalogItemId", "owned", "equipped"]:
		if raw_item.has(key) and not merged.has(key):
			merged[key] = raw_item.get(key)
	return merged

func _cosmetic_catalog_id(raw_item: Dictionary) -> String:
	var item: Dictionary = _cosmetic_item(raw_item)
	return _fallback(str(item.get("id", "")), str(raw_item.get("catalogItemId", "")))

func _cosmetic_display_name(raw_item: Dictionary) -> String:
	var item: Dictionary = _cosmetic_item(raw_item)
	return _fallback(str(item.get("name", "")), _cosmetic_catalog_id(raw_item))

func _cosmetic_type(raw_item: Dictionary) -> String:
	var item: Dictionary = _cosmetic_item(raw_item)
	return str(item.get("type", item.get("cosmeticType", raw_item.get("type", raw_item.get("cosmeticType", "")))))

func _cosmetic_status_label(raw_item: Dictionary) -> String:
	var item: Dictionary = _cosmetic_item(raw_item)
	if _is_cosmetic_equipped(raw_item):
		return "已装备"
	if bool(item.get("owned", raw_item.get("owned", false))):
		return "已拥有"
	return "未拥有"

func _is_cosmetic_equipped(raw_item: Dictionary) -> bool:
	var item: Dictionary = _cosmetic_item(raw_item)
	if bool(item.get("equipped", raw_item.get("equipped", false))):
		return true
	var catalog_item_id := _cosmetic_catalog_id(raw_item)
	if catalog_item_id.is_empty():
		return false
	for entry in _array(cosmetics_data, "equipped"):
		if entry is Dictionary:
			if str((entry as Dictionary).get("catalogItemId", "")) == catalog_item_id:
				return true
			if _cosmetic_catalog_id(entry) == catalog_item_id:
				return true
	return false

func _is_default_cosmetic_equipped(cosmetic_type: String) -> bool:
	for entry in _array(cosmetics_data, "equipped"):
		if entry is Dictionary:
			var entry_type := str((entry as Dictionary).get("slot", (entry as Dictionary).get("cosmeticType", _cosmetic_type(entry))))
			if entry_type == cosmetic_type:
				return false
	return true

func _shop_catalog_section_label(section_name: String) -> String:
	match section_name:
		"permanent":
			return "常驻区"
		"featured":
			return "精选轮换区"
		_:
			return section_name

func _shop_catalog_button_label(raw_item: Dictionary) -> String:
	var item: Dictionary = _cosmetic_item(raw_item)
	var action := "购买"
	if _is_cosmetic_equipped(raw_item):
		action = "已装备"
	elif bool(item.get("owned", raw_item.get("owned", false))):
		action = "装备"
	return "%s %s  %s · %s  %d" % [action, _cosmetic_display_name(raw_item), _cosmetic_type_label(_cosmetic_type(raw_item)), _rarity_label(str(item.get("rarity", ""))), int(item.get("price", 0))]

func _cosmetic_type_label(cosmetic_type: String) -> String:
	match cosmetic_type:
		"TITLE":
			return "称号"
		"AVATAR":
			return "头像"
		"BACKGROUND":
			return "主页背景"
		"DOG_SKIN":
			return "狗狗皮肤"
		"BATTLE_EFFECT":
			return "战斗特效"
		_:
			return _fallback(cosmetic_type, "外观")

func _apply_equipped_cosmetic_shell() -> void:
	if background_rect != null:
		background_rect.texture = _texture(_equipped_background_path())
	if profile_badge_label == null or profile_name_label == null or profile_title_label == null:
		return
	var user: Dictionary = _dict(me_data, "user")
	var title_item := _equipped_cosmetic("TITLE")
	var avatar_item := _equipped_cosmetic("AVATAR")
	profile_badge_label.text = _avatar_glyph(_cosmetic_catalog_id(avatar_item))
	profile_name_label.text = _fallback(str(user.get("nickname", "")), _fallback(str(user.get("account", "")), "玩家"))
	profile_title_label.text = _fallback(_cosmetic_display_name(title_item), "公园新星")

func _equipped_cosmetic(cosmetic_type: String) -> Dictionary:
	for entry in _array(cosmetics_data, "equipped"):
		if entry is Dictionary and str(entry.get("slot", entry.get("cosmeticType", ""))) == cosmetic_type:
			var item := _cosmetic_item(entry)
			if item.is_empty():
				return entry.duplicate(true)
			return item
	return {}

func _equipped_background_path() -> String:
	var background := _equipped_cosmetic("BACKGROUND")
	match _cosmetic_catalog_id(background):
		"bg-royal-kennel":
			return "res://assets/backgrounds/storybook-royal-kennel.webp"
		"bg-dog-park-night":
			return "res://assets/backgrounds/storybook-dog-park.webp"
		_:
			return "res://assets/backgrounds/storybook-dog-park.webp"

func _avatar_glyph(catalog_id: String) -> String:
	match catalog_id:
		"avatar-crown":
			return "冠"
		"avatar-bone":
			return "骨"
		_:
			return "狗"

func _rarity_label(rarity: String) -> String:
	match rarity:
		"COMMON":
			return "普通"
		"RARE":
			return "稀有"
		"EPIC":
			return "史诗"
		"LEGENDARY":
			return "传说"
		_:
			return _fallback(rarity, "普通")

func _tier_label(tier: String) -> String:
	match tier:
		"BRONZE":
			return "青铜"
		"SILVER":
			return "白银"
		"GOLD":
			return "黄金"
		"PLATINUM":
			return "铂金"
		"DIAMOND":
			return "钻石"
		"MASTER":
			return "大师"
		"DOG_KING":
			return "犬王"
		_:
			return _fallback(tier, "未定级")

func _tier_display_label(profile: Dictionary) -> String:
	return _fallback(str(profile.get("tierLabel", "")), _tier_label(str(profile.get("tier", ""))))

func _ladder_score_text(profile: Dictionary) -> String:
	var tier := str(profile.get("tier", ""))
	var score := int(profile.get("score", 0))
	if tier == "MASTER":
		return "%d 分 / 500 晋级犬王" % score
	if tier == "DOG_KING":
		return "%d 分 · 犬王积分" % score
	return "%d 分 / 100 LP" % score

func _season_summary_button_label(summary: Dictionary) -> String:
	var name := str(summary.get("seasonName", summary.get("seasonId", "")))
	var tier := _fallback(str(summary.get("ladderTierLabel", "")), "未参赛")
	var score_text := ""
	if summary.has("ladderScore") and str(summary.get("ladderScore", "")).length() > 0:
		score_text = " · %d 分" % int(summary.get("ladderScore", 0))
	var dog_king := ""
	if int(summary.get("dogKingRank", 0)) > 0:
		dog_king = " · 犬王第 %d 名" % int(summary.get("dogKingRank", 0))
	var apex_text := "巅峰未入榜"
	if int(summary.get("apexRank", 0)) > 0:
		apex_text = "巅峰第 %d 名 · %d胜%d败" % [int(summary.get("apexRank", 0)), int(summary.get("apexWins", 0)), int(summary.get("apexLosses", 0))]
	return "%s  天梯 %s%s%s  %s" % [name, tier, score_text, dog_king, apex_text]

func _apex_run_summary_label(run_like: Dictionary) -> String:
	var item_count := _array(run_like, "items").size()
	var relic_count := _array(run_like, "relics").size()
	return "%s  %d胜%d负  第%d回合 · 遗物 %d · 装备 %d" % [_dog_name(str(run_like.get("dogType", ""))), int(run_like.get("wins", 0)), int(run_like.get("losses", 0)), int(run_like.get("round", 0)), relic_count, item_count]

func _room_member_status(member: Dictionary) -> String:
	if bool(member.get("eliminated", false)):
		var round_text := str(member.get("eliminatedRound", ""))
		return "淘汰" if round_text.is_empty() else "第 %s 回合淘汰" % round_text
	if bool(member.get("ready", false)):
		return "已准备"
	return "存活"

func _room_summary_label(room: Dictionary) -> String:
	var status := str(room.get("status", ""))
	if status == "WAITING":
		return "等待中"
	if status == "COMPLETE":
		return "已结束"
	var phase_text := _room_phase_label(str(room.get("phase", "")))
	var round_value := int(room.get("currentRound", room.get("round", 0)))
	if round_value > 0:
		return "%s · 第 %d 回合" % [phase_text, round_value]
	return phase_text

func _room_list_action_label(room: Dictionary) -> String:
	return "加入房间" if str(room.get("status", "")) == "WAITING" else "观战"

func _can_start_room_action(room: Dictionary) -> bool:
	return bool(room.get("isHost", false)) and str(room.get("status", "")) == "WAITING"

func _can_ready_room_action(room: Dictionary) -> bool:
	if str(room.get("status", "")) != "ACTIVE":
		return false
	if not ["SHOP", "BATTLE"].has(str(room.get("phase", ""))):
		return false
	if _dict(room, "currentRun").is_empty():
		return false
	var member := _current_room_member(room)
	if member.is_empty():
		return false
	return not bool(member.get("ready", false)) and not bool(member.get("eliminated", false))

func _room_current_run_action_locked() -> bool:
	if current_tab != TAB_ROOMS:
		return false
	if active_room.is_empty() or _dict(active_room, "currentRun").is_empty():
		return false
	var member := _current_room_member(active_room)
	if member.is_empty():
		return false
	return bool(member.get("ready", false)) or bool(member.get("eliminated", false))

func _room_run_method_locked(method: String) -> bool:
	return _room_current_run_action_locked() and ROOM_LOCKED_RUN_METHODS.has(method)

func _current_room_battle_id(room: Dictionary) -> String:
	if str(room.get("phase", "")) != "BATTLE":
		return ""
	var member := _current_room_member(room)
	if member.is_empty() or bool(member.get("eliminated", false)):
		return ""
	return str(member.get("currentBattleId", ""))

func _room_battle_finish_context(battle_id: String) -> Dictionary:
	var room_id := str(active_room.get("id", ""))
	if room_id.is_empty():
		return {}
	var kind := "DOGFIGHT_ROOM_READY" if _can_ready_room_action(active_room) and battle_id == _current_room_battle_id(active_room) else "DOGFIGHT_ROOM_VIEW"
	return {"kind": kind, "roomId": room_id, "battleId": battle_id}

func _current_room_member(room: Dictionary) -> Dictionary:
	var explicit: Dictionary = _dict(room, "currentRunMember")
	if not explicit.is_empty():
		return explicit
	var current_run: Dictionary = _dict(room, "currentRun")
	var run_id := str(current_run.get("id", ""))
	if run_id.is_empty():
		return {}
	for entry in _array(room, "members"):
		if not entry is Dictionary:
			continue
		var member: Dictionary = entry
		if str(member.get("runId", "")) == run_id or str(member.get("currentRunId", "")) == run_id:
			return member.duplicate(true)
	return {}

func _room_status_label(status: String) -> String:
	match status:
		"WAITING":
			return "等待中"
		"ACTIVE":
			return "进行中"
		"COMPLETE":
			return "已结束"
		_:
			return _fallback(status, "未知")

func _room_phase_label(phase: String) -> String:
	match phase:
		"LOBBY":
			return "大厅阶段"
		"DOG_SELECT":
			return "选狗阶段"
		"SHOP":
			return "商店阶段"
		"BATTLE":
			return "战斗阶段"
		"COMPLETE":
			return "房间结束"
		_:
			return _fallback(phase, "未知阶段")

func _opponent_kind_label(kind: String) -> String:
	match kind:
		"PLAYER":
			return "玩家"
		"BOT":
			return "机器人"
		"SEED":
			return "种子"
		_:
			return _fallback(kind, "未知对手")

func _room_member_kind_label(kind: String) -> String:
	match kind:
		"PLAYER":
			return "玩家"
		"BOT":
			return "机器人"
		"SEED":
			return "种子"
		_:
			return _fallback(kind, "未知席位")

func _battle_side_label(side: String) -> String:
	match side.to_lower():
		"player":
			return "我方"
		"opponent":
			return "对手"
		"draw":
			return "平局"
		"system":
			return "系统"
		_:
			return _fallback(side, "未知")

func _signed_int(value: int) -> String:
	return "%+d" % value

func _reward_amount(source: Dictionary, def: Dictionary) -> int:
	return int(source.get("reward", def.get("reward", 0)))

func _achievement_category_summary(achievements: Array) -> String:
	var categories := ["全部"]
	for achievement in achievements:
		if achievement is Dictionary:
			var category := str((achievement as Dictionary).get("category", ""))
			if not category.is_empty() and not categories.has(category):
				categories.append(category)
	return " / ".join(categories)

func _achievement_button_label(achievement: Dictionary) -> String:
	var claimed := bool(achievement.get("claimed", false))
	var claimable := bool(achievement.get("claimable", false))
	var status := "已领取" if claimed else ("可领取" if claimable else "未完成")
	var hidden_text := " 隐藏成就" if bool(achievement.get("hidden", false)) else ""
	var title := _fallback(str(achievement.get("title", "")), str(achievement.get("id", "")))
	var category := str(achievement.get("category", ""))
	var category_text := "  %s" % category if not category.is_empty() else ""
	return "%s%s %s%s  %d/%d  奖励 %d" % [status, hidden_text, title, category_text, int(achievement.get("progress", 0)), int(achievement.get("target", 0)), int(achievement.get("reward", 0))]

func _claim_status_label(claimable: bool, claimed: bool, progress: int, target: int) -> String:
	if claimed:
		return "已领取"
	if claimable:
		return "可领取"
	if progress >= target and target > 0:
		return "可领取"
	return "未完成"

func _cosmetic_action_from_modal(action: String, catalog_item_id: String) -> void:
	_close_top_modal()
	if action == "purchase":
		await _purchase_shop_item(catalog_item_id)
	else:
		await _equip_cosmetic(catalog_item_id)

func _achievement_action_from_modal(achievement_id: String) -> void:
	_close_top_modal()
	await _claim_achievement(achievement_id)

func _daily_action_from_modal(task_id: String) -> void:
	_close_top_modal()
	await _claim_daily(task_id)

func _load_room_battle_from_modal(battle_id: String) -> void:
	_close_top_modal()
	await _load_room_battle(battle_id)

func _show_forfeit_modal(run: Dictionary) -> void:
	var modal := _modal_panel("放弃并结算当前跑局", Vector2(540, 360))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	var dog_type := str(run.get("dogType", ""))
	_render_detail_header(box, _dog_texture(dog_type), "确认放弃", "%s 路 第 %d 回合" % [_dog_name(dog_type), int(run.get("round", 0))])
	_add_line(box, "当前战绩", "%d 胜 / %d 败" % [int(run.get("wins", 0)), int(run.get("losses", 0))])
	_add_line(box, "资源", "金币 %d 路 阶段 %s" % [int(run.get("gold", 0)), _run_phase_label(str(run.get("phase", "")))])
	_add_line(box, "提示", "放弃后立即按当前记录结算，不会额外增加失败。")
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 8)
	box.add_child(actions)
	actions.add_child(_action_button("确认放弃并结算", _confirm_forfeit_from_modal))
	actions.add_child(_action_button("继续跑局", _close_top_modal))
	_push_modal(modal["panel"])

func _confirm_forfeit_from_modal() -> void:
	_close_top_modal()
	await _call_session("settle_run", [])

func _show_offer_modal(offer: Dictionary) -> void:
	var def: Dictionary = _dict(offer, "def")
	var title := _fallback(str(def.get("name", "")), str(offer.get("defId", offer.get("offerId", ""))))
	var modal := _modal_panel("商店报价", Vector2(560, 500))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_render_detail_header(box, _offer_texture(offer), title, "商店报价 · %s" % _quality_label(str(offer.get("quality", ""))))
	_add_item_def_details(box, def, str(offer.get("quality", "")), str(offer.get("defId", offer.get("offerId", ""))))
	_add_line(box, "价格", "%d 金币" % int(offer.get("price", 0)))
	var discount := int(offer.get("discount", 0))
	if discount > 0:
		_add_line(box, "折扣", "-%d 金币" % discount)
	box.add_child(_run_action_button("购买到背包", _buy_offer_from_modal.bind(str(offer.get("offerId", "")))))
	_push_modal(modal["panel"])

func _show_class_reward_modal(choice: Dictionary) -> void:
	var def: Dictionary = _dict(choice, "def")
	var title := _fallback(str(def.get("name", "")), str(choice.get("defId", "")))
	var modal := _modal_panel("职业装备奖励", Vector2(560, 500))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_render_detail_header(box, _sticker_texture(str(choice.get("defId", ""))), title, "职业装备奖励 · %s" % _quality_label(str(choice.get("quality", ""))))
	_add_item_def_details(box, def, str(choice.get("quality", "")), str(choice.get("defId", "")))
	box.add_child(_run_action_button("领取职业装备", _class_reward_from_modal.bind(str(choice.get("defId", "")))))
	_push_modal(modal["panel"])

func _show_relic_choice_modal(choice: Dictionary) -> void:
	var def: Dictionary = _dict(choice, "def")
	var title := _fallback(str(def.get("name", "")), str(choice.get("relicId", "")))
	var modal := _modal_panel("遗物选择", Vector2(520, 430))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_render_detail_header(box, _relic_texture(choice), title, "遗物选择 · %s" % _quality_label(str(choice.get("quality", ""))))
	_add_line(box, "品质", _quality_label(str(choice.get("quality", ""))))
	var description := _detail_description(def)
	if not description.is_empty():
		_add_line(box, "说明", description)
	var effect := str(def.get("effect", ""))
	if not effect.is_empty():
		_add_line(box, "效果", effect)
	box.add_child(_run_action_button("选择遗物", _relic_choice_from_modal.bind(str(choice.get("relicId", "")))))
	_push_modal(modal["panel"])

func _show_enchant_choice_modal(choice: Dictionary) -> void:
	selected_enchant_choice_id = str(choice.get("id", ""))
	var modal := _modal_panel("附魔选择", Vector2(540, 430))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	var enchant: Dictionary = _dict(choice, "enchant")
	_add_line(box, "名称", _enchant_choice_label(choice))
	_add_line(box, "说明", str(choice.get("description", "")))
	if not enchant.is_empty():
		_add_line(box, "类型", _enchant_kind_label(str(enchant.get("kind", ""))))
		if enchant.has("target"):
			_add_line(box, "目标", _enchant_target_label(str(enchant.get("target", ""))))
		if enchant.has("effect"):
			_add_line(box, "效果", _enchant_effect_label(str(enchant.get("effect", ""))))
		if enchant.has("amount"):
			_add_line(box, "数值", str(enchant.get("amount", "")))
	if selected_item_id.is_empty():
		box.add_child(_disabled_action_button("先选中装备再附魔"))
	else:
		box.add_child(_run_action_button("附魔到选中装备", _enchant_from_modal.bind(str(choice.get("id", "")))))
	_push_modal(modal["panel"])

func _show_potion_choice_modal(choice: Dictionary) -> void:
	selected_potion_choice_id = str(choice.get("id", ""))
	var modal := _modal_panel("药水选择", Vector2(540, 430))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_add_line(box, "类型", _potion_category_label(str(choice.get("category", ""))))
	_add_line(box, "点数", _detail_array_text(choice.get("dice", [])))
	_add_line(box, "说明", str(choice.get("description", "")))
	if selected_item_id.is_empty():
		box.add_child(_disabled_action_button("先选中装备再使用药水"))
	else:
		box.add_child(_run_action_button("药水给选中装备", _potion_from_modal.bind(str(choice.get("id", "")))))
	_push_modal(modal["panel"])

func _show_item_detail_modal(item: Dictionary) -> void:
	var def: Dictionary = _dict(item, "def")
	var title := _fallback(str(def.get("name", "")), str(item.get("defId", item.get("id", ""))))
	var modal := _modal_panel("装备详情", Vector2(560, 520))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_render_detail_header(box, _item_texture(item), title, "装备详情 · %s" % _quality_label(str(item.get("quality", ""))))
	_add_item_def_details(box, def, str(item.get("quality", "")), str(item.get("defId", item.get("id", ""))))
	_add_line(box, "位置", "%s  (%d,%d)" % [_area_label(str(item.get("area", ""))), int(item.get("x", 0)), int(item.get("y", 0))])
	var id := str(item.get("id", ""))
	if not id.is_empty():
		var run := _current_interaction_run()
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		if _can_sell_item_action(run, id):
			row.add_child(_run_action_button("出售装备", _item_action_from_modal.bind("sell_item", id)))
		if _can_upgrade_item_action(run, id):
			row.add_child(_run_action_button("合成升级", _item_action_from_modal.bind("upgrade_item", id)))
		if row.get_child_count() > 0:
			box.add_child(row)
	_push_modal(modal["panel"])

func _show_relic_detail_modal(relic: Dictionary) -> void:
	var def: Dictionary = _dict(relic, "def")
	var title := _fallback(str(def.get("name", "")), str(relic.get("relicId", relic.get("id", ""))))
	var modal := _modal_panel("遗物详情", Vector2(520, 420))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_render_detail_header(box, _relic_texture(relic), title, "遗物详情 · %s" % _quality_label(str(relic.get("quality", ""))))
	_add_line(box, "品质", _quality_label(str(relic.get("quality", ""))))
	var description := _detail_description(def)
	if not description.is_empty():
		_add_line(box, "说明", description)
	var effect := str(def.get("effect", ""))
	if not effect.is_empty():
		_add_line(box, "效果", effect)
	var relic_id := str(relic.get("id", relic.get("relicId", "")))
	if not relic_id.is_empty():
		box.add_child(_run_action_button("出售遗物", _relic_action_from_modal.bind(relic_id)))
	_push_modal(modal["panel"])

func _show_selected_detail_modal() -> void:
	if not selected_item.is_empty():
		_show_item_detail_modal(selected_item)
		return
	if not selected_relic.is_empty():
		_show_relic_detail_modal(selected_relic)
		return
	_show_error("请先选中装备、背包道具或遗物")

func _render_detail_header(parent: VBoxContainer, texture: Texture2D, title: String, subtitle: String) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	parent.add_child(row)
	var icon := TextureRect.new()
	icon.custom_minimum_size = Vector2(68, 68)
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.texture = texture
	row.add_child(icon)
	var labels := VBoxContainer.new()
	labels.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(labels)
	var title_label := Label.new()
	title_label.text = title
	title_label.custom_minimum_size = Vector2(0, 30)
	title_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	labels.add_child(title_label)
	var subtitle_label := Label.new()
	subtitle_label.text = subtitle
	subtitle_label.custom_minimum_size = Vector2(0, 24)
	subtitle_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	labels.add_child(subtitle_label)

func _add_item_def_details(parent: VBoxContainer, def: Dictionary, quality: String, fallback_id: String) -> void:
	_add_line(parent, "品质", _quality_label(quality))
	if not fallback_id.is_empty():
		_add_line(parent, "资源", fallback_id)
	var dice_text := _detail_array_text(def.get("triggerDice", def.get("dice", [])))
	if not dice_text.is_empty():
		_add_line(parent, "触发点数", dice_text)
	var size_text := _detail_size_text(def)
	if not size_text.is_empty():
		_add_line(parent, "尺寸", size_text)
	var tag_text := _detail_array_text(def.get("tags", []))
	if not tag_text.is_empty():
		_add_line(parent, "标签", tag_text)
	var description := _detail_description(def)
	if not description.is_empty():
		_add_line(parent, "说明", description)
	var effect := str(def.get("effect", ""))
	if not effect.is_empty():
		_add_line(parent, "效果", effect)

func _detail_description(def: Dictionary) -> String:
	for key in ["description", "effectText", "advancedEffect", "summary"]:
		var value := str(def.get(key, ""))
		if not value.is_empty():
			return value
	return ""

func _detail_array_text(value: Variant) -> String:
	var values := _variant_array(value)
	if values.is_empty():
		return ""
	var parts := PackedStringArray()
	for entry in values:
		parts.append(str(entry))
	return ", ".join(parts)

func _detail_size_text(def: Dictionary) -> String:
	if def.has("size"):
		return str(def.get("size", ""))
	if def.has("width") or def.has("height"):
		return "%d x %d" % [int(def.get("width", 1)), int(def.get("height", 1))]
	return ""

func _area_label(area: String) -> String:
	match area:
		"EQUIPMENT":
			return "装备栏"
		"BAG":
			return "背包"
		_:
			return _fallback(area, "未知区域")

func _enchant_choice_label(choice: Dictionary) -> String:
	var enchant: Dictionary = _dict(choice, "enchant")
	return _fallback(str(enchant.get("label", "")), _fallback(str(choice.get("label", "")), str(choice.get("id", ""))))

func _potion_choice_label(choice: Dictionary) -> String:
	return _fallback(str(choice.get("description", "")), _fallback(str(choice.get("category", "")), str(choice.get("id", ""))))

func _enchant_kind_label(kind: String) -> String:
	match kind:
		"EXTRA_DICE":
			return "额外触发点数"
		"BASE_EFFECT":
			return "基础效果"
		"SPECIAL":
			return "特殊状态"
		"TRIGGER_NEIGHBOR":
			return "触发相邻装备"
		"BUFF_NEIGHBOR_EFFECT":
			return "强化相邻装备"
		"GRANT_NEIGHBOR_EFFECT":
			return "赋予相邻效果"
		_:
			return _fallback(kind, "未知附魔")

func _enchant_target_label(target: String) -> String:
	match target:
		"LEFT":
			return "左侧"
		"RIGHT":
			return "右侧"
		"ADJACENT":
			return "相邻"
		_:
			return _fallback(target, "未知目标")

func _enchant_effect_label(effect: String) -> String:
	match effect:
		"DAMAGE":
			return "攻击"
		"HEAL":
			return "恢复生命"
		"SHIELD":
			return "增加护盾"
		"THORNS":
			return "荆棘"
		"FURY":
			return "激昂"
		"POISON":
			return "中毒"
		"WEAK":
			return "虚弱"
		"LIFESTEAL":
			return "吸血"
		"CLEANSE":
			return "净化"
		_:
			return _fallback(effect, "未知效果")

func _potion_category_label(category: String) -> String:
	match category:
		"ADD_ONE":
			return "增加一个点数"
		"ADD_TWO":
			return "增加两个点数"
		"EXTRA_ONE":
			return "额外增加点数"
		"REPLACE_RANGE":
			return "改为指定范围"
		"REPLACE_ALL":
			return "改为全点数"
		_:
			return _fallback(category, "未知药水")

func _buy_offer_from_modal(offer_id: String) -> void:
	_close_top_modal()
	await _call_session("buy_offer", [offer_id, "BAG"])

func _class_reward_from_modal(def_id: String) -> void:
	_close_top_modal()
	await _call_session("select_class_reward", [def_id])

func _relic_choice_from_modal(relic_id: String) -> void:
	_close_top_modal()
	await _call_session("select_relic", [relic_id])

func _enchant_from_modal(enchant_id: String) -> void:
	_close_top_modal()
	await _select_enchant(enchant_id)

func _potion_from_modal(potion_id: String) -> void:
	_close_top_modal()
	await _select_potion(potion_id)

func _item_action_from_modal(method: String, item_id: String) -> void:
	_close_top_modal()
	await _call_session(method, [item_id])

func _relic_action_from_modal(relic_id: String) -> void:
	_close_top_modal()
	await _call_session("sell_relic", [relic_id])

func _filter_area(items: Array, area: String) -> Array:
	var result: Array = []
	for item in items:
		if item is Dictionary and str(item.get("area", "")) == area:
			result.append(item)
	return result

func _modal_panel(title: String, size: Vector2, closable := true) -> Dictionary:
	if _modal_stack() == null:
		_show_error("弹窗层未初始化")
		return {}
	var panel := PanelContainer.new()
	panel.custom_minimum_size = size
	panel.add_theme_stylebox_override("panel", UiTokens.modal_panel_style())
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.offset_left = -size.x / 2.0
	panel.offset_right = size.x / 2.0
	panel.offset_top = -size.y / 2.0
	panel.offset_bottom = size.y / 2.0
	var box := VBoxContainer.new()
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_theme_constant_override("separation", 8)
	panel.add_child(box)
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	box.add_child(header)
	var label := Label.new()
	label.text = title
	label.custom_minimum_size = Vector2(0, 36)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	header.add_child(label)
	if closable:
		header.add_child(_action_button("关闭", _close_top_modal))
	var scroll := ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(scroll)
	var body := VBoxContainer.new()
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 8)
	scroll.add_child(body)
	return {"panel": panel, "box": body}

func _push_modal(panel: Node) -> void:
	var stack: Object = _modal_stack()
	if stack != null and stack.has_method("push_modal"):
		stack.call("push_modal", panel, true)

func _close_top_modal() -> void:
	var stack: Object = _modal_stack()
	if stack != null and stack.has_method("pop_modal"):
		stack.call("pop_modal")

func _modal_stack() -> Object:
	if session == null:
		return null
	return session.get("modal_stack")

func _select_item(item: Dictionary, label: String) -> void:
	selected_item = item.duplicate(true)
	selected_item_id = str(item.get("id", ""))
	selected_item_label = label
	selected_relic_id = ""
	selected_relic = {}
	status_label.text = "已选中：%s" % label
	_render_current_tab()

func _select_reward_target_or_item(item: Dictionary, label: String) -> void:
	_select_item(item, label)
	var run := _current_interaction_run()
	var phase := str(run.get("phase", ""))
	if phase == "ENCHANT_CHOICE":
		await _select_enchant(_active_enchant_choice_id())
	elif phase == "POTION_CHOICE":
		await _select_potion(_active_potion_choice_id())

func _select_relic(relic: Dictionary, label: String) -> void:
	selected_relic = relic.duplicate(true)
	selected_relic_id = str(relic.get("id", relic.get("relicId", "")))
	selected_item_id = ""
	selected_item_label = ""
	selected_item = {}
	status_label.text = "已选中：%s" % label
	_render_current_tab()

func _open_relic_from_rail(relic: Dictionary, label: String) -> void:
	_select_relic(relic, label)
	_show_relic_detail_modal(relic)

func _call_selected_item(method: String) -> void:
	if selected_item_id.is_empty():
		_show_error("请先选中装备或背包道具")
		return
	await _call_session(method, [selected_item_id])

func _move_selected(area: String) -> void:
	if selected_item_id.is_empty():
		_show_error("请先选中装备或背包道具")
		return
	await _call_session("move_item", [selected_item_id, area, 0, 0])

func _move_selected_to(area: String, x: int, y: int) -> void:
	if selected_item_id.is_empty():
		_show_error("请先选中装备或背包道具")
		return
	await _call_session("move_item", [selected_item_id, area, x, y])

func _select_upgrade_item() -> void:
	if selected_item_id.is_empty():
		_show_error("请先选中要升级的装备")
		return
	await _call_session("select_upgrade_item", [selected_item_id])

func _select_potion(potion_id: String) -> void:
	if potion_id.is_empty():
		_show_error("请先选择药水")
		return
	if selected_item_id.is_empty():
		_show_error("请先选中要使用药水的装备")
		return
	await _call_session("select_potion", [potion_id, selected_item_id])

func _select_enchant(enchant_id: String) -> void:
	if enchant_id.is_empty():
		_show_error("请先选择附魔")
		return
	if selected_item_id.is_empty():
		_show_error("请先选中要附魔的装备")
		return
	await _call_session("select_enchant", [enchant_id, selected_item_id])

func _active_enchant_choice_id() -> String:
	var choices := _array(_current_interaction_run(), "enchantChoices")
	if not selected_enchant_choice_id.is_empty():
		for choice in choices:
			if choice is Dictionary and str(choice.get("id", "")) == selected_enchant_choice_id:
				return selected_enchant_choice_id
	for choice in choices:
		if choice is Dictionary:
			return str(choice.get("id", ""))
	return ""

func _active_potion_choice_id() -> String:
	var choices := _array(_current_interaction_run(), "potionChoices")
	if not selected_potion_choice_id.is_empty():
		for choice in choices:
			if choice is Dictionary and str(choice.get("id", "")) == selected_potion_choice_id:
				return selected_potion_choice_id
	for choice in choices:
		if choice is Dictionary:
			return str(choice.get("id", ""))
	return ""

func _api_get(path: String) -> Dictionary:
	var client: ApiClient = _api()
	if client == null:
		return {"ok": false, "error": "API 未初始化", "data": {}}
	return await client.get_json(path)

func _api_post(path: String, body: Dictionary) -> Dictionary:
	var client: ApiClient = _api()
	if client == null:
		return {"ok": false, "error": "API 未初始化", "data": {}}
	return await client.post_json(path, body)

func _guarded_api_get(path: String) -> Dictionary:
	if action_in_progress:
		return {"ok": false, "error": "操作进行中", "data": {}}
	action_in_progress = true
	_update_controls()
	var response: Dictionary = await _api_get(path)
	action_in_progress = false
	_update_controls()
	return response

func _guarded_api_post(path: String, body: Dictionary) -> Dictionary:
	if action_in_progress:
		return {"ok": false, "error": "操作进行中", "data": {}}
	action_in_progress = true
	_update_controls()
	var response: Dictionary = await _api_post(path, body)
	action_in_progress = false
	_update_controls()
	return response

func _api() -> ApiClient:
	if session == null:
		return null
	return session.get("api") as ApiClient

func _run_store() -> Object:
	if session == null:
		return null
	return session.get("run_store")

func _current_run() -> Dictionary:
	var store: Object = _run_store()
	if store == null or not store.has_method("has_run") or not store.has_run():
		return {}
	return store.get("run")

func _current_interaction_run() -> Dictionary:
	if current_tab == TAB_ROOMS and not active_room.is_empty():
		var room_run: Dictionary = _dict(active_room, "currentRun")
		if not room_run.is_empty():
			return room_run
	return _current_run()

func _can_sell_item_action(run: Dictionary, item_id: String) -> bool:
	return not item_id.is_empty() and str(run.get("phase", "")) == "SHOP"

func _can_upgrade_item_action(run: Dictionary, item_id: String) -> bool:
	if item_id.is_empty():
		return false
	if not ["MAP", "CLASS_REWARD", "SHOP", "PREP", "MATCH"].has(str(run.get("phase", ""))):
		return false
	var target := _item_by_id(run, item_id)
	if target.is_empty():
		return false
	var target_quality := str(target.get("quality", "")).to_upper()
	if target_quality == "DIAMOND":
		return false
	var target_def_id := str(target.get("defId", ""))
	for entry in _array(run, "items"):
		if not entry is Dictionary:
			continue
		var candidate: Dictionary = entry
		if str(candidate.get("id", "")) == item_id:
			continue
		if str(candidate.get("defId", "")) == target_def_id and str(candidate.get("quality", "")).to_upper() == target_quality:
			return true
	return false

func _item_by_id(run: Dictionary, item_id: String) -> Dictionary:
	for entry in _array(run, "items"):
		if entry is Dictionary and str((entry as Dictionary).get("id", "")) == item_id:
			return (entry as Dictionary).duplicate(true)
	return {}

func _data(response: Dictionary) -> Dictionary:
	var value = response.get("data", {})
	return value if value is Dictionary else {}

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value = source.get(key, {})
	return value if value is Dictionary else {}

func _array(source: Dictionary, key: String) -> Array:
	var value = source.get(key, [])
	return value if value is Array else []

func _available_map_nodes(map_state: Dictionary) -> Array:
	var available = map_state.get("availableNodeIds", [])
	var nodes = map_state.get("nodes", [])
	var result: Array = []
	if not available is Array or not nodes is Array:
		return result
	for node in nodes:
		if node is Dictionary and available.has(str(node.get("id", ""))):
			result.append(node)
	return result

func _render_item_grid(parent: VBoxContainer, title: String, area: String, run: Dictionary, slot_count: int) -> void:
	_add_line(parent, title, "%d 格固定槽位，从左向右触发" % slot_count)
	var grid := GridContainer.new()
	grid.columns = min(12, slot_count)
	grid.add_theme_constant_override("h_separation", 4)
	grid.add_theme_constant_override("v_separation", 4)
	parent.add_child(grid)
	var items: Array = _array(run, "items")
	for x in range(slot_count):
		var item: Dictionary = _item_at_slot(items, area, x)
		var button := _button(_slot_label(item, x), 58)
		button.custom_minimum_size = Vector2(58, 64)
		button.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		if item.is_empty():
			button.pressed.connect(_move_selected_to.bind(area, x, 0))
		else:
			var label := _item_label(item)
			_apply_button_icon(button, _item_texture(item))
			button.pressed.connect(_select_reward_target_or_item.bind(item, label))
		grid.add_child(button)

func _render_relic_rail(parent: VBoxContainer, run: Dictionary) -> void:
	var relics: Array = _array(run, "relics")
	_add_line(parent, "遗物", "6槽，重复获得升级 · 已拥有 %d 个" % relics.size())
	var grid := GridContainer.new()
	grid.columns = 6
	grid.add_theme_constant_override("h_separation", 4)
	grid.add_theme_constant_override("v_separation", 4)
	parent.add_child(grid)
	for slot in range(6):
		var relic: Dictionary = _relic_at_slot(relics, slot)
		var button := _button(_relic_slot_label(relic, slot), 82)
		button.custom_minimum_size = Vector2(82, 68)
		button.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		if relic.is_empty():
			button.disabled = true
		else:
			var relic_def: Dictionary = _dict(relic, "def")
			var name := _fallback(str(relic_def.get("name", "")), str(relic.get("relicId", "")))
		var label := "遗物：%s  %s" % [name, _quality_label(str(relic.get("quality", "")))]
		_apply_button_icon(button, _relic_texture(relic))
		button.pressed.connect(_open_relic_from_rail.bind(relic, label))
		grid.add_child(button)

func _map_current_node(map_state: Dictionary) -> Dictionary:
	var current_node_id := str(map_state.get("currentNodeId", ""))
	if current_node_id.is_empty():
		return {}
	for node in _array(map_state, "nodes"):
		if node is Dictionary and str((node as Dictionary).get("id", "")) == current_node_id:
			return node as Dictionary
	return {}

func _render_map_route(parent: VBoxContainer, map_state: Dictionary) -> void:
	var nodes: Array = _array(map_state, "nodes")
	if nodes.is_empty():
		_add_line(parent, "路线", "暂无地图节点")
		return
	nodes.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var left_layer := int(a.get("layer", 0))
		var right_layer := int(b.get("layer", 0))
		if left_layer == right_layer:
			return int(a.get("column", 0)) < int(b.get("column", 0))
		return left_layer < right_layer
	)
	var available: Array = _variant_array(map_state.get("availableNodeIds", []))
	var completed: Array = _variant_array(map_state.get("completedNodeIds", []))
	var current_node_id := str(map_state.get("currentNodeId", ""))
	var board := TextureRect.new()
	board.name = "ParchmentMapBoard"
	board.custom_minimum_size = Vector2(0, 360)
	board.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	board.texture = _texture("res://assets/map/exploration-parchment-scroll.webp")
	board.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	board.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	parent.add_child(board)
	var route := VBoxContainer.new()
	route.name = "MapRouteContent"
	route.set_anchors_preset(Control.PRESET_FULL_RECT)
	route.offset_left = 18.0
	route.offset_right = -18.0
	route.offset_top = 18.0
	route.offset_bottom = -18.0
	route.add_theme_constant_override("separation", 6)
	board.add_child(route)
	var active_layer := -999
	var row: HBoxContainer = null
	for node in nodes:
		if not node is Dictionary:
			continue
		var layer := int(node.get("layer", 0))
		if layer != active_layer:
			active_layer = layer
			_add_line(route, "第 %d 层" % (layer + 1), "")
			row = HBoxContainer.new()
			row.add_theme_constant_override("separation", 6)
			route.add_child(row)
		if row != null:
			row.add_child(_map_node_button(node, available, completed, current_node_id))

func _map_node_button(node: Dictionary, available: Array, completed: Array, current_node_id: String) -> Button:
	var node_id := str(node.get("id", ""))
	var available_state := available.has(node_id)
	var completed_state := completed.has(node_id)
	var current_state := node_id == current_node_id
	var state := "可进入" if available_state else ("当前" if current_state else ("已完成" if completed_state else "未解锁"))
	var text := "%s\n%s" % [_map_node_title(node), state]
	var button := _button(text, 86)
	button.custom_minimum_size = Vector2(86, 74)
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_apply_button_icon(button, _map_texture(str(node.get("kind", ""))))
	if available_state:
		button.pressed.connect(_call_session.bind("select_map_node", [node_id]))
	else:
		button.pressed.connect(_show_map_node_modal.bind(node))
	button.disabled = action_in_progress
	return button

func _show_map_node_modal(node: Dictionary) -> void:
	var modal := _modal_panel(_map_node_title(node), Vector2(560, 500))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_add_line(box, "层级", "第 %d 层 · 第 %d 列" % [int(node.get("layer", 0)) + 1, int(node.get("column", 0)) + 1])
	_add_line(box, "类型", _map_node_title(node))
	var shop_type := str(node.get("shopType", ""))
	if not shop_type.is_empty():
		_add_line(box, "商店", _shop_name(shop_type))
	var event: Dictionary = _dict(node, "event")
	if not event.is_empty():
		_add_line(box, "事件", _fallback(str(event.get("title", "")), str(event.get("type", ""))))
		_add_line(box, "说明", str(event.get("description", "")))
	var monster: Dictionary = _dict(node, "monster")
	if not monster.is_empty():
		_add_line(box, "怪物", "%s · %s · 第%d回合" % [str(monster.get("name", "")), _dog_name(str(monster.get("dogType", ""))), int(monster.get("round", int(node.get("layer", 0)) + 1))])
		_render_map_monster_equipment(box, monster)
		_render_map_reward_preview(box, _variant_array(monster.get("possibleRewards", [])))
	if bool(node.get("hidden", false)):
		_add_line(box, "状态", "隐藏事件")
	_push_modal(modal["panel"])

func _render_map_monster_equipment(parent: VBoxContainer, monster: Dictionary) -> void:
	var items := _variant_array(monster.get("equipment", []))
	var label := Label.new()
	label.text = "野怪装备栏"
	label.custom_minimum_size = Vector2(0, 28)
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	parent.add_child(label)
	var grid := GridContainer.new()
	grid.columns = 12
	grid.add_theme_constant_override("h_separation", 4)
	grid.add_theme_constant_override("v_separation", 4)
	parent.add_child(grid)
	for x in range(12):
		var item: Dictionary = _item_at_slot(items, "EQUIPMENT", x)
		var button := _button(_slot_label(item, x), 52)
		button.custom_minimum_size = Vector2(52, 48)
		button.disabled = item.is_empty()
		if not item.is_empty():
			_apply_button_icon(button, _item_texture(item))
			button.pressed.connect(_show_map_monster_item_modal.bind(item))
		grid.add_child(button)

func _render_map_reward_preview(parent: VBoxContainer, rewards: Array) -> void:
	var label := Label.new()
	label.text = "可能掉落"
	label.custom_minimum_size = Vector2(0, 28)
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	parent.add_child(label)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	parent.add_child(row)
	if rewards.is_empty():
		_add_line(parent, "", "暂无可预览掉落")
		return
	for reward in rewards.slice(0, 8):
		if reward is Dictionary:
			var def: Dictionary = _dict(reward, "def")
			var reward_name := _fallback(str(def.get("name", "")), str(reward.get("defId", "")))
			var text := "%s\n%s" % [_quality_label(str(reward.get("quality", ""))), reward_name]
			var button := _button(text, 82)
			button.custom_minimum_size = Vector2(82, 62)
			button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			_apply_button_icon(button, _item_reward_texture(reward))
			button.pressed.connect(_show_map_reward_modal.bind(reward))
			row.add_child(button)

func _show_map_monster_item_modal(item: Dictionary) -> void:
	var def: Dictionary = _dict(item, "def")
	var title := _fallback(str(def.get("name", "")), str(item.get("defId", item.get("id", ""))))
	var modal := _modal_panel("野怪装备详情", Vector2(560, 500))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_render_detail_header(box, _item_texture(item), title, "野怪装备预览 · %s" % _quality_label(str(item.get("quality", ""))))
	_add_item_def_details(box, def, str(item.get("quality", "")), str(item.get("defId", item.get("id", ""))))
	_add_line(box, "触发点数", _map_preview_trigger_text(item))
	_add_line(box, "位置", "%s  (%d,%d)" % [_area_label(str(item.get("area", ""))), int(item.get("x", 0)), int(item.get("y", 0))])
	_push_modal(modal["panel"])

func _show_map_reward_modal(reward: Dictionary) -> void:
	var def: Dictionary = _dict(reward, "def")
	var title := _fallback(str(def.get("name", "")), str(reward.get("defId", "")))
	var modal := _modal_panel("地图掉落预览", Vector2(560, 480))
	if modal.is_empty():
		return
	var box: VBoxContainer = modal["box"]
	_render_detail_header(box, _item_reward_texture(reward), title, "可能掉落 · %s" % _quality_label(str(reward.get("quality", ""))))
	_add_item_def_details(box, def, str(reward.get("quality", "")), str(reward.get("defId", "")))
	_add_line(box, "触发点数", _map_preview_trigger_text(reward))
	_push_modal(modal["panel"])

func _map_preview_trigger_text(source: Dictionary) -> String:
	if source.has("triggerDice") or source.has("dice"):
		return _detail_array_text(source.get("triggerDice", source.get("dice", [])))
	var def: Dictionary = _dict(source, "def")
	return _detail_array_text(def.get("triggerDice", def.get("dice", [])))

func _item_at_slot(items: Array, area: String, x: int) -> Dictionary:
	for item in items:
		if item is Dictionary and str(item.get("area", "")) == area and int(item.get("x", 0)) == x:
			return item
	return {}

func _relic_at_slot(relics: Array, slot: int) -> Dictionary:
	for relic in relics:
		if relic is Dictionary and (relic as Dictionary).has("slot") and int((relic as Dictionary).get("slot", -1)) == slot:
			return relic
	if slot < relics.size() and relics[slot] is Dictionary and not (relics[slot] as Dictionary).has("slot"):
		return relics[slot]
	return {}

func _slot_label(item: Dictionary, x: int) -> String:
	if item.is_empty():
		return str(x + 1)
	var def: Dictionary = _dict(item, "def")
	var name := _fallback(str(def.get("name", "")), str(item.get("defId", item.get("id", ""))))
	return "%d\n%s\n%s" % [x + 1, _quality_label(str(item.get("quality", ""))), name]

func _relic_slot_label(relic: Dictionary, slot: int) -> String:
	if relic.is_empty():
		return "遗物槽 %d\n空遗物槽 %d" % [slot + 1, slot + 1]
	var def: Dictionary = _dict(relic, "def")
	var name := _fallback(str(def.get("name", "")), str(relic.get("relicId", relic.get("id", ""))))
	return "遗物槽 %d\n%s\n%s" % [slot + 1, name, _quality_label(str(relic.get("quality", "")))]

func _equipment_slot_count(run: Dictionary) -> int:
	for relic in _array(run, "relics"):
		if relic is Dictionary:
			var def: Dictionary = _dict(relic, "def")
			if str(def.get("effect", "")) == "EXTRA_EQUIPMENT_REDUCED_EFFECT":
				return 18
	return 12

func _variant_array(value: Variant) -> Array:
	return value if value is Array else []

func _map_node_title(node: Dictionary) -> String:
	match str(node.get("kind", "")):
		"PLAYER_BATTLE":
			return "玩家战"
		"MONSTER_BATTLE":
			return "野怪"
		"SHOP_FIXED":
			return "固定商店"
		"SHOP_UNKNOWN":
			return "未知商店"
		"SHOP_EQUIPMENT":
			return "装备商店"
		"REST":
			return "休整"
		"EVENT":
			return "事件"
		_:
			return str(node.get("kind", "节点"))

func _item_label(item: Dictionary) -> String:
	var def: Dictionary = _dict(item, "def")
	return "%s  %s  %s (%d,%d)" % [
		_fallback(str(def.get("name", "")), str(item.get("defId", item.get("id", "")))),
		_quality_label(str(item.get("quality", ""))),
		_area_label(str(item.get("area", ""))),
		int(item.get("x", 0)),
		int(item.get("y", 0)),
	]

func _offer_label(offer: Dictionary) -> String:
	var def: Dictionary = _dict(offer, "def")
	return "%s  %s" % [_fallback(str(def.get("name", "")), str(offer.get("defId", offer.get("offerId", "")))), _quality_label(str(offer.get("quality", "")))]

func _item_texture(item: Dictionary) -> Texture2D:
	var def_id := str(item.get("defId", ""))
	var art := _item_art_texture(def_id)
	return art if art != null else _sticker_texture(def_id)

func _offer_texture(offer: Dictionary) -> Texture2D:
	var def_id := str(offer.get("defId", ""))
	var art := _item_art_texture(def_id)
	return art if art != null else _sticker_texture(def_id)

func _item_reward_texture(reward: Dictionary) -> Texture2D:
	var def_id := str(reward.get("defId", ""))
	var art := _item_art_texture(def_id)
	return art if art != null else _sticker_texture(def_id)

func _relic_texture(relic: Dictionary) -> Texture2D:
	return _sticker_texture(str(relic.get("relicId", "")))

func _item_art_texture(def_id: String) -> Texture2D:
	if def_id.is_empty():
		return null
	return _texture("res://assets/item-card-art/%s.webp" % def_id)

func _sticker_texture(asset_id: String) -> Texture2D:
	if asset_id.is_empty():
		return _texture("res://assets/sticker-icons/starter-1.webp")
	var texture := _texture("res://assets/sticker-icons/%s.webp" % asset_id)
	return texture if texture != null else _texture("res://assets/sticker-icons/starter-1.webp")

func _map_texture(kind: String) -> Texture2D:
	var key := kind.to_lower().replace("_", "-")
	var path := "res://assets/map-icons/%s.webp" % key
	var texture := _texture(path)
	return texture if texture != null else _texture("res://assets/map-icons/event.webp")

func _texture(path: String) -> Texture2D:
	if ResourceLoader.exists(path):
		var imported := ResourceLoader.load(path)
		if imported is Texture2D:
			return imported
	if not FileAccess.file_exists(path):
		return null
	var image := Image.new()
	if image.load(path) != OK:
		return null
	return ImageTexture.create_from_image(image)

func _apply_button_icon(button: Button, texture: Texture2D) -> void:
	if texture == null:
		return
	button.icon = texture
	button.expand_icon = true

func _section(title: String) -> VBoxContainer:
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", UiTokens.paper_panel_style())
	content.add_child(panel)
	var box := VBoxContainer.new()
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_theme_constant_override("separation", 8)
	panel.add_child(box)
	var label := Label.new()
	label.text = title
	label.custom_minimum_size = Vector2(0, 32)
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	box.add_child(label)
	return box

func _add_line(parent: VBoxContainer, label: String, value: String) -> void:
	var row := Label.new()
	row.custom_minimum_size = Vector2(0, 28)
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	row.text = "%s：%s" % [label, value] if not label.is_empty() else value
	row.add_theme_color_override("font_color", UiTokens.ink_color())
	parent.add_child(row)

func _add_plain_line(parent: VBoxContainer, text: String) -> void:
	var row := Label.new()
	row.custom_minimum_size = Vector2(0, 24)
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	row.text = text
	row.add_theme_color_override("font_color", UiTokens.ink_color())
	parent.add_child(row)

func _apply_button_style(button: Button) -> void:
	button.custom_minimum_size.y = max(button.custom_minimum_size.y, UiTokens.touch_target_height())
	button.add_theme_stylebox_override("normal", UiTokens.button_style())
	button.add_theme_stylebox_override("hover", UiTokens.button_hover_style())
	button.add_theme_stylebox_override("pressed", UiTokens.button_pressed_style())
	button.add_theme_stylebox_override("disabled", UiTokens.button_disabled_style())
	button.add_theme_color_override("font_color", UiTokens.ink_color())
	button.add_theme_color_override("font_hover_color", UiTokens.ink_color())
	button.add_theme_color_override("font_pressed_color", UiTokens.ink_color())
	button.add_theme_color_override("font_disabled_color", Color(0.24, 0.20, 0.16, 0.70))

func _apply_input_style(input: LineEdit) -> void:
	input.custom_minimum_size.y = max(input.custom_minimum_size.y, UiTokens.touch_target_height())
	input.add_theme_stylebox_override("normal", UiTokens.input_style())
	input.add_theme_stylebox_override("focus", UiTokens.input_focus_style())
	input.add_theme_color_override("font_color", Color(0.98, 0.92, 0.82, 1.0))
	input.add_theme_color_override("font_placeholder_color", Color(0.75, 0.66, 0.54, 0.90))

func _button(text: String, min_width: int) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(min_width, 38)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL if min_width == 0 else Control.SIZE_SHRINK_BEGIN
	button.clip_text = true
	button.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_apply_button_style(button)
	return button

func _action_button(text: String, handler: Callable) -> Button:
	var button := _button(text, 0)
	button.disabled = action_in_progress
	button.pressed.connect(handler)
	return button

func _run_action_button(text: String, handler: Callable) -> Button:
	var button := _action_button(text, handler)
	button.disabled = button.disabled or _room_current_run_action_locked()
	return button

func _disabled_action_button(text: String) -> Button:
	var button := _button(text, 0)
	button.disabled = true
	return button

func _mode_button(title: String, description: String, action_label: String, handler: Callable) -> Button:
	var button := _button("%s\n%s\n%s" % [title, description, action_label], 0)
	button.custom_minimum_size = Vector2(0, 78)
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button.pressed.connect(handler)
	button.disabled = action_in_progress
	return button

func _update_controls() -> void:
	if lobby_button != null:
		lobby_button.disabled = action_in_progress
	if dog_type_select != null:
		dog_type_select.disabled = action_in_progress
	if mode_select != null:
		mode_select.disabled = action_in_progress
	if lucky_select != null:
		lucky_select.disabled = action_in_progress
	if create_run_button != null:
		create_run_button.disabled = action_in_progress
	if refresh_button != null:
		refresh_button.disabled = action_in_progress
	if nav_list != null:
		for child in nav_list.get_children():
			if child is Button:
				child.disabled = action_in_progress
	if content != null:
		_set_buttons_disabled(content, action_in_progress)
	var stack := _modal_stack()
	if stack != null:
		var panels: Array = stack.get("stack")
		for panel in panels:
			if panel is Node:
				_set_buttons_disabled(panel, action_in_progress)

func _set_buttons_disabled(node: Node, disabled: bool) -> void:
	if node is Button:
		var button := node as Button
		if disabled:
			if not button.disabled:
				button.set_meta("disabled_by_action", true)
				button.disabled = true
		elif button.has_meta("disabled_by_action"):
			button.remove_meta("disabled_by_action")
			button.disabled = false
	for child in node.get_children():
		_set_buttons_disabled(child, disabled)

func _clear_children(container: Node) -> void:
	for child in container.get_children():
		container.remove_child(child)
		child.queue_free()

func _fallback(value: String, fallback: String) -> String:
	return fallback if value.is_empty() or value == "<null>" else value

func _show_error(message: String) -> void:
	status_label.text = message
