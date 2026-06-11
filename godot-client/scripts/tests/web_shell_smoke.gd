extends SceneTree

const TOKENS := preload("res://scripts/ui/web/WebUiTokens.gd")

var _lobby_count := 0
var _music_count := 0
var _language_count := 0
var _logout_count := 0

func _init() -> void:
	var shell_scene = load("res://scenes/shell/WebShell.tscn")
	if shell_scene == null:
		_fail("WebShell scene must load")
		return
	var shell = shell_scene.instantiate()
	if shell == null:
		_fail("WebShell scene must instantiate")
		return
	var viewport_1280 := _make_viewport(Vector2i(1280, 720), "Viewport1280")
	viewport_1280.add_child(shell)
	await process_frame
	await process_frame

	if shell.name != "WebShell":
		_fail("WebShell root node must be named WebShell")
		return
	for node_path in [
		"Root",
		"Root/TopBar",
		"Root/TopBar/UserLabel",
		"Root/TopBar/ResourceRow",
		"Root/ErrorLabel",
		"Root/Content",
		"Root/TopBar/LobbyButton",
		"Root/TopBar/MusicButton",
		"Root/TopBar/LanguageButton",
		"Root/TopBar/LogoutButton",
	]:
		if shell.get_node_or_null(node_path) == null:
			_fail("WebShell missing node %s" % node_path)
			return

	if not shell.has_method("content_container") or not shell.has_method("set_user") or not shell.has_method("set_run") or not shell.has_method("set_error") or not shell.has_method("clear_content"):
		_fail("WebShell must expose the required API")
		return
	if not shell.content_container() is VBoxContainer:
		_fail("WebShell.content_container must return a VBoxContainer")
		return
	if shell.content_container() != shell.get_node("Root/Content"):
		_fail("WebShell.content_container must return Root/Content")
		return

	var root_node: Control = shell.get_node("Root")
	if not _is_fullscreen_control(root_node):
		_fail("WebShell Root must stay fullscreen while centering its safe content column")
		return

	shell.set_user({"nickname": "Tester", "account": "acct-1"})
	var user_label: Label = shell.get_node("Root/TopBar/UserLabel")
	if not user_label.text.contains("Tester"):
		_fail("WebShell.set_user must show nickname")
		return
	shell.set_user({"nickname": "TesterWithAVeryLongNicknameThatMustStaySingleLine", "account": "acct-1"})
	if user_label.autowrap_mode != TextServer.AUTOWRAP_OFF or user_label.text_overrun_behavior != TextServer.OVERRUN_TRIM_ELLIPSIS:
		_fail("WebShell user label must keep stable single-line overflow")
		return
	if int(user_label.custom_minimum_size.x) < 180 or int(user_label.custom_minimum_size.y) < 44:
		_fail("WebShell user label must keep stable dimensions")
		return
	shell.set_user({})
	if not user_label.text.contains("\u73a9\u5bb6"):
		_fail("WebShell.set_user must fall back to player label")
		return

	shell.set_error("Something failed")
	var error_label: Label = shell.get_node("Root/ErrorLabel")
	if error_label.text != "Something failed" or not error_label.visible:
		_fail("WebShell.set_error must show error text")
		return

	shell.set_run({"gold": 9, "wins": 2, "losses": 1, "round": 3})
	if shell.get_node_or_null("Root/TopBar/ResourceRow/ResourcePill_gold") == null:
		_fail("WebShell.set_run must render ResourcePill_gold")
		return
	var top_bar: HBoxContainer = shell.get_node("Root/TopBar")
	if int(top_bar.custom_minimum_size.y) < 72 or int(top_bar.custom_minimum_size.y) > 88:
		_fail("WebShell top bar must keep stable height")
		return
	if top_bar.z_index < TOKENS.layer_card():
		_fail("WebShell top bar must use card layer tokens")
		return
	var safe_margin := int(TOKENS.screen_safe_margin())
	var max_width := int(TOKENS.desktop_content_max_width())
	if int(top_bar.size.x) > max_width:
		_fail("WebShell top bar must not exceed desktop max content width")
		return
	if abs(int(top_bar.size.x) - max_width) > 2:
		_fail("WebShell 1280 top bar width must fill the safe desktop width")
		return
	if int(top_bar.position.x) < safe_margin - 2:
		_fail("WebShell top bar must keep the 16:9 safe horizontal margin")
		return
	if int(top_bar.position.y) < safe_margin - 2:
		_fail("WebShell top bar must not stick to the top edge")
		return
	if int(top_bar.size.y) != int(top_bar.custom_minimum_size.y):
		_fail("WebShell top bar height must be stable at runtime")
		return
	if int(top_bar.get_theme_constant("separation")) != int(TOKENS.shell_top_bar_separation()):
		_fail("WebShell top bar separation must come from WebUiTokens")
		return
	var left_padding: Control = shell.get_node("Root/TopBar/TopBarLeftPadding")
	var right_padding: Control = shell.get_node("Root/TopBar/TopBarRightPadding")
	if int(left_padding.custom_minimum_size.x) != int(TOKENS.shell_top_bar_padding()) \
		or int(right_padding.custom_minimum_size.x) != int(TOKENS.shell_top_bar_padding()):
		_fail("WebShell top bar side padding must come from WebUiTokens")
		return
	var gold_label = shell.get_node("Root/TopBar/ResourceRow/ResourcePill_gold/ResourcePillText")
	if not str(gold_label.text).contains("\u91d1\u5e01 9"):
		_fail("WebShell gold pill must include gold value")
		return
	var resource_row: HBoxContainer = shell.get_node("Root/TopBar/ResourceRow")
	if int(resource_row.custom_minimum_size.y) < 38 or int(resource_row.custom_minimum_size.y) > 48:
		_fail("WebShell resource row must keep a stable compact height")
		return
	if resource_row.size_flags_horizontal != Control.SIZE_EXPAND_FILL:
		_fail("WebShell resource row must absorb extra width instead of pushing other top bar controls")
		return
	if int(resource_row.get_theme_constant("separation")) != int(TOKENS.shell_resource_separation()):
		_fail("WebShell resource row separation must come from WebUiTokens")
		return
	for button_name in ["LobbyButton", "MusicButton", "LanguageButton", "LogoutButton"]:
		var button: Button = shell.get_node("Root/TopBar/%s" % button_name)
		if int(button.custom_minimum_size.x) < 76 or int(button.custom_minimum_size.y) != int(TOKENS.touch_target_height()):
			_fail("WebShell top bar button must keep stable dimensions: %s" % button_name)
			return
		if not button.clip_text or button.text_overrun_behavior != TextServer.OVERRUN_TRIM_ELLIPSIS:
			_fail("WebShell top bar button text must stay single-line clipped: %s" % button_name)
			return

	var content: VBoxContainer = shell.content_container()
	if content.z_index < TOKENS.layer_base():
		_fail("WebShell content must have explicit base layer semantics")
		return
	var content_padding := _content_horizontal_padding(top_bar, content)
	if content_padding != int(TOKENS.shell_content_horizontal_padding()):
		_fail("WebShell content horizontal padding must come from WebUiTokens")
		return
	if abs(int(content.size.x) - (int(top_bar.size.x) - content_padding * 2)) > 2:
		_fail("WebShell content width must reflect its stable horizontal padding")
		return
	if int(content.position.y) <= int(top_bar.position.y + top_bar.size.y):
		_fail("WebShell content must start below the top bar and error strip space")
		return
	if int(error_label.position.y - (top_bar.position.y + top_bar.size.y)) != int(TOKENS.shell_gap()):
		_fail("WebShell top bar to error gap must come from WebUiTokens")
		return
	if int(content.position.y - (error_label.position.y + error_label.size.y)) != int(TOKENS.shell_gap()):
		_fail("WebShell error to content gap must come from WebUiTokens")
		return
	if int(content.size.y) < 480:
		_fail("WebShell content must leave a stable 16:9 page area")
		return
	if int(content.get_theme_constant("separation")) != int(TOKENS.shell_content_separation()):
		_fail("WebShell content separation must come from WebUiTokens")
		return

	var error_rect: Rect2 = error_label.get_global_rect()
	var content_rect: Rect2 = content.get_global_rect()
	if error_label.z_index <= content.z_index:
		_fail("WebShell error label must be layered above content")
		return
	if error_rect.intersects(content_rect):
		_fail("WebShell error label must not overlap or be covered by content")
		return
	var error_style = error_label.get("style_box")
	if error_style == null or not error_style is StyleBoxFlat:
		_fail("WebShell error label must expose its token-backed StyleBox")
		return
	if int((error_style as StyleBoxFlat).content_margin_left) != int(TOKENS.shell_error_margin_horizontal()) \
		or int((error_style as StyleBoxFlat).content_margin_right) != int(TOKENS.shell_error_margin_horizontal()) \
		or int((error_style as StyleBoxFlat).content_margin_top) != int(TOKENS.shell_error_margin_vertical()) \
		or int((error_style as StyleBoxFlat).content_margin_bottom) != int(TOKENS.shell_error_margin_vertical()):
		_fail("WebShell error strip margins must come from WebUiTokens")
		return

	var child := Label.new()
	child.name = "TemporaryContent"
	content.add_child(child)
	shell.clear_content()
	await process_frame
	if content.get_node_or_null("TemporaryContent") != null:
		_fail("WebShell.clear_content must remove content children")
		return

	shell.lobby_requested.connect(func() -> void: _lobby_count += 1)
	shell.music_toggle_requested.connect(func() -> void: _music_count += 1)
	shell.language_toggle_requested.connect(func() -> void: _language_count += 1)
	shell.logout_requested.connect(func() -> void: _logout_count += 1)
	shell.get_node("Root/TopBar/LobbyButton").emit_signal("pressed")
	shell.get_node("Root/TopBar/MusicButton").emit_signal("pressed")
	shell.get_node("Root/TopBar/LanguageButton").emit_signal("pressed")
	shell.get_node("Root/TopBar/LogoutButton").emit_signal("pressed")
	if _lobby_count != 1 or _music_count != 1 or _language_count != 1 or _logout_count != 1:
		_fail("WebShell top bar buttons must emit requested signals")
		return

	shell.queue_free()
	viewport_1280.queue_free()
	await process_frame
	await _assert_shell_layout_for_viewport(shell_scene, Vector2i(1600, 900))
	print("Web shell smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)

func _is_fullscreen_control(control: Control) -> bool:
	return control.anchor_left == 0.0 \
		and control.anchor_top == 0.0 \
		and control.anchor_right == 1.0 \
		and control.anchor_bottom == 1.0 \
		and control.grow_horizontal == Control.GROW_DIRECTION_BOTH \
		and control.grow_vertical == Control.GROW_DIRECTION_BOTH

func _make_viewport(viewport_size: Vector2i, viewport_name: String) -> SubViewport:
	var test_viewport := SubViewport.new()
	test_viewport.name = viewport_name
	test_viewport.size = viewport_size
	test_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(test_viewport)
	return test_viewport

func _assert_shell_layout_for_viewport(shell_scene: PackedScene, viewport_size: Vector2i) -> void:
	var test_viewport := _make_viewport(viewport_size, "Viewport%d" % viewport_size.x)
	var shell = shell_scene.instantiate()
	if shell == null:
		_fail("WebShell scene must instantiate for viewport %s" % str(viewport_size))
		return
	test_viewport.add_child(shell)
	await process_frame
	await process_frame

	var top_bar: HBoxContainer = shell.get_node("Root/TopBar")
	var content: VBoxContainer = shell.get_node("Root/Content")
	var safe_margin := int(TOKENS.screen_safe_margin())
	var max_width := int(TOKENS.desktop_content_max_width())
	if int(top_bar.size.x) > max_width:
		_fail("WebShell %s top bar must not exceed desktop max content width" % str(viewport_size))
		return
	if abs(int(top_bar.size.x) - max_width) > 2:
		_fail("WebShell %s top bar must use desktop max content width" % str(viewport_size))
		return
	if viewport_size.x == 1280 and int(top_bar.position.x) < safe_margin - 2:
		_fail("WebShell 1280 top bar must keep safe margin")
		return
	if viewport_size.x > 1280 and int(top_bar.position.x) <= safe_margin:
		_fail("WebShell wide viewport top bar must be centered inside desktop max width")
		return
	var content_padding := _content_horizontal_padding(top_bar, content)
	if content_padding != int(TOKENS.shell_content_horizontal_padding()):
		_fail("WebShell %s content padding must come from WebUiTokens" % str(viewport_size))
		return
	var error_label: Label = shell.get_node("Root/ErrorLabel")
	if int(error_label.position.y - (top_bar.position.y + top_bar.size.y)) != int(TOKENS.shell_gap()):
		_fail("WebShell %s top bar to error gap must come from WebUiTokens" % str(viewport_size))
		return
	if int(content.position.y - (error_label.position.y + error_label.size.y)) != int(TOKENS.shell_gap()):
		_fail("WebShell %s error to content gap must come from WebUiTokens" % str(viewport_size))
		return
	if abs(int(content.size.x) - (int(top_bar.size.x) - content_padding * 2)) > 2:
		_fail("WebShell %s content width must reflect stable padding" % str(viewport_size))
		return
	shell.queue_free()
	test_viewport.queue_free()

func _content_horizontal_padding(top_bar: Control, content: Control) -> int:
	return int(content.position.x - top_bar.position.x)
