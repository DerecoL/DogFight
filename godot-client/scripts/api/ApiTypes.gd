class_name ApiTypes
extends RefCounted

static func dict_value(source: Dictionary, key: String, fallback: Variant = null) -> Variant:
	return source[key] if source.has(key) else fallback

static func string_value(source: Dictionary, key: String, fallback := "") -> String:
	var value := dict_value(source, key, fallback)
	return str(value) if value != null else fallback

static func int_value(source: Dictionary, key: String, fallback := 0) -> int:
	var value := dict_value(source, key, fallback)
	return int(value) if value != null else fallback

static func array_value(source: Dictionary, key: String) -> Array:
	var value := dict_value(source, key, [])
	return value if value is Array else []

static func dict_array(source: Dictionary, key: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for entry in array_value(source, key):
		if entry is Dictionary:
			result.append(entry)
	return result
