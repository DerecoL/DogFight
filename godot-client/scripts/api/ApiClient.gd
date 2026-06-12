class_name ApiClient
extends Node

signal request_started(path: String)
signal request_finished(path: String, ok: bool, status: int, payload: Dictionary)
signal loading_changed(active: bool)

var base_url := "http://127.0.0.1:4000/api"
var cookie_header := ""
var timeout_seconds := 20.0
var active_request_count := 0
var last_error := ""

func configure(next_base_url: String) -> void:
	base_url = next_base_url.rstrip("/")

func is_loading() -> bool:
	return active_request_count > 0

func request_json(method: int, path: String, body: Dictionary = {}) -> Dictionary:
	if await _is_local_service_unavailable():
		var unavailable := {"ok": false, "status": 0, "error": _local_service_unavailable_message(), "data": {}}
		_begin_request(path)
		_finish_request(path, false, 0, unavailable)
		return unavailable
	var http := HTTPRequest.new()
	http.timeout = timeout_seconds
	add_child(http)
	var headers := PackedStringArray(["Content-Type: application/json"])
	if cookie_header.length() > 0:
		headers.append("Cookie: %s" % cookie_header)
	var payload := "" if method == HTTPClient.METHOD_GET and body.is_empty() else JSON.stringify(body)
	var url := "%s%s" % [base_url, path]
	_begin_request(path)
	var start_error := http.request(url, headers, method, payload)
	if start_error != OK:
		http.queue_free()
		var start_failed := {"ok": false, "status": 0, "error": _local_service_unavailable_message(), "data": {}}
		_finish_request(path, false, 0, start_failed)
		return start_failed
	var response: Array = await http.request_completed
	var status := int(response[1])
	var response_headers: PackedStringArray = response[2]
	var bytes: PackedByteArray = response[3]
	_capture_cookie(response_headers)
	var text := bytes.get_string_from_utf8()
	if status == 0:
		http.queue_free()
		var connection_failed := {"ok": false, "status": status, "error": _local_service_unavailable_message(), "data": {}}
		_finish_request(path, false, status, connection_failed)
		return connection_failed
	if text.strip_edges().is_empty():
		http.queue_free()
		var empty_response := {"ok": false, "status": status, "error": "服务端返回空响应，请确认本地服务状态", "data": {}}
		_finish_request(path, false, status, empty_response)
		return empty_response
	var parsed = JSON.parse_string(text)
	var data: Dictionary = parsed if parsed is Dictionary else {}
	var ok := status >= 200 and status < 300
	var result := {
		"ok": ok,
		"status": status,
		"error": "" if ok else str(data.get("error", "请求失败")),
		"data": data,
	}
	_finish_request(path, ok, status, result)
	http.queue_free()
	return result

func get_json(path: String) -> Dictionary:
	return await request_json(HTTPClient.METHOD_GET, path)

func post_json(path: String, body: Dictionary = {}) -> Dictionary:
	return await request_json(HTTPClient.METHOD_POST, path, body)

func _begin_request(path: String) -> void:
	var was_loading := is_loading()
	active_request_count += 1
	request_started.emit(path)
	if not was_loading:
		loading_changed.emit(true)

func _finish_request(path: String, ok: bool, status: int, payload: Dictionary) -> void:
	if active_request_count > 0:
		active_request_count -= 1
	last_error = "" if ok else str(payload.get("error", "请求失败"))
	request_finished.emit(path, ok, status, payload)
	if not is_loading():
		loading_changed.emit(false)

func _local_service_unavailable_message() -> String:
	return "本地服务未启动。请先运行 scripts/start-godot-dev.ps1，再登录、注册或快速开始。"

func _is_local_service_unavailable() -> bool:
	var endpoint := _local_base_url_endpoint()
	if endpoint.is_empty():
		return false
	var tree := get_tree()
	if tree == null:
		return false
	var peer := StreamPeerTCP.new()
	var error := peer.connect_to_host(str(endpoint.get("host", "")), int(endpoint.get("port", 0)))
	if error != OK:
		return true
	for _attempt in range(6):
		peer.poll()
		var status := peer.get_status()
		if status == StreamPeerTCP.STATUS_CONNECTED:
			peer.disconnect_from_host()
			return false
		if status == StreamPeerTCP.STATUS_ERROR:
			return true
		await tree.create_timer(0.05).timeout
	peer.disconnect_from_host()
	return true

func _local_base_url_endpoint() -> Dictionary:
	var lower := base_url.to_lower()
	var default_port := 80
	var without_scheme := lower
	if lower.begins_with("http://"):
		without_scheme = lower.substr("http://".length())
	elif lower.begins_with("https://"):
		without_scheme = lower.substr("https://".length())
		default_port = 443
	else:
		return {}
	var slash_index := without_scheme.find("/")
	var authority := without_scheme if slash_index == -1 else without_scheme.substr(0, slash_index)
	var host := authority
	var port := default_port
	if authority.begins_with("[::1]"):
		host = "::1"
		var ipv6_port_index := authority.find("]:")
		if ipv6_port_index != -1:
			port = int(authority.substr(ipv6_port_index + 2))
	elif authority.contains(":"):
		var host_parts := authority.split(":", false, 1)
		host = str(host_parts[0])
		port = int(host_parts[1])
	if host == "localhost" or host == "::1" or host.begins_with("127."):
		return {"host": host, "port": port}
	return {}

func _capture_cookie(headers: PackedStringArray) -> void:
	for header in headers:
		var lower := header.to_lower()
		if lower.begins_with("set-cookie:"):
			var raw_cookie := header.substr("set-cookie:".length()).strip_edges()
			var pair := raw_cookie.split(";", false, 1)[0]
			if pair.length() > 0:
				cookie_header = pair
