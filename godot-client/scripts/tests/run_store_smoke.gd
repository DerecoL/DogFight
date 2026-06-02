extends SceneTree

func _init() -> void:
	var script := load("res://scripts/state/RunStore.gd")
	if script == null:
		push_error("RunStore.gd failed to load")
		quit(1)
		return
	var store = script.new()
	store.set_run({"id": ""})
	if store.has_run():
		push_error("RunStore must reject empty run ids")
		quit(1)
		return
	store.set_run({"id": null})
	if store.has_run():
		push_error("RunStore must reject null run ids")
		quit(1)
		return
	var source_run := {
		"id": "run-1",
		"phase": "SHOP",
		"gold": 9,
		"wins": 1,
		"losses": 0,
		"round": 2,
		"items": [
			{"id": "bag-1", "area": "BAG", "x": 2, "y": 0},
			{"id": "eq-1", "area": "EQUIPMENT", "x": 0, "y": 0}
		],
		"shopItems": [{"offerId": "offer-1"}],
		"lastBattle": {"id": "battle-1", "result": "WIN"},
		"mapState": {
			"availableNodeIds": ["map-a"],
			"nodes": [
				{"id": "map-a", "kind": "SHOP_FIXED", "layer": 0, "column": 0},
				{"id": "map-b", "kind": "EVENT", "layer": 0, "column": 1}
			]
		}
	}
	store.set_run(source_run)
	source_run["gold"] = 99
	source_run["items"][1]["id"] = "mutated-source-item"
	if not store.has_run() or store.phase() != "SHOP" or store.gold() != 9:
		push_error("RunStore basic accessors failed")
		quit(1)
		return
	var equipment_items: Array[Dictionary] = store.items_in_area("EQUIPMENT")
	if equipment_items.size() != 1 or str(equipment_items[0].get("id", "")) != "eq-1":
		push_error("RunStore equipment filter failed")
		quit(1)
		return
	equipment_items[0]["id"] = "mutated-returned-item"
	if str(store.items_in_area("EQUIPMENT")[0].get("id", "")) != "eq-1":
		push_error("RunStore item defensive copy failed")
		quit(1)
		return
	var shop_offers: Array[Dictionary] = store.shop_offers()
	if shop_offers.size() != 1:
		push_error("RunStore shop offers failed")
		quit(1)
		return
	shop_offers[0]["offerId"] = "mutated-returned-offer"
	if str(store.shop_offers()[0].get("offerId", "")) != "offer-1":
		push_error("RunStore shop offer defensive copy failed")
		quit(1)
		return
	var last_battle: Dictionary = store.last_battle()
	if str(last_battle.get("id", "")) != "battle-1":
		push_error("RunStore last battle failed")
		quit(1)
		return
	last_battle["id"] = "mutated-returned-battle"
	if str(store.last_battle().get("id", "")) != "battle-1":
		push_error("RunStore last battle defensive copy failed")
		quit(1)
		return
	var map_nodes: Array[Dictionary] = store.map_available_nodes()
	if map_nodes.size() != 1 or str(map_nodes[0].get("id", "")) != "map-a":
		push_error("RunStore map available nodes failed")
		quit(1)
		return
	map_nodes[0]["id"] = "mutated-map-node"
	if str(store.map_available_nodes()[0].get("id", "")) != "map-a":
		push_error("RunStore map node defensive copy failed")
		quit(1)
		return
	quit(0)
