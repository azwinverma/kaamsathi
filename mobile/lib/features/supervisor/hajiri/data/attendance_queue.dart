import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

/// Sync state of a locally recorded hajiri change.
enum QueueState {
  /// Waiting to be sent (also used after a retryable network failure).
  pending,

  /// Included in an in-flight bulk request.
  syncing,

  /// Rejected by the server; needs the supervisor's attention.
  error;

  static QueueState parse(String? s) =>
      QueueState.values.firstWhere((e) => e.name == s, orElse: () => pending);
}

/// One attendance change waiting for `POST /org/attendance/bulk`.
class QueuedAttendance {
  const QueuedAttendance({
    required this.clientUuid,
    required this.orgId,
    required this.employmentId,
    required this.date,
    required this.status,
    this.overtimeMinutes = 0,
    this.note,
    this.method = 'supervisor',
    this.state = QueueState.pending,
    this.errorCode,
    this.errorMessage,
    this.attempts = 0,
    required this.createdAt,
    required this.updatedAt,
  });

  final String clientUuid;
  final String orgId;
  final String employmentId;

  /// AD ISO date `YYYY-MM-DD`.
  final String date;
  final String status;
  final int overtimeMinutes;
  final String? note;
  final String method;
  final QueueState state;
  final String? errorCode;
  final String? errorMessage;
  final int attempts;
  final DateTime createdAt;
  final DateTime updatedAt;

  /// Body item for the bulk endpoint (CONTRACT §Hajiri).
  Map<String, dynamic> toBulkJson() => {
    'client_uuid': clientUuid,
    'employment_id': employmentId,
    'date': date,
    'status': status,
    'method': method,
    'overtime_minutes': overtimeMinutes,
    if (note != null && note!.isNotEmpty) 'note': note,
  };

  Map<String, Object?> toRow() => {
    'client_uuid': clientUuid,
    'org_id': orgId,
    'employment_id': employmentId,
    'date': date,
    'status': status,
    'overtime_minutes': overtimeMinutes,
    'note': note,
    'method': method,
    'state': state.name,
    'error_code': errorCode,
    'error_message': errorMessage,
    'attempts': attempts,
    'created_at': createdAt.millisecondsSinceEpoch,
    'updated_at': updatedAt.millisecondsSinceEpoch,
  };

  factory QueuedAttendance.fromRow(Map<String, Object?> r) => QueuedAttendance(
    clientUuid: r['client_uuid']! as String,
    orgId: r['org_id']! as String,
    employmentId: r['employment_id']! as String,
    date: r['date']! as String,
    status: r['status']! as String,
    overtimeMinutes: (r['overtime_minutes'] as int?) ?? 0,
    note: r['note'] as String?,
    method: (r['method'] as String?) ?? 'supervisor',
    state: QueueState.parse(r['state'] as String?),
    errorCode: r['error_code'] as String?,
    errorMessage: r['error_message'] as String?,
    attempts: (r['attempts'] as int?) ?? 0,
    createdAt: DateTime.fromMillisecondsSinceEpoch(r['created_at']! as int),
    updatedAt: DateTime.fromMillisecondsSinceEpoch(r['updated_at']! as int),
  );

  /// Key used to overlay local changes on the server roster.
  String get key => '$employmentId|$date';
}

/// Durable FIFO of hajiri changes. Every tap is written here first (with a
/// fresh `client_uuid`) and only removed once the server confirms it.
class AttendanceQueue {
  AttendanceQueue(this._db, {Uuid? uuid, DateTime Function()? clock})
    : _uuid = uuid ?? const Uuid(),
      _clock = clock ?? DateTime.now;

  final Database _db;
  final Uuid _uuid;
  final DateTime Function() _clock;

  static const _t = 'attendance_queue';

  /// Records a change. Any older unsent change for the same worker and day
  /// is replaced (the newest tap wins); a change already in flight is left
  /// alone and will simply be overwritten server-side by this newer one.
  Future<QueuedAttendance> enqueue({
    required String orgId,
    required String employmentId,
    required String date,
    required String status,
    int overtimeMinutes = 0,
    String? note,
    String method = 'supervisor',
  }) async {
    final now = _clock();
    final rec = QueuedAttendance(
      clientUuid: _uuid.v4(),
      orgId: orgId,
      employmentId: employmentId,
      date: date,
      status: status,
      overtimeMinutes: overtimeMinutes,
      note: note,
      method: method,
      createdAt: now,
      updatedAt: now,
    );
    await _db.transaction((txn) async {
      await txn.delete(
        _t,
        where: 'org_id = ? AND employment_id = ? AND date = ? AND state != ?',
        whereArgs: [orgId, employmentId, date, QueueState.syncing.name],
      );
      await txn.insert(_t, rec.toRow());
    });
    return rec;
  }

