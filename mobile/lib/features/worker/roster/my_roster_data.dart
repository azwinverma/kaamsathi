import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/cached.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../../core/storage/prefs.dart';
import '../../common/roster_models.dart';

/// One rostered day for the worker.
class MyShift {
  const MyShift({
    required this.date,
    this.dateBs,
    this.shift,
    this.siteName,
    this.isOff = false,
    this.note,
    this.organizationName,
  });
  final String date;
  final String? dateBs;
  final ShiftRef? shift;
  final String? siteName;
  final bool isOff;
  final String? note;
  final String? organizationName;

  factory MyShift.fromJson(Json j) {
    // Tolerate `{date, entry: {...}}` day wrappers as well as flat entries.
    final e = asJsonOrNull(j['entry']) ?? j;
    final site = asJsonOrNull(e['site']);
    final org = asJsonOrNull(e['organization']);
    var shift = ShiftRef.fromJson(e['shift']);
    if (shift == null && e['shift_name'] != null) {
      shift = ShiftRef(
        id: strOr(e['shift_id']),
        name: strOr(e['shift_name']),
        startTime: str(e['start_time']),
        endTime: str(e['end_time']),
      );
    }
    return MyShift(
      date: strOr(j['date'] ?? e['date']),
      dateBs: str(j['date_bs'] ?? e['date_bs']),
      shift: shift,
      siteName: str(site?['name'] ?? e['site_name']),
      isOff: boolOf(e['is_off']),
      note: str(e['note']),
      organizationName: str(org?['name'] ?? e['organization_name']),
    );
  }
}

/// `GET /me/roster?week_start=`.
///
/// Contract ambiguity: only "worker's own shifts" is specified. We accept a
/// bare list or a map with `entries` / `results` / `days`, each item either a
/// flat RosterEntry or a `{date, entry}` day wrapper.
class MyRosterWeek {
  const MyRosterWeek({required this.weekStart, required this.entries});
  final DateTime weekStart;
  final Map<String, MyShift> entries;

  MyShift? on(DateTime day) => entries[isoDate(day)];

  factory MyRosterWeek.fromJson(Object? data, DateTime weekStart) {
    Object? list = data;
    if (data is Map) list = data['entries'] ?? data['results'] ?? data['shifts'] ?? data['days'];
    final out = <String, MyShift>{};
    for (final j in asJsonList(list)) {
      final s = MyShift.fromJson(j);
      final hasData = s.shift != null || s.isOff || s.siteName != null;
      if (s.date.isNotEmpty && hasData) out[s.date] = s;
    }
    return MyRosterWeek(weekStart: weekStart, entries: out);
  }
}

class MyRosterRepository {
  MyRosterRepository(this._api, this._prefs);
  final ApiClient _api;
  final Prefs _prefs;

  Future<Cached<MyRosterWeek>> week(DateTime weekStart) => cachedFetch(
    prefs: _prefs,
    key: 'me_roster_${isoDate(weekStart)}',
    fetch: () async {
      final data = await _api.get<dynamic>('/me/roster', query: {'week_start': isoDate(weekStart)});
      return data is List ? {'entries': data} : asJson(data);
    },
    parse: (j) => MyRosterWeek.fromJson(j, weekStart),
  );
}

final myRosterRepositoryProvider = Provider<MyRosterRepository>(
  (ref) => MyRosterRepository(ref.watch(apiClientProvider), ref.watch(prefsProvider)),
);

final myRosterProvider = FutureProvider.autoDispose.family<Cached<MyRosterWeek>, DateTime>((ref, weekStart) {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  return ref.watch(myRosterRepositoryProvider).week(weekStart);
});
