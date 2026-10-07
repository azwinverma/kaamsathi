import '../../../../core/api/json.dart';

/// Attendance statuses (CONTRACT `Attendance.status`).
abstract final class AttendanceStatus {
  static const present = 'present';
  static const absent = 'absent';
  static const halfDay = 'half_day';
  static const leave = 'leave';
  static const holiday = 'holiday';
  static const weeklyOff = 'weekly_off';

  /// The four a supervisor marks from the daily list.
  static const markable = [present, absent, halfDay, leave];

  /// Register cell code → status.
  static String? fromCode(String? code) => switch (code) {
    'P' => present,
    'A' => absent,
    'H' => halfDay,
    'L' => leave,
    'PH' => holiday,
    'WO' => weeklyOff,
    _ => null,
  };
}

class AttendanceRecord {
  const AttendanceRecord({
    this.id,
    required this.employmentId,
    required this.date,
    this.dateBs,
    required this.status,
    this.statusLabel,
    this.checkInAt,
    this.checkOutAt,
    this.method,
    this.overtimeMinutes = 0,
    this.note,
  });

  final String? id;
  final String employmentId;
  final String date;
  final String? dateBs;
  final String status;
  final String? statusLabel;
  final DateTime? checkInAt;
  final DateTime? checkOutAt;
  final String? method;
  final int overtimeMinutes;
  final String? note;

  factory AttendanceRecord.fromJson(Json j) => AttendanceRecord(
    id: str(j['id']),
    employmentId: strOr(j['employment_id']),
    date: strOr(j['date']),
    dateBs: str(j['date_bs']),
    status: strOr(j['status']),
    statusLabel: str(j['status_label']),
    checkInAt: dateTimeOf(j['check_in_at']),
    checkOutAt: dateTimeOf(j['check_out_at']),
    method: str(j['method']),
    overtimeMinutes: intOf(j['overtime_minutes']) ?? 0,
    note: str(j['note']),
  );
}

class RosterRow {
  const RosterRow({
    required this.employmentId,
    required this.workerId,
    required this.workerName,
    this.photo,
    this.designation,
    this.siteId,
    this.record,
  });

  final String employmentId;
  final String workerId;
  final String workerName;
  final String? photo;
  final String? designation;
  final String? siteId;
  final AttendanceRecord? record;

  factory RosterRow.fromJson(Json j) {
    final w = asJson(j['worker']);
    final rec = asJsonOrNull(j['record']);
    return RosterRow(
      employmentId: strOr(j['employment_id']),
      workerId: strOr(w['id']),
      workerName: strOr(w['full_name']),
      photo: str(w['photo']),
      designation: str(j['designation']),
      siteId: str(j['site_id']),
      record: rec == null ? null : AttendanceRecord.fromJson(rec),
    );
  }
}

/// `GET /org/attendance/day`.
class DayRoster {
  const DayRoster({
    required this.date,
    this.dateBs,
    this.isHoliday = false,
    this.holidayName,
    required this.rows,
    this.fromCache = false,
  });

  final String date;
  final String? dateBs;
  final bool isHoliday;
  final String? holidayName;
  final List<RosterRow> rows;

  /// Loaded from the on-device cache because the network was unavailable.
  final bool fromCache;

  factory DayRoster.fromJson(Json j, {bool fromCache = false}) => DayRoster(
    date: strOr(j['date']),
    dateBs: str(j['date_bs']),
    isHoliday: boolOf(j['is_holiday']),
    holidayName: str(j['holiday_name']),
    rows: asJsonList(j['rows']).map(RosterRow.fromJson).toList(),
    fromCache: fromCache,
  );
}

class RegisterDay {
  const RegisterDay({
    required this.date,
    required this.bsDay,
    required this.weekday,
    this.isHoliday = false,
    this.isWeeklyOff = false,
  });

  final String date;
  final int bsDay;
  final int weekday;
  final bool isHoliday;
  final bool isWeeklyOff;

  factory RegisterDay.fromJson(Json j) => RegisterDay(
    date: strOr(j['date']),
    bsDay: intOf(j['bs_day']) ?? 0,
    weekday: intOf(j['weekday']) ?? 0,
    isHoliday: boolOf(j['is_holiday']),
    isWeeklyOff: boolOf(j['is_weekly_off']),
  );
}

class RegisterRow {
  const RegisterRow({
    required this.employmentId,
    required this.workerName,
    this.designation,
    required this.cells,
    required this.totals,
  });

  final String employmentId;
  final String workerName;
  final String? designation;

  /// AD date → `P|A|H|L|PH|WO` or null.
  final Map<String, String?> cells;
  final Map<String, num> totals;

  factory RegisterRow.fromJson(Json j) => RegisterRow(
    employmentId: strOr(j['employment_id']),
    workerName: strOr(j['worker_name']),
    designation: str(j['designation']),
    cells: asJson(j['cells']).map((k, v) => MapEntry(k, str(v))),
    totals: numMap(j['totals']),
  );
}

/// `GET /org/attendance/register`.
class Register {
  const Register({
    required this.bsYear,
    required this.bsMonth,
    this.monthNameEn,
    this.monthNameNe,
    required this.days,
    required this.rows,
  });

  final int bsYear;
  final int bsMonth;
  final String? monthNameEn;
  final String? monthNameNe;
  final List<RegisterDay> days;
  final List<RegisterRow> rows;

  factory Register.fromJson(Json j) => Register(
    bsYear: intOf(j['bs_year']) ?? 0,
    bsMonth: intOf(j['bs_month']) ?? 0,
    monthNameEn: str(j['month_name_en']),
    monthNameNe: str(j['month_name_ne']),
    days: asJsonList(j['days']).map(RegisterDay.fromJson).toList(),
    rows: asJsonList(j['rows']).map(RegisterRow.fromJson).toList(),
  );
}

Map<String, num> numMap(Object? v) {
  final out = <String, num>{};
  asJson(v).forEach((k, val) {
    final n = numOf(val);
    if (n != null) out[k] = n;
  });
  return out;
}

class SiteRef {
  const SiteRef({required this.id, required this.name, this.address});
  final String id;
  final String name;
  final String? address;

  factory SiteRef.fromJson(Json j) => SiteRef(
    id: strOr(j['id']),
    name: strOr(j['name']),
    address: str(j['address']),
  );
}
