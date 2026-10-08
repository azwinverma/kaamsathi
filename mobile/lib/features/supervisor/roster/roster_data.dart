import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../common/roster_models.dart';

/// One cell of `GET /org/roster` (`{shift_id, site_id, is_off}`).
class RosterCell {
  const RosterCell({this.shiftId, this.siteId, this.isOff = false});
  final String? shiftId;
  final String? siteId;
  final bool isOff;

  static RosterCell? fromJson(Object? v) {
    final j = asJsonOrNull(v);
    if (j == null) return null;
    final shift = j['shift'];
    return RosterCell(
      shiftId: shift is Map ? str(shift['id']) : str(j['shift_id'] ?? shift),
      siteId: str(j['site_id'] ?? (j['site'] is Map ? (j['site'] as Map)['id'] : j['site'])),
      isOff: boolOf(j['is_off']),
    );
  }
}

/// Roster cell warning codes (O005); never blocks saving.
abstract final class RosterWarning {
  static const onLeave = 'on_leave';
  static const holiday = 'holiday';
  static const weeklyOff = 'weekly_off';
  static const conflictElsewhere = 'conflict_elsewhere';
}

class RosterWeekRow {
  const RosterWeekRow({
    required this.employmentId,
    required this.workerName,
    this.designation,
    this.cells = const {},
    this.warnings = const {},
  });
  final String employmentId;
  final String workerName;
  final String? designation;

  /// AD date → cell (null = nothing rostered).
  final Map<String, RosterCell?> cells;

  /// AD date → warning codes (only rostered, not-off cells).
  final Map<String, List<String>> warnings;

  factory RosterWeekRow.fromJson(Json j) {
    final cells = <String, RosterCell?>{};
    asJson(j['cells']).forEach((k, v) => cells[k] = RosterCell.fromJson(v));
    final warnings = <String, List<String>>{};
    asJson(j['warnings']).forEach((k, v) {
      final list = strList(v).where((x) => x.isNotEmpty).toList();
      if (list.isNotEmpty) warnings[k] = list;
    });
    return RosterWeekRow(
      employmentId: strOr(j['employment_id']),
      workerName: strOr(j['worker_name'] ?? asJsonOrNull(j['worker'])?['full_name']),
      designation: str(j['designation']),
      cells: cells,
      warnings: warnings,
    );
  }
}

/// `PUT /org/roster` → `{saved, cleared, warnings: [{employment_id, date, code, message}], notified_workers}`.
class RosterSaveResult {
  const RosterSaveResult({this.saved = 0, this.cleared = 0, this.warnings = const [], this.notifiedWorkers = 0});
  final int saved;
  final int cleared;
  final List<({String employmentId, String date, String code, String? message})> warnings;
  final int notifiedWorkers;

  factory RosterSaveResult.fromJson(Object? v) {
    final j = asJson(v);
    return RosterSaveResult(
      saved: intOf(j['saved']) ?? 0,
      cleared: intOf(j['cleared']) ?? 0,
      warnings: [
        for (final w in asJsonList(j['warnings']))
          (
            employmentId: strOr(w['employment_id']),
            date: strOr(w['date']),
            code: strOr(w['code']),
            message: str(w['message']),
          ),
      ],
      notifiedWorkers: intOf(j['notified_workers']) ?? 0,
    );
  }
}

/// `GET /org/roster?week_start=&site=`.
class RosterWeek {
  const RosterWeek({required this.days, required this.rows, this.warningLabels = const {}});

  /// `(date, date_bs)` for the 7 days.
  final List<({String date, String? dateBs})> days;
  final List<RosterWeekRow> rows;

  /// Server-localised `warning_labels: {code: text}`.
  final Map<String, String> warningLabels;

  factory RosterWeek.fromJson(Json j, DateTime weekStart) {
    var days = [
      for (final d in (j['days'] is List ? j['days'] as List : const []))
        if (d is Map) (date: strOr(d['date']), dateBs: str(d['date_bs'])) else (date: '$d', dateBs: null),
    ];
    if (days.isEmpty) days = [for (final d in weekDays(weekStart)) (date: isoDate(d), dateBs: null)];
    return RosterWeek(
      days: days,
      rows: asJsonList(j['rows']).map(RosterWeekRow.fromJson).toList(),
      warningLabels: {for (final e in asJson(j['warning_labels']).entries) e.key: '${e.value}'},
    );
  }
}

class RosterRepository {
  RosterRepository(this._api);
  final ApiClient _api;

  Future<RosterWeek> week(DateTime weekStart, {String? siteId}) async {
    final data = await _api.get<Map<String, dynamic>>(
      '/org/roster',
      query: {'week_start': isoDate(weekStart), 'site': siteId},
    );
    return RosterWeek.fromJson(data, weekStart);
  }

  Future<List<ShiftRef>> shifts() async {
    final data = await _api.get<dynamic>('/org/shifts', query: {'page_size': 100});
    return [for (final j in resultsOf(data)) ShiftRef.fromJson(j)].whereType<ShiftRef>().toList();
  }

  /// Upserts one cell. `shiftId == null && !isOff` clears the shift.
  Future<RosterSaveResult> setCell({
    required String employmentId,
    required String date,
    String? shiftId,
    String? siteId,
    required bool isOff,
  }) async => RosterSaveResult.fromJson(
    await _api.put<dynamic>(
      '/org/roster',
      data: {
        'entries': [
          {
            'employment_id': employmentId,
            'date': date,
            'shift_id': isOff ? null : shiftId,
            if (siteId != null) 'site_id': siteId,
            'is_off': isOff,
          },
        ],
      },
    ),
  );
}

final rosterRepositoryProvider = Provider<RosterRepository>((ref) => RosterRepository(ref.watch(apiClientProvider)));

typedef RosterKey = ({String orgId, String? siteId, DateTime weekStart});

final rosterWeekProvider = FutureProvider.autoDispose.family<RosterWeek, RosterKey>(
  (ref, key) => ref.watch(rosterRepositoryProvider).week(key.weekStart, siteId: key.siteId),
);

final orgShiftsProvider = FutureProvider.autoDispose<List<ShiftRef>>((ref) {
  ref.watch(sessionProvider.select((s) => s.orgId));
  return ref.watch(rosterRepositoryProvider).shifts();
});
