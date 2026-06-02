class_name AppStore
extends RefCounted

signal user_changed(user: Dictionary)
signal run_changed(run: Dictionary)
signal error_raised(message: String)

const AccountStore := preload("res://scripts/state/AccountStore.gd")
const RunStore := preload("res://scripts/state/RunStore.gd")

var account: AccountStore = AccountStore.new()
var run: RunStore = RunStore.new()
var last_error := ""

func set_user(next_user: Dictionary) -> void:
	account.set_user(next_user)
	user_changed.emit(account.user.duplicate(true))

func set_wallet(next_wallet: Dictionary) -> void:
	account.set_wallet(next_wallet)

func set_current_run(next_run: Dictionary) -> void:
	run.set_run(next_run)
	run_changed.emit(run.run.duplicate(true))

func raise_error(message: String) -> void:
	last_error = message
	error_raised.emit(message)
