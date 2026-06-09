extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var screen_scene := load("res://scenes/screens/RunSettlementScreen.tscn")
	if screen_scene == null:
		_fail("RunSettlementScreen scene failed to load")
		return
	var screen = screen_scene.instantiate()
	root.add_child(screen)
	await process_frame
	screen.call("set_payload", {"run": _settled_run()})
	await process_frame

	var text := _collect_text(screen)
	for part in ["跑局结束", "胜场", "12", "败场", "2", "积分", "1202", "天梯结算", "黄金 82", "铂金 16", "基础 +42", "段位税 5", "败场 3", "+34"]:
		if not text.contains(part):
			_fail("Settlement summary missing: %s" % part)
			return

	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot run settlement summary smoke passed")
	quit(0)

func _settled_run() -> Dictionary:
	return {
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
			"baseScore": 42,
			"tierTax": 5,
			"lossPenalty": 3,
			"perfectBonus": 0,
			"newbieProtection": 0,
			"delta": 34,
			"wins": 12,
			"losses": 2,
		},
	}

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
