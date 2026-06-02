extends PanelContainer

signal login_succeeded

@onready var account_input: LineEdit = %AccountInput
@onready var password_input: LineEdit = %PasswordInput
@onready var login_button: Button = %LoginButton
@onready var register_button: Button = %RegisterButton
@onready var error_label: Label = %ErrorLabel

var session: Node

func bind_session(next_session: Node) -> void:
	if session != null and session.has_signal("error_raised") and session.error_raised.is_connected(_on_error_raised):
		session.error_raised.disconnect(_on_error_raised)
	session = next_session
	if session != null and session.has_signal("error_raised") and not session.error_raised.is_connected(_on_error_raised):
		session.error_raised.connect(_on_error_raised)

func _ready() -> void:
	if not login_button.pressed.is_connected(_on_login_pressed):
		login_button.pressed.connect(_on_login_pressed)
	if not register_button.pressed.is_connected(_on_register_pressed):
		register_button.pressed.connect(_on_register_pressed)

func _on_login_pressed() -> void:
	await _submit_auth("login")

func _on_register_pressed() -> void:
	await _submit_auth("register")

func _submit_auth(action: String) -> void:
	error_label.text = ""
	if session == null or not session.has_method(action):
		error_label.text = "登录会话未初始化"
		return
	var account := account_input.text.strip_edges()
	if account.length() < 3:
		error_label.text = "账号至少 3 个字符"
		return
	if password_input.text.length() < 6:
		error_label.text = "密码至少 6 个字符"
		return
	login_button.disabled = true
	register_button.disabled = true
	var ok: bool = await session.call(action, account, password_input.text)
	login_button.disabled = false
	register_button.disabled = false
	if ok:
		login_succeeded.emit()

func _on_error_raised(message: String) -> void:
	error_label.text = message
