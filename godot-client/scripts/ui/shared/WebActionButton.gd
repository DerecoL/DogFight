class_name WebActionButton
extends RefCounted

const TOKENS := preload("res://scripts/ui/web/WebUiTokens.gd")

const META_ORIGINAL_LABEL := "web_action_button_original_label"
const META_LOADING_ACTIVE := "web_action_button_loading_active"
const META_DISABLED_BEFORE_LOADING := "web_action_button_disabled_before_loading"
const BUTTON_BORDER_WIDTH := 2
const BUTTON_RADIUS := 8
const BUTTON_PADDING := 10
const BUTTON_SIDE_PADDING := 14

static func create(label: String, callback: Callable, variant := "primary") -> Button:
	var button := Button.new()
	button.text = label
	button.set_meta(META_ORIGINAL_LABEL, label)
	button.custom_minimum_size = Vector2(TOKENS.secondary_folded_entry_size().x, int(TOKENS.touch_target_height()))
	button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	button.clip_text = true
	button.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	button.autowrap_mode = TextServer.AUTOWRAP_OFF
	button.focus_mode = Control.FOCUS_ALL
	button.alignment = HORIZONTAL_ALIGNMENT_CENTER
	button.add_theme_color_override("font_color", TOKENS.ink_color())
	button.add_theme_color_override("font_hover_color", TOKENS.ink_color())
	button.add_theme_color_override("font_pressed_color", Color(1.0, 0.96, 0.84, 1.0))
	button.add_theme_color_override("font_disabled_color", Color(TOKENS.ink_color(), 0.55))
	_apply_variant(button, variant)
	if callback.is_valid():
		button.pressed.connect(callback)
	return button

static func set_loading(button: Button, loading: bool, label := "Loading") -> void:
	if button == null:
		return
	if not button.has_meta(META_ORIGINAL_LABEL):
		button.set_meta(META_ORIGINAL_LABEL, button.text)
	if loading:
		if not button.has_meta(META_LOADING_ACTIVE) or not bool(button.get_meta(META_LOADING_ACTIVE)):
			button.set_meta(META_DISABLED_BEFORE_LOADING, button.disabled)
		button.set_meta(META_LOADING_ACTIVE, true)
		button.disabled = true
		button.text = label
	else:
		button.disabled = bool(button.get_meta(META_DISABLED_BEFORE_LOADING, false))
		button.set_meta(META_LOADING_ACTIVE, false)
		button.text = str(button.get_meta(META_ORIGINAL_LABEL))

static func _apply_variant(button: Button, variant: String) -> void:
	match variant:
		"secondary":
			_apply_style_set(
				button,
				_style(TOKENS.paper_color(), TOKENS.wood_color()),
				_style(Color(1.0, 0.96, 0.82, 1.0), TOKENS.accent_color()),
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
	button.add_theme_stylebox_override("disabled", _disabled_style(normal))
	button.add_theme_stylebox_override("focus", hover.duplicate())

static func _style(bg: Color, border: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.set_border_width_all(BUTTON_BORDER_WIDTH)
	style.set_corner_radius_all(BUTTON_RADIUS)
	style.content_margin_left = BUTTON_SIDE_PADDING
	style.content_margin_top = BUTTON_PADDING
	style.content_margin_right = BUTTON_SIDE_PADDING
	style.content_margin_bottom = BUTTON_PADDING
	return style

static func _disabled_style(base: StyleBoxFlat) -> StyleBoxFlat:
	var disabled := base.duplicate()
	disabled.bg_color = Color(base.bg_color.darkened(0.12), 0.82)
	disabled.border_color = Color(base.border_color.lightened(0.22), 0.82)
	return disabled
