class_name WebShell
extends Control

signal lobby_requested
signal logout_requested
signal music_toggle_requested
signal language_toggle_requested

const TOKENS := preload("res://scripts/ui/web/WebUiTokens.gd")
const ACTION_BUTTON := preload("res://scripts/ui/shared/WebActionButton.gd")
const RESOURCE_PILL := preload("res://scripts/ui/shared/WebResourcePill.gd")

const TOP_BAR_HEIGHT := 80
const ERROR_HEIGHT := 36
const USER_LABEL_WIDTH := 220
const RESOURCE_ROW_WIDTH := 384
const RESOURCE_ROW_HEIGHT := 44
const TOP_BAR_BUTTON_WIDTH := 84

class ShellTopBar:
	extends HBoxContainer

	var style_box: StyleBoxFlat

	func _draw() -> void:
		if style_box != null:
			draw_style_box(style_box, Rect2(Vector2.ZERO, size))

	func _notification(what: int) -> void:
		if what == NOTIFICATION_RESIZED:
			queue_redraw()

class ShellErrorLabel:
	extends Label

	var style_box: StyleBoxFlat

	func _draw() -> void:
		if style_box != null:
			draw_style_box(style_box, Rect2(Vector2.ZERO, size))

	func _notification(what: int) -> void:
		if what == NOTIFICATION_RESIZED:
			queue_redraw()

var _root: Control
var _top_bar: HBoxContainer
var _user_label: Label
var _resource_row: HBoxContainer
var _error_label: Label
var _content: VBoxContainer

func _ready() -> void:
	_build_shell()

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED and _root != null:
		_layout_shell()

func content_container() -> VBoxContainer:
	_ensure_shell()
	return _content

func set_user(user: Dictionary) -> void:
	_ensure_shell()
	var nickname := str(user.get("nickname", "")).strip_edges()
	var account := str(user.get("account", "")).strip_edges()
	var display_name := nickname
	if display_name.is_empty():
		display_name = account
	if display_name.is_empty():
		display_name = "\u73a9\u5bb6"
	_user_label.text = display_name if account.is_empty() or display_name == account else "%s (%s)" % [display_name, account]

func set_run(run: Dictionary) -> void:
	_ensure_shell()
	_clear_children(_resource_row)
	if run.is_empty():
		return
	_resource_row.add_child(RESOURCE_PILL.create("\u91d1\u5e01", int(run.get("gold", 0)), "gold"))
	_resource_row.add_child(RESOURCE_PILL.create("\u80dc\u8d1f", "%d/%d" % [int(run.get("wins", 0)), int(run.get("losses", 0))], "record"))
	_resource_row.add_child(RESOURCE_PILL.create("\u56de\u5408", int(run.get("round", 0)), "round"))

func set_error(message: String) -> void:
	_ensure_shell()
	_error_label.text = message
	_error_label.visible = not message.strip_edges().is_empty()

func clear_content() -> void:
	_ensure_shell()
	_clear_children(_content)

func _ensure_shell() -> void:
	if _root == null:
		_build_shell()

