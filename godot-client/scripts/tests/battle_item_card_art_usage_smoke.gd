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
	await process_frame
	for method_name in ["_battle_item_art_texture", "_battle_item_texture"]:
		if not screen.has_method(method_name):
			_fail("%s is missing" % method_name)
			return
	var item_texture: Texture2D = screen.call("_battle_item_texture", {"defId": "v3-flea-disc"})
	if item_texture == null or item_texture.get_width() <= 128:
		_fail("Battle item texture must prefer migrated item-card-art over sticker icon")
		return
	var fallback_texture: Texture2D = screen.call("_battle_item_texture", {"defId": "starter-1"})
	if fallback_texture == null:
		_fail("Battle item texture must still fall back to sticker icon")
		return
	var source := FileAccess.get_file_as_string("res://scripts/ui/BattleReplayScreen.gd")
	if not source.contains("res://assets/item-card-art/%s.webp"):
		_fail("BattleReplayScreen must reference migrated item-card-art assets")
		return
	screen.queue_free()
	for _frame in range(5):
		await process_frame
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
