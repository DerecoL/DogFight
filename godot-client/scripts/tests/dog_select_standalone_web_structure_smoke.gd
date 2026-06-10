extends SceneTree

var screen_node: Node

func _init() -> void:
	_run()

func _run() -> void:
	var scene = load("res://scenes/screens/DogSelectScreen.tscn")
	if scene == null:
		_fail("DogSelectScreen scene failed to load")
		return
	var screen = scene.instantiate()
	screen_node = screen
	root.add_child(screen)
	await process_frame
	await process_frame

	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("DogSelectScreen must be standalone and must not redirect to LegacyRunScreen")
		return
	if screen.find_child("PlaceholderPanel", true, false) != null:
		_fail("DogSelectScreen must not render placeholder content")
		return
	for node_name in ["DogSelectScreen", "ScreenHeading", "DogSelect", "DogCardGrid", "DogDetailPanel", "StartRunButton"]:
		if screen.find_child(node_name, true, false) == null:
			_fail("Standalone DogSelectScreen missing Web node: %s" % node_name)
			return
	var grid = screen.find_child("DogCardGrid", true, false) as GridContainer
	if grid == null or grid.columns != 4:
		_fail("Standalone DogCardGrid should use four columns like Web, got %s" % (str(grid.columns) if grid != null else "<missing>"))
		return
	if grid.get_child_count() != 8:
		_fail("Standalone DogCardGrid should mirror Web's fixed 8 dog slots, got %d" % grid.get_child_count())
		return
	for dog_type in ["SHIBA", "SAMOYED", "MUTT", "BULLY", "EMPEROR", "FROG"]:
		var card = screen.find_child("DogCard_%s" % dog_type, true, false) as Button
		if card == null:
			_fail("Standalone DogCardGrid missing card for %s" % dog_type)
			return
		for child_name in [
			"DogCardArtFrame_%s" % dog_type,
			"DogCardDogBadge_%s" % dog_type,
			"DogCardAvatar_%s" % dog_type,
			"DogCardArt_%s" % dog_type,
			"DogCardName_%s" % dog_type,
			"DogCardCopy_%s" % dog_type,
			"DogCardTagRow_%s" % dog_type,
		]:
			if card.find_child(child_name, true, false) == null:
				_fail("Standalone DogCard should mirror Web card child: %s" % child_name)
				return
		var art = card.find_child("DogCardArt_%s" % dog_type, true, false) as TextureRect
		if art == null or art.texture == null:
			_fail("Standalone DogCardGrid card must render dog art for %s" % dog_type)
			return
		var avatar = card.find_child("DogCardAvatar_%s" % dog_type, true, false) as TextureRect
		if avatar == null or avatar.texture == null:
			_fail("Standalone DogCardGrid card must render Web dog-avatar for %s" % dog_type)
			return
	var detail_avatar := screen.find_child("DogDetailAvatar", true, false) as TextureRect
	if detail_avatar == null or detail_avatar.texture == null:
		_fail("Standalone DogDetailPanel must render Web DogBadge avatar texture")
		return
	for index in [6, 7]:
		if screen.find_child("DogCardPlaceholder_%d" % index, true, false) == null:
			_fail("Standalone DogCardGrid missing Web placeholder slot %d" % index)
			return
	var selected = screen.find_child("DogCard_SHIBA", true, false) as Button
	if selected == null or not selected.button_pressed:
		_fail("Standalone DogSelectScreen should select SHIBA by default")
		return
	if _visible_option_button_count(screen) > 0:
		_fail("Standalone DogSelectScreen must not expose old dropdown run creation controls")
		return
	var start_buttons := _visible_named_button_count(screen, "StartRunButton")
	if start_buttons != 1:
		_fail("Standalone DogSelectScreen should expose one Web start action, got %d" % start_buttons)
		return

	screen.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot standalone dog select Web structure smoke passed")
	quit(0)

func _visible_option_button_count(node: Node) -> int:
	var count := 0
	if node is OptionButton and (node as OptionButton).is_visible_in_tree():
		count += 1
	for child in node.get_children():
		count += _visible_option_button_count(child)
	return count

func _visible_named_button_count(node: Node, node_name: String) -> int:
	var count := 0
	if node.name == node_name and node is Button:
		count += 1
	for child in node.get_children():
		count += _visible_named_button_count(child, node_name)
	return count

func _fail(message: String) -> void:
	push_error(message)
	if screen_node != null:
		screen_node.queue_free()
	quit(1)
