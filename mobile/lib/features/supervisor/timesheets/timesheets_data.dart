import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/json.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../common/timesheet_models.dart';

/// Supervisor side of `/org/timesheets` (own sites only — the server scopes
/// supervisors to their sites; we pass the selected site when there is one).
class OrgTimesheetsRepository {
  OrgTimesheetsRepository(this._api);
  final ApiClient _api;

  Future<List<Timesheet>> week(DateTime weekStart, {String? siteId}) async {
    final iso = isoDate(weekStart);
    final data = await _api.get<dynamic>(
      '/org/timesheets',
      query: {'week_start': iso, 'site': siteId, 'page_size': 200},
    );
    final list = resultsOf(data).map(Timesheet.fromJson).where((t) => t.weekStart.isEmpty || t.weekStart == iso).toList();
    list.sort((a, b) {
      // Drafts to act on first, then by name.
      if (a.canSubmit != b.canSubmit) return a.canSubmit ? -1 : 1;
      return (a.workerName ?? '').compareTo(b.workerName ?? '');
    });
    return list;
  }

  /// Creates / refreshes drafts from hajiri (never overwrites approved ones).
  Future<void> generate(DateTime weekStart, {String? siteId}) => _api.postNoContent(
    '/org/timesheets/generate',
    data: {'week_start': isoDate(weekStart), if (siteId != null) 'site': siteId},
  );

  Future<void> submit(String id) => _api.postNoContent('/org/timesheets/$id/submit');
}

final orgTimesheetsRepositoryProvider = Provider<OrgTimesheetsRepository>(
  (ref) => OrgTimesheetsRepository(ref.watch(apiClientProvider)),
);

typedef TimesheetKey = ({String orgId, String? siteId, DateTime weekStart});

final orgTimesheetsProvider = FutureProvider.autoDispose.family<List<Timesheet>, TimesheetKey>((ref, key) {
  return ref.watch(orgTimesheetsRepositoryProvider).week(key.weekStart, siteId: key.siteId);
});
