extends Control

const DEFAULT_API_BASE_URL := "http://127.0.0.1:4000/api"

var api_base_url: String = DEFAULT_API_BASE_URL
var current_user: Dictionary = {}
var current_run: Dictionary = {}

func _ready() -> void:
	var override_url := OS.get_environment("DOGFIGHT_API_BASE_URL")
	if override_url.length() > 0:
		api_base_url = override_url.rstrip("/")
