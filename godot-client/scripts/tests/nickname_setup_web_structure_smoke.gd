extends SceneTree

const WebUiTokens := preload("res://scripts/ui/web/WebUiTokens.gd")

func _init() -> void:
	_run()

func _run() -> void:
	root.size = WebUiTokens.safe_content_size_16_9()
	var screen_scene = load("res://scenes/screens/NicknameSetupScreen.tscn")
	if screen_scene == null:
		_fail("NicknameSetupScreen scene failed to load")
		return
	var screen = screen_scene.instantiate()
	root.add_child(screen)
	await process_frame

	for node_name in [
		"NicknameSetupRoot",
		"NicknameCard",
		"NicknameBody",
		"NicknameActions",
		"NicknameHint",
		"ScreenHeadingCentered",
		"NicknameTitle",
		"NicknameSubtitle",
		"NicknameForm",
		"NicknameField",
		"NicknameLabel",
		"NicknameInput",
		"NicknameStatus",
		"NicknameSubmitButton",
	]:
		if screen.find_child(node_name, true, false) == null:
			_fail("Missing nickname Web node: %s" % node_name)
			return

	var shell_content: Node = screen.get_node_or_null("WebShell/Root/Content")
	var root_card := screen.find_child("NicknameSetupRoot", true, false) as PanelContainer
	if shell_content == null or root_card == null:
		_fail("Nickname setup must render a named root card inside WebShell content")
		return
	if root_card.get_parent() != shell_content:
		_fail("NicknameSetupRoot must be the card rendered inside WebShell/Root/Content")
		return
	if root_card.get_theme_stylebox("panel") == null:
		_fail("NicknameSetupRoot must expose a token-backed panel style")
		return
	var card_min := WebUiTokens.auth_card_min_size()
	if root_card.custom_minimum_size.x < card_min.x or root_card.custom_minimum_size.y < card_min.y:
		_fail("NicknameSetupRoot must reserve at least the auth card minimum size")
		return
	if root_card.custom_minimum_size.x > 620.0 or root_card.custom_minimum_size.y > 480.0:
		_fail("NicknameSetupRoot must stay compact for a 1280x720 engine window")
		return
	if root_card.size_flags_horizontal != Control.SIZE_SHRINK_CENTER or root_card.size_flags_vertical != Control.SIZE_SHRINK_CENTER:
		_fail("NicknameSetupRoot must be centered instead of filling WebShell content")
		return

	var body := screen.find_child("NicknameBody", true, false) as VBoxContainer
	var actions := screen.find_child("NicknameActions", true, false) as VBoxContainer
	if body == null or actions == null:
		_fail("Nickname setup card must split body and action regions")
		return
	if body.custom_minimum_size.x < 420.0 or actions.custom_minimum_size.x < 420.0:
		_fail("Nickname body and actions must keep a stable form width")
		return

	var input := screen.find_child("NicknameInput", true, false) as LineEdit
	if input == null or input.max_length != 16:
		_fail("Nickname input max length must match Web maxLength=16")
		return
	if input.custom_minimum_size.x < 420.0 or input.custom_minimum_size.y < WebUiTokens.touch_target_height():
		_fail("Nickname input must keep a stable touch-sized Web form footprint")
		return
	if input.get_theme_stylebox("normal") == null or input.get_theme_stylebox("focus") == null:
		_fail("Nickname input must use shared Web input styles")
		return

	var status := screen.find_child("NicknameStatus", true, false) as Label
	if status == null or status.custom_minimum_size.x < 420.0 or status.custom_minimum_size.y < 44.0:
		_fail("Nickname status must reserve stable space for wrapped feedback")
		return
	if not status.clip_text or status.text_overrun_behavior != TextServer.OVERRUN_TRIM_ELLIPSIS:
		_fail("Nickname status must clip or ellipsize long feedback inside the card")
		return
	if status.max_lines_visible <= 0 or status.max_lines_visible > 2:
		_fail("Nickname status must cap visible lines to keep card height stable")
		return
	var status_height_before := status.get_combined_minimum_size().y
	var card_height_before := root_card.get_combined_minimum_size().y
	status.text = "Nickname status overflow check ".repeat(40)
	await process_frame
	var status_height_after := status.get_combined_minimum_size().y
	var card_height_after := root_card.get_combined_minimum_size().y
	if status_height_after > status_height_before + 1.0 or status_height_after > 48.0:
		_fail("Nickname status long text must not increase its stable height")
		return
	if card_height_after > card_height_before + 1.0 or card_height_after > 480.0:
		_fail("Nickname card long status text must not grow beyond its stable height")
		return

	var submit := screen.find_child("NicknameSubmitButton", true, false) as Button
	if submit == null or submit.custom_minimum_size.x < 420.0 or submit.custom_minimum_size.y < WebUiTokens.touch_target_height():
		_fail("Nickname submit button must keep a stable full-width touch target")
		return
	if submit.text.strip_edges().is_empty() or submit.text == "保存昵称":
		_fail("Nickname submit must expose a stable CTA and must not regress to old save text")
		return
	if submit.get_theme_stylebox("normal") == null or submit.get_theme_stylebox("disabled") == null:
		_fail("Nickname submit button must use shared handdrawn button styles")
		return
	if submit.clip_text != true or submit.text_overrun_behavior != TextServer.OVERRUN_TRIM_ELLIPSIS:
		_fail("Nickname submit button must clip long loading text without changing layout")
		return

	var logout_leak := root_card.find_child("LogoutButton", true, false) != null or _find_button_containing(root_card, "logout") != null
	if logout_leak:
		_fail("Nickname setup must not include a logout button; shell top bar owns that entry")
		return

	var text := _collect_text(screen)
	if text.strip_edges().is_empty():
		_fail("Nickname setup must render visible hierarchy text")
		return
	var title := screen.find_child("NicknameTitle", true, false) as Label
	var label := screen.find_child("NicknameLabel", true, false) as Label
	if title.text.strip_edges().is_empty() or label.text.strip_edges().is_empty():
		_fail("Nickname title and field label must stay visible")
		return
	if text.contains("退出登录"):
		_fail("Nickname setup must not leak a local logout text")
		return

	screen.queue_free()
	for _frame in range(2):
		await process_frame
	print("Godot nickname setup Web structure smoke passed")
	quit(0)

func _collect_text(node: Node) -> String:
	var text := ""
	if node is Label:
		text += (node as Label).text + "\n"
	if node is Button:
		text += (node as Button).text + "\n"
	for child in node.get_children():
		text += _collect_text(child)
	return text

func _find_button_containing(node: Node, needle: String) -> Button:
	if node is Button and (node as Button).text.to_lower().contains(needle.to_lower()):
		return node as Button
	for child in node.get_children():
		var result := _find_button_containing(child, needle)
		if result != null:
			return result
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
