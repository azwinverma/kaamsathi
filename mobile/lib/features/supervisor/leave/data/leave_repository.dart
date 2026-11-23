import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/json.dart';
import '../../../../core/auth/session.dart';
import '../../../../core/providers.dart';

/// `LeaveRequest` — CONTRACT lists the model fields; the response's worker
/// reference isn't spelled out, so several shapes are accepted. Shared by the
/// supervisor queue (`/org/leaves`) and the worker's own list (`/me/leaves`).
class LeaveRequest {
  const LeaveRequest({
    required this.id,
    required this.workerName,
    this.workerPhoto,
    this.designation,
    required this.leaveType,
    this.leaveTypeLabel,
    required this.fromDate,
    this.fromDateBs,
    required this.toDate,
    this.toDateBs,
    required this.days,
    this.reason,
    required this.status,
    this.employmentId,
    this.organizationName,
    this.source,
    this.requestedByName,
    this.decisionNote,
    this.createdAt,
  });

  final String id;
  final String workerName;
  final String? workerPhoto;
  final String? designation;
  final String leaveType;
  final String? leaveTypeLabel;
  final String fromDate;
  final String? fromDateBs;
  final String toDate;
  final String? toDateBs;
  final num days;
  final String? reason;

  /// pending | approved | rejected | cancelled
  final String status;
  final String? employmentId;
  final String? organizationName;

  /// employer (entered by the employer/supervisor) | worker (asked from the app)
  final String? source;
  final String? requestedByName;
  final String? decisionNote;
  final DateTime? createdAt;

  bool get isPending => status == 'pending';
  bool get isWorkerRequested => source == 'worker';

  factory LeaveRequest.fromJson(Json j) {
    final emp = asJsonOrNull(j['employment']);
    final worker = asJsonOrNull(j['worker']) ?? asJsonOrNull(emp?['worker']);
    return LeaveRequest(
      id: strOr(j['id']),
      workerName: strOr(worker?['full_name'] ?? j['worker_name'] ?? emp?['worker_name']),
      workerPhoto: str(worker?['photo']),
      designation: str(j['designation'] ?? emp?['designation']),
      leaveType: strOr(j['leave_type']),
      leaveTypeLabel: str(j['leave_type_label']),
      fromDate: strOr(j['from_date']),
      fromDateBs: str(j['from_date_bs']),
      toDate: strOr(j['to_date']),
      toDateBs: str(j['to_date_bs']),
      days: numOf(j['days']) ?? 0,
      reason: str(j['reason']),
      status: strOr(j['status'], 'pending'),
      employmentId: str(j['employment_id']),
      organizationName: str(asJsonOrNull(j['organization'])?['name']),
      source: str(j['source']),
      requestedByName: str(asJsonOrNull(j['requested_by'])?['full_name']),
      decisionNote: str(j['decision_note']),
      createdAt: dateTimeOf(j['created_at']),
    );
  }
}

class LeaveRepository {
  LeaveRepository(this._api);
  final ApiClient _api;

  Future<List<LeaveRequest>> list(String status) async {
    final data = await _api.get<dynamic>('/org/leaves', query: {'status': status, 'page_size': 100});
    return resultsOf(data).map(LeaveRequest.fromJson).toList();
  }

  Future<void> approve(String id) => _api.postNoContent('/org/leaves/$id/approve');

  Future<void> reject(String id, {String? note}) =>
      _api.postNoContent('/org/leaves/$id/reject', data: {if (note != null && note.isNotEmpty) 'note': note});
}

final leaveRepositoryProvider = Provider<LeaveRepository>((ref) => LeaveRepository(ref.watch(apiClientProvider)));

final leavesProvider = FutureProvider.autoDispose.family<List<LeaveRequest>, String>((ref, status) {
  // Re-fetch when the organization changes.
  ref.watch(sessionProvider.select((s) => s.orgId));
  return ref.watch(leaveRepositoryProvider).list(status);
});
