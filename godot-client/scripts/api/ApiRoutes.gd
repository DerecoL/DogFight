class_name ApiRoutes
extends RefCounted

static func health() -> String:
	return "/health"

static func login() -> String:
	return "/auth/login"

static func register() -> String:
	return "/auth/register"

static func logout() -> String:
	return "/auth/logout"

static func me() -> String:
	return "/me"

static func profile_nickname() -> String:
	return "/profile/nickname"

static func runs() -> String:
	return "/runs"

static func run_detail(run_id: String) -> String:
	return "/runs/%s" % _encode_segment(run_id)

static func run_shop_buy(run_id: String) -> String:
	return "%s/shop/buy" % run_detail(run_id)

static func run_shop_sell(run_id: String) -> String:
	return "%s/shop/sell" % run_detail(run_id)

static func run_shop_reroll(run_id: String) -> String:
	return "%s/shop/reroll" % run_detail(run_id)

static func run_item_move(run_id: String) -> String:
	return "%s/items/move" % run_detail(run_id)

static func run_map_select(run_id: String) -> String:
	return "%s/map/select" % run_detail(run_id)

static func run_battle_match(run_id: String) -> String:
	return "%s/battle/match" % run_detail(run_id)

static func run_battle_start(run_id: String) -> String:
	return "%s/battle/start" % run_detail(run_id)

static func run_battle_finish(run_id: String) -> String:
	return "%s/battle/finish" % run_detail(run_id)

static func _encode_segment(value: String) -> String:
	return value.uri_encode()
