class_name BaseWebScreen
extends Control

var session: Node
var payload: Dictionary = {}

func bind_session(next_session: Node) -> void:
	session = next_session

func set_payload(next_payload: Dictionary) -> void:
	payload = next_payload.duplicate(true)
	_on_payload_changed()

func clear_payload() -> void:
	payload = {}
	_on_payload_changed()

func _on_payload_changed() -> void:
	pass

func _make_placeholder(title: String, subtitle: String) -> PanelContainer:
	var tokens = load("res://scripts/ui/web/WebUiTokens.gd")
	var panel := PanelContainer.new()
	panel.name = "PlaceholderPanel"
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.custom_minimum_size = Vector2(520, 220)
	if tokens != null:
		panel.add_theme_stylebox_override("panel", tokens.paper_card_style())
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 20)
	margin.add_theme_constant_override("margin_top", 18)
	margin.add_theme_constant_override("margin_right", 20)
	margin.add_theme_constant_override("margin_bottom", 18)
	panel.add_child(margin)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	margin.add_child(box)
	var title_label := Label.new()
	title_label.name = "Title"
	title_label.text = title
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title_label)
	var subtitle_label := Label.new()
	subtitle_label.name = "Subtitle"
	subtitle_label.text = subtitle
	subtitle_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(subtitle_label)
	return panel
