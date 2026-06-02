class_name UiTokens
extends RefCounted

static func touch_target_height() -> int:
	return 48

static func panel_radius() -> int:
	return 8

static func gap_small() -> int:
	return 8

static func gap_medium() -> int:
	return 12

static func gap_large() -> int:
	return 20

static func desktop_content_max_width() -> int:
	return 1280

static func mobile_bottom_bar_height() -> int:
	return 64

static func ink_color() -> Color:
	return Color(0.16, 0.11, 0.08, 1.0)

static func paper_color() -> Color:
	return Color(1.0, 0.965, 0.86, 0.96)

static func paper_deep_color() -> Color:
	return Color(0.92, 0.80, 0.58, 0.98)

static func accent_color() -> Color:
	return Color(0.86, 0.43, 0.20, 1.0)

static func paper_panel_style() -> StyleBoxFlat:
	return _style_box(paper_color(), Color(0.36, 0.22, 0.13, 0.95), 2, panel_radius(), 14)

static func modal_panel_style() -> StyleBoxFlat:
	return _style_box(Color(1.0, 0.955, 0.82, 0.985), Color(0.25, 0.13, 0.07, 1.0), 3, panel_radius(), 16)

static func button_style() -> StyleBoxFlat:
	return _style_box(Color(0.98, 0.82, 0.47, 1.0), Color(0.34, 0.19, 0.09, 1.0), 2, panel_radius(), 10)

static func button_hover_style() -> StyleBoxFlat:
	return _style_box(Color(1.0, 0.88, 0.55, 1.0), Color(0.34, 0.19, 0.09, 1.0), 2, panel_radius(), 10)

static func button_pressed_style() -> StyleBoxFlat:
	return _style_box(Color(0.82, 0.56, 0.28, 1.0), Color(0.24, 0.13, 0.06, 1.0), 2, panel_radius(), 10)

static func button_disabled_style() -> StyleBoxFlat:
	return _style_box(Color(0.63, 0.57, 0.48, 0.82), Color(0.36, 0.31, 0.25, 0.75), 1, panel_radius(), 10)

static func input_style() -> StyleBoxFlat:
	return _style_box(Color(0.18, 0.15, 0.12, 0.90), Color(0.73, 0.55, 0.34, 0.95), 2, panel_radius(), 10)

static func input_focus_style() -> StyleBoxFlat:
	return _style_box(Color(0.13, 0.11, 0.09, 0.94), accent_color(), 2, panel_radius(), 10)

static func _style_box(bg: Color, border: Color, border_width: int, radius: int, margin: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.set_border_width_all(border_width)
	style.set_corner_radius_all(radius)
	style.content_margin_left = margin
	style.content_margin_top = max(8, margin - 2)
	style.content_margin_right = margin
	style.content_margin_bottom = max(8, margin - 2)
	return style