  /// All queued records (optionally for one org), oldest first.
  Future<List<QueuedAttendance>> all({String? orgId}) async {
    final rows = await _db.query(
      _t,
      where: orgId == null ? null : 'org_id = ?',
      whereArgs: orgId == null ? null : [orgId],
      orderBy: 'created_at ASC, rowid ASC',
    );
    return rows.map(QueuedAttendance.fromRow).toList();
  }

  /// Records ready to send, oldest first.
  Future<List<QueuedAttendance>> pending({String? orgId, int limit = 100}) async {
    final rows = await _db.query(
      _t,
      where: orgId == null ? 'state = ?' : 'state = ? AND org_id = ?',
      whereArgs: orgId == null
          ? [QueueState.pending.name]
          : [QueueState.pending.name, orgId],
      orderBy: 'created_at ASC, rowid ASC',
      limit: limit,
    );
    return rows.map(QueuedAttendance.fromRow).toList();
  }

  /// Org ids that have records waiting to be sent.
  Future<List<String>> orgsWithPending() async {
    final rows = await _db.rawQuery(
      'SELECT DISTINCT org_id FROM $_t WHERE state = ?',
      [QueueState.pending.name],
    );
    return rows.map((r) => r['org_id']! as String).toList();
  }

  Future<int> count({QueueState? state}) async {
    final rows = await _db.rawQuery(
      state == null
          ? 'SELECT COUNT(*) AS c FROM $_t'
          : 'SELECT COUNT(*) AS c FROM $_t WHERE state = ?',
      state == null ? null : [state.name],
    );
    return (rows.first['c'] as int?) ?? 0;
  }

  Future<void> markSyncing(Iterable<String> uuids) =>
      _setState(uuids, QueueState.syncing);

  /// Network/5xx failure: put back in line and bump the attempt counter.
  Future<void> markRetry(Iterable<String> uuids) async {
    if (uuids.isEmpty) return;
    final ids = uuids.toList();
    await _db.rawUpdate(
      'UPDATE $_t SET state = ?, attempts = attempts + 1, updated_at = ? '
      'WHERE client_uuid IN (${List.filled(ids.length, '?').join(',')})',
      [QueueState.pending.name, _clock().millisecondsSinceEpoch, ...ids],
    );
  }

  /// Server confirmed these — remove them.
  Future<void> markSaved(Iterable<String> uuids) async {
    if (uuids.isEmpty) return;
    final ids = uuids.toList();
    await _db.delete(
      _t,
      where: 'client_uuid IN (${List.filled(ids.length, '?').join(',')})',
      whereArgs: ids,
    );
  }

  /// Server rejected this record (e.g. `invalid_state` for a locked month).
  Future<void> markFailed(String uuid, String code, String message) =>
      _db.update(
        _t,
        {
          'state': QueueState.error.name,
          'error_code': code,
          'error_message': message,
          'updated_at': _clock().millisecondsSinceEpoch,
        },
        where: 'client_uuid = ?',
        whereArgs: [uuid],
      );

  /// User asked to try a failed record again.
  Future<void> retry(String uuid) => _db.update(
    _t,
    {
      'state': QueueState.pending.name,
      'error_code': null,
      'error_message': null,
      'updated_at': _clock().millisecondsSinceEpoch,
    },
    where: 'client_uuid = ?',
    whereArgs: [uuid],
  );

  /// Drop a local change (e.g. after a permanent error).
  Future<void> discard(String uuid) =>
      _db.delete(_t, where: 'client_uuid = ?', whereArgs: [uuid]);

  /// After an app restart nothing is really in flight any more.
  Future<void> recoverInFlight() async {
    await _db.update(
      _t,
      {'state': QueueState.pending.name},
      where: 'state = ?',
      whereArgs: [QueueState.syncing.name],
    );
  }

  Future<void> clear() => _db.delete(_t);

  Future<void> _setState(Iterable<String> uuids, QueueState s) async {
    if (uuids.isEmpty) return;
    final ids = uuids.toList();
    await _db.update(
      _t,
      {'state': s.name, 'updated_at': _clock().millisecondsSinceEpoch},
      where: 'client_uuid IN (${List.filled(ids.length, '?').join(',')})',
      whereArgs: ids,
    );
  }
}
