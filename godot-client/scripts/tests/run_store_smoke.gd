extends SceneTree

func _init() -> void:
	var script := load("res://scripts/state/RunStore.gd")
	if script == null:
		push_error("RunStore.gd failed to load")
		quit(1)
		return
	var store := script.new()
	store.set_run({
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
		"shopItems": [{"offerId": "offer-1"}]
	})
	if not store.has_run() or store.phase() != "SHOP" or store.gold() != 9:
		push_error("RunStore basic accessors failed")
		quit(1)
		return
	if store.items_in_area("EQUIPMENT").size() != 1:
		push_error("RunStore equipment filter failed")
		quit(1)
		return
	if store.shop_offers().size() != 1:
		push_error("RunStore shop offers failed")
		quit(1)
		return
	quit(0)