func _build_shell() -> void:
	if _root != null:
		return
	name = "WebShell"
	set_anchors_preset(Control.PRESET_FULL_RECT)
	grow_horizontal = Control.GROW_DIRECTION_BOTH
	grow_vertical = Control.GROW_DIRECTION_BOTH

	_root = Control.new()
	_root.name = "Root"
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_root.grow_vertical = Control.GROW_DIRECTION_BOTH
	_root.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_root.size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_child(_root)

	_top_bar = ShellTopBar.new()
	_top_bar.name = "TopBar"
	(_top_bar as ShellTopBar).style_box = TOKENS.wood_panel_style()
	_top_bar.custom_minimum_size = Vector2(0, TOP_BAR_HEIGHT)
	_top_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_top_bar.clip_contents = true
	_top_bar.z_index = TOKENS.layer_card()
	_top_bar.add_theme_constant_override("separation", TOKENS.shell_top_bar_separation())
	_root.add_child(_top_bar)

	_top_bar.add_child(_top_bar_padding("TopBarLeftPadding"))

	_user_label = Label.new()
	_user_label.name = "UserLabel"
	_user_label.text = "\u73a9\u5bb6"
	_user_label.custom_minimum_size = Vector2(USER_LABEL_WIDTH, TOKENS.touch_target_height())
	_user_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_user_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_user_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_user_label.clip_text = true
	_user_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_user_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	_user_label.add_theme_color_override("font_color", Color(1.0, 0.94, 0.80, 1.0))
	_top_bar.add_child(_user_label)

	_resource_row = HBoxContainer.new()
	_resource_row.name = "ResourceRow"
	_resource_row.custom_minimum_size = Vector2(RESOURCE_ROW_WIDTH, RESOURCE_ROW_HEIGHT)
	_resource_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_resource_row.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_resource_row.alignment = BoxContainer.ALIGNMENT_END
	_resource_row.add_theme_constant_override("separation", TOKENS.shell_resource_separation())
	_top_bar.add_child(_resource_row)

	var lobby_button := ACTION_BUTTON.create("\u5927\u5385", func() -> void: lobby_requested.emit(), "secondary")
	lobby_button.name = "LobbyButton"
	_configure_top_bar_button(lobby_button)
	_top_bar.add_child(lobby_button)

	var music_button := ACTION_BUTTON.create("\u97f3\u4e50", func() -> void: music_toggle_requested.emit(), "secondary")
	music_button.name = "MusicButton"
	_configure_top_bar_button(music_button)
	_top_bar.add_child(music_button)

	var language_button := ACTION_BUTTON.create("\u8bed\u8a00", func() -> void: language_toggle_requested.emit(), "secondary")
	language_button.name = "LanguageButton"
	_configure_top_bar_button(language_button)
	_top_bar.add_child(language_button)

	var logout_button := ACTION_BUTTON.create("\u9000\u51fa", func() -> void: logout_requested.emit(), "danger")
	logout_button.name = "LogoutButton"
	_configure_top_bar_button(logout_button)
	_top_bar.add_child(logout_button)

	_top_bar.add_child(_top_bar_padding("TopBarRightPadding"))

	_error_label = ShellErrorLabel.new()
	_error_label.name = "ErrorLabel"
	(_error_label as ShellErrorLabel).style_box = _error_style()
	_error_label.visible = false
	_error_label.custom_minimum_size = Vector2(0, ERROR_HEIGHT)
	_error_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_error_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_error_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_error_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_error_label.clip_text = true
	_error_label.add_theme_color_override("font_color", TOKENS.danger_color())
	_error_label.z_index = TOKENS.layer_overlay()
	_root.add_child(_error_label)

	_content = VBoxContainer.new()
	_content.name = "Content"
	_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_content.z_index = TOKENS.layer_base()
	_content.add_theme_constant_override("separation", TOKENS.shell_content_separation())
	_root.add_child(_content)

	set_run({})
	_layout_shell()
	call_deferred("_layout_shell")

func _clear_children(parent: Node) -> void:
	for child in parent.get_children():
		parent.remove_child(child)
		child.queue_free()

func _layout_shell() -> void:
	if _root == null or _top_bar == null or _error_label == null or _content == null:
		return
	var viewport_size := get_viewport_rect().size
	if viewport_size.x <= 0.0 or viewport_size.y <= 0.0:
		viewport_size = size
	if viewport_size.x < 320.0 or viewport_size.y < 240.0:
		viewport_size = Vector2(TOKENS.safe_content_size_16_9())
	var safe_margin := float(TOKENS.screen_safe_margin())
	var available_width: float = maxf(0.0, viewport_size.x - safe_margin * 2.0)
	var column_width: float = minf(float(TOKENS.desktop_content_max_width()), available_width)
	var column_x: float = floorf((viewport_size.x - column_width) * 0.5)
	var top_y: float = safe_margin
	var error_y: float = top_y + TOP_BAR_HEIGHT + TOKENS.shell_gap()
	var content_y: float = error_y + ERROR_HEIGHT + TOKENS.shell_gap()
	var content_height: float = maxf(0.0, viewport_size.y - content_y - safe_margin)
	var content_horizontal_padding := float(TOKENS.shell_content_horizontal_padding())

	_top_bar.position = Vector2(column_x, top_y)
	_top_bar.size = Vector2(column_width, TOP_BAR_HEIGHT)
	_error_label.position = Vector2(column_x, error_y)
	_error_label.size = Vector2(column_width, ERROR_HEIGHT)
	_content.position = Vector2(column_x + content_horizontal_padding, content_y)
	_content.size = Vector2(maxf(0.0, column_width - content_horizontal_padding * 2.0), content_height)

func _top_bar_padding(node_name: String) -> Control:
	var spacer := Control.new()
	spacer.name = node_name
	spacer.custom_minimum_size = Vector2(TOKENS.shell_top_bar_padding(), 1)
	spacer.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return spacer

func _configure_top_bar_button(button: Button) -> void:
	button.custom_minimum_size = Vector2(TOP_BAR_BUTTON_WIDTH, TOKENS.touch_target_height())
	button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	button.clip_text = true
	button.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	button.autowrap_mode = TextServer.AUTOWRAP_OFF

func _error_style() -> StyleBoxFlat:
	var style := TOKENS.paper_card_style().duplicate()
	style.bg_color = Color(1.0, 0.86, 0.70, 0.96)
	style.border_color = TOKENS.danger_color()
	style.content_margin_left = TOKENS.shell_error_margin_horizontal()
	style.content_margin_top = TOKENS.shell_error_margin_vertical()
	style.content_margin_right = TOKENS.shell_error_margin_horizontal()
	style.content_margin_bottom = TOKENS.shell_error_margin_vertical()
	return style
