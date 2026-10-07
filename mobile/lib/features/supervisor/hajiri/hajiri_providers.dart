import 'dart:async';
import 'dart:math' as math;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/auth/session.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';
import 'data/attendance_models.dart';
import 'data/attendance_queue.dart';
import 'data/attendance_repository.dart';
import 'data/attendance_syncer.dart';

final attendanceRepositoryProvider = Provider<AttendanceRepository>(
  (ref) => AttendanceRepository(
    ref.watch(apiClientProvider),
    ref.watch(databaseProvider),
  ),
);

final attendanceQueueProvider = Provider<AttendanceQueue>(
  (ref) => AttendanceQueue(ref.watch(databaseProvider)),
);

/// Snapshot of the offline queue + sync status, for badges and row overlays.
class SyncState {
  const SyncState({
    this.records = const [],
    this.syncing = false,
    this.online = true,
    this.lastError,
  });

  final List<QueuedAttendance> records;
  final bool syncing;
  final bool online;
  final ApiException? lastError;

  int get pendingCount =>
      records.where((r) => r.state != QueueState.error).length;
  int get failedCount =>
      records.where((r) => r.state == QueueState.error).length;

  /// Latest local change per `employment|date`.
  Map<String, QueuedAttendance> get byKey => {
    for (final r in records) r.key: r,
  };

  SyncState copyWith({
    List<QueuedAttendance>? records,
    bool? syncing,
    bool? online,
    ApiException? lastError,
    bool clearError = false,
  }) => SyncState(
    records: records ?? this.records,
    syncing: syncing ?? this.syncing,
    online: online ?? this.online,
    lastError: clearError ? null : (lastError ?? this.lastError),
  );
}

/// Owns the queue → server sync loop: syncs shortly after each change, when
/// connectivity returns, and on an exponential back-off while failing.
class SyncController extends Notifier<SyncState> {
  StreamSubscription<List<ConnectivityResult>>? _connSub;
  Timer? _debounce;
  Timer? _retry;
  int _failures = 0;
  bool _running = false;

  AttendanceQueue get _queue => ref.read(attendanceQueueProvider);

  @override
  SyncState build() {
    ref.onDispose(() {
      _connSub?.cancel();
      _debounce?.cancel();
      _retry?.cancel();
    });
    Future.microtask(_init);
    return const SyncState();
  }

  Future<void> _init() async {
    await _queue.recoverInFlight();
    await _reload();
    try {
      _connSub = Connectivity().onConnectivityChanged.listen((results) {
        final online = results.any((r) => r != ConnectivityResult.none);
        state = state.copyWith(online: online);
        if (online) unawaited(syncNow());
      });
    } catch (_) {
      // Connectivity plugin unavailable (tests) — rely on timers.
    }
    unawaited(syncNow());
  }

  Future<void> _reload() async {
    final records = await _queue.all();
    state = state.copyWith(records: records);
  }

  /// Records a status change for one worker/day and schedules a sync.
  Future<void> record({
    required String orgId,
    required String employmentId,
    required String date,
    required String status,
    int overtimeMinutes = 0,
  }) async {
    await _queue.enqueue(
      orgId: orgId,
      employmentId: employmentId,
      date: date,
      status: status,
      overtimeMinutes: overtimeMinutes,
    );
    await _reload();
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 800), syncNow);
  }

  Future<void> retry(String clientUuid) async {
    await _queue.retry(clientUuid);
    await _reload();
    unawaited(syncNow());
  }

  Future<void> discard(String clientUuid) async {
    await _queue.discard(clientUuid);
    await _reload();
  }

  Future<void> retryAllFailed() async {
    for (final r in state.records.where((r) => r.state == QueueState.error)) {
      await _queue.retry(r.clientUuid);
    }
    await _reload();
    unawaited(syncNow());
  }

  /// Sends everything pending. Safe to call repeatedly.
  Future<void> syncNow() async {
    if (_running) return;
    if (!ref.read(sessionProvider).isLoggedIn) return;
    _running = true;
    _retry?.cancel();
    state = state.copyWith(syncing: true);
    try {
      final syncer = AttendanceSyncer(
        _queue,
        ref.read(attendanceRepositoryProvider).postBulk,
      );
      final outcome = await syncer.syncAll();
      await _reload();
      if (outcome.retryLater) {
        _failures++;
        state = state.copyWith(
          lastError: outcome.error,
          online: !(outcome.error?.isNetwork ?? false),
        );
        _scheduleRetry();
      } else {
        _failures = 0;
        state = state.copyWith(clearError: true, online: true);
        if (outcome.saved > 0) {
          // Refresh rosters so server-confirmed records show up.
          ref.invalidate(dayRosterProvider);
        }
      }
    } catch (e) {
      _failures++;
      state = state.copyWith(lastError: ApiException.from(e));
      _scheduleRetry();
    } finally {
      _running = false;
      state = state.copyWith(syncing: false);
    }
  }

  void _scheduleRetry() {
    if (state.pendingCount == 0) return;
    final seconds = math.min(300, 5 * math.pow(2, _failures - 1).toInt());
    _retry?.cancel();
    _retry = Timer(Duration(seconds: seconds), syncNow);
  }

  /// Logout: drop unsent changes for this user.
  Future<void> clearAll() async {
    await _queue.clear();
    await ref.read(attendanceRepositoryProvider).clearCache();
    await _reload();
  }
}

final syncControllerProvider = NotifierProvider<SyncController, SyncState>(
  SyncController.new,
);

/// Date shown on Today's Hajiri (Nepal calendar date).
class HajiriDateController extends Notifier<DateTime> {
  @override
  DateTime build() => nepalToday();

  void set(DateTime d) => state = DateTime(d.year, d.month, d.day);
}

final hajiriDateProvider = NotifierProvider<HajiriDateController, DateTime>(
  HajiriDateController.new,
);

typedef DayKey = ({String orgId, String? siteId, String date});

final dayRosterProvider = FutureProvider.autoDispose.family<DayRoster, DayKey>(
  (ref, key) => ref
      .watch(attendanceRepositoryProvider)
      .fetchDay(orgId: key.orgId, siteId: key.siteId, date: key.date),
);

/// Sites of the selected org that this user can work with.
final sitesProvider = FutureProvider.autoDispose<List<SiteRef>>((ref) async {
  final session = ref.watch(sessionProvider);
  final mem = session.membership;
  if (mem == null) return const [];
  final all = await ref.watch(attendanceRepositoryProvider).fetchSites();
  if (mem.allSites) return all;
  return all.where((s) => mem.siteIds.contains(s.id)).toList();
});

typedef RegisterKey = ({String orgId, String? siteId, int bsYear, int bsMonth});

final registerProvider = FutureProvider.autoDispose
    .family<Register, RegisterKey>(
      (ref, key) => ref
          .watch(attendanceRepositoryProvider)
          .fetchRegister(
            bsYear: key.bsYear,
            bsMonth: key.bsMonth,
            siteId: key.siteId,
          ),
    );
