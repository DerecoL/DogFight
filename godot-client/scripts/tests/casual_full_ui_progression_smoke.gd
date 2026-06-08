extends SceneTree

var seen_paths: Dictionary = {}
var main_node: Node

func _init() -> void:
	_run()

func _run() -> void:
	var main := await _new_logged_in_main()
	if main == null:
		return
	var router = main.get("router")
	if not await _wait_for_screen(router, "legacy_run"):
		_fail("Login should route to playable lobby")
		return
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null or not legacy.visible:
		_fail("LegacyRunScreen should be visible after login")
		return

	var casual_button = _find_button_containing(legacy, "开始休闲模式")
	if casual_button == null:
		_fail("Playable lobby must expose casual mode entry")
		return
	casual_button.pressed.emit()
	await process_frame
	await process_frame
	var start_button = _find_button_containing(legacy, "开始一局")
	if start_button == null:
		_fail("Casual dog-selection tab must expose start-run confirmation")
		return

	seen_paths.clear()
	start_button.pressed.emit()
	if not await _wait_for_path("/runs"):
		_fail("Start-run confirmation should POST /runs")
		return
	if not await _wait_for_idle(legacy):
		_fail("Start-run action should finish refreshing")
		return
	if not await _wait_for_run_phase(main, "MAP"):
		_fail("New casual run should start on the exploration map")
		return
	_assert_no_placeholder_or_old_screens(main, "created casual run")

	var run_id := _current_run_id(main)
	if run_id.is_empty():
		_fail("Created casual run should expose a run id")
		return
	if not await _advance_to_match_phase(main, legacy, run_id):
		return
	if not await _start_and_finish_battle(main, legacy, router, run_id):
		return
	_assert_no_placeholder_or_old_screens(main, "finished battle")

	main.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot casual full UI progression smoke passed")
	quit(0)

func _new_logged_in_main() -> Node:
	var main_scene = load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return null
	var main = main_scene.instantiate()
	main_node = main
	root.add_child(main)
	await process_frame
	await process_frame
	var api = main.get("api")
	if api == null or not api.has_signal("request_finished"):
		_fail("Main API client must emit request_finished")
		return null
	api.request_finished.connect(func(path: String, _ok: bool, _status: int, _payload: Dictionary) -> void:
		seen_paths[path] = true
	)
	var router = main.get("router")
	var login_screen = main.get_node_or_null("ScreenRoot/LoginScreen")
	if router == null or login_screen == null:
		_fail("Main must expose router and LoginScreen")
		return null
	var account_input = login_screen.get_node_or_null("%AccountInput") as LineEdit
	var password_input = login_screen.get_node_or_null("%PasswordInput") as LineEdit
	if account_input == null or password_input == null:
		_fail("LoginScreen must expose account and password inputs")
		return null
	account_input.text = "godot-casual-full-%d-%d" % [int(Time.get_unix_time_from_system()), Time.get_ticks_usec()]
	password_input.text = "dogdice"
	await login_screen.call("_on_register_pressed")
	if not await _wait_for_screen(router, "nickname_setup"):
		_fail("Register should route to nickname setup")
		return null
	var nickname_screen = main.get_node_or_null("ScreenRoot/NicknameSetupScreen")
	var nickname_input := _find_line_edit(nickname_screen)
	if nickname_input == null:
		_fail("NicknameSetupScreen must expose nickname input")
		return null
	nickname_input.text = "休闲全流程烟测"
	await nickname_screen.call("_submit_nickname")
	return main

func _advance_to_match_phase(main: Node, legacy: Node, run_id: String) -> bool:
	for _step in range(14):
		var phase := _current_run_phase(main)
		if phase == "MATCH":
			return true
		if phase == "BATTLE":
			return true
		if phase == "MAP":
			if not await _advance_map_phase(main, legacy, run_id):
				return false
		elif phase == "SHOP":
			if not await _advance_shop_phase(main, legacy, run_id):
				return false
		elif phase == "PREP":
			if not await _click_action_and_wait(legacy, "匹配对手", "/runs/%s/battle/match" % run_id):
				_fail("PREP phase should match an opponent from the visible UI")
				return false
		else:
			_fail("Casual full-flow smoke reached unsupported pre-battle phase: %s" % phase)
			return false
		if not await _wait_for_idle(legacy):
			_fail("Run action should finish refreshing")
			return false
		_assert_no_placeholder_or_old_screens(main, "advancing casual run")
	_fail("Casual run did not reach battle match phase within the UI action budget")
	return false

func _advance_map_phase(main: Node, legacy: Node, run_id: String) -> bool:
	var run := _current_run(main)
	var map_state: Dictionary = _dict(run, "mapState")
	if not _dict(map_state, "pendingReward").is_empty():
		if await _click_action_and_wait(legacy, "跳过怪物奖励", "/runs/%s/map/monster-reward/skip" % run_id):
			return true
		_fail("Pending monster reward should expose a skip action")
		return false
	var current_node := _current_map_node(map_state)
	if str(current_node.get("kind", "")) == "EVENT":
		if await _click_action_and_wait(legacy, "处理事件", "/runs/%s/map/event" % run_id):
			return true
		_fail("Current event node should expose resolve action")
		return false
	var target_button = await _wait_for_preferred_available_map_button(legacy, run)
	if target_button == null:
		_fail("MAP phase should expose at least one reachable map node (%s)" % _map_debug_summary(legacy, run))
		return false
	seen_paths.clear()
	target_button.pressed.emit()
	if not await _wait_for_path("/runs/%s/map/select" % run_id):
		_fail("Reachable map node click should POST map/select")
		return false
	return true

