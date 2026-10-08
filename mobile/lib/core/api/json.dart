/// Small, null-tolerant JSON readers used by hand-written `fromJson`s.
library;

typedef Json = Map<String, dynamic>;

Json asJson(Object? v) {
  if (v is Map<String, dynamic>) return v;
  if (v is Map) return v.map((k, val) => MapEntry('$k', val));
  return const {};
}

Json? asJsonOrNull(Object? v) => v is Map ? asJson(v) : null;

List<Json> asJsonList(Object? v) => v is List ? v.whereType<Map<dynamic, dynamic>>().map(asJson).toList() : const [];

/// Accepts either a plain list or a paginated
/// `{"count", "next", "previous", "results": [...]}` envelope.
List<Json> resultsOf(Object? v) {
  if (v is List) return asJsonList(v);
  if (v is Map) return asJsonList(v['results']);
  return const [];
}

String? str(Object? v) => v == null ? null : '$v';
String strOr(Object? v, [String fallback = '']) => v == null ? fallback : '$v';

int? intOf(Object? v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v) ?? double.tryParse(v)?.toInt();
  return null;
}

double? numOf(Object? v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v);
  return null;
}

bool boolOf(Object? v, [bool fallback = false]) {
  if (v is bool) return v;
  if (v is num) return v != 0;
  if (v is String) return v == 'true' || v == '1';
  return fallback;
}

List<String> strList(Object? v) => v is List ? v.map((e) => '$e').toList() : const [];

DateTime? dateTimeOf(Object? v) => v is String ? DateTime.tryParse(v) : null;
