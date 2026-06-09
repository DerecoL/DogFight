extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var main_scene := load("res://scenes/Main.tscn")
	if main_scene == null:
		_fail("Main scene failed to load")
		return
	var main = main_scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame

	var run_screen = main.get_node_or_null("ScreenRoot/LegacyRunScreen")
	if run_screen == null:
		_fail("RunScreen is missing")
		return
	if run_screen.has_method("bind_session"):
		run_screen.bind_session(main)

	run_screen.set("cosmetics_data", {
		"equipped": [
			{
				"slot": "TITLE",
				"catalogItemId": "title-paper-crown",
				"item": {"id": "title-paper-crown", "name": "纸冠头衔", "type": "TITLE", "rarity": "EPIC"},
			},
		],
		"inventory": [
			{
				"catalogItemId": "title-paper-crown",
				"item": {"id": "title-paper-crown", "name": "纸冠头衔", "description": "在账号面板展示纸冠称号", "type": "TITLE", "rarity": "EPIC"},
				"owned": true,
			},
			{
				"catalogItemId": "avatar-crown",
				"item": {"id": "avatar-crown", "name": "皇冠头像", "description": "展示皇冠头像", "type": "AVATAR", "rarity": "RARE"},
				"owned": true,
			},
		],
	})
	run_screen.set("current_tab", "设置")
	run_screen.call("_render_current_tab")
	await process_frame

	for node_name in [
		"CosmeticGroup_TITLE",
		"CosmeticGroupHeading_TITLE",
		"CosmeticGrid_TITLE",
		"CosmeticDefaultCard_TITLE",
		"CosmeticDefaultBadge_TITLE",
		"CosmeticDefaultName_TITLE",
		"CosmeticDefaultDescription_TITLE",
		"CosmeticDefaultMeta_TITLE",
		"CosmeticDefaultActions_TITLE",
		"CosmeticDefaultState_TITLE",
		"CosmeticDefaultAction_TITLE",
		"CosmeticCard_title-paper-crown",
		"CosmeticBadge_title-paper-crown",
		"CosmeticName_title-paper-crown",
		"CosmeticDescription_title-paper-crown",
		"CosmeticMeta_title-paper-crown",
		"CosmeticActions_title-paper-crown",
		"CosmeticState_title-paper-crown",
		"CosmeticAction_title-paper-crown",
		"CosmeticGroup_AVATAR",
		"CosmeticGroupHeading_AVATAR",
		"CosmeticDefaultBadge_AVATAR",
		"CosmeticDefaultName_AVATAR",
		"CosmeticDefaultDescription_AVATAR",
		"CosmeticDefaultMeta_AVATAR",
		"CosmeticDefaultActions_AVATAR",
		"CosmeticDefaultState_AVATAR",
		"CosmeticCard_avatar-crown",
		"CosmeticBadge_avatar-crown",
		"CosmeticName_avatar-crown",
		"CosmeticDescription_avatar-crown",
		"CosmeticMeta_avatar-crown",
		"CosmeticActions_avatar-crown",
		"CosmeticState_avatar-crown",
		"CosmeticEmpty_BACKGROUND",
	]:
		_assert_has(run_screen, node_name)

	_assert_label_text(run_screen, "CosmeticGroupHeading_TITLE", "称号")
	_assert_label_text(run_screen, "CosmeticDefaultBadge_TITLE", "称号")
	_assert_label_text(run_screen, "CosmeticDefaultName_TITLE", "默认称号")
	_assert_label_text(run_screen, "CosmeticDefaultDescription_TITLE", "不装备称号，显示账号原始样式。")
	_assert_label_text(run_screen, "CosmeticDefaultMeta_TITLE", "默认 · 免费")
	_assert_label_text(run_screen, "CosmeticDefaultState_TITLE", "初始外观")
	_assert_button_text(run_screen, "CosmeticDefaultAction_TITLE", "选择默认", false)
	_assert_label_text(run_screen, "CosmeticBadge_title-paper-crown", "称号")
	_assert_label_text(run_screen, "CosmeticName_title-paper-crown", "纸冠头衔")
	_assert_label_text(run_screen, "CosmeticDescription_title-paper-crown", "在账号面板展示纸冠称号")
	_assert_label_text(run_screen, "CosmeticMeta_title-paper-crown", "史诗 · 已拥有")
	_assert_label_text(run_screen, "CosmeticState_title-paper-crown", "当前装备")
	_assert_button_text(run_screen, "CosmeticAction_title-paper-crown", "已装备", true)
	_assert_label_text(run_screen, "CosmeticDefaultState_AVATAR", "当前默认")
	_assert_button_text(run_screen, "CosmeticDefaultAction_AVATAR", "已选择", true)
	_assert_label_text(run_screen, "CosmeticName_avatar-crown", "皇冠头像")
	_assert_label_text(run_screen, "CosmeticMeta_avatar-crown", "稀有 · 已拥有")
	_assert_label_text(run_screen, "CosmeticState_avatar-crown", "可装备")
	_assert_button_text(run_screen, "CosmeticAction_avatar-crown", "装备", false)

	main.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot account settings card detail structure smoke passed")
	quit(0)

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing account settings card detail node: %s" % node_name)

func _assert_label_text(root_node: Node, node_name: String, expected: String) -> void:
	var label := _find_by_name(root_node, node_name) as Label
	if label == null:
		_fail("Missing label: %s" % node_name)
		return
	if label.text != expected:
		_fail("Label %s should be %s, got %s" % [node_name, expected, label.text])

func _assert_button_text(root_node: Node, node_name: String, expected: String, expected_disabled: bool) -> void:
	var button := _find_by_name(root_node, node_name) as Button
	if button == null:
		_fail("Missing button: %s" % node_name)
		return
	if button.text != expected:
		_fail("Button %s should be %s, got %s" % [node_name, expected, button.text])
	if button.disabled != expected_disabled:
		_fail("Button %s disabled should be %s" % [node_name, str(expected_disabled)])

func _find_by_name(node: Node, node_name: String) -> Node:
	if node.name == node_name:
		return node
	for child in node.get_children():
		var found := _find_by_name(child, node_name)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
