extends SceneTree

func _init() -> void:
	var session_script := load("res://scripts/state/GameSession.gd")
	var toast_script := load("res://scripts/router/ToastBus.gd")
	if session_script == null or toast_script == null:
		push_error("GameSession or ToastBus failed to load")
		quit(1)
		return
	var session := Control.new()
	session.set_script(session_script)
	if not session.has_method("_run_action_success_message"):
		push_error("GameSession must expose run action success feedback labels")
		quit(1)
		return
	if not session.has_method("_push_run_action_success"):
		push_error("GameSession must push success feedback through ToastBus")
		quit(1)
		return
	var expected_actions := [
		"move_item",
		"upgrade_item",
		"buy_offer",
		"sell_item",
		"reroll_shop",
		"match_battle",
		"select_potion",
		"select_class_reward",
		"select_enchant",
		"select_relic",
		"sell_relic",
		"settle_run",
		"finish_battle",
	]
	for action in expected_actions:
		var label := str(session.call("_run_action_success_message", action))
		if label.strip_edges().is_empty():
			push_error("Run action is missing a success feedback label: %s" % action)
			quit(1)
			return
	session.toast_bus = toast_script.new()
	for action in ["buy_offer", "sell_item", "upgrade_item", "select_relic"]:
		session.call("_push_run_action_success", action)
		var toast: Dictionary = session.toast_bus.pop_next()
		if str(toast.get("kind", "")) != "success":
			push_error("Run action feedback must use success toast kind: %s" % action)
			quit(1)
			return
		if str(toast.get("message", "")).strip_edges().is_empty():
			push_error("Run action feedback must include a visible message: %s" % action)
			quit(1)
			return
	session.toast_bus.free()
	session.free()
	quit(0)
