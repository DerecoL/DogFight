class_name WebUiTokens
extends RefCounted

static func board_slot_size() -> int:
	return 74

static func compact_slot_size() -> int:
	return 52

static func icon_slot_size() -> int:
	return 30

static func touch_target_height() -> int:
	return 48

static func paper_color() -> Color:
	return Color(0.98, 0.92, 0.76, 0.98)

static func ink_color() -> Color:
	return Color(0.16, 0.10, 0.07, 1.0)

static func wood_color() -> Color:
	return Color(0.39, 0.22, 0.12, 1.0)

static func accent_color() -> Color:
	return Color(0.86, 0.42, 0.18, 1.0)

static func safe_color() -> Color:
	return Color(0.22, 0.52, 0.34, 1.0)

static func danger_color() -> Color:
	return Color(0.72, 0.18, 0.13, 1.0)

static func quality_color(quality: String) -> Color:
	match quality:
		"BRONZE":
			return Color(0.70, 0.42, 0.22, 1.0)
		"SILVER":
			return Color(0.74, 0.78, 0.80, 1.0)
		"GOLD":
			return Color(0.92, 0.68, 0.18, 1.0)
		"DIAMOND":
			return Color(0.32, 0.78, 0.92, 1.0)
		_:
			return Color(0.55, 0.48, 0.40, 1.0)

static func paper_card_style() -> StyleBoxFlat:
	return _style_box(paper_color(), wood_color(), 2, 8, 14)

static func wood_panel_style() -> StyleBoxFlat:
	return _style_box(Color(0.50, 0.29, 0.15, 0.96), Color(0.20, 0.10, 0.05, 1.0), 2, 8, 12)

static func handdrawn_button_style() -> StyleBoxFlat:
	return _style_box(Color(0.96, 0.76, 0.34, 1.0), Color(0.28, 0.15, 0.07, 1.0), 2, 8, 10)

static func handdrawn_button_hover_style() -> StyleBoxFlat:
	return _style_box(Color(1.0, 0.84, 0.44, 1.0), Color(0.28, 0.15, 0.07, 1.0), 2, 8, 10)

static func handdrawn_button_pressed_style() -> StyleBoxFlat:
	return _style_box(Color(0.78, 0.50, 0.22, 1.0), Color(0.18, 0.09, 0.04, 1.0), 2, 8, 10)

static func resource_pill_style() -> StyleBoxFlat:
	return _style_box(Color(1.0, 0.93, 0.68, 0.96), Color(0.35, 0.20, 0.10, 1.0), 2, 8, 8)

static func slot_style(selected: bool, over: bool) -> StyleBoxFlat:
	var bg := Color(0.91, 0.79, 0.56, 0.92)
	var border := Color(0.42, 0.25, 0.13, 1.0)
	if selected:
		border = accent_color()
	if over:
		bg = Color(1.0, 0.88, 0.44, 0.98)
	return _style_box(bg, border, 2 if selected or over else 1, 6, 4)

static func _style_box(bg: Color, border: Color, border_width: int, radius: int, margin: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.set_border_width_all(border_width)
	style.set_corner_radius_all(radius)
	style.content_margin_left = margin
	style.content_margin_top = margin
	style.content_margin_right = margin
	style.content_margin_bottom = margin
	return style
