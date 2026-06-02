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
	if not screen.has_method("_on_restart_pressed"):
		_fail("BattleReplayScreen must expose a replay restart control")
		return
	var battle := {
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"winner": "player",
		"events": [_event()],
		"playerSnapshot": _snapshot("player-bite"),
		"opponentSnapshot": _snapshot("opponent-bite"),
	}
	screen.start_replay(battle)
	screen.call("_apply_event", _event())
	screen.call("_mark_replay_complete")
	await process_frame
	var text := _collect_text(screen)
	if not text.contains("战斗数据看板"):
		_fail("Battle review must be visible before restart")
		return
	screen.call("_on_restart_pressed")
	await process_frame
	if int(screen.get("event_index")) != 0 or bool(screen.get("replay_complete")):
		_fail("Restart must reset replay index and completion state")
		return
	var player_hp: ProgressBar = screen.get_node("%PlayerHp")
	var opponent_hp: ProgressBar = screen.get_node("%OpponentHp")
	if int(player_hp.value) != 100 or int(opponent_hp.value) != 100:
		_fail("Restart must restore initial HP")
		return
	var review_panel: PanelContainer = screen.get("review_panel")
	if review_panel != null and review_panel.visible:
		_fail("Restart must hide battle review")
		return
	var log_view: RichTextLabel = screen.get_node("%Log")
	if not log_view.text.is_empty():
		_fail("Restart must clear replay log")
		return
	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle restart replay smoke passed")
	quit(0)

func _event() -> Dictionary:
	return {
		"time": 1.0,
		"actor": "player",
		"kind": "ITEM",
		"text": "1点牙咬造成 5 点伤害",
		"effectType": "DAMAGE",
		"target": "opponent",
		"sourceHpDelta": 0,
		"targetHpDelta": -5,
		"roll": 1,
		"itemId": "player-bite",
		"playerHp": 100,
		"opponentHp": 95,
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
	}

func _snapshot(item_id: String) -> Dictionary:
	return {
		"name": item_id,
		"dogType": "SHIBA",
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