func _advance_shop_phase(main: Node, legacy: Node, run_id: String) -> bool:
	var run := _current_run(main)
	var current_node := _current_map_node(_dict(run, "mapState"))
	var expected_path := "/runs/%s/map/complete-node" % run_id if not current_node.is_empty() else "/runs/%s/battle/match" % run_id
	for label in ["进入战斗", "返回地图", "匹配对手"]:
		if await _click_action_and_wait(legacy, label, expected_path):
			return true
	_fail("SHOP phase should expose a Web-style progression action")
	return false

func _start_and_finish_battle(main: Node, legacy: Node, router: Node, run_id: String) -> bool:
	if _current_run_phase(main) == "MATCH":
		if not await _wait_for_idle(legacy):
			_fail("MATCH phase should finish rendering before battle start")
			return false
		if not await _click_action_and_wait(legacy, "开始战斗", "/runs/%s/battle/start" % run_id):
			_fail("MATCH phase should start battle from the visible UI (%s)" % _button_debug_summary(legacy))
			return false
	if not await _wait_for_screen(router, "battle_replay"):
		_fail("Starting a battle should route to BattleReplayScreen")
		return false
	var battle_screen = main.get_node_or_null("ScreenRoot/BattleReplayScreen")
	if battle_screen == null or not battle_screen.visible:
		_fail("BattleReplayScreen should be visible after battle start")
		return false
	var skip_button = battle_screen.get_node_or_null("%SkipButton") as Button
	var finish_button = battle_screen.get_node_or_null("%FinishButton") as Button
	if skip_button == null or finish_button == null:
		_fail("Battle replay must expose skip and finish buttons")
		return false
	skip_button.pressed.emit()
	for _frame in range(20):
		if not finish_button.disabled:
			break
		await process_frame
	if finish_button.disabled:
		_fail("Skipping battle replay should enable finish")
		return false
	seen_paths.clear()
	finish_button.pressed.emit()
	if not await _wait_for_path("/runs/%s/battle/finish" % run_id):
		_fail("Battle finish button should POST battle/finish")
		return false
	if not await _wait_for_screen(router, "legacy_run"):
		_fail("Finishing a battle should return to the playable run shell")
		return false
	for _frame in range(240):
		if _current_run_phase(main) != "BATTLE":
			return true
		await process_frame
	_fail("Finishing a battle should advance the run out of BATTLE phase")
	return false

func _click_action_and_wait(root_node: Node, text: String, path: String) -> bool:
	var button = await _wait_for_button_containing(root_node, text)
	if button == null:
		return false
	seen_paths.clear()
	button.pressed.emit()
	return await _wait_for_path(path)

func _wait_for_button_containing(node: Node, text: String) -> Button:
	for _frame in range(120):
		var button := _find_button_containing(node, text)
		if button != null:
			return button
		await process_frame
	return null

func _button_debug_summary(node: Node) -> String:
	var buttons: Array[Button] = []
	_collect_visible_buttons(node, buttons)
	var parts: Array[String] = []
	for button in buttons.slice(0, 12):
		parts.append(button.text.replace("\n", " / "))
	return "buttons=%d [%s]" % [buttons.size(), " | ".join(parts)]

func _preferred_available_map_button(root_node: Node, run: Dictionary) -> Button:
	var map_state: Dictionary = _dict(run, "mapState")
	var target_id := _preferred_available_node_id(map_state)
	if target_id.is_empty():
		return null
	var route = root_node.find_child("MapRouteContent", true, false)
	if route == null:
		return null
	var buttons: Array[Button] = []
	_collect_visible_buttons(route, buttons)
	var nodes := _array(map_state, "nodes")
	nodes.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		var left_layer := int(left.get("layer", 0))
		var right_layer := int(right.get("layer", 0))
		if left_layer == right_layer:
			return int(left.get("column", 0)) < int(right.get("column", 0))
		return left_layer < right_layer
	)
	var count = min(nodes.size(), buttons.size())
	for index in range(count):
		var node: Dictionary = nodes[index]
		if str(node.get("id", "")) == target_id:
			return buttons[index]
	return null

func _wait_for_preferred_available_map_button(root_node: Node, run: Dictionary) -> Button:
	for _frame in range(120):
		var button := _preferred_available_map_button(root_node, run)
		if button != null:
			return button
		await process_frame
	return null

