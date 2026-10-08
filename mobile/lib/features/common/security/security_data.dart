import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/providers.dart';

/// `GET /auth/sessions` item (SessionDevice, EXTENSIONS §1).
class SessionDevice {
  const SessionDevice({
    required this.id,
    this.userAgent,
    this.ip,
    this.platform = 'other',
    this.createdAt,
    this.lastSeenAt,
    this.revokedAt,
    this.current = false,
  });

  final String id;
  final String? userAgent;
  final String? ip;

  /// web | android | ios | other
  final String platform;
  final DateTime? createdAt;
  final DateTime? lastSeenAt;
  final DateTime? revokedAt;
  final bool current;

  bool get isRevoked => revokedAt != null;

  /// A short, human description of the browser/app from the user agent.
  String? get clientLabel {
    final ua = userAgent ?? '';
    if (ua.isEmpty) return null;
    for (final (needle, label) in const [
      ('KaamSathi', 'KaamSathi app'),
      ('Edg/', 'Edge'),
      ('Chrome/', 'Chrome'),
      ('Firefox/', 'Firefox'),
      ('Safari/', 'Safari'),
      ('Dart/', 'KaamSathi app'),
      ('okhttp', 'Android app'),
    ]) {
      if (ua.contains(needle)) return label;
    }
    return ua.length > 40 ? '${ua.substring(0, 40)}…' : ua;
  }

  factory SessionDevice.fromJson(Json j) => SessionDevice(
    id: strOr(j['id']),
    userAgent: str(j['user_agent']),
    ip: str(j['ip']),
    platform: strOr(j['platform'], 'other'),
    createdAt: dateTimeOf(j['created_at']),
    lastSeenAt: dateTimeOf(j['last_seen_at']),
    revokedAt: dateTimeOf(j['revoked_at']),
    current: boolOf(j['current']),
  );
}

/// Active sessions, current first, then most recently used.
List<SessionDevice> sortSessions(Iterable<SessionDevice> all) {
  final list = all.where((s) => !s.isRevoked).toList();
  list.sort((a, b) {
    if (a.current != b.current) return a.current ? -1 : 1;
    final at = a.lastSeenAt ?? a.createdAt ?? DateTime(0);
    final bt = b.lastSeenAt ?? b.createdAt ?? DateTime(0);
    return bt.compareTo(at);
  });
  return list;
}

class SecurityRepository {
  SecurityRepository(this._api);
  final ApiClient _api;

  Future<List<SessionDevice>> sessions() async {
    final data = await _api.get<dynamic>('/auth/sessions');
    return sortSessions(resultsOf(data).map(SessionDevice.fromJson));
  }

  Future<void> revoke(String id) => _api.delete('/auth/sessions/$id');

  Future<void> revokeOthers() => _api.postNoContent('/auth/sessions/revoke-others');
}

final securityRepositoryProvider = Provider<SecurityRepository>(
  (ref) => SecurityRepository(ref.watch(apiClientProvider)),
);

final sessionsProvider = FutureProvider.autoDispose<List<SessionDevice>>((ref) {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  return ref.watch(securityRepositoryProvider).sessions();
});
