class_name WebResourcePill
extends RefCounted

const TOKENS := preload("res://scripts/ui/web/WebUiTokens.gd")

const PILL_WIDTH := 120
const PILL_HEIGHT := 38
const TEXT_WIDTH := 104
const LABEL_WIDTH := 40
const VALUE_WIDTH := 58
const TEXT_GAP := 6
const PILL_BORDER_WIDTH := 2
const PILL_RADIUS := 8
const PILL_PADDING_X := 8
const PILL_PADDING_Y := 6

static func create(label: String, value, tone := "default") -> PanelContainer:
	var pill := PanelContainer.new()
	pill.name = "ResourcePill_%s" % tone
	pill.custom_minimum_size = Vector2(PILL_WIDTH, PILL_HEIGHT)
	pill.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	pill.clip_contents = true
	pill.add_theme_stylebox_override("panel", _style_for_tone(tone))

	var compatibility_text := _make_text_label("ResourcePillText", "%s %s" % [label, str(value)], TEXT_WIDTH, HORIZONTAL_ALIGNMENT_CENTER)
	compatibility_text.visible = false
	pill.add_child(compatibility_text)

	var text_row := HBoxContainer.new()
	text_row.name = "ResourcePillContent"
	text_row.custom_minimum_size = Vector2(TEXT_WIDTH, PILL_HEIGHT)
	text_row.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	text_row.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	text_row.alignment = BoxContainer.ALIGNMENT_CENTER
	text_row.add_theme_constant_override("separation", TEXT_GAP)
	text_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pill.add_child(text_row)

	var label_text := _make_text_label("ResourcePillLabel", label, LABEL_WIDTH, HORIZONTAL_ALIGNMENT_RIGHT)
	label_text.add_theme_color_override("font_color", Color(TOKENS.ink_color(), 0.72))
	text_row.add_child(label_text)

	var value_text := _make_text_label("ResourcePillValue", str(value), VALUE_WIDTH, HORIZONTAL_ALIGNMENT_LEFT)
	value_text.add_theme_color_override("font_color", TOKENS.ink_color())
	value_text.add_theme_font_size_override("font_size", 15)
	text_row.add_child(value_text)
	return pill

static func _style_for_tone(tone: String) -> StyleBoxFlat:
	match tone:
		"gold":
			return _resource_style(Color(1.0, 0.88, 0.38, 0.98), TOKENS.quality_color("GOLD").darkened(0.28))
		"danger":
			return _resource_style(Color(0.95, 0.54, 0.48, 0.96), TOKENS.danger_color())
		"safe":
			return _resource_style(Color(0.72, 0.90, 0.72, 0.96), TOKENS.safe_color())
		_:
			return TOKENS.resource_pill_style()

static func _make_text_label(node_name: String, text: String, width: int, alignment: HorizontalAlignment) -> Label:
	var text_label := Label.new()
	text_label.name = node_name
	text_label.text = text
	text_label.horizontal_alignment = alignment
	text_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	text_label.custom_minimum_size = Vector2(width, PILL_HEIGHT)
	text_label.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	text_label.clip_text = true
	text_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	text_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	text_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return text_label

static func _resource_style(bg: Color, border: Color) -> StyleBoxFlat:
	var style := TOKENS.resource_pill_style().duplicate()
	style.bg_color = bg
	style.border_color = border
	style.set_border_width_all(PILL_BORDER_WIDTH)
	style.set_corner_radius_all(PILL_RADIUS)
	style.content_margin_left = PILL_PADDING_X
	style.content_margin_top = PILL_PADDING_Y
	style.content_margin_right = PILL_PADDING_X
	style.content_margin_bottom = PILL_PADDING_Y
	return style
