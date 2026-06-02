class_name AccountStore
extends RefCounted

var user: Dictionary = {}
var wallet: Dictionary = {}
var cosmetics: Dictionary = {}

func set_user(next_user: Dictionary) -> void:
	user = next_user.duplicate(true)

func set_wallet(next_wallet: Dictionary) -> void:
	wallet = next_wallet.duplicate(true)

func set_cosmetics(next_cosmetics: Dictionary) -> void:
	cosmetics = next_cosmetics.duplicate(true)

func is_logged_in() -> bool:
	return user_id().length() > 0

func user_id() -> String:
	return str(user.get("id", ""))

func account_name() -> String:
	return str(user.get("account", ""))

func display_name() -> String:
	var nickname := str(user.get("nickname", ""))
	return nickname if nickname.length() > 0 else account_name()

func currency_balance() -> int:
	return int(wallet.get("balance", 0))
