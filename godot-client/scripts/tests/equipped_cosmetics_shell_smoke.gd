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
	run_screen.set("me_data", {
		"user": {"account": "cosmetic-player", "nickname": "外观玩家"},
	})
	run_screen.set("cosmetics_data", {
		"inventory": [],
		"equipped": [
			{"slot": "TITLE", "catalogItemId": "title-dog-king-shadow", "item": {"id": "title-dog-king-shadow", "name": "犬王之影", "type": "TITLE"}},
			{"slot": "AVATAR", "catalogItemId": "avatar-crown", "item": {"id": "avatar-crown", "name": "皇冠头像", "type": "AVATAR"}},
			{"slot": "BACKGROUND", "catalogItemId": "bg-royal-kennel", "item": {"id": "bg-royal-kennel", "name": "皇家犬舍", "type": "BACKGROUND"}},
		],
	})
	run_screen.call("_render_shell")
	await process_frame
	var background = run_screen.get_node_or_null("Background")
	if background == null or not background is TextureRect:
		_fail("RunScreen background is missing")
		return
	var texture: Texture2D = (background as TextureRect).texture
	if texture == null or not str(texture.resource_path).contains("storybook-royal-kennel.webp"):
		_fail("Equipped background was not applied")
		return
	var text := _collect_text(run_screen)
	for part in ["外观玩家", "冠", "犬王之影"]:
		if not text.contains(part):
			_fail("Equipped profile cosmetic missing: %s" % part)
			return
	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot equipped cosmetics shell smoke passed")
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
