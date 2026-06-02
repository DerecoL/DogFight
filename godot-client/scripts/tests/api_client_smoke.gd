extends SceneTree

func _init() -> void:
	var session_script := load("res://scripts/state/GameSession.gd")
	var api_script := load("res://scripts/api/ApiClient.gd")
	var types_script := load("res://scripts/api/ApiTypes.gd")
	var routes_script := load("res://scripts/api/ApiRoutes.gd")
	if session_script == null or api_script == null or types_script == null:
		push_error("Core Godot client scripts failed to load")
		quit(1)
		return
	if routes_script == null:
		push_error("ApiRoutes.gd failed to load")
		quit(1)
		return
	if routes_script.login() != "/auth/login":
		push_error("ApiRoutes.login returned wrong path")
		quit(1)
		return
	if routes_script.register() != "/auth/register":
		push_error("ApiRoutes.register returned wrong path")
		quit(1)
		return
	if routes_script.taptap_login() != "/auth/taptap":
		push_error("ApiRoutes.taptap_login returned wrong path")
		quit(1)
		return
	if routes_script.logout() != "/auth/logout" or routes_script.profile_nickname() != "/profile/nickname":
		push_error("ApiRoutes auth profile paths are invalid")
		quit(1)
		return
	if routes_script.achievements() != "/achievements" or routes_script.daily_tasks() != "/daily-tasks":
		push_error("ApiRoutes account progression paths are invalid")
		quit(1)
		return
	if routes_script.cosmetics_equip() != "/cosmetics/equip" or routes_script.apex_submit() != "/apex/submit":
		push_error("ApiRoutes cosmetics or apex paths are invalid")
		quit(1)
		return
	if routes_script.dogfight_rooms() != "/dogfight/rooms" or routes_script.dogfight_room_ready("room-1") != "/dogfight/rooms/room-1/ready":
		push_error("ApiRoutes dogfight room paths are invalid")
		quit(1)
		return
	if routes_script.run_battle_start("run-1") != "/runs/run-1/battle/start":
		push_error("ApiRoutes.run_battle_start returned wrong path")
		quit(1)
		return
	var account_store_script := load("res://scripts/state/AccountStore.gd")
	var app_store_script := load("res://scripts/state/AppStore.gd")
	if account_store_script == null or app_store_script == null:
		push_error("Store foundation scripts failed to load")
		quit(1)
		return
	var app_store = app_store_script.new()
	app_store.set_user({"id": "user-1", "account": "tester", "nickname": "测试员"})
	if str(app_store.account.user_id()) != "user-1":
		push_error("AppStore did not update AccountStore user")
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
	if api.is_loading():
		push_error("ApiClient should not be loading before requests")
		quit(1)
		return
	if api.timeout_seconds <= 0:
		push_error("ApiClient timeout_seconds must be positive")
		quit(1)
		return
	var value = types_script.string_value({"phase": "SHOP"}, "phase", "MAP")
	if value != "SHOP":
		push_error("ApiTypes.string_value returned wrong value")
		quit(1)
		return
	var login_scene := load("res://scenes/LoginScreen.tscn")
	if login_scene == null:
		push_error("LoginScreen scene failed to load")
		quit(1)
		return
	var login_screen = login_scene.instantiate()
	if login_screen.get_node_or_null("%RegisterButton") == null:
		push_error("LoginScreen must expose RegisterButton")
		quit(1)
		return
	if login_screen.get_node_or_null("%TapTapButton") == null or login_screen.get_node_or_null("%TapTapCodeInput") == null:
		push_error("LoginScreen must expose TapTap login controls")
		quit(1)
		return
	login_screen.free()
	var run_scene := load("res://scenes/RunScreen.tscn")
	if run_scene == null:
		push_error("RunScreen scene failed to load")
		quit(1)
		return
	var run_screen = run_scene.instantiate()
	if not run_screen.has_method("bind_session"):
		push_error("RunScreen must expose bind_session")
		quit(1)
		return
	if not run_screen.has_method("_save_nickname") or not run_screen.has_method("_unequip_cosmetic") or not run_screen.has_method("_submit_apex_candidate"):
		push_error("RunScreen must expose account, cosmetics, and apex actions")
		quit(1)
		return
	if not run_screen.has_method("_render_lobby_tab") or not run_screen.has_method("_render_settings_tab") or not run_screen.has_method("_show_history_modal") or not run_screen.has_method("_show_snapshot_modal"):
		push_error("RunScreen must expose lobby, settings, history, and snapshot panels")
		quit(1)
		return
	if not run_screen.has_method("_render_item_grid") or not run_screen.has_method("_render_map_route") or not run_screen.has_method("_show_map_node_modal"):
		push_error("RunScreen must expose visual inventory and map route views")
		quit(1)
		return
	run_screen.free()
	var battle_scene := load("res://scenes/BattleReplayScreen.tscn")
	if battle_scene == null:
		push_error("BattleReplayScreen scene failed to load")
		quit(1)
		return
	var battle_screen = battle_scene.instantiate()
	if not battle_screen.has_method("start_replay") or not battle_screen.has_method("_render_snapshots") or not battle_screen.has_method("_set_log_filter") or not battle_screen.has_method("_set_speed"):
		push_error("BattleReplayScreen must expose replay snapshots, filters, and speed controls")
		quit(1)
		return
	battle_screen.free()
	api.free()
	node.free()
	quit(0)
