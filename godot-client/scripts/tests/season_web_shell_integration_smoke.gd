extends SceneTree

func _init() -> void:
	var scene := load("res://scenes/screens/SeasonScreen.tscn")
	if scene == null:
		_fail("SeasonScreen scene must load")
		return
	var screen = scene.instantiate()
	root.add_child(screen)
	await process_frame

	if screen.find_child("WebShell", true, false) == null:
		_fail("SeasonScreen must include WebShell")
		return
	if screen.find_child("LegacyRunScreen", true, false) != null:
		_fail("SeasonScreen must not embed LegacyRunScreen")
		return
	if screen.find_child("PlaceholderPanel", true, false) != null:
		_fail("SeasonScreen must not show placeholder content")
		return

	screen.call("set_payload", {
		"user": {"nickname": "赛季玩家"},
		"run": {"gold": 9, "wins": 1, "losses": 0, "round": 2},
		"season": {"id": "season-1", "name": "第一赛季", "status": "ACTIVE"},
		"seasonSummaries": [
			{"id": "summary-1", "seasonName": "测试赛季", "ladderTierLabel": "白银", "ladderTier": "SILVER", "ladderScore": 120, "apexRank": 3},
		],
	})
	await process_frame

	var text := _collect_text(screen)
	for part in ["赛季玩家", "金币 9", "第一赛季", "测试赛季", "白银", "120"]:
		if not text.contains(part):
			_fail("SeasonScreen missing WebShell or season text: %s" % part)
			return

	screen.queue_free()
	print("Season WebShell integration smoke passed")
	quit(0)

func _collect_text(node: Node) -> String:
	var parts: Array[String] = []
	_collect_text_into(node, parts)
	return "\n".join(parts)

func _collect_text_into(node: Node, parts: Array[String]) -> void:
	if node is Label or node is Button:
		parts.append(str(node.get("text")))
	for child in node.get_children():
		_collect_text_into(child, parts)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
