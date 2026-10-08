import '../../../core/api/json.dart';
import '../../../core/format.dart';
import '../../common/ref_data.dart';

/// `GET /me/worker` (Worker model fields from CONTRACT).
class WorkerProfile {
  const WorkerProfile({
    required this.id,
    required this.fullName,
    this.fullNameNe,
    required this.phone,
    this.gender,
    this.dateOfBirth,
    this.address,
    this.photo,
    required this.verificationStatus,
    required this.isAvailable,
    required this.paymentMethod,
    this.bankName,
    this.bankAccountNo,
    this.bankAccountName,
    this.walletId,
    this.ssfId,
    this.districtName,
    this.districtNameNe,
    this.preferredDistricts = const [],
    this.serviceRadiusKm,
    this.expectedMonthlyWage,
    this.availableFrom,
  });

  final String id;
  final String fullName;
  final String? fullNameNe;
  final String phone;
  final String? gender;
  final String? dateOfBirth;
  final String? address;
  final String? photo;
  final String verificationStatus;
  final bool isAvailable;
  final String paymentMethod;
  final String? bankName;
  final String? bankAccountNo;
  final String? bankAccountName;
  final String? walletId;
  final String? ssfId;
  final String? districtName;
  final String? districtNameNe;

  /// EXTENSIONS §3 preferences (codes or `{code, name_en, name_ne}` refs).
  final List<District> preferredDistricts;
  final int? serviceRadiusKm;
  final String? expectedMonthlyWage;
  final String? availableFrom;

  String displayName(String lang) => lang == 'ne' && (fullNameNe?.isNotEmpty ?? false) ? fullNameNe! : fullName;

  factory WorkerProfile.fromJson(Json j) {
    final district =
        asJsonOrNull(j['current_district']) ?? asJsonOrNull(j['district']) ?? asJsonOrNull(j['permanent_district']);
    return WorkerProfile(
      id: strOr(j['id']),
      fullName: strOr(j['full_name']),
      fullNameNe: str(j['full_name_ne']),
      phone: strOr(j['phone']),
      gender: str(j['gender']),
      dateOfBirth: str(j['date_of_birth']),
      address: str(j['address']),
      photo: str(j['photo']),
      verificationStatus: strOr(j['verification_status'], 'unverified'),
      isAvailable: boolOf(j['is_available']),
      paymentMethod: strOr(j['payment_method'], 'cash'),
      bankName: str(j['bank_name']),
      bankAccountNo: str(j['bank_account_no']),
      bankAccountName: str(j['bank_account_name']),
      walletId: str(j['wallet_id']),
      ssfId: str(j['ssf_id']),
      districtName: str(district?['name_en']),
      districtNameNe: str(district?['name_ne']),
      preferredDistricts: [
        for (final d in (j['preferred_districts'] is List ? j['preferred_districts'] as List : const <Object>[]))
          if (District.fromAny(d) case final x?) x,
      ],
      serviceRadiusKm: intOf(j['service_radius_km']),
      expectedMonthlyWage: str(j['expected_monthly_wage']),
      availableFrom: str(j['available_from']),
    );
  }
}

/// One day of `GET /me/attendance`.
class MyAttendanceDay {
  const MyAttendanceDay({required this.date, required this.bsDay, this.status});
  final String date;
  final int bsDay;
  final String? status;

  factory MyAttendanceDay.fromJson(Json j) =>
      MyAttendanceDay(date: strOr(j['date']), bsDay: intOf(j['bs_day']) ?? 0, status: str(j['status']));
}

class MyAttendanceMonth {
  const MyAttendanceMonth({required this.days, required this.totals});
  final List<MyAttendanceDay> days;
  final Map<String, num> totals;

  MyAttendanceDay? dayFor(String isoDate) => days.where((d) => d.date == isoDate).firstOrNull;

  factory MyAttendanceMonth.fromJson(Json j) {
    final totals = <String, num>{};
    asJson(j['totals']).forEach((k, v) {
      final n = numOf(v);
      if (n != null) totals[k] = n;
    });
    return MyAttendanceMonth(days: asJsonList(j['days']).map(MyAttendanceDay.fromJson).toList(), totals: totals);
  }
}

/// Payslip (list + detail share one model; list items may omit breakdown).
class Payslip {
  const Payslip({
    required this.id,
    required this.bsYear,
    required this.bsMonth,
    this.monthNameEn,
    this.monthNameNe,
    this.organizationName,
    this.designation,
    this.wageType,
    this.daysInMonth,
    this.presentDays,
    this.paidLeaveDays,
    this.holidayDays,
    this.weeklyOffDays,
    this.absentDays,
    this.payableDays,
    this.overtimeHours,
    this.basicEarned,
    this.daEarned,
    this.allowanceEarned,
    this.overtimePay,
    this.festivalAllowance,
    this.grossPay,
    this.ssfEmployee,
    this.tds,
    this.advanceRecovery,
    this.otherDeductions,
    required this.netPay,
    this.paymentMethod,
    required this.paymentStatus,
    this.paidAt,
    this.note,
  });

