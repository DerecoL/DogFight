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
	screen.start_replay(_battle())
	for event in _events():
		screen.call("_apply_event", event)
	await process_frame

	var shell := _find_by_name(screen, "CollapsedBattleLog")
	if shell == null:
		_fail("CollapsedBattleLog must exist")
		return
	var log := _find_by_name(shell, "BattleLog") as RichTextLabel
	if log == null:
		_fail("CollapsedBattleLog must contain the active BattleLog body")
		return
	if not log.visible:
		_fail("BattleLog must remain visible in collapsed mode like the Web recent log")
		return
	if not log.text.contains("system event 4"):
		_fail("Collapsed BattleLog must show recent log entries")
		return
	if log.text.contains("system event 1"):
		_fail("Collapsed BattleLog must trim older entries")
		return

	var toggle := _find_by_name(shell, "BattleLogToggle") as Button
	if toggle == null:
		_fail("CollapsedBattleLog must expose BattleLogToggle")
		return
	if toggle.text != "展开日志":
		_fail("BattleLogToggle collapsed text must mirror Web")
		return
	toggle.pressed.emit()
	await process_frame
	if toggle.text != "收起日志":
		_fail("BattleLogToggle expanded text must mirror Web")
		return
	if not log.text.contains("system event 1"):
		_fail("Expanded BattleLog must show older entries")
		return

	var damage_filter := _find_by_name(shell, "BattleLogFilter_damage") as Button
	if damage_filter == null:
		_fail("Battle log must expose named damage filter")
		return
	damage_filter.pressed.emit()
	await process_frame
	damage_filter = _find_by_name(shell, "BattleLogFilter_damage") as Button
	if damage_filter == null:
		_fail("Battle log damage filter must remain available after rerender")
		return
	if not damage_filter.button_pressed:
		_fail("Damage filter must become active")
		return
	if not log.text.contains("damage event"):
		_fail("Damage filter must keep damage events")
		return
	if log.text.contains("system event"):
		_fail("Damage filter must hide unrelated system events")
		return

	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot battle log shell Web structure smoke passed")
	quit(0)

func _battle() -> Dictionary:
	return {
		"id": "battle-log-shell",
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
		"winner": "player",
		"events": _events(),
		"playerSnapshot": _snapshot("Hero"),
		"opponentSnapshot": _snapshot("Rival"),
	}

func _events() -> Array:
	return [
		_event(1, "system", "UTILITY", "system event 1", ""),
		_event(2, "system", "UTILITY", "system event 2", ""),
		_event(3, "player", "ITEM", "damage event", "DAMAGE"),
		_event(4, "system", "UTILITY", "system event 4", ""),
	]

func _event(time: int, actor: String, kind: String, text: String, effect_type: String) -> Dictionary:
	return {
		"time": time,
		"actor": actor,
		"kind": kind,
		"text": text,
		"effectType": effect_type,
		"target": "opponent",
		"sourceHpDelta": 0,
		"targetHpDelta": -5 if effect_type == "DAMAGE" else 0,
		"roll": 1,
		"itemId": "player-bite" if effect_type == "DAMAGE" else "",
		"playerHp": 100,
		"opponentHp": 95,
		"playerMaxHp": 100,
		"opponentMaxHp": 100,
	}

func _snapshot(display_name: String) -> Dictionary:
	return {
		"name": display_name,
		"dogType": "SHIBA",
		"wins": 1,
		"losses": 0,
		"round": 2,
		"items": [
			{"id": "player-bite", "defId": "starter-1", "quality": "BRONZE", "area": "EQUIPMENT", "x": 0, "y": 0, "def": {"name": "Bite", "size": 1}},
		],
		"relics": [],
	}

func _find_by_name(node: Node, node_name: String) -> Node:
	if node.name == node_name:
		return node
	for child in node.get_children():
		var found := _find_by_name(child, node_name)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
