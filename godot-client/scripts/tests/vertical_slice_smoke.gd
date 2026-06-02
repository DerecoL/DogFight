extends SceneTree

const ApiClient := preload("res://scripts/api/ApiClient.gd")

var api: ApiClient

func _init() -> void:
	_run()

func _run() -> void:
	api = ApiClient.new()
	var base_url := OS.get_environment("DOGFIGHT_API_BASE_URL")
	api.configure(base_url if base_url.length() > 0 else "http://127.0.0.1:4000/api")
	root.add_child(api)
	await process_frame

	var account := "godot-smoke-%d-%d" % [Time.get_unix_time_from_system(), Time.get_ticks_usec()]
	await _expect_ok(await api.post_json("/auth/register", {"account": account, "password": "dogdice"}), "register")
	await _expect_ok(await api.post_json("/profile/nickname", {"nickname": "Godot烟测"}), "set nickname")
	var create_response: Dictionary = await _expect_ok(await api.post_json("/runs", {"dogType": "SHIBA", "mode": "CASUAL"}), "create run")
	var run: Dictionary = _run_from(create_response, "create run")
	var run_id := str(run.get("id", ""))
	if run_id.is_empty():
		_fail("created run did not include id")
		return

	var node_id := _first_available_node_id(run, "MONSTER_BATTLE")
	if node_id.is_empty():
		_fail("created run did not expose an available monster battle map node")
		return
	var map_response: Dictionary = await _expect_ok(await api.post_json("/runs/%s/map/select" % run_id, {"nodeId": node_id}), "select map node")
	run = _run_from(map_response, "select map node")
	if str(run.get("phase", "")) != "MATCH":
		_fail("selecting monster map node should enter MATCH")
		return

	var battle_response: Dictionary = await _expect_ok(await api.post_json("/runs/%s/battle/start" % run_id, {}), "start battle")
	run = _run_from(battle_response, "start battle")
	if str(run.get("phase", "")) != "BATTLE":
		_fail("battle start should enter BATTLE")
		return
	var battle = battle_response.get("data", {}).get("battle", {})
	if not battle is Dictionary or not battle.has("events"):
		_fail("battle start did not return battle events")
		return

	var finish_response: Dictionary = await _expect_ok(await api.post_json("/runs/%s/battle/finish" % run_id, {}), "finish battle")
	run = _run_from(finish_response, "finish battle")
	if str(run.get("phase", "")) == "BATTLE":
		_fail("battle finish should leave BATTLE")
		return
	print("Godot vertical slice smoke passed: ", run_id)
	quit(0)

func _expect_ok(response: Dictionary, label: String) -> Dictionary:
	if not bool(response.get("ok", false)):
		_fail("%s failed: %s" % [label, str(response.get("error", ""))])
	return response

func _run_from(response: Dictionary, label: String) -> Dictionary:
	var data = response.get("data", {})
	var run = data.get("run", {}) if data is Dictionary else {}
	if run is Dictionary:
		return run
	_fail("%s did not return run" % label)
	return {}

func _first_available_node_id(run: Dictionary, kind: String) -> String:
	var map_state = run.get("mapState", {})
	if not map_state is Dictionary:
		return ""
	var available: Array = map_state.get("availableNodeIds", [])
	for node in map_state.get("nodes", []):
		if node is Dictionary and available.has(str(node.get("id", ""))) and str(node.get("kind", "")) == kind:
			return str(node.get("id", ""))
	return ""

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
