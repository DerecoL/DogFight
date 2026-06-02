extends SceneTree

const REQUIRED_ASSETS := [
	"res://assets/map/exploration-parchment-scroll.webp",
	"res://assets/item-card-art/v4-growing-chew-sword.webp",
	"res://assets/item-card-art/v4-boom-counter.webp",
	"res://assets/item-card-art/v3-wooden-shield.webp",
	"res://assets/item-card-art/v3-spiked-vest.webp",
	"res://assets/item-card-art/v3-large-bone-sword.webp",
	"res://assets/item-card-art/v3-hydrant-axe.webp",
	"res://assets/item-card-art/v3-flea-disc.webp",
	"res://assets/item-card-art/v3-fermented-trash-bin.webp",
	"res://assets/item-card-art/v3-auto-waterer.webp",
	"res://assets/item-card-art/samoyed-absolute-zero.webp",
	"res://assets/item-card-art/milk-bone.webp",
	"res://assets/item-card-art/dog-gold-ingot.webp",
]

func _init() -> void:
	for path in REQUIRED_ASSETS:
		if not FileAccess.file_exists(path):
			push_error("Missing migrated Godot asset: %s" % path)
			quit(1)
			return
	quit(0)
