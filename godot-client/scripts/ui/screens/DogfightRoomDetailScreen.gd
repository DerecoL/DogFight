extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("房间详情", "Web 对齐目标：玩家席位、阶段、选狗、准备、观战、房间战报。"))
