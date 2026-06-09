extends SceneTree

const ApiClientScript := preload("res://scripts/api/ApiClient.gd")

class FakeApi:
	extends ApiClientScript

	var seen_paths: Dictionary = {}
	var seen_bodies: Dictionary = {}

	func post_json(path: String, body: Dictionary = {}) -> Dictionary:
		seen_paths[path] = true
		seen_bodies[path] = body.duplicate(true)
		return {
			"ok": true,
			"data": {
				"run": {
					"id": "casual-created-run",
					"mode": str(body.get("mode", "CASUAL")),
					"phase": "SHOP",
					"status": "ACTIVE",
					"dogType": str(body.get("dogType", "SHIBA")),
					"luckyNumber": body.get("luckyNumber", null),
					"round": 1,
					"wins": 0,
					"losses": 0,
					"gold": 10,
					"items": [],
					"relics": [],
					"shopItems": [],
					"choices": [],
					"classRewardChoices": [],
					"enchantChoices": [],
					"relicChoices": [],
					"upgradeChoices": [],
					"potionChoices": [],
					"mapState": {"nodes": [], "availableNodeIds": [], "completedNodeIds": [], "currentNodeId": ""},
				},
			},
		}

var main_node: Node
var fake_api_node: FakeApi

func _init() -> void:
	_run()

func _run() -> void:
	var main_scene = load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	main_node = main
	root.add_child(main)
	await process_frame
	await process_frame
	var router = main.get("router")
	if router == null:
		_fail("Main must expose router")
		return
	var fake_api := FakeApi.new()
	fake_api_node = fake_api
	main.set("api", fake_api)
	main.add_child(fake_api)
	main.set("current_user", {"id": "casual-smoke-user", "nickname": "CasualUiSmoke"})
	main.set("needs_nickname_setup", false)
	main.call("open_screen", "mode_lobby")
	var reached_mode_lobby := false
	for _frame in range(240):
		if str(router.get("current_screen_id")) == "mode_lobby":
			reached_mode_lobby = true
			break
		await process_frame
	if not reached_mode_lobby:
		_fail("Main should route to standalone mode lobby")
		return
	var mode_lobby = main.get_node_or_null("ScreenRoot/ModeLobbyScreen")
	if mode_lobby == null or not mode_lobby.visible:
		_fail("ModeLobbyScreen should be visible")
		return
	var casual_button = mode_lobby.find_child("CasualModeButton", true, false) as Button
	if casual_button == null:
		_fail("Standalone mode lobby must expose CasualModeButton")
		return

	casual_button.pressed.emit()
	var reached_dog_select := false
	for _frame in range(240):
		if str(router.get("current_screen_id")) == "dog_select":
			reached_dog_select = true
			break
		await process_frame
	if not reached_dog_select:
		_fail("Casual mode entry should open standalone dog_select screen")
		return
	var dog_select = main.get_node_or_null("ScreenRoot/DogSelectScreen")
	if dog_select == null or not dog_select.visible:
		_fail("Casual mode entry should show standalone DogSelectScreen")
		return
	if main.get("run_store").has_run():
		_fail("Entering casual mode must not create a run before dog confirmation")
		return
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy != null and legacy.visible:
		_fail("Casual mode entry must not show LegacyRunScreen")
		return

	var start_button = dog_select.find_child("StartRunButton", true, false) as Button
	if start_button == null:
		_fail("Standalone dog_select screen must expose StartRunButton")
		return
	start_button.pressed.emit()
	var posted_runs := false
	for _frame in range(600):
		if fake_api_node != null and fake_api_node.seen_paths.has("/runs"):
			posted_runs = true
			break
		await process_frame
	if not posted_runs:
		_fail("Start-run confirmation should POST /runs")
		return
	var body: Dictionary = fake_api_node.seen_bodies.get("/runs", {})
	if str(body.get("mode", "")) != "CASUAL" or str(body.get("dogType", "")) != "SHIBA":
		_fail("Start-run confirmation should send Web dog-select payload, got %s" % str(body))
		return
	var became_idle := false
	for _frame in range(600):
		if dog_select != null and not bool(dog_select.get("action_in_progress")):
			became_idle = true
			break
		await process_frame
	if not became_idle:
		_fail("Start-run confirmation should finish refreshing")
		return
	var created_run := false
	for _frame in range(600):
		var run_store = main.get("run_store")
		if run_store != null and run_store.has_method("has_run") and run_store.has_run():
			var run: Dictionary = run_store.get("run")
			if str(run.get("mode", "")) == "CASUAL":
				created_run = true
				break
		await process_frame
	if not created_run:
		_fail("Start-run confirmation should create a playable CASUAL run; store=%s" % _run_store_debug(main))
		return
	var reached_run_shop := false
	for _frame in range(240):
		if str(router.get("current_screen_id")) == "run_shop":
			reached_run_shop = true
			break
		await process_frame
	if not reached_run_shop:
		_fail("Created CASUAL run should route to standalone run_shop screen, got %s" % str(router.get("current_screen_id")))
		return
	if main.get_node_or_null("ScreenRoot/ModeLobbyScreen").visible:
		_fail("Created run must hide ModeLobbyScreen")
		return
	if dog_select.visible:
		_fail("Created run must hide DogSelectScreen")
		return
	if legacy != null and legacy.visible:
		_fail("Created run must not show LegacyRunScreen")
		return
	var run_shop = main.get_node_or_null("ScreenRoot/RunShopScreen")
	if run_shop == null or run_shop.find_child("PlaceholderPanel", true, false) != null:
		_fail("Created run must show real standalone RunShopScreen content")
		return

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot casual UI create run smoke passed")
	quit(0)

func _run_store_debug(main: Node) -> String:
	var run_store = main.get("run_store")
	if run_store == null:
		return "<missing>"
	return "has_run=%s run=%s" % [str(run_store.has_run()), str(run_store.get("run"))]

func _fail(message: String) -> void:
	push_error(message)
	if main_node != null:
		main_node.queue_free()
	quit(1)
