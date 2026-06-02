extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var scene := load("res://scenes/BattleReplayScreen.tscn")
	if scene == null:
		_fail("BattleReplayScreen scene failed to load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame
	var event := {
		"time": 1.2,
		"actor": "player",
		"kind": "ITEM",
		"text": "1点牙咬造成 5 点伤害",
		"roll": 1,
		"itemId": "player-bite",
		"playerHp": 92,
		"opponentHp": 80,
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"playerShield": 7,
		"opponentShield": 3,
		"playerStatuses": {"positive": [{"type": "shield", "label": "护盾", "amount": 7}], "negative": [{"type": "poison", "label": "中毒", "stacks": 2}]},
		"opponentStatuses": {"positive": [], "negative": [{"type": "weak", "label": "虚弱", "remaining": 2}]},
		"reservoirs": {"player": [{"itemId": "frog-pool", "duration": 10, "progress": 5, "nextAt": 6, "speedMultiplier": 1}], "opponent": []},
	}
	screen.start_replay({
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"events": [event],
		"playerSnapshot": _snapshot("你的狗狗", "SHIBA", "player-bite"),
		"opponentSnapshot": _snapshot("离线狗狗", "MUTT", "opponent-bite"),
	})
	screen.call("_apply_event", event)
	await process_frame
	var text := _collect_text(screen)
	if not text.contains("护盾 7") or not text.contains("中毒x2") or not text.contains("frog-pool 50%"):
		_fail("BattleReplayScreen did not render shield, statuses, and reservoirs")
		return
	var buttons: Dictionary = screen.get("player_item_buttons")
	var button = buttons.get("player-bite", null)
	if not button is Button or (button as Button).modulate == Color.WHITE:
		_fail("BattleReplayScreen did not highlight active equipment")
		return
	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle replay visual smoke passed")
	quit(0)

func _snapshot(name: String, dog_type: String, item_id: String) -> Dictionary:
	return {
		"name": name,
		"dogType": dog_type,
		"wins": 0,
		"losses": 0,
		"round": 1,
		"items": [
			{"id": item_id, "defId": "starter-1", "quality": "BRONZE", "area": "EQUIPMENT", "x": 0, "y": 0, "def": {"name": "1点牙咬"}},
		],
		"relics": [],
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
