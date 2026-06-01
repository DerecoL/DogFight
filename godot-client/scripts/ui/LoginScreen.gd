extends PanelContainer

signal login_succeeded

@onready var account_input: LineEdit = %AccountInput
@onready var password_input: LineEdit = %PasswordInput
@onready var login_button: Button = %LoginButton
@onready var error_label: Label = %ErrorLabel

var session: Node

func bind_session(next_session: Node) -> void:
	session = next_session
	if session != null and session.has_signal("error_raised") and not session.error_raised.is_connected(_on_error_raised):
		session.error_raised.connect(_on_error_raised)

func _ready() -> void:
	login_button.pressed.connect(_on_login_pressed)

func _on_login_pressed() -> void:
	error_label.text = ""
	if session == null or not session.has_method("login"):
		error_label.text = "登录会话未初始化"
		return
	login_button.disabled = true
	var ok: bool = await session.login(account_input.text.strip_edges(), password_input.text)
	login_button.disabled = false
	if ok:
		login_succeeded.emit()

func _on_error_raised(message: String) -> void:
	error_label.text = message