  final String id;
  final int bsYear;
  final int bsMonth;
  final String? monthNameEn;
  final String? monthNameNe;
  final String? organizationName;
  final String? designation;
  final String? wageType;
  final num? daysInMonth;
  final num? presentDays;
  final num? paidLeaveDays;
  final num? holidayDays;
  final num? weeklyOffDays;
  final num? absentDays;
  final num? payableDays;
  final num? overtimeHours;
  final String? basicEarned;
  final String? daEarned;
  final String? allowanceEarned;
  final String? overtimePay;
  final String? festivalAllowance;
  final String? grossPay;
  final String? ssfEmployee;
  final String? tds;
  final String? advanceRecovery;
  final String? otherDeductions;
  final String netPay;
  final String? paymentMethod;
  final String paymentStatus;
  final DateTime? paidAt;
  final String? note;

  bool get isPaid => paymentStatus == 'paid';

  String monthLabel(String lang) => formatBsMonthYear(bsYear, bsMonth, lang);

  factory Payslip.fromJson(Json j) {
    // Month may be top-level or nested under `run`.
    final run = asJsonOrNull(j['run']) ?? const <String, dynamic>{};
    final org = asJsonOrNull(j['organization']) ?? asJsonOrNull(run['organization']);
    Object? pick(String k) => j[k] ?? run[k];
    return Payslip(
      id: strOr(j['id']),
      bsYear: intOf(pick('bs_year')) ?? 0,
      bsMonth: intOf(pick('bs_month')) ?? 0,
      monthNameEn: str(pick('month_name_en')),
      monthNameNe: str(pick('month_name_ne')),
      organizationName: str(j['organization_name'] ?? org?['name']),
      designation: str(j['designation']),
      wageType: str(j['wage_type']),
      daysInMonth: numOf(j['days_in_month']),
      presentDays: numOf(j['present_days']),
      paidLeaveDays: numOf(j['paid_leave_days']),
      holidayDays: numOf(j['holiday_days']),
      weeklyOffDays: numOf(j['weekly_off_days']),
      absentDays: numOf(j['absent_days']),
      payableDays: numOf(j['payable_days']),
      overtimeHours: numOf(j['overtime_hours']),
      basicEarned: str(j['basic_earned']),
      daEarned: str(j['da_earned']),
      allowanceEarned: str(j['allowance_earned']),
      overtimePay: str(j['overtime_pay']),
      festivalAllowance: str(j['festival_allowance']),
      grossPay: str(j['gross_pay']),
      ssfEmployee: str(j['ssf_employee']),
      tds: str(j['tds']),
      advanceRecovery: str(j['advance_recovery']),
      otherDeductions: str(j['other_deductions']),
      netPay: strOr(j['net_pay'], '0'),
      paymentMethod: str(j['payment_method']),
      paymentStatus: strOr(j['payment_status'], 'pending'),
      paidAt: dateTimeOf(j['paid_at']),
      note: str(j['note']),
    );
  }
}

/// `GET /me/history` item (same shape as WorkerProfile.history).
class HistoryItem {
  const HistoryItem({
    required this.organizationName,
    this.trade,
    this.startDate,
    this.startDateBs,
    this.endDate,
    this.endDateBs,
    this.months,
    this.rating,
  });

  final String organizationName;
  final String? trade;
  final String? startDate;
  final String? startDateBs;
  final String? endDate;
  final String? endDateBs;
  final num? months;
  final num? rating;

  factory HistoryItem.fromJson(Json j, String lang) {
    final tradeObj = asJsonOrNull(j['trade']);
    final trade =
        tradeObj == null
            ? str(j['trade'])
            : str(lang == 'ne' ? (tradeObj['name_ne'] ?? tradeObj['name_en']) : tradeObj['name_en']);
    return HistoryItem(
      organizationName: strOr(j['organization_name'] ?? asJsonOrNull(j['organization'])?['name']),
      trade: trade,
      startDate: str(j['start_date']),
      startDateBs: str(j['start_date_bs']),
      endDate: str(j['end_date']),
      endDateBs: str(j['end_date_bs']),
      months: numOf(j['months']),
      rating: numOf(j['rating']),
    );
  }
}

/// Consent scopes (CONTRACT `Consent.scope`).
abstract final class ConsentScope {
  static const dataProcessing = 'data_processing';
  static const profileShare = 'profile_share';
  static const historyShare = 'history_share';
  static const all = [dataProcessing, profileShare, historyShare];
}

class ConsentRecord {
  const ConsentRecord({required this.scope, required this.granted, this.organizationId});
  final String scope;
  final bool granted;
  final String? organizationId;

  factory ConsentRecord.fromJson(Json j) {
    final org = j['organization'];
    return ConsentRecord(
      scope: strOr(j['scope']),
      granted: boolOf(j['granted']),
      organizationId: org is Map ? str(org['id']) : str(org ?? j['organization_id']),
    );
  }
}
