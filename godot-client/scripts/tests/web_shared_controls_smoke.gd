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
	if int(primary.custom_minimum_size.y) < 48:
		_fail("WebActionButton touch height must stay at least the web token touch target")
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

	for variant in ["primary", "secondary", "danger"]:
		var variant_button = button_factory.create("Variant %s" % variant, _on_button_pressed, variant)
		for state in ["normal", "hover", "pressed", "disabled"]:
			if not variant_button.has_theme_stylebox_override(state):
				_fail("WebActionButton %s variant must provide %s style override" % [variant, state])
				return

	var stable_height: float = primary.custom_minimum_size.y
	button_factory.set_loading(primary, true, "Loading")
	if not primary.disabled or primary.text != "Loading":
		_fail("WebActionButton.set_loading(true) must disable and show loading text")
		return
	if primary.custom_minimum_size.y != stable_height:
		_fail("WebActionButton loading must not change button height")
		return
	button_factory.set_loading(primary, false, "Wrong external label")
	if primary.disabled or primary.text != "Start":
		_fail("WebActionButton.set_loading(false) must restore the original label without trusting callers")
		return
	if primary.custom_minimum_size.y != stable_height:
		_fail("WebActionButton restore must not change button height")
		return

	var disabled_button = button_factory.create("Locked", _on_button_pressed, "primary")
	disabled_button.disabled = true
	button_factory.set_loading(disabled_button, true, "Loading locked")
	button_factory.set_loading(disabled_button, true, "Still loading")
	if not disabled_button.disabled or disabled_button.text != "Still loading":
		_fail("WebActionButton repeated loading must keep disabled state and update loading text")
		return
	button_factory.set_loading(disabled_button, false, "Wrong external locked label")
	if not disabled_button.disabled or disabled_button.text != "Locked":
		_fail("WebActionButton.set_loading(false) must restore a pre-disabled button and its original label")
		return

	var long_button = button_factory.create("This button label is intentionally much longer than the available button width", _on_button_pressed, "secondary")
	if long_button.autowrap_mode != TextServer.AUTOWRAP_OFF or long_button.text_overrun_behavior != TextServer.OVERRUN_TRIM_ELLIPSIS:
		_fail("WebActionButton long text must stay single-line and ellipsized")
		return
	var long_button_minimum: Vector2 = long_button.get_combined_minimum_size()
	if int(long_button.custom_minimum_size.x) > 220 or int(long_button_minimum.x) > 220:
		_fail("WebActionButton long text must not create an oversized minimum width")
		return
	if long_button.custom_minimum_size.y != stable_height or int(long_button_minimum.y) > int(stable_height):
		_fail("WebActionButton long text must keep the stable touch height")
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
	for tone in ["default", "gold", "danger", "safe"]:
		var toned_pill = pill_factory.create("Tone", 7, tone)
		if not toned_pill.has_theme_stylebox_override("panel"):
			_fail("WebResourcePill %s tone must provide panel style override" % tone)
			return
	var text_root = pill.get_node_or_null("ResourcePillText")
	if text_root == null:
		_fail("WebResourcePill must contain ResourcePillText node for lookup compatibility")
		return
	if not text_root is Label:
		_fail("WebResourcePill ResourcePillText compatibility node must remain a Label")
		return
	if not str(text_root.text).contains("\u91d1\u5e01 12"):
		_fail("WebResourcePill ResourcePillText label must keep the combined text")
		return
	if text_root.autowrap_mode != TextServer.AUTOWRAP_OFF:
		_fail("WebResourcePill ResourcePillText compatibility label must not wrap")
		return
	if text_root.text_overrun_behavior != TextServer.OVERRUN_TRIM_ELLIPSIS or not text_root.clip_text:
		_fail("WebResourcePill ResourcePillText compatibility label must clip and trim overflow")
		return
	var label = pill.get_node_or_null("ResourcePillContent/ResourcePillLabel")
	var value = pill.get_node_or_null("ResourcePillContent/ResourcePillValue")
	if label == null or not label is Label or value == null or not value is Label:
		_fail("WebResourcePill must split label and value into child labels")
		return
	if label.text != "\u91d1\u5e01" or value.text != "12":
		_fail("WebResourcePill child labels must preserve label and value text")
		return
	if int(label.custom_minimum_size.x) >= int(value.custom_minimum_size.x):
		_fail("WebResourcePill value must have stronger horizontal emphasis than the label")
		return
	for child_label in [label, value]:
		if child_label.autowrap_mode != TextServer.AUTOWRAP_OFF:
			_fail("WebResourcePill text must not wrap")
			return
		if child_label.text_overrun_behavior != TextServer.OVERRUN_TRIM_ELLIPSIS or not child_label.clip_text:
			_fail("WebResourcePill text must clip and trim overflow")
			return
	var long_pill = pill_factory.create("\u8d85\u957f\u8d44\u6e90\u6807\u7b7e\u4e0d\u5e94\u6491\u5f00", "999999999999999999", "danger")
	if int(long_pill.custom_minimum_size.x) != int(pill.custom_minimum_size.x) or int(long_pill.custom_minimum_size.y) != int(pill.custom_minimum_size.y):
		_fail("WebResourcePill long text must keep the same fixed minimum size")
		return
	var long_pill_minimum: Vector2 = long_pill.get_combined_minimum_size()
	if int(long_pill_minimum.x) > int(pill.custom_minimum_size.x) or int(long_pill_minimum.y) > int(pill.custom_minimum_size.y):
		_fail("WebResourcePill long text must not expand the combined minimum size")
		return

	print("Web shared controls smoke passed")
	quit(0)

func _on_button_pressed() -> void:
	_button_pressed_count += 1

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
