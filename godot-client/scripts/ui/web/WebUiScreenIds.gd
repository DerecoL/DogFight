class_name WebUiScreenIds
extends RefCounted

const LOGIN := "login"
const NICKNAME_SETUP := "nickname_setup"
const MODE_LOBBY := "mode_lobby"
const PLAYABLE_RUN := "legacy_run"
const RUN_SHELL := "run_shell"
const EXPLORATION_MAP := "exploration_map"
const RUN_SHOP := "run_shop"
const REWARD_CHOICE := "reward_choice"
const BATTLE_REPLAY := "battle_replay"
const RUN_SETTLEMENT := "run_settlement"
const ACCOUNT_SHOP := "account_shop"
const ACHIEVEMENTS := "achievements"
const LEADERBOARDS := "leaderboards"
const SEASON := "season"
const DOGFIGHT_ROOMS := "dogfight_rooms"
const DOGFIGHT_ROOM_DETAIL := "dogfight_room_detail"
const ACCOUNT_SETTINGS := "account_settings"

const SCREEN_NODES := {
	LOGIN: "LoginScreen",
	NICKNAME_SETUP: "NicknameSetupScreen",
	MODE_LOBBY: "ModeLobbyScreen",
	RUN_SHELL: "RunShellScreen",
	EXPLORATION_MAP: "ExplorationMapScreen",
	RUN_SHOP: "RunShopScreen",
	REWARD_CHOICE: "RewardChoiceScreen",
	BATTLE_REPLAY: "BattleReplayScreen",
	RUN_SETTLEMENT: "RunSettlementScreen",
	ACCOUNT_SHOP: "AccountShopScreen",
	ACHIEVEMENTS: "AchievementsScreen",
	LEADERBOARDS: "LeaderboardsScreen",
	SEASON: "SeasonScreen",
	DOGFIGHT_ROOMS: "DogfightRoomsScreen",
	DOGFIGHT_ROOM_DETAIL: "DogfightRoomDetailScreen",
	ACCOUNT_SETTINGS: "AccountSettingsScreen",
}

const RUN_PHASE_SCREENS := {
	"MAP": EXPLORATION_MAP,
	"CHOICE": PLAYABLE_RUN,
	"CLASS_REWARD": PLAYABLE_RUN,
	"ENCHANT_CHOICE": PLAYABLE_RUN,
	"RELIC_CHOICE": PLAYABLE_RUN,
	"UPGRADE_CHOICE": PLAYABLE_RUN,
	"POTION_CHOICE": PLAYABLE_RUN,
	"SHOP": RUN_SHOP,
	"PREP": PLAYABLE_RUN,
	"MATCH": PLAYABLE_RUN,
	"BATTLE": BATTLE_REPLAY,
	"COMPLETE": PLAYABLE_RUN,
}

static func screen_ids() -> Array[String]:
	var ids: Array[String] = []
	for id in SCREEN_NODES.keys():
		ids.append(str(id))
	return ids

static func node_name_for(screen_id: String) -> String:
	return str(SCREEN_NODES.get(screen_id, ""))

static func screen_for_run_phase(phase: String) -> String:
	return str(RUN_PHASE_SCREENS.get(phase, PLAYABLE_RUN))
