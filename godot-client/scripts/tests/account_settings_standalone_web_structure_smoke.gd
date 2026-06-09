extends SceneTree

func _init() -> void:
	_run()

func _run() -> void:
	var screen_scene := load("res://scenes/screens/AccountSettingsScreen.tscn")
	if screen_scene == null:
		_fail("AccountSettingsScreen scene failed to load")
		return
	var screen = screen_scene.instantiate()
	root.add_child(screen)
	await process_frame
	screen.call("set_payload", {"cosmeticsData": _cosmetics_data()})
	await process_frame

	if str(screen.get("playable_redirect_screen_id")) != "":
		_fail("AccountSettingsScreen must render standalone UI instead of redirecting to playable shell")
		return

	for node_name in [
		"AccountSettingsScreen",
		"AccountSettingsHeading",
		"AccountSettingsEyebrow",
		"AccountSettingsTitle",
		"CosmeticGroup_TITLE",
		"CosmeticGrid_TITLE",
		"CosmeticDefaultCard_TITLE",
		"CosmeticDefaultAction_TITLE",
		"CosmeticCard_title-paper-crown",
		"CosmeticAction_title-paper-crown",
		"CosmeticGroup_AVATAR",
		"CosmeticGrid_AVATAR",
		"CosmeticDefaultCard_AVATAR",
		"CosmeticDefaultAction_AVATAR",
		"CosmeticCard_avatar-crown",
		"CosmeticAction_avatar-crown",
		"CosmeticGroup_BACKGROUND",
		"CosmeticEmpty_BACKGROUND",
		"CosmeticGroup_DOG_SKIN",
		"CosmeticEmpty_DOG_SKIN",
		"CosmeticGroup_BATTLE_EFFECT",
		"CosmeticEmpty_BATTLE_EFFECT",
	]:
		_assert_has(screen, node_name)

	var title_default := _find_by_name(screen, "CosmeticDefaultAction_TITLE") as Button
	if title_default == null or title_default.disabled:
		_fail("Title default action should be enabled when a title is equipped")
		return
	var avatar_default := _find_by_name(screen, "CosmeticDefaultAction_AVATAR") as Button
	if avatar_default == null or not avatar_default.disabled:
		_fail("Avatar default action should be disabled when default avatar is selected")
		return
	var title_action := _find_by_name(screen, "CosmeticAction_title-paper-crown") as Button
	if title_action == null or not title_action.disabled:
		_fail("Equipped title action should be disabled")
		return
	var avatar_action := _find_by_name(screen, "CosmeticAction_avatar-crown") as Button
	if avatar_action == null or avatar_action.disabled:
		_fail("Owned avatar action should be enabled")
		return

	var text := _collect_text(screen)
	for part in ["个人设置", "时装与展示", "称号", "默认称号", "不装备称号，显示账号原始样式。", "初始外观", "选择默认", "纸冠头衔", "在账号面板展示纸冠称号", "史诗 · 已拥有", "当前装备", "已装备", "头像", "默认头像", "使用初始狗狗头像。", "当前默认", "已选择", "皇冠头像", "稀有 · 已拥有", "可装备", "装备", "主页背景", "暂无已拥有的主页背景", "狗狗皮肤", "暂无已拥有的狗狗皮肤", "战斗特效", "暂无已拥有的战斗特效"]:
		if not text.contains(part):
			_fail("Account settings standalone Web text missing: %s" % part)
			return

	screen.queue_free()
	for _frame in range(5):
		await process_frame
	print("Godot account settings standalone Web structure smoke passed")
	quit(0)

func _cosmetics_data() -> Dictionary:
	return {
		"equipped": [
			{"slot": "TITLE", "catalogItemId": "title-paper-crown", "item": {"id": "title-paper-crown", "name": "纸冠头衔", "type": "TITLE", "rarity": "EPIC"}},
		],
		"inventory": [
			{"catalogItemId": "title-paper-crown", "item": {"id": "title-paper-crown", "name": "纸冠头衔", "description": "在账号面板展示纸冠称号", "type": "TITLE", "rarity": "EPIC"}, "owned": true},
			{"catalogItemId": "avatar-crown", "item": {"id": "avatar-crown", "name": "皇冠头像", "description": "展示皇冠头像", "type": "AVATAR", "rarity": "RARE"}, "owned": true},
		],
	}

func _assert_has(root_node: Node, node_name: String) -> void:
	if _find_by_name(root_node, node_name) == null:
		_fail("Missing account settings standalone Web node: %s" % node_name)

func _find_by_name(node: Node, node_name: String) -> Node:
	if node.name == node_name:
		return node
	for child in node.get_children():
		var found := _find_by_name(child, node_name)
		if found != null:
			return found
	return null

func _collect_text(node: Node) -> String:
	var text := ""
	if node is Label:
		text += (node as Label).text + "\n"
	if node is Button:
		text += (node as Button).text + "\n"
	for child in node.get_children():
		text += _collect_text(child)
	return text

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
