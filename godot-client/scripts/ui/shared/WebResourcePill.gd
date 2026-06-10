class_name WebResourcePill
extends RefCounted

const TOKENS := preload("res://scripts/ui/web/WebUiTokens.gd")

static func create(label: String, value, tone := "default") -> PanelContainer:
	var pill := PanelContainer.new()
	pill.name = "ResourcePill_%s" % tone
	pill.custom_minimum_size = Vector2(110, 34)
	pill.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	pill.add_theme_stylebox_override("panel", _style_for_tone(tone))

	var text := Label.new()
	text.name = "ResourcePillText"
	text.text = "%s %s" % [label, str(value)]
	text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	text.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	text.custom_minimum_size = Vector2(94, 34)
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	text.autowrap_mode = TextServer.AUTOWRAP_OFF
	pill.add_child(text)
	return pill

static func _style_for_tone(tone: String) -> StyleBoxFlat:
	match tone:
		"gold":
			return _style(Color(1.0, 0.88, 0.38, 0.98), Color(0.42, 0.25, 0.08, 1.0))
		"danger":
			return _style(Color(0.95, 0.54, 0.48, 0.96), TOKENS.danger_color())
		"safe":
			return _style(Color(0.72, 0.90, 0.72, 0.96), TOKENS.safe_color())
		_:
			return TOKENS.resource_pill_style()

static func _style(bg: Color, border: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	style.content_margin_left = 8
	style.content_margin_top = 6
	style.content_margin_right = 8
	style.content_margin_bottom = 6
	return style
