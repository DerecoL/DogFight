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
	if not main.has_method("_show_reward_summary"):
		_fail("GameSession must expose reward summary modal")
		return
	var modal_layer = main.get_node_or_null("OverlayRoot/ModalLayer")
	if modal_layer == null:
		_fail("ModalLayer is missing")
		return
	main.call("_show_reward_summary", {
		"source": "MONSTER_BATTLE",
		"title": "野怪战斗奖励",
		"entries": [
			{"kind": "item", "label": "获得装备", "detail": "1点牙咬 · 铜", "defId": "starter-1", "quality": "BRONZE"},
			{"kind": "gold", "label": "获得金币", "detail": "+6 金币"},
			{"kind": "tolerance", "label": "恢复容错", "detail": "+1 容错"},
		],
	})
	await process_frame
	if modal_layer.get_child_count() != 1:
		_fail("Reward summary did not push a modal")
		return
	var text := _collect_text(modal_layer)
	if not text.contains("野怪战斗奖励") or not text.contains("获得装备") or not text.contains("+6 金币"):
		_fail("Reward summary modal did not render title and entries")
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot reward summary smoke passed")
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
