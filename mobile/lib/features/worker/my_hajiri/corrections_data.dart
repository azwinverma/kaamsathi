import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/providers.dart';

/// Statuses a worker may ask for.
const correctionStatuses = ['present', 'half_day', 'absent', 'leave'];

/// Attendance correction (P008), shared by the worker and supervisor views.
class AttendanceCorrection {
  const AttendanceCorrection({
    required this.id,
    required this.employmentId,
    this.workerName,
    this.organizationName,
    this.designation,
    this.siteId,
    required this.date,
    this.dateBs,
    this.currentStatus,
    this.currentStatusLabel,
    required this.requestedStatus,
    this.requestedStatusLabel,
    this.requestedCheckInAt,
    this.requestedCheckOutAt,
    required this.reason,
    required this.status,
    this.statusLabel,
    this.decidedBy,
    this.decidedAt,
    this.decisionNote,
    this.createdAt,
  });

  final String id;
  final String employmentId;
  final String? workerName;
  final String? organizationName;
  final String? designation;
  final String? siteId;
  final String date;
  final String? dateBs;
  final String? currentStatus;
  final String? currentStatusLabel;
  final String requestedStatus;
  final String? requestedStatusLabel;
  final DateTime? requestedCheckInAt;
  final DateTime? requestedCheckOutAt;
  final String reason;

  /// pending | approved | rejected
  final String status;
  final String? statusLabel;
  final String? decidedBy;
  final DateTime? decidedAt;
  final String? decisionNote;
  final DateTime? createdAt;

  bool get isPending => status == 'pending';

  factory AttendanceCorrection.fromJson(Json j) => AttendanceCorrection(
    id: strOr(j['id']),
    employmentId: strOr(j['employment_id']),
    workerName: str(asJsonOrNull(j['worker'])?['full_name']),
    organizationName: str(asJsonOrNull(j['organization'])?['name']),
    designation: str(j['designation']),
    siteId: str(j['site_id']),
    date: strOr(j['date']),
    dateBs: str(j['date_bs']),
    currentStatus: str(j['current_status']),
    currentStatusLabel: str(j['current_status_label']),
    requestedStatus: strOr(j['requested_status'], 'present'),
    requestedStatusLabel: str(j['requested_status_label']),
    requestedCheckInAt: dateTimeOf(j['requested_check_in_at']),
    requestedCheckOutAt: dateTimeOf(j['requested_check_out_at']),
    reason: strOr(j['reason']),
    status: strOr(j['status'], 'pending'),
    statusLabel: str(j['status_label']),
    decidedBy: str(asJsonOrNull(j['decided_by'])?['full_name']),
    decidedAt: dateTimeOf(j['decided_at']),
    decisionNote: str(j['decision_note']),
    createdAt: dateTimeOf(j['created_at']),
  );
}

/// Nepal is UTC+05:45 with no DST: a wall-clock time on [date] as an
/// ISO-8601 string with that offset.
String nepalIso(String date, int hour, int minute) {
  String two(int v) => v.toString().padLeft(2, '0');
  return '${date}T${two(hour)}:${two(minute)}:00+05:45';
}

/// Body for `POST /me/attendance/corrections`.
Json correctionBody({
  required String employmentId,
  required String date,
  required String requestedStatus,
  ({int hour, int minute})? checkIn,
  ({int hour, int minute})? checkOut,
  required String reason,
}) => {
  'employment_id': employmentId,
  'date': date,
  'requested_status': requestedStatus,
  if (checkIn != null) 'requested_check_in_at': nepalIso(date, checkIn.hour, checkIn.minute),
  if (checkOut != null) 'requested_check_out_at': nepalIso(date, checkOut.hour, checkOut.minute),
  'reason': reason.trim(),
};

class CorrectionsRepository {
  CorrectionsRepository(this._api);
  final ApiClient _api;

  Future<List<AttendanceCorrection>> mine() async {
    final data = await _api.get<dynamic>('/me/attendance/corrections', query: {'page_size': 100});
    return resultsOf(data).map(AttendanceCorrection.fromJson).toList();
  }

  Future<void> request(Json body) => _api.postNoContent('/me/attendance/corrections', data: body);

  /// Supervisor queue (the server limits supervisors to their own sites).
  Future<List<AttendanceCorrection>> queue({String? status}) async {
    final data = await _api.get<dynamic>('/org/attendance-corrections', query: {'status': status, 'page_size': 100});
    return resultsOf(data).map(AttendanceCorrection.fromJson).toList();
  }

  Future<void> approve(String id, {String? note}) => _api.postNoContent(
    '/org/attendance-corrections/$id/approve',
    data: {if (note != null && note.trim().isNotEmpty) 'note': note.trim()},
  );

  Future<void> reject(String id, {required String note}) =>
      _api.postNoContent('/org/attendance-corrections/$id/reject', data: {'note': note.trim()});
}

final correctionsRepositoryProvider = Provider<CorrectionsRepository>(
  (ref) => CorrectionsRepository(ref.watch(apiClientProvider)),
);

final myCorrectionsProvider = FutureProvider.autoDispose<List<AttendanceCorrection>>((ref) {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  ref.watch(langCodeProvider);
  return ref.watch(correctionsRepositoryProvider).mine();
});

/// `pending` or `approved,rejected`.
final correctionQueueProvider = FutureProvider.autoDispose.family<List<AttendanceCorrection>, String>((ref, status) {
  ref.watch(sessionProvider.select((s) => (s.me?.id, s.orgId)));
  ref.watch(langCodeProvider);
  return ref.watch(correctionsRepositoryProvider).queue(status: status);
});
