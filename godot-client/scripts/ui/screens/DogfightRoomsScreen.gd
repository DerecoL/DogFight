extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("多人房间", "Web 对齐目标：房间列表、创建、加入、匹配。"))
