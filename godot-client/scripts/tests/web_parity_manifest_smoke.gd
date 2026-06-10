extends SceneTree

const REQUIRED_DOMAINS := [
	"auth",
	"nickname",
	"shell",
	"mode_lobby",
	"dog_select",
	"exploration_map",
	"run_shop",
	"inventory",
	"reward_choice",
	"run_shell",
	"battle_replay",
	"run_settlement",
	"account_history",
	"account_shop",
	"achievements_daily",
	"account_settings",
	"leaderboards",
	"apex",
	"season",
	"dogfight_rooms",
	"dogfight_room_detail",
	"localization",
	"audio_assets",
]

const VALID_PHASES := [
	"baseline",
	"foundation",
	"run_core",
	"battle",
	"account",
	"dogfight",
	"final",
]

const VALID_STATUSES := [
	"aligned",
	"partial",
	"gap",
	"legacy_only",
]

func _init() -> void:
	var manifest = load("res://scripts/ui/web/WebParityManifest.gd")
	if manifest == null:
		_fail("WebParityManifest.gd must exist")
		return

	var domains: Array = manifest.domains()
	for domain_id in REQUIRED_DOMAINS:
		var domain := _find_domain(domains, domain_id)
		if domain.is_empty():
			_fail("Web parity manifest missing domain: %s" % domain_id)
			return
		for required_key in ["id", "webSource", "godotTarget", "phase", "status"]:
			if str(domain.get(required_key, "")).is_empty():
				_fail("Manifest domain %s missing non-empty %s" % [domain_id, required_key])
				return
		if not VALID_PHASES.has(str(domain.get("phase", ""))):
			_fail("Manifest domain %s has invalid phase %s" % [domain_id, str(domain.get("phase", ""))])
			return
		if not VALID_STATUSES.has(str(domain.get("status", ""))):
			_fail("Manifest domain %s has invalid status %s" % [domain_id, str(domain.get("status", ""))])
			return

	var legacy_allowed: Array = manifest.legacy_allowed_domains()
	if not legacy_allowed.has("battle_replay"):
		_fail("battle_replay must stay legacy-allowed during foundation migration")
		return
	if legacy_allowed.has("account_shop"):
		_fail("account_shop must not allow legacy fallback")
		return

	print("Web parity manifest smoke passed")
	quit(0)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)

func _find_domain(domains: Array, domain_id: String) -> Dictionary:
	for entry in domains:
		if typeof(entry) != TYPE_DICTIONARY:
			continue
		var domain: Dictionary = entry
		if str(domain.get("id", "")) == domain_id:
			return domain
	return {}
