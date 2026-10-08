import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/providers.dart';
import '../../../core/storage/prefs.dart';

/// `GET /me/notifications` item (EXTENSIONS §4).
class AppNotification {
  const AppNotification({
    required this.id,
    required this.kind,
    required this.title,
    this.titleNe,
    this.body = '',
    this.bodyNe,
    this.data = const {},
    this.link,
    this.readAt,
    this.createdAt,
  });

  final String id;
  final String kind;
  final String title;
  final String? titleNe;
  final String body;
  final String? bodyNe;
  final Json data;
  final String? link;
  final DateTime? readAt;
  final DateTime? createdAt;

  bool get isRead => readAt != null;

  String titleFor(String lang) => lang == 'ne' && (titleNe?.isNotEmpty ?? false) ? titleNe! : title;
  String bodyFor(String lang) => lang == 'ne' && (bodyNe?.isNotEmpty ?? false) ? bodyNe! : body;

  AppNotification markedRead(DateTime at) => AppNotification(
    id: id,
    kind: kind,
    title: title,
    titleNe: titleNe,
    body: body,
    bodyNe: bodyNe,
    data: data,
    link: link,
    readAt: readAt ?? at,
    createdAt: createdAt,
  );

  factory AppNotification.fromJson(Json j) => AppNotification(
    id: strOr(j['id']),
    kind: strOr(j['kind']),
    title: strOr(j['title']),
    titleNe: str(j['title_ne']),
    body: strOr(j['body']),
    bodyNe: str(j['body_ne']),
    data: asJson(j['data']),
    link: str(j['link']),
    // Some serializers send `is_read` instead of (or as well as) `read_at`.
    readAt: dateTimeOf(j['read_at']) ?? (boolOf(j['is_read']) ? DateTime.fromMillisecondsSinceEpoch(0) : null),
    createdAt: dateTimeOf(j['created_at']),
  );
}

/// `GET /me/notifications/unread-count` → `{count}` (also accepts
/// `unread`/`unread_count` or a bare number).
int parseUnreadCount(Object? data) {
  if (data is Map) return intOf(data['count'] ?? data['unread'] ?? data['unread_count']) ?? 0;
  return intOf(data) ?? 0;
}

class InboxRepository {
  InboxRepository(this._api);
  final ApiClient _api;

  Future<List<AppNotification>> list() async {
    final data = await _api.get<dynamic>('/me/notifications', query: {'page_size': 100});
    return resultsOf(data).map(AppNotification.fromJson).toList();
  }

  Future<int> unreadCount() async => parseUnreadCount(await _api.get<dynamic>('/me/notifications/unread-count'));

  Future<void> markRead(String id) => _api.postNoContent('/me/notifications/$id/read');

  Future<void> markAllRead() => _api.postNoContent('/me/notifications/read-all');
}

/// Push-notification hook — deliberately not wired yet.
///
/// The app has no push plugin; the inbox is kept fresh by polling
/// [unreadCountProvider] on app resume and on tab switches. When a push
/// plugin (e.g. `firebase_messaging`) is added later:
/// 1. obtain the FCM token after login and call [register] with
///    `platform: 'android' | 'ios'`;
/// 2. call [register] again from the plugin's token-refresh callback;
/// 3. call [unregister] before logout (best effort; the server also drops
///    tokens of revoked sessions);
/// 4. on a received message, call `ref.read(unreadCountProvider.notifier).refresh(force: true)`.
class DeviceTokenRegistry {
  DeviceTokenRegistry(this._api);
  final ApiClient _api;

  /// `POST /me/devices {platform, token}`.
  Future<void> register({required String platform, required String token}) =>
      _api.postNoContent('/me/devices', data: {'platform': platform, 'token': token});

  /// `DELETE /me/devices/{token}`.
  Future<void> unregister(String token) => _api.delete('/me/devices/${Uri.encodeComponent(token)}');
}

final inboxRepositoryProvider = Provider<InboxRepository>((ref) => InboxRepository(ref.watch(apiClientProvider)));

final deviceTokenRegistryProvider = Provider<DeviceTokenRegistry>(
  (ref) => DeviceTokenRegistry(ref.watch(apiClientProvider)),
);

final notificationsProvider = FutureProvider.autoDispose<List<AppNotification>>((ref) {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  return ref.watch(inboxRepositoryProvider).list();
});

/// Unread notifications for the bell badge. Starts from the last known value
/// (so the badge shows offline) and refreshes on demand, at most every
/// [minInterval] unless forced. Never throws: a server without the inbox
/// (404/501) simply shows no badge.
class UnreadCountController extends Notifier<int> {
  static const minInterval = Duration(seconds: 20);
  static const _cacheKey = 'inbox_unread';

  DateTime? _last;
  bool _inFlight = false;

  Prefs get _prefs => ref.read(prefsProvider);

  @override
  int build() {
    ref.watch(sessionProvider.select((s) => s.me?.id));
    _last = null;
    try {
      return intOf(_prefs.cachedJson(_cacheKey)?['count']) ?? 0;
    } catch (_) {
      return 0;
    }
  }

  Future<void> refresh({bool force = false}) async {
    if (!ref.read(sessionProvider).isLoggedIn || _inFlight) return;
    final now = DateTime.now();
    if (!force && _last != null && now.difference(_last!) < minInterval) return;
    _inFlight = true;
    _last = now;
    try {
      set(await ref.read(inboxRepositoryProvider).unreadCount());
    } on ApiException catch (e) {
      // Offline: keep the cached count. Feature off: no badge.
      if (!e.isNetwork) set(0);
    } catch (_) {
      // Never let a badge poll crash the shell.
    } finally {
      _inFlight = false;
    }
  }

  /// Sets the count locally (e.g. after marking items read) and caches it.
  void set(int count) {
    final c = count < 0 ? 0 : count;
    state = c;
    try {
      _prefs.setCachedJson(_cacheKey, {'count': c});
    } catch (_) {}
  }
}

final unreadCountProvider = NotifierProvider<UnreadCountController, int>(UnreadCountController.new);
