extends SceneTree

var main_node: Node

func _init() -> void:
	_run()

func _run() -> void:
	var packed := load("res://scenes/screens/AccountShopScreen.tscn")
	if packed == null:
		_fail("AccountShopScreen scene failed to load")
		return
	var account_shop = packed.instantiate()
	main_node = account_shop
	root.add_child(account_shop)
	await process_frame
	await process_frame

	if str(account_shop.get("playable_redirect_screen_id")) != "":
		_fail("AccountShopScreen must be a real standalone Web screen, not a Legacy redirect")
		return
	if account_shop.find_child("PlaceholderPanel", true, false) != null:
		_fail("AccountShopScreen must not render a placeholder panel")
		return
	if account_shop.find_child("AccountShopPanel", true, false) == null:
		_fail("AccountShopScreen must render the Web account shop panel")
		return

	account_shop.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot account shop standalone screen smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	if main_node != null:
		main_node.queue_free()
	quit(1)
