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
