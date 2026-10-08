import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/cached.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../../core/storage/prefs.dart';
import '../../common/timesheet_models.dart';

/// `GET /me/timesheets?week_start=` — the worker's sheets for one week (one per
/// employment). The filter is re-applied client-side in case the server
/// ignores the query parameter.
class MyTimesheetsRepository {
  MyTimesheetsRepository(this._api, this._prefs);
  final ApiClient _api;
  final Prefs _prefs;

  Future<Cached<List<Timesheet>>> week(DateTime weekStart) {
    final iso = isoDate(weekStart);
    return cachedFetch(
      prefs: _prefs,
      key: 'me_timesheets_$iso',
      fetch: () async {
        final data = await _api.get<dynamic>('/me/timesheets', query: {'week_start': iso, 'page_size': 50});
        return {'results': resultsOf(data)};
      },
      parse: (j) => resultsOf(j).map(Timesheet.fromJson).where((t) => t.weekStart.isEmpty || t.weekStart == iso).toList(),
    );
  }
}

final myTimesheetsRepositoryProvider = Provider<MyTimesheetsRepository>(
  (ref) => MyTimesheetsRepository(ref.watch(apiClientProvider), ref.watch(prefsProvider)),
);

final myTimesheetsProvider = FutureProvider.autoDispose.family<Cached<List<Timesheet>>, DateTime>((ref, weekStart) {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  return ref.watch(myTimesheetsRepositoryProvider).week(weekStart);
});
