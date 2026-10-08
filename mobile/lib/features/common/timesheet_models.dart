import '../../core/api/json.dart';

/// Labour Act weekly OT cap (24 h) — the server sends `over_cap`, this is
/// only the fallback when it doesn't.
const weeklyOtCapMinutes = 1440;

/// One day inside a timesheet's `days` json.
class TimesheetDay {
  const TimesheetDay({
    required this.date,
    this.dateBs,
    this.workedMinutes = 0,
    this.regularMinutes = 0,
    this.overtimeMinutes = 0,
    this.status,
  });

  final String date;
  final String? dateBs;
  final int workedMinutes;
  final int regularMinutes;
  final int overtimeMinutes;

  /// Attendance status of the day (present, half_day, absent, …).
  final String? status;

  factory TimesheetDay.fromJson(Json j) => TimesheetDay(
    date: strOr(j['date']),
    dateBs: str(j['date_bs']),
    workedMinutes: intOf(j['worked_minutes']) ?? 0,
    regularMinutes: intOf(j['regular_minutes']) ?? 0,
    overtimeMinutes: intOf(j['overtime_minutes']) ?? 0,
    status: str(j['status']),
  );
}

/// `Timesheet` (EXTENSIONS §4) as served by `/me/timesheets` and `/org/timesheets`.
class Timesheet {
  const Timesheet({
    required this.id,
    required this.weekStart,
    required this.status,
    this.employmentId,
    this.workerName,
    this.designation,
    this.siteName,
    this.organizationName,
    this.days = const [],
    this.regularMinutes = 0,
    this.overtimeClaimed = 0,
    this.overtimeApproved,
    this.overCap = false,
    this.note,
  });

  final String id;
  final String weekStart;

  /// draft | submitted | approved | rejected
  final String status;
  final String? employmentId;
  final String? workerName;
  final String? designation;
  final String? siteName;
  final String? organizationName;
  final List<TimesheetDay> days;
  final int regularMinutes;
  final int overtimeClaimed;
  final int? overtimeApproved;
  final bool overCap;
  final String? note;

  bool get isDraft => status == 'draft';

  /// Re-submitting a returned sheet is allowed too.
  bool get canSubmit => status == 'draft' || status == 'rejected';

  TimesheetDay? dayFor(String isoDate) => days.where((d) => d.date == isoDate).firstOrNull;

  factory Timesheet.fromJson(Json j) {
    final emp = asJsonOrNull(j['employment']);
    final worker = asJsonOrNull(j['worker'] ?? emp?['worker']);
    final site = asJsonOrNull(j['site'] ?? emp?['site']);
    final org = asJsonOrNull(j['organization'] ?? emp?['organization']);
    final ot = intOf(j['overtime_minutes_claimed'] ?? j['overtime_minutes']) ?? 0;
    return Timesheet(
      id: strOr(j['id']),
      weekStart: strOr(j['week_start']),
      status: strOr(j['status'], 'draft'),
      employmentId: str(emp?['id'] ?? (j['employment'] is Map ? null : j['employment']) ?? j['employment_id']),
      workerName: str(worker?['full_name'] ?? j['worker_name'] ?? emp?['worker_name']),
      designation: str(j['designation'] ?? emp?['designation']),
      siteName: str(site?['name'] ?? j['site_name']),
      organizationName: str(org?['name'] ?? j['organization_name']),
      days: asJsonList(j['days']).map(TimesheetDay.fromJson).toList(),
      regularMinutes: intOf(j['regular_minutes']) ?? 0,
      overtimeClaimed: ot,
      overtimeApproved: intOf(j['overtime_minutes_approved']),
      overCap: j.containsKey('over_cap') ? boolOf(j['over_cap']) : ot > weeklyOtCapMinutes,
      note: str(j['note']),
    );
  }
}
