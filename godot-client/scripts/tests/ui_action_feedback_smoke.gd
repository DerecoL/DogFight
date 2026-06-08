extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var main_scene := load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame
	var run_screen = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if run_screen != null and run_screen.has_method("bind_session"):
		run_screen.bind_session(main)
	var session = main
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	for method_name in ["_ui_action_success_message", "_push_ui_action_success"]:
		if not run_screen.has_method(method_name):
			_fail("%s is missing" % method_name)
			return
	var actions := [
		"claim_achievement",
		"claim_daily",
		"purchase_shop_item",
		"equip_cosmetic",
		"unequip_cosmetic",
		"submit_apex",
		"create_room",
		"match_room",
		"leave_room",
		"ready_room",
		"choose_room_dog",
	]
	for action in actions:
		var message := str(run_screen.call("_ui_action_success_message", action))
		if message.strip_edges().is_empty():
			_fail("Missing UI action success message: %s" % action)
			return
	var toast_bus = session.get("toast_bus")
	if toast_bus == null:
		_fail("Session ToastBus is missing")
		return
	toast_bus.clear()
	run_screen.call("_push_ui_action_success", "purchase_shop_item")
	var toast: Dictionary = toast_bus.pop_next()
	if str(toast.get("kind", "")) != "success" or str(toast.get("message", "")).strip_edges().is_empty():
		_fail("UI action success feedback must push a success toast")
		return
	var source := FileAccess.get_file_as_string("res://scripts/ui/RunScreen.gd")
	for needle in [
		"_post_and_store(ApiRoutes.achievement_claim(achievement_id), {}, \"achievements\", \"claim_achievement\")",
		"_post_and_store(ApiRoutes.daily_task_claim(task_id), {}, \"daily\", \"claim_daily\")",
		"_post_and_store(ApiRoutes.shop_purchase(), {\"catalogItemId\": catalog_item_id}, \"shop\", \"purchase_shop_item\")",
		"_apply_room_response(response, \"create_room\")",
	]:
		if not source.contains(str(needle)):
			_fail("RunScreen UI action feedback is not wired: %s" % str(needle))
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
