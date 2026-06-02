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
	if not screen.has_method("configure_cosmetics"):
		_fail("BattleReplayScreen cosmetic configuration is missing")
		return
	screen.call("configure_cosmetics", {
		"equipped": [
			{"slot": "DOG_SKIN", "catalogItemId": "skin-shiba-scarf", "item": {"id": "skin-shiba-scarf", "name": "柴犬围巾", "type": "DOG_SKIN"}},
			{"slot": "BATTLE_EFFECT", "catalogItemId": "fx-aurora-roll", "item": {"id": "fx-aurora-roll", "name": "极光投掷", "type": "BATTLE_EFFECT"}},
		],
	})
	screen.start_replay({
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"events": [{
			"time": 1,
			"actor": "player",
			"kind": "ITEM",
			"text": "装备触发",
			"roll": 6,
			"playerHp": 100,
			"opponentHp": 95,
			"playerMaxHp": 100,
			"opponentMaxHp": 100,
		}],
		"playerSnapshot": _snapshot("你的狗狗", "SHIBA"),
		"opponentSnapshot": _snapshot("离线狗狗", "MUTT"),
	})
	await process_frame
	var text := _collect_text(screen)
	if not text.contains("极光投掷"):
		_fail("Equipped battle effect label is missing")
		return
	var player_avatar: TextureRect = screen.get("player_avatar")
	if player_avatar == null or player_avatar.modulate == Color.WHITE:
		_fail("Equipped dog skin did not visibly tint player avatar")
		return
	screen.call("_apply_event", {
		"time": 1,
		"actor": "player",
		"kind": "ITEM",
		"text": "装备触发",
		"roll": 6,
		"playerHp": 100,
		"opponentHp": 95,
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
	})
	await process_frame
	if not str((screen.get("dice_label") as Label).text).contains("极光投掷"):
		_fail("Equipped battle effect did not decorate dice label")
		return
	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle cosmetics smoke passed")
	quit(0)

func _snapshot(name: String, dog_type: String) -> Dictionary:
	return {
		"name": name,
		"dogType": dog_type,
		"wins": 1,
		"losses": 0,
		"round": 2,
		"items": [],
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
