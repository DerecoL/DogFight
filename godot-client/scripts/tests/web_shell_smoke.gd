extends SceneTree

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
	root.add_child(shell)
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
	if int(top_bar.custom_minimum_size.y) < 64:
		_fail("WebShell top bar must keep stable height")
		return
	var gold_label = shell.get_node("Root/TopBar/ResourceRow/ResourcePill_gold/ResourcePillText")
	if not str(gold_label.text).contains("\u91d1\u5e01 9"):
		_fail("WebShell gold pill must include gold value")
		return

	var content: VBoxContainer = shell.content_container()
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
	print("Web shell smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
