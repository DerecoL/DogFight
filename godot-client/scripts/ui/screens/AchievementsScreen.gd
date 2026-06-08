extends BaseWebScreen

func _ready() -> void:
	add_child(_make_placeholder("成就与每日", "Web 对齐目标：成就分类、进度、领取、每日任务刷新和领取。"))
