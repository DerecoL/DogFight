class_name ShellBackedWebScreen
extends BaseWebScreen

const WebShellScene := preload("res://scenes/shell/WebShell.tscn")

var shell: WebShell
var shell_content: VBoxContainer

func _ready() -> void:
	_render_shell()

func _on_payload_changed() -> void:
	_render_shell()

func content_container() -> VBoxContainer:
	_ensure_shell()
	if shell_content == null and shell != null:
		shell_content = shell.content_container()
	return shell_content

func _render_shell() -> void:
	_ensure_shell()
	if shell == null:
		return
	shell.set_user(_dict(payload, "user"))
	shell.set_run(_dict(payload, "run"))
	shell.set_error(str(payload.get("error", "")))
	shell.clear_content()
	_render_shell_content()

func _render_shell_content() -> void:
	pass

func _ensure_shell() -> void:
	if shell != null and is_instance_valid(shell):
		return
	set_anchors_preset(Control.PRESET_FULL_RECT)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	for child in get_children():
		remove_child(child)
		child.queue_free()

	shell = WebShellScene.instantiate()
	shell.name = "WebShell"
	add_child(shell)
	shell_content = shell.content_container()
	shell.lobby_requested.connect(_on_shell_lobby_requested)
	shell.logout_requested.connect(_on_shell_logout_requested)

func _on_shell_lobby_requested() -> void:
	if session != null and session.has_method("open_screen"):
		session.call("open_screen", "mode_lobby")

func _on_shell_logout_requested() -> void:
	if session != null and session.has_method("logout"):
		session.call("logout")

func _dict(source: Dictionary, key: String) -> Dictionary:
	var value = source.get(key, {})
	return value if value is Dictionary else {}
