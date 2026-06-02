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
	run_screen.set("meta_shop_data", {
		"wallet": {"balance": 360, "dailyEarned": 40},
		"sections": {
			"permanent": [
				{
					"id": "title-paper-crown",
					"name": "纸冠头衔",
					"description": "在账号面板展示纸冠称号",
					"type": "TITLE",
					"rarity": "EPIC",
					"price": 120,
					"owned": false,
				},
			],
			"featured": [
				{
					"id": "avatar-crown",
					"name": "皇冠头像",
					"description": "显示皇冠头像",
					"type": "AVATAR",
					"rarity": "RARE",
					"price": 80,
					"owned": true,
				},
				{
					"id": "bg-royal-kennel",
					"name": "皇家犬舍",
					"description": "主页背景",
					"type": "BACKGROUND",
					"rarity": "LEGENDARY",
					"price": 300,
					"owned": true,
				},
			],
		},
	})
	run_screen.set("cosmetics_data", {
		"equipped": [
			{"slot": "BACKGROUND", "catalogItemId": "bg-royal-kennel", "item": {"id": "bg-royal-kennel", "name": "皇家犬舍", "type": "BACKGROUND"}},
		],
		"inventory": [
			{"catalogItemId": "avatar-crown", "item": {"id": "avatar-crown", "name": "皇冠头像", "type": "AVATAR", "rarity": "RARE"}, "owned": true},
			{"catalogItemId": "bg-royal-kennel", "item": {"id": "bg-royal-kennel", "name": "皇家犬舍", "type": "BACKGROUND", "rarity": "LEGENDARY"}, "owned": true},
		],
	})
	run_screen.set("current_tab", "商城")
	run_screen.call("_render_current_tab")
	await process_frame
	var text := _collect_text(run_screen)
	for part in ["账号商城 / 外观", "余额 360 / 今日获得 40", "常驻区", "精选轮换区", "购买 纸冠头衔", "称号", "史诗", "装备 皇冠头像", "头像", "稀有", "已装备 皇家犬舍", "主页背景", "传说", "默认 称号"]:
		if not text.contains(str(part)):
			_fail("Account shop catalog label missing: %s" % str(part))
			return
	for raw in ["featured", "permanent", "TITLE", "AVATAR", "BACKGROUND"]:
		if text.contains(str(raw)):
			_fail("Account shop leaked raw catalog label: %s" % str(raw))
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot account shop catalog labels smoke passed")
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
