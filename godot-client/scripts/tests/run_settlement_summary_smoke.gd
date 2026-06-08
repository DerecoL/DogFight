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
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	var store = main.get("run_store")
	if store == null or not store.has_method("set_run"):
		_fail("RunStore is missing")
		return
	store.set_run({
		"id": "run-complete",
		"mode": "LADDER",
		"phase": "COMPLETE",
		"status": "COMPLETE",
		"dogType": "SHIBA",
		"round": 12,
		"wins": 12,
		"losses": 2,
		"gold": 18,
		"score": 1202,
		"items": [],
		"relics": [],
		"shopItems": [],
		"ladderSettlement": {
			"id": "settle-1",
			"beforeTier": "GOLD",
			"beforeScore": 82,
			"afterTier": "PLATINUM",
			"afterScore": 16,
			"delta": 34,
			"wins": 12,
			"losses": 2,
		},
	})
	run_screen.set("current_tab", "跑局")
	run_screen.call("_render_current_tab")
	await process_frame
	var text := _collect_text(run_screen)
	for part in ["跑局结算", "12 胜 / 2 负", "最终分数", "1202", "金币 18", "天梯结算", "黄金", "铂金", "+34"]:
		if not text.contains(part):
			_fail("Settlement summary missing: %s" % part)
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot run settlement summary smoke passed")
	quit(0)

func _collect_text(node: Node) -> String:
	var text := ""
	if node is Label:
		text += (node as Label).text + "\n"
	if node is Button:
		text += (node as Button).text + "\n"
	for child in node.get_children():
		text += _collect_text(child)
	return text

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
