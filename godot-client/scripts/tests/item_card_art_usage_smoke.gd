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
	for method_name in ["_item_art_texture", "_item_texture", "_offer_texture"]:
		if not run_screen.has_method(method_name):
			_fail("%s is missing" % method_name)
			return
	var item_texture: Texture2D = run_screen.call("_item_texture", {"defId": "v3-wooden-shield"})
	if item_texture == null or item_texture.get_width() <= 128:
		_fail("Item texture must prefer migrated item-card-art over sticker icon")
		return
	var offer_texture: Texture2D = run_screen.call("_offer_texture", {"defId": "v4-growing-chew-sword"})
	if offer_texture == null or offer_texture.get_width() <= 128:
		_fail("Offer texture must prefer migrated item-card-art over sticker icon")
		return
	var fallback_texture: Texture2D = run_screen.call("_item_texture", {"defId": "starter-1"})
	if fallback_texture == null:
		_fail("Item texture must still fall back to sticker icon")
		return
	var source := FileAccess.get_file_as_string("res://scripts/ui/RunScreen.gd")
	if not source.contains("res://assets/item-card-art/%s.webp"):
		_fail("RunScreen must load migrated item-card-art assets")
		return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
