class_name WebRoutePolicy
extends RefCounted

const WebIds := preload("res://scripts/ui/web/WebUiScreenIds.gd")

const _FORMAL_SCREEN_IDS := [
	WebIds.LOGIN,
	WebIds.NICKNAME_SETUP,
	WebIds.MODE_LOBBY,
	WebIds.DOG_SELECT,
	WebIds.SEASON,
	WebIds.ACCOUNT_SHOP,
	WebIds.ACHIEVEMENTS,
	WebIds.ACCOUNT_SETTINGS,
	WebIds.LEADERBOARDS,
	WebIds.APEX,
	WebIds.EXPLORATION_MAP,
	WebIds.RUN_SHOP,
	WebIds.REWARD_CHOICE,
	WebIds.RUN_SHELL,
	WebIds.BATTLE_REPLAY,
	WebIds.RUN_SETTLEMENT,
	WebIds.ACCOUNT,
	WebIds.DOGFIGHT_ROOMS,
	WebIds.DOGFIGHT_ROOM_DETAIL,
]

const _RUN_PHASE_SCREENS := {
	"MAP": WebIds.EXPLORATION_MAP,
	"CHOICE": WebIds.REWARD_CHOICE,
	"CLASS_REWARD": WebIds.REWARD_CHOICE,
	"ENCHANT_CHOICE": WebIds.REWARD_CHOICE,
	"RELIC_CHOICE": WebIds.REWARD_CHOICE,
	"UPGRADE_CHOICE": WebIds.REWARD_CHOICE,
	"POTION_CHOICE": WebIds.REWARD_CHOICE,
	"SHOP": WebIds.RUN_SHOP,
	"PREP": WebIds.RUN_SHELL,
	"MATCH": WebIds.RUN_SHELL,
	"BATTLE": WebIds.BATTLE_REPLAY,
	"COMPLETE": WebIds.RUN_SETTLEMENT,
}

const _LEGACY_ALLOWED_PHASES := [
	"BATTLE",
]

const _LEGACY_ALLOWED_SCREENS := [
	WebIds.BATTLE_REPLAY,
]

static func formal_screen_ids() -> Array[String]:
	var ids: Array[String] = []
	for id in _FORMAL_SCREEN_IDS:
		ids.append(str(id))
	return ids

static func formal_screen_for_run_phase(phase: String) -> String:
	return str(_RUN_PHASE_SCREENS.get(phase, WebIds.MODE_LOBBY))

static func migration_allows_legacy_for_phase(phase: String) -> bool:
	return _LEGACY_ALLOWED_PHASES.has(phase)

static func migration_allows_legacy_for_screen(screen_id: String) -> bool:
	return _LEGACY_ALLOWED_SCREENS.has(screen_id)
