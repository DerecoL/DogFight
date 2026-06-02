class_name Responsive
extends RefCounted

const MOBILE_MAX_WIDTH := 720
const TABLET_MAX_WIDTH := 1024

static func breakpoint_for_width(width: int) -> String:
	if width <= MOBILE_MAX_WIDTH:
		return "mobile"
	if width <= TABLET_MAX_WIDTH:
		return "tablet"
	return "desktop"

static func is_mobile_size(size: Vector2i) -> bool:
	return breakpoint_for_width(size.x) == "mobile"

static func is_desktop_size(size: Vector2i) -> bool:
	return breakpoint_for_width(size.x) == "desktop"
