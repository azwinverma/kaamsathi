import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/api_exception.dart';
import 'api/json.dart';
import 'auth/session.dart';
import 'providers.dart';
import 'storage/prefs.dart';

/// Client feature-flag keys the app knows about. The backend only sends
/// flags marked `client_visible`; a key that is absent means "not managed by
/// a flag" and the feature stays on (no hard dependency on `/flags`).
abstract final class FlagKeys {
  static const disputeEvidence = 'dispute_evidence';
  static const disputeAppeal = 'dispute_appeal';
  static const attendanceCorrections = 'attendance_corrections';
  static const ratings = 'worker_ratings';
  static const credentialResubmit = 'credential_resubmit';
  static const spokenLanguages = 'spoken_languages';
}

/// `GET /flags` → `{flags: {key: bool}}` (also accepts a bare map).
Map<String, bool> parseFlags(Object? data) {
  final j = asJson(data);
  final raw = j['flags'] is Map ? asJson(j['flags']) : j;
  return {
    for (final e in raw.entries)
      if (e.value is bool || e.value is num || e.value is String) e.key: boolOf(e.value),
  };
}

/// Client-visible feature flags. Starts from the last cached copy (works
/// offline), refreshes on login and on app resume. Never throws: a server
/// without `/flags` simply leaves everything on.
class FlagsController extends Notifier<Map<String, bool>> {
  static const _cacheKey = 'feature_flags';
  static const minInterval = Duration(minutes: 5);

  DateTime? _last;
  bool _inFlight = false;

  Prefs get _prefs => ref.read(prefsProvider);

  @override
  Map<String, bool> build() {
    ref.watch(sessionProvider.select((s) => (s.me?.id, s.orgId)));
    _last = null;
    try {
      return parseFlags(_prefs.cachedJson(_cacheKey));
    } catch (_) {
      return const {};
    }
  }

  /// True unless the server explicitly switched [key] off.
  bool isOn(String key) => state[key] ?? true;

  Future<void> refresh({bool force = false}) async {
    if (!ref.read(sessionProvider).isLoggedIn || _inFlight) return;
    final now = DateTime.now();
    if (!force && _last != null && now.difference(_last!) < minInterval) return;
    _inFlight = true;
    _last = now;
    try {
      final flags = parseFlags(await ref.read(apiClientProvider).get<dynamic>('/flags'));
      state = flags;
      try {
        await _prefs.setCachedJson(_cacheKey, {'flags': flags});
      } catch (_) {}
    } on ApiException catch (e) {
      // Offline: keep the cache. Endpoint missing: nothing is flagged.
      if (!e.isNetwork && (e.statusCode == 404 || e.statusCode == 405 || e.statusCode == 501)) {
        state = const {};
      }
    } catch (_) {
      // Flags must never break the app.
    } finally {
      _inFlight = false;
    }
  }
}

final flagsProvider = NotifierProvider<FlagsController, Map<String, bool>>(FlagsController.new);

/// `ref.watch(flagOnProvider(FlagKeys.x))` — true unless explicitly off.
final flagOnProvider = Provider.family<bool, String>((ref, key) => ref.watch(flagsProvider)[key] ?? true);
