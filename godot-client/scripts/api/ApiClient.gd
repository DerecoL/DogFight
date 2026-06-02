class_name ApiClient
extends Node

signal request_started(path: String)
signal request_finished(path: String, ok: bool, status: int, payload: Dictionary)

var base_url := "http://127.0.0.1:4000/api"
var cookie_header := ""

func configure(next_base_url: String) -> void:
	base_url = next_base_url.rstrip("/")

func request_json(method: int, path: String, body: Dictionary = {}) -> Dictionary:
	var http := HTTPRequest.new()
	add_child(http)
	var headers := PackedStringArray(["Content-Type: application/json"])
	if cookie_header.length() > 0:
		headers.append("Cookie: %s" % cookie_header)
	var payload := "" if method == HTTPClient.METHOD_GET and body.is_empty() else JSON.stringify(body)
	var url := "%s%s" % [base_url, path]
	request_started.emit(path)
	var start_error := http.request(url, headers, method, payload)
	if start_error != OK:
		http.queue_free()
		var failed := {"ok": false, "status": 0, "error": "请求启动失败", "data": {}}
		request_finished.emit(path, false, 0, failed)
		return failed
	var response: Array = await http.request_completed
	var status := int(response[1])
	var response_headers: PackedStringArray = response[2]
	var bytes: PackedByteArray = response[3]
	_capture_cookie(response_headers)
	var text := bytes.get_string_from_utf8()
	var parsed = JSON.parse_string(text)
	var data: Dictionary = parsed if parsed is Dictionary else {}
	var ok := status >= 200 and status < 300
	var result := {
		"ok": ok,
		"status": status,
		"error": "" if ok else str(data.get("error", "请求失败")),
		"data": data,
	}
	request_finished.emit(path, ok, status, result)
	http.queue_free()
	return result

func get_json(path: String) -> Dictionary:
	return await request_json(HTTPClient.METHOD_GET, path)

func post_json(path: String, body: Dictionary = {}) -> Dictionary:
	return await request_json(HTTPClient.METHOD_POST, path, body)

func _capture_cookie(headers: PackedStringArray) -> void:
	for header in headers:
		var lower := header.to_lower()
		if lower.begins_with("set-cookie:"):
			var raw_cookie := header.substr("set-cookie:".length()).strip_edges()
			var pair := raw_cookie.split(";", false, 1)[0]
			if pair.length() > 0:
				cookie_header = pair
