class_name WebShell
extends Control

signal lobby_requested
signal logout_requested
signal music_toggle_requested
signal language_toggle_requested

const TOKENS := preload("res://scripts/ui/web/WebUiTokens.gd")
const ACTION_BUTTON := preload("res://scripts/ui/shared/WebActionButton.gd")
const RESOURCE_PILL := preload("res://scripts/ui/shared/WebResourcePill.gd")

var _root: VBoxContainer
var _top_bar: HBoxContainer
var _user_label: Label
var _resource_row: HBoxContainer
var _error_label: Label
var _content: VBoxContainer

func _ready() -> void:
	_build_shell()

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

	_root = VBoxContainer.new()
	_root.name = "Root"
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_root.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_root.add_theme_constant_override("separation", 0)
	add_child(_root)

	_top_bar = HBoxContainer.new()
	_top_bar.name = "TopBar"
	_top_bar.custom_minimum_size = Vector2(0, 64)
	_top_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_top_bar.add_theme_constant_override("separation", 8)
	_root.add_child(_top_bar)

	_user_label = Label.new()
	_user_label.name = "UserLabel"
	_user_label.text = "\u73a9\u5bb6"
	_user_label.custom_minimum_size = Vector2(180, TOKENS.touch_target_height())
	_user_label.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	_user_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_user_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_user_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	_top_bar.add_child(_user_label)

	_resource_row = HBoxContainer.new()
	_resource_row.name = "ResourceRow"
	_resource_row.custom_minimum_size = Vector2(360, 44)
	_resource_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_resource_row.alignment = BoxContainer.ALIGNMENT_END
	_resource_row.add_theme_constant_override("separation", 6)
	_top_bar.add_child(_resource_row)

	var lobby_button := ACTION_BUTTON.create("\u5927\u5385", func() -> void: lobby_requested.emit(), "secondary")
	lobby_button.name = "LobbyButton"
	lobby_button.custom_minimum_size = Vector2(76, TOKENS.touch_target_height())
	_top_bar.add_child(lobby_button)

	var music_button := ACTION_BUTTON.create("\u97f3\u4e50", func() -> void: music_toggle_requested.emit(), "secondary")
	music_button.name = "MusicButton"
	music_button.custom_minimum_size = Vector2(76, TOKENS.touch_target_height())
	_top_bar.add_child(music_button)

	var language_button := ACTION_BUTTON.create("\u8bed\u8a00", func() -> void: language_toggle_requested.emit(), "secondary")
	language_button.name = "LanguageButton"
	language_button.custom_minimum_size = Vector2(76, TOKENS.touch_target_height())
	_top_bar.add_child(language_button)

	var logout_button := ACTION_BUTTON.create("\u9000\u51fa", func() -> void: logout_requested.emit(), "danger")
	logout_button.name = "LogoutButton"
	logout_button.custom_minimum_size = Vector2(76, TOKENS.touch_target_height())
	_top_bar.add_child(logout_button)

	_error_label = Label.new()
	_error_label.name = "ErrorLabel"
	_error_label.visible = false
	_error_label.custom_minimum_size = Vector2(0, 32)
	_error_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_error_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_error_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_error_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_error_label.add_theme_color_override("font_color", TOKENS.danger_color())
	_root.add_child(_error_label)

	_content = VBoxContainer.new()
	_content.name = "Content"
	_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_content.add_theme_constant_override("separation", 12)
	_root.add_child(_content)

	set_run({})

func _clear_children(parent: Node) -> void:
	for child in parent.get_children():
		parent.remove_child(child)
		child.queue_free()
