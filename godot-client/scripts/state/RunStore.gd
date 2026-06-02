class_name RunStore
extends RefCounted

var run: Dictionary = {}

func set_run(next_run: Dictionary) -> void:
	run = next_run.duplicate(true)

func has_run() -> bool:
	return not run.is_empty() and run_id().length() > 0

func run_id() -> String:
	var id = run.get("id", "")
	return "" if id == null else str(id)

func phase() -> String:
	return str(run.get("phase", ""))

func gold() -> int:
	return int(run.get("gold", 0))

func wins() -> int:
	return int(run.get("wins", 0))

func losses() -> int:
	return int(run.get("losses", 0))

func round_number() -> int:
	return int(run.get("round", 0))

func items_in_area(area: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for item in run.get("items", []):
		if item is Dictionary and str(item.get("area", "")) == area:
			result.append(item.duplicate(true))
	result.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var ay := int(a.get("y", 0))
		var by := int(b.get("y", 0))
		if ay != by:
			return ay < by
		return int(a.get("x", 0)) < int(b.get("x", 0))
	)
	return result

func shop_offers() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for offer in run.get("shopItems", []):
		if offer is Dictionary:
			result.append(offer.duplicate(true))
	return result

func map_available_nodes() -> Array[Dictionary]:
	var map_state = run.get("mapState", {})
	if not map_state is Dictionary:
		return []
	var available_ids: Array = map_state.get("availableNodeIds", [])
	var nodes: Array = map_state.get("nodes", [])
	var result: Array[Dictionary] = []
	for node in nodes:
		if node is Dictionary and available_ids.has(str(node.get("id", ""))):
			result.append(node.duplicate(true))
	result.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var layer_a := int(a.get("layer", 0))
		var layer_b := int(b.get("layer", 0))
		if layer_a != layer_b:
			return layer_a < layer_b
		return int(a.get("column", 0)) < int(b.get("column", 0))
	)
	return result

func last_battle() -> Dictionary:
	var battle = run.get("lastBattle", {})
	return battle.duplicate(true) if battle is Dictionary else {}
