extends SceneTree

var _button_pressed_count := 0

func _init() -> void:
	var button_factory = load("res://scripts/ui/shared/WebActionButton.gd")
	if button_factory == null:
		_fail("WebActionButton.gd must load")
		return
	var pill_factory = load("res://scripts/ui/shared/WebResourcePill.gd")
	if pill_factory == null:
		_fail("WebResourcePill.gd must load")
		return

	var primary = button_factory.create("Start", _on_button_pressed, "primary")
	if primary == null or not primary is Button:
		_fail("WebActionButton.create must return a Button")
		return
	if primary.text != "Start":
		_fail("WebActionButton must keep the requested label")
		return
	if int(primary.custom_minimum_size.y) < 44:
		_fail("WebActionButton touch height must stay at least 44")
		return
	if primary.size_flags_horizontal != Control.SIZE_SHRINK_CENTER:
		_fail("WebActionButton must not expand horizontally by default")
		return
	if primary.autowrap_mode != TextServer.AUTOWRAP_OFF:
		_fail("WebActionButton must keep stable single-line height")
		return
	if not primary.clip_text or primary.text_overrun_behavior != TextServer.OVERRUN_TRIM_ELLIPSIS:
		_fail("WebActionButton must clip overflowing text")
		return
	primary.emit_signal("pressed")
	if _button_pressed_count != 1:
		_fail("WebActionButton must call the provided callback when pressed")
		return

	var danger = button_factory.create("Delete", _on_button_pressed, "danger")
	if danger == null or danger.get_theme_stylebox("normal") == null:
		_fail("WebActionButton danger variant must provide a normal style")
		return

	button_factory.set_loading(primary, true, "Loading")
	if not primary.disabled or primary.text != "Loading":
		_fail("WebActionButton.set_loading(true) must disable and show loading text")
		return
	button_factory.set_loading(primary, false, "Start")
	if primary.disabled or primary.text != "Start":
		_fail("WebActionButton.set_loading(false) must enable and restore label")
		return

	var pill = pill_factory.create("\u91d1\u5e01", 12, "gold")
	if pill == null or not pill is PanelContainer:
		_fail("WebResourcePill.create must return PanelContainer")
		return
	if pill.name != "ResourcePill_gold":
		_fail("WebResourcePill must include tone in node name")
		return
	if int(pill.custom_minimum_size.x) < 110:
		_fail("WebResourcePill width must stay at least 110")
		return
	if int(pill.custom_minimum_size.y) < 34:
		_fail("WebResourcePill height must stay at least 34")
		return
	var label = pill.get_node_or_null("ResourcePillText")
	if label == null or not label is Label:
		_fail("WebResourcePill must contain ResourcePillText label")
		return
	if not str(label.text).contains("\u91d1\u5e01 12"):
		_fail("WebResourcePill text must include label and value")
		return
	if label.autowrap_mode != TextServer.AUTOWRAP_OFF:
		_fail("WebResourcePill text must not wrap")
		return
	if label.text_overrun_behavior != TextServer.OVERRUN_TRIM_ELLIPSIS:
		_fail("WebResourcePill text must trim overflow")
		return

	print("Web shared controls smoke passed")
	quit(0)

func _on_button_pressed() -> void:
	_button_pressed_count += 1

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
