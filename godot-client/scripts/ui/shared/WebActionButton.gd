class_name WebActionButton
extends RefCounted

const TOKENS := preload("res://scripts/ui/web/WebUiTokens.gd")

static func create(label: String, callback: Callable, variant := "primary") -> Button:
	var button := Button.new()
	button.text = label
	button.custom_minimum_size = Vector2(0, max(44, int(TOKENS.touch_target_height())))
	button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	button.clip_text = true
	button.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	button.autowrap_mode = TextServer.AUTOWRAP_OFF
	button.focus_mode = Control.FOCUS_ALL
	_apply_variant(button, variant)
	if callback.is_valid():
		button.pressed.connect(callback)
	return button

static func set_loading(button: Button, loading: bool, label: String) -> void:
	if button == null:
		return
	button.disabled = loading
	button.text = label

static func _apply_variant(button: Button, variant: String) -> void:
	match variant:
		"secondary":
			_apply_style_set(
				button,
				_style(TOKENS.paper_color(), TOKENS.wood_color()),
				_style(Color(1.0, 0.96, 0.82, 1.0), TOKENS.wood_color()),
				_style(Color(0.88, 0.78, 0.58, 1.0), TOKENS.wood_color())
			)
		"danger":
			_apply_style_set(
				button,
				_style(TOKENS.danger_color(), Color(0.28, 0.06, 0.04, 1.0)),
				_style(Color(0.86, 0.24, 0.18, 1.0), Color(0.28, 0.06, 0.04, 1.0)),
				_style(Color(0.54, 0.11, 0.08, 1.0), Color(0.18, 0.04, 0.03, 1.0))
			)
		_:
			_apply_style_set(
				button,
				TOKENS.handdrawn_button_style(),
				TOKENS.handdrawn_button_hover_style(),
				TOKENS.handdrawn_button_pressed_style()
			)

static func _apply_style_set(button: Button, normal: StyleBoxFlat, hover: StyleBoxFlat, pressed: StyleBoxFlat) -> void:
	button.add_theme_stylebox_override("normal", normal)
	button.add_theme_stylebox_override("hover", hover)
	button.add_theme_stylebox_override("pressed", pressed)
	button.add_theme_stylebox_override("disabled", normal.duplicate())

static func _style(bg: Color, border: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	style.content_margin_left = 12
	style.content_margin_top = 10
	style.content_margin_right = 12
	style.content_margin_bottom = 10
	return style
