extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("赛季", "Web 对齐目标：当前赛季、赛季历史、赛季结算和快照。"))
