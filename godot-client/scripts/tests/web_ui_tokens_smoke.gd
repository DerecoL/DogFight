extends SceneTree

func _init() -> void:
	var tokens = load("res://scripts/ui/web/WebUiTokens.gd")
	if tokens == null:
		_fail("WebUiTokens.gd must exist")
		return

	if int(tokens.board_slot_size()) != 74:
		_fail("Web board slot size must match the 74px inspection target")
		return
	if int(tokens.compact_slot_size()) != 52:
		_fail("Web compact slot size must match the 52px inspection target")
		return
	if int(tokens.icon_slot_size()) != 30:
		_fail("Web icon slot size must match the 30px inspection target")
		return
	if int(tokens.touch_target_height()) < 44:
		_fail("Touch target must stay at least 44px")
		return

	var required_visual_token_methods := [
		"screen_safe_margin",
		"desktop_content_max_width",
		"auth_card_min_size",
		"lobby_mode_card_min_size",
		"auth_card_style",
		"mode_card_style",
		"input_style",
		"debug_foldout_style",
		"safe_content_size_16_9",
		"safe_content_margin",
		"handdrawn_card_min_size",
		"handdrawn_card_fixed_size",
		"debug_entry_button_size",
		"secondary_folded_entry_size",
		"layer_base",
		"layer_card",
		"layer_overlay",
		"layer_toast",
		"layer_debug",
	]
	for method_name in required_visual_token_methods:
		if not tokens.has_method(method_name):
			_fail("WebUiTokens must expose %s" % method_name)
			return

	for style_method in ["auth_card_style", "mode_card_style", "input_style", "debug_foldout_style"]:
		var style_box = tokens.call(style_method)
		if style_box == null or not style_box is StyleBoxFlat:
			_fail("%s must return StyleBoxFlat for direct theme override use" % style_method)
			return

	for token_method in ["auth_card_style_token", "mode_card_style_token", "input_style_token", "debug_foldout_style_token"]:
		if not tokens.has_method(token_method):
			_fail("WebUiTokens must expose %s" % token_method)
			return
		var style_token = tokens.call(token_method)
		if typeof(style_token) != TYPE_DICTIONARY:
			_fail("%s must return a reusable style Dictionary" % token_method)
			return
		for key in ["style_box", "bg_color", "border_color", "text_color", "accent_color"]:
			if not style_token.has(key):
				_fail("%s must include %s" % [token_method, key])
				return
		if style_token["style_box"] == null or not style_token["style_box"] is StyleBoxFlat:
			_fail("%s style_box must be StyleBoxFlat" % token_method)
			return
		for color_key in ["bg_color", "border_color", "text_color", "accent_color"]:
			if typeof(style_token[color_key]) != TYPE_COLOR:
				_fail("%s %s must be Color" % [token_method, color_key])
				return

	if typeof(tokens.screen_safe_margin()) != TYPE_INT:
		_fail("screen_safe_margin must return int")
		return
	if int(tokens.screen_safe_margin()) < 32 or int(tokens.screen_safe_margin()) > 72:
		_fail("screen_safe_margin must suit 1280x720 and 1600x900 16:9 windows")
		return

	if typeof(tokens.desktop_content_max_width()) != TYPE_INT:
		_fail("desktop_content_max_width must return int")
		return
	if int(tokens.desktop_content_max_width()) > 1280 - int(tokens.screen_safe_margin()) * 2:
		_fail("desktop_content_max_width must fit inside a 1280px viewport with safe margins")
		return
	if int(tokens.desktop_content_max_width()) < 960:
		_fail("desktop_content_max_width must leave enough room for desktop information hierarchy")
		return

	var auth_card_min_size = tokens.auth_card_min_size()
	var lobby_mode_card_min_size = tokens.lobby_mode_card_min_size()
	if typeof(auth_card_min_size) != TYPE_VECTOR2I or typeof(lobby_mode_card_min_size) != TYPE_VECTOR2I:
		_fail("Auth and lobby card minimum sizes must return Vector2i")
		return
	if auth_card_min_size.x < 360 or auth_card_min_size.y < 300:
		_fail("Auth card minimum size must reserve stable login content space")
		return
	if auth_card_min_size.x > int(tokens.desktop_content_max_width()) or auth_card_min_size.y > 720 - int(tokens.screen_safe_margin()) * 2:
		_fail("Auth card minimum size must fit inside a 1280x720 safe viewport")
		return
	if lobby_mode_card_min_size.x < 260 or lobby_mode_card_min_size.y < 160:
		_fail("Lobby mode card minimum size must stay readable and stable")
		return
	if lobby_mode_card_min_size.x * 3 > int(tokens.desktop_content_max_width()):
		_fail("Three lobby mode cards must fit inside the desktop content width")
		return

	var safe_content_size = tokens.safe_content_size_16_9()
	if typeof(safe_content_size) != TYPE_VECTOR2I:
		_fail("safe_content_size_16_9 must return Vector2i")
		return
	if safe_content_size.x < 960 or safe_content_size.x > 1600:
		_fail("16:9 safe content width must stay in a stable desktop range")
		return
	if safe_content_size.y < 540 or safe_content_size.y > 900:
		_fail("16:9 safe content height must stay in a stable desktop range")
		return
	if abs((float(safe_content_size.x) / float(safe_content_size.y)) - (16.0 / 9.0)) > 0.02:
		_fail("safe_content_size_16_9 must keep a 16:9 ratio")
		return

	if typeof(tokens.safe_content_margin()) != TYPE_INT:
		_fail("safe_content_margin must return int")
		return
	if int(tokens.safe_content_margin()) < 24 or int(tokens.safe_content_margin()) > 96:
		_fail("safe_content_margin must be large enough for 16:9 edge safety without wasting space")
		return

	var card_min_size = tokens.handdrawn_card_min_size()
	var card_fixed_size = tokens.handdrawn_card_fixed_size()
	if typeof(card_min_size) != TYPE_VECTOR2I or typeof(card_fixed_size) != TYPE_VECTOR2I:
		_fail("Handdrawn card size tokens must return Vector2i")
		return
	if card_min_size.x < 220 or card_min_size.y < 120:
		_fail("Handdrawn card minimum size must reserve stable content space")
		return
	if card_fixed_size.x < card_min_size.x or card_fixed_size.y < card_min_size.y:
		_fail("Handdrawn card fixed size must not be smaller than its minimum size")
		return
	if card_fixed_size.x > 420 or card_fixed_size.y > 280:
		_fail("Handdrawn card fixed size must remain compact for 16:9 layouts")
		return

	var debug_entry_button_size = tokens.debug_entry_button_size()
	var secondary_folded_entry_size = tokens.secondary_folded_entry_size()
	if typeof(debug_entry_button_size) != TYPE_VECTOR2I or typeof(secondary_folded_entry_size) != TYPE_VECTOR2I:
		_fail("Folded entry size tokens must return Vector2i")
		return
	if debug_entry_button_size.x < int(tokens.compact_slot_size()) or debug_entry_button_size.y < int(tokens.touch_target_height()):
		_fail("Debug entry button must keep a stable touch-friendly size")
		return
	if secondary_folded_entry_size.x < debug_entry_button_size.x or secondary_folded_entry_size.y < debug_entry_button_size.y:
		_fail("Secondary folded entry area must be at least as stable as the debug entry button")
		return

	var layer_values := [
		tokens.layer_base(),
		tokens.layer_card(),
		tokens.layer_overlay(),
		tokens.layer_toast(),
		tokens.layer_debug(),
	]
	for layer_value in layer_values:
		if typeof(layer_value) != TYPE_INT:
			_fail("Layer tokens must return int")
			return
	if not (layer_values[0] < layer_values[1]
		and layer_values[1] < layer_values[2]
		and layer_values[2] < layer_values[3]
		and layer_values[3] < layer_values[4]):
		_fail("Layer tokens must preserve base < card < overlay < toast < debug order")
		return
	if layer_values[4] > 1000:
		_fail("Layer tokens must stay in a modest z-index range")
		return

	var paper = tokens.paper_card_style()
	if paper == null or not paper is StyleBoxFlat:
		_fail("paper_card_style must return StyleBoxFlat")
		return
	if (paper as StyleBoxFlat).corner_radius_top_left > 8:
		_fail("Paper card radius must stay 8px or less")
		return

	var slot = tokens.slot_style(false, false)
	if slot == null or not slot is StyleBoxFlat:
		_fail("slot_style must return StyleBoxFlat")
		return

	var selected_slot = tokens.slot_style(true, false)
	if selected_slot == null or not selected_slot is StyleBoxFlat:
		_fail("selected slot_style must return StyleBoxFlat")
		return
	if (selected_slot as StyleBoxFlat).border_color == (slot as StyleBoxFlat).border_color:
		_fail("Selected slot must visibly differ from normal slot")
		return

	var gold: Color = tokens.quality_color("GOLD")
	var bronze: Color = tokens.quality_color("BRONZE")
	if gold == bronze:
		_fail("Quality colors must distinguish GOLD and BRONZE")
		return

	print("Web UI tokens smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
