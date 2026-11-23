import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/providers.dart';
import '../../supervisor/leave/data/leave_repository.dart';

export '../../supervisor/leave/data/leave_repository.dart' show LeaveRequest;

/// Leave types a worker may ask for (the server's `LeaveRequest.TYPES`).
const leaveTypes = ['home', 'sick', 'maternity', 'paternity', 'mourning', 'unpaid'];

/// Inclusive number of days from [from] to [to] (AD ISO dates); 0 when invalid.
int leaveDayCount(String from, String to) {
  final a = DateTime.tryParse(from);
  final b = DateTime.tryParse(to);
  if (a == null || b == null || b.isBefore(a)) return 0;
  return DateTime.utc(b.year, b.month, b.day).difference(DateTime.utc(a.year, a.month, a.day)).inDays + 1;
}

/// Body for `POST /me/leaves`.
Json leaveRequestBody({
  required String employmentId,
  required String leaveType,
  required String fromDate,
  required String toDate,
  String reason = '',
}) => {
  'employment_id': employmentId,
  'leave_type': leaveType,
  'from_date': fromDate,
  'to_date': toDate,
  if (reason.trim().isNotEmpty) 'reason': reason.trim(),
};

/// Worker self-service leave: `/me/leaves` (list · request · cancel a pending one).
class MyLeaveRepository {
  MyLeaveRepository(this._api);
  final ApiClient _api;

  Future<List<LeaveRequest>> mine() async {
    final data = await _api.get<dynamic>('/me/leaves', query: {'page_size': 100});
    return resultsOf(data).map(LeaveRequest.fromJson).toList();
  }

  Future<void> request(Json body) => _api.postNoContent('/me/leaves', data: body);

  Future<void> cancel(String id) => _api.postNoContent('/me/leaves/$id/cancel');
}

final myLeaveRepositoryProvider = Provider<MyLeaveRepository>((ref) => MyLeaveRepository(ref.watch(apiClientProvider)));

final myLeavesProvider = FutureProvider.autoDispose<List<LeaveRequest>>((ref) {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  ref.watch(langCodeProvider);
  return ref.watch(myLeaveRepositoryProvider).mine();
});