func _preferred_available_node_id(map_state: Dictionary) -> String:
	var available := _array(map_state, "availableNodeIds")
	var nodes := _array(map_state, "nodes")
	for priority in ["PLAYER_BATTLE", "MONSTER_BATTLE", "SHOP_FIXED", "SHOP_EQUIPMENT", "SHOP_UNKNOWN", "REST", "EVENT"]:
		for node in nodes:
			if not node is Dictionary:
				continue
			var entry: Dictionary = node
			var node_id := str(entry.get("id", ""))
			if available.has(node_id) and str(entry.get("kind", "")) == priority:
				return node_id
	for node in nodes:
		if not node is Dictionary:
			continue
		var node_id := str((node as Dictionary).get("id", ""))
		if available.has(node_id):
			return node_id
	return ""

func _map_debug_summary(root_node: Node, run: Dictionary) -> String:
	var map_state: Dictionary = _dict(run, "mapState")
	var route = root_node.find_child("MapRouteContent", true, false)
	var buttons: Array[Button] = []
	if route != null:
		_collect_visible_buttons(route, buttons)
	return "phase=%s nodes=%d available=%d current=%s route=%s buttons=%d" % [
		str(run.get("phase", "")),
		_array(map_state, "nodes").size(),
		_array(map_state, "availableNodeIds").size(),
		str(map_state.get("currentNodeId", "")),
		"yes" if route != null else "no",
		buttons.size(),
	]

func _collect_visible_buttons(node: Node, out: Array[Button]) -> void:
	if node == null:
		return
	if node is Button and (node as Button).is_visible_in_tree() and not (node as Button).disabled:
		out.append(node as Button)
	for child in node.get_children():
		_collect_visible_buttons(child, out)

func _collect_buttons_containing(node: Node, text: String, out: Array[Button]) -> void:
	if node == null:
		return
	if node is Button and (node as Button).is_visible_in_tree() and not (node as Button).disabled and (node as Button).text.contains(text):
		out.append(node as Button)
	for child in node.get_children():
		_collect_buttons_containing(child, text, out)

func _wait_for_screen(router: Node, screen_id: String) -> bool:
	for _frame in range(240):
		if str(router.get("current_screen_id")) == screen_id:
			return true
		await process_frame
	return false

func _wait_for_path(path: String) -> bool:
	for _frame in range(300):
		if seen_paths.has(path):
			return true
		await process_frame
	return false

func _wait_for_idle(legacy: Node) -> bool:
	for _frame in range(300):
		if legacy != null and not bool(legacy.get("action_in_progress")):
			return true
		await process_frame
	return false

func _wait_for_run_phase(main: Node, phase: String) -> bool:
	for _frame in range(240):
		if _current_run_phase(main) == phase:
			return true
		await process_frame
	return false

func _current_run(main: Node) -> Dictionary:
	var run_store = main.get("run_store")
	if run_store != null and run_store.has_method("has_run") and run_store.has_run():
		return run_store.get("run")
	return {}

func _current_run_id(main: Node) -> String:
	return str(_current_run(main).get("id", ""))

func _current_run_phase(main: Node) -> String:
	return str(_current_run(main).get("phase", ""))

func _current_map_node(map_state: Dictionary) -> Dictionary:
	var current_node_id := str(map_state.get("currentNodeId", ""))
	if current_node_id.is_empty():
		return {}
	for node in _array(map_state, "nodes"):
		if node is Dictionary and str((node as Dictionary).get("id", "")) == current_node_id:
			return node as Dictionary
	return {}

func _find_line_edit(node: Node) -> LineEdit:
	if node == null:
		return null
	if node is LineEdit:
		return node as LineEdit
	for child in node.get_children():
		var result := _find_line_edit(child)
		if result != null:
			return result
	return null

func _find_button_containing(node: Node, text: String) -> Button:
	if node == null:
		return null
	if node is Button and (node as Button).is_visible_in_tree() and not (node as Button).disabled and (node as Button).text.contains(text):
		return node as Button
	for child in node.get_children():
		var result := _find_button_containing(child, text)
		if result != null:
			return result
	return null

func _array(source: Dictionary, key: String) -> Array:
	var value = source.get(key, [])
	return value if value is Array else []

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value = source.get(key, {})
	return value if value is Dictionary else {}

func _assert_no_placeholder_or_old_screens(main: Node, context: String) -> void:
	if _visible_placeholder(main):
		_fail("%s must not show placeholder content" % context)
	var legacy = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if legacy == null or not legacy.visible:
		_fail("%s should stay in the playable shell" % context)
	for old_screen in ["ModeLobbyScreen", "ExplorationMapScreen", "RunShopScreen", "RewardChoiceScreen", "RunSettlementScreen"]:
		var screen = main.get_node_or_null("ScreenRoot/%s" % old_screen)
		if screen != null and screen.visible:
			_fail("%s must not show old standalone screen %s" % [context, old_screen])

func _visible_placeholder(main: Node) -> bool:
	var placeholder = main.find_child("PlaceholderPanel", true, false)
	return placeholder is CanvasItem and (placeholder as CanvasItem).is_visible_in_tree()

func _fail(message: String) -> void:
	push_error(message)
	if main_node != null:
		main_node.queue_free()
	quit(1)
