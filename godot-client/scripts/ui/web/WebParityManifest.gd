class_name WebParityManifest
extends RefCounted

const WebIds := preload("res://scripts/ui/web/WebUiScreenIds.gd")

const PHASE_BASELINE := "baseline"
const PHASE_FOUNDATION := "foundation"
const PHASE_RUN_CORE := "run_core"
const PHASE_BATTLE := "battle"
const PHASE_ACCOUNT := "account"
const PHASE_DOGFIGHT := "dogfight"
const PHASE_FINAL := "final"

const STATUS_ALIGNED := "aligned"
const STATUS_PARTIAL := "partial"
const STATUS_GAP := "gap"
const STATUS_LEGACY_ONLY := "legacy_only"

const _DOMAINS := {
	"auth": {
		"id": "auth",
		"webSource": "src/auth",
		"godotTarget": WebIds.LOGIN,
		"phase": PHASE_BASELINE,
		"status": STATUS_PARTIAL,
	},
	"nickname": {
		"id": "nickname",
		"webSource": "src/nickname",
		"godotTarget": WebIds.NICKNAME_SETUP,
		"phase": PHASE_BASELINE,
		"status": STATUS_PARTIAL,
	},
	"shell": {
		"id": "shell",
		"webSource": "src/App.tsx",
		"godotTarget": "Main.tscn",
		"phase": PHASE_FOUNDATION,
		"status": STATUS_PARTIAL,
	},
	"mode_lobby": {
		"id": "mode_lobby",
		"webSource": "src/mode-lobby",
		"godotTarget": WebIds.MODE_LOBBY,
		"phase": PHASE_FOUNDATION,
		"status": STATUS_PARTIAL,
	},
	"dog_select": {
		"id": "dog_select",
		"webSource": "src/dog-select",
		"godotTarget": WebIds.DOG_SELECT,
		"phase": PHASE_FOUNDATION,
		"status": STATUS_PARTIAL,
	},
	"exploration_map": {
		"id": "exploration_map",
		"webSource": "src/run/map",
		"godotTarget": WebIds.EXPLORATION_MAP,
		"phase": PHASE_RUN_CORE,
		"status": STATUS_PARTIAL,
	},
	"run_shop": {
		"id": "run_shop",
		"webSource": "src/run/shop",
		"godotTarget": WebIds.RUN_SHOP,
		"phase": PHASE_RUN_CORE,
		"status": STATUS_PARTIAL,
	},
	"inventory": {
		"id": "inventory",
		"webSource": "src/run/inventory",
		"godotTarget": WebIds.RUN_SHELL,
		"phase": PHASE_RUN_CORE,
		"status": STATUS_PARTIAL,
	},
	"reward_choice": {
		"id": "reward_choice",
		"webSource": "src/run/rewards",
		"godotTarget": WebIds.REWARD_CHOICE,
		"phase": PHASE_RUN_CORE,
		"status": STATUS_PARTIAL,
	},
	"run_shell": {
		"id": "run_shell",
		"webSource": "src/run/shell",
		"godotTarget": WebIds.RUN_SHELL,
		"phase": PHASE_RUN_CORE,
		"status": STATUS_PARTIAL,
	},
	"battle_replay": {
		"id": "battle_replay",
		"webSource": "src/battle/replay",
		"godotTarget": WebIds.BATTLE_REPLAY,
		"phase": PHASE_BATTLE,
		"status": STATUS_PARTIAL,
	},
	"run_settlement": {
		"id": "run_settlement",
		"webSource": "src/run/settlement",
		"godotTarget": WebIds.RUN_SETTLEMENT,
		"phase": PHASE_RUN_CORE,
		"status": STATUS_PARTIAL,
	},
	"account_history": {
		"id": "account_history",
		"webSource": "src/account/history",
		"godotTarget": WebIds.ACCOUNT,
		"phase": PHASE_ACCOUNT,
		"status": STATUS_PARTIAL,
	},
	"account_shop": {
		"id": "account_shop",
		"webSource": "src/account/shop",
		"godotTarget": WebIds.ACCOUNT_SHOP,
		"phase": PHASE_ACCOUNT,
		"status": STATUS_PARTIAL,
	},
	"achievements_daily": {
		"id": "achievements_daily",
		"webSource": "src/account/achievements",
		"godotTarget": WebIds.ACHIEVEMENTS,
		"phase": PHASE_ACCOUNT,
		"status": STATUS_PARTIAL,
	},
	"account_settings": {
		"id": "account_settings",
		"webSource": "src/account/settings",
		"godotTarget": WebIds.ACCOUNT_SETTINGS,
		"phase": PHASE_ACCOUNT,
		"status": STATUS_PARTIAL,
	},
	"leaderboards": {
		"id": "leaderboards",
		"webSource": "src/leaderboards",
		"godotTarget": WebIds.LEADERBOARDS,
		"phase": PHASE_ACCOUNT,
		"status": STATUS_PARTIAL,
	},
	"apex": {
		"id": "apex",
		"webSource": "src/apex",
		"godotTarget": WebIds.APEX,
		"phase": PHASE_ACCOUNT,
		"status": STATUS_PARTIAL,
	},
	"season": {
		"id": "season",
		"webSource": "src/season",
		"godotTarget": WebIds.SEASON,
		"phase": PHASE_ACCOUNT,
		"status": STATUS_PARTIAL,
	},
	"dogfight_rooms": {
		"id": "dogfight_rooms",
		"webSource": "src/dogfight/rooms",
		"godotTarget": WebIds.DOGFIGHT_ROOMS,
		"phase": PHASE_DOGFIGHT,
		"status": STATUS_PARTIAL,
	},
	"dogfight_room_detail": {
		"id": "dogfight_room_detail",
		"webSource": "src/dogfight/room-detail",
		"godotTarget": WebIds.DOGFIGHT_ROOM_DETAIL,
		"phase": PHASE_DOGFIGHT,
		"status": STATUS_PARTIAL,
	},
	"localization": {
		"id": "localization",
		"webSource": "src/i18n",
		"godotTarget": "scripts/localization",
		"phase": PHASE_FINAL,
		"status": STATUS_GAP,
	},
	"audio_assets": {
		"id": "audio_assets",
		"webSource": "public/assets/audio",
		"godotTarget": "assets/audio",
		"phase": PHASE_FINAL,
		"status": STATUS_GAP,
	},
}

const _LEGACY_ALLOWED_DOMAINS := [
	"battle_replay",
]

static func domains() -> Array:
	var entries: Array = []
	for id in _DOMAINS.keys():
		entries.append(_DOMAINS[id].duplicate(true))
	return entries

static func legacy_allowed_domains() -> Array[String]:
	var ids: Array[String] = []
	for id in _LEGACY_ALLOWED_DOMAINS:
		ids.append(str(id))
	return ids
