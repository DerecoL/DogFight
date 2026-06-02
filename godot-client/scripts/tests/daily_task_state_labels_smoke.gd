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
	var run_screen = main.get_node_or_null("ScreenRoot/RunScreen")
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	run_screen.set("daily_data", {
		"dateKey": "2026-06-02",
		"refreshUsed": true,
		"wallet": {"balance": 240},
		"tasks": [
			{
				"taskId": "daily-claimed",
				"progress": 3,
				"target": 3,
				"reward": 15,
				"claimedAt": "2026-06-02T05:10:00.000Z",
				"def": {"title": "每日战斗", "description": "完成 3 场战斗"},
			},
			{
				"taskId": "daily-ready",
				"progress": 5,
				"target": 5,
				"reward": 20,
				"claimedAt": "",
				"def": {"title": "商店达人", "description": "购买 5 件商品"},
			},
			{
				"taskId": "daily-open",
				"progress": 1,
				"target": 4,
				"reward": 10,
				"claimedAt": "",
				"def": {"title": "继续挑战", "description": "完成 4 个回合"},
			},
		],
	})
	run_screen.set("current_tab", "每日")
	run_screen.call("_render_current_tab")
	await process_frame
	var text := _collect_text(run_screen)
	for part in ["每日任务", "2026-06-02 · 余额 240", "今日已刷新", "已领取 每日战斗", "可领取 商店达人", "未完成 继续挑战", "1/4", "奖励 10"]:
		if not text.contains(str(part)):
			_fail("Daily task state label missing: %s" % str(part))
			return
	var refresh_button := _find_button(run_screen, "今日已刷新")
	if refresh_button == null:
		_fail("Used refresh button is missing")
		return
	if not refresh_button.disabled:
		_fail("Used refresh button should be disabled")
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot daily task state labels smoke passed")
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

func _find_button(node: Node, needle: String) -> Button:
	if node is Button and (node as Button).text.contains(needle):
		return node as Button
	for child in node.get_children():
		var found := _find_button(child, needle)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
