class_name ApiRoutes
extends RefCounted

static func health() -> String:
	return "/health"

static func login() -> String:
	return "/auth/login"

static func register() -> String:
	return "/auth/register"

static func taptap_login() -> String:
	return "/auth/taptap"

static func logout() -> String:
	return "/auth/logout"

static func me() -> String:
	return "/me"

static func profile_nickname() -> String:
	return "/profile/nickname"

static func achievements() -> String:
	return "/achievements"

static func achievement_claim(achievement_id: String) -> String:
	return "/achievements/%s/claim" % _encode_segment(achievement_id)

static func daily_tasks() -> String:
	return "/daily-tasks"

static func daily_tasks_refresh() -> String:
	return "/daily-tasks/refresh"

static func daily_task_claim(task_id: String) -> String:
	return "/daily-tasks/%s/claim" % _encode_segment(task_id)

static func shop() -> String:
	return "/shop"

static func shop_purchase() -> String:
	return "/shop/purchase"

static func cosmetics_me() -> String:
	return "/cosmetics/me"

static func cosmetics_equip() -> String:
	return "/cosmetics/equip"

static func ladder_me() -> String:
	return "/ladder/me"

static func ladder_leaderboard() -> String:
	return "/ladder/leaderboard"

static func apex() -> String:
	return "/apex"

static func apex_submit() -> String:
	return "/apex/submit"

static func runs() -> String:
	return "/runs"

static func runs_history() -> String:
	return "/runs/history"

static func run_detail(run_id: String) -> String:
	return "/runs/%s" % _encode_segment(run_id)

static func run_map_event(run_id: String) -> String:
	return "%s/map/event" % run_detail(run_id)

static func run_map_complete_node(run_id: String) -> String:
	return "%s/map/complete-node" % run_detail(run_id)

static func run_monster_reward_claim(run_id: String) -> String:
	return "%s/map/monster-reward/claim" % run_detail(run_id)

static func run_monster_reward_skip(run_id: String) -> String:
	return "%s/map/monster-reward/skip" % run_detail(run_id)

static func run_shop_buy(run_id: String) -> String:
	return "%s/shop/buy" % run_detail(run_id)

static func run_shop_sell(run_id: String) -> String:
	return "%s/shop/sell" % run_detail(run_id)

static func run_shop_reroll(run_id: String) -> String:
	return "%s/shop/reroll" % run_detail(run_id)

static func run_item_move(run_id: String) -> String:
	return "%s/items/move" % run_detail(run_id)

static func run_item_upgrade(run_id: String) -> String:
	return "%s/items/upgrade" % run_detail(run_id)

static func run_choice_select(run_id: String) -> String:
	return "%s/choice/select" % run_detail(run_id)

static func run_upgrade_select(run_id: String) -> String:
	return "%s/upgrade/select" % run_detail(run_id)

static func run_upgrade_skip(run_id: String) -> String:
	return "%s/upgrade/skip" % run_detail(run_id)

static func run_potion_select(run_id: String) -> String:
	return "%s/potion/select" % run_detail(run_id)

static func run_class_reward_select(run_id: String) -> String:
	return "%s/class-reward/select" % run_detail(run_id)

static func run_enchant_select(run_id: String) -> String:
	return "%s/enchant/select" % run_detail(run_id)

static func run_relic_select(run_id: String) -> String:
	return "%s/relic/select" % run_detail(run_id)

static func run_relic_sell(run_id: String) -> String:
	return "%s/relic/sell" % run_detail(run_id)

static func run_map_select(run_id: String) -> String:
	return "%s/map/select" % run_detail(run_id)

static func run_battle_match(run_id: String) -> String:
	return "%s/battle/match" % run_detail(run_id)

static func run_battle_start(run_id: String) -> String:
	return "%s/battle/start" % run_detail(run_id)

static func run_battle_finish(run_id: String) -> String:
	return "%s/battle/finish" % run_detail(run_id)

static func run_settle(run_id: String) -> String:
	return "%s/settle" % run_detail(run_id)

static func dogfight_rooms() -> String:
	return "/dogfight/rooms"

static func dogfight_match() -> String:
	return "/dogfight/match"

static func dogfight_room(room_id: String) -> String:
	return "/dogfight/rooms/%s" % _encode_segment(room_id)

static func dogfight_room_join(room_id: String) -> String:
	return "%s/join" % dogfight_room(room_id)

static func dogfight_room_leave(room_id: String) -> String:
	return "%s/leave" % dogfight_room(room_id)

static func dogfight_room_start(room_id: String) -> String:
	return "%s/start" % dogfight_room(room_id)

static func dogfight_room_ready(room_id: String) -> String:
	return "%s/ready" % dogfight_room(room_id)

static func dogfight_room_dog_choice(room_id: String) -> String:
	return "%s/dog-choice" % dogfight_room(room_id)

static func dogfight_battle(battle_id: String) -> String:
	return "/dogfight/battles/%s" % _encode_segment(battle_id)

static func _encode_segment(value: String) -> String:
	return value.uri_encode()
