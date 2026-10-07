import '../storage/prefs.dart';
import 'api_exception.dart';
import 'json.dart';

/// A value that may have come from the on-device cache (offline).
class Cached<T> {
  const Cached(this.data, {this.fromCache = false});
  final T data;
  final bool fromCache;
}

/// True when an endpoint is simply not switched on yet on this server
/// (404 route missing, 405, 501) — screens show a friendly "coming soon"
/// state instead of an error.
bool isFeatureUnavailable(Object? error) {
  if (error is! ApiException) return false;
  final s = error.statusCode;
  return s == 404 || s == 405 || s == 501;
}

/// Fetches JSON and remembers the last good copy in [prefs]; when offline
/// (network/timeout) the cached copy is returned with `fromCache: true`.
Future<Cached<T>> cachedFetch<T>({
  required Prefs prefs,
  required String key,
  required Future<Json> Function() fetch,
  required T Function(Json) parse,
}) async {
  try {
    final j = await fetch();
    await prefs.setCachedJson(key, j);
    return Cached(parse(j));
  } on ApiException catch (e) {
    if (!e.isNetwork) rethrow;
    final c = prefs.cachedJson(key);
    if (c == null) rethrow;
    return Cached(parse(c), fromCache: true);
  }
}
