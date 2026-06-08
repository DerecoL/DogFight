extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("探索地图", "Web 对齐目标：路线板、节点详情、事件、掉落、怪物装备预览、路线草稿工具。"))
