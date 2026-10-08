import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';

/// Latest employment contract version (ECOSYSTEM §5).
///
/// Contract ambiguity: the worker API has no `GET .../contract`; we read an
/// optional `contract` object embedded in the employment (and the response of
/// `contract/accept`). Absent → status unknown, PDF still openable.
class ContractInfo {
  const ContractInfo({this.version, this.generatedAt, this.acceptedAt, this.acceptedChannel});
  final int? version;
  final DateTime? generatedAt;
  final DateTime? acceptedAt;
  final String? acceptedChannel;

  bool get isAccepted => acceptedAt != null;

  static ContractInfo? fromJson(Object? v) {
    final j = asJsonOrNull(v);
    if (j == null) return null;
    // `{latest, versions}` envelope: `latest: null` means no contract yet.
    if (j.containsKey('latest') && j['latest'] == null) return null;
    final latest = asJsonOrNull(j['latest']) ?? j;
    return ContractInfo(
      version: intOf(latest['version']),
      generatedAt: dateTimeOf(latest['generated_at']),
      acceptedAt: dateTimeOf(latest['accepted_at']),
      acceptedChannel: str(latest['accepted_channel']),
    );
  }
}

/// `GET /me/employments` item (Employment + organization).
class MyEmployment {
  const MyEmployment({
    required this.id,
    required this.organizationName,
    this.organizationNameNe,
    this.organizationId,
    this.siteName,
    this.tradeEn,
    this.tradeNe,
    this.designation,
    this.startDate,
    this.startDateBs,
    this.endDate,
    this.endDateBs,
    required this.status,
    this.wageType,
    this.basicSalary,
    this.dearnessAllowance,
    this.otherAllowance,
    this.dailyWage,
    this.monthlyGross,
    this.ssfEnrolled = false,
    this.contract,
    this.ratedByMe = false,
    this.employerVerified = false,
  });

  final String id;
  final String organizationName;
  final String? organizationNameNe;
  final String? organizationId;
  final String? siteName;
  final String? tradeEn;
  final String? tradeNe;
  final String? designation;
  final String? startDate;
  final String? startDateBs;
  final String? endDate;
  final String? endDateBs;

  /// active | ended
  final String status;
  final String? wageType;
  final String? basicSalary;
  final String? dearnessAllowance;
  final String? otherAllowance;
  final String? dailyWage;
  final String? monthlyGross;
  final bool ssfEnrolled;
  final ContractInfo? contract;
  final bool ratedByMe;

  /// The employer passed KaamSathi's business verification (KYB).
  final bool employerVerified;

  bool get isActive => status == 'active';

  String orgName(String lang) =>
      lang == 'ne' && (organizationNameNe?.isNotEmpty ?? false) ? organizationNameNe! : organizationName;

  String? trade(String lang) => lang == 'ne' ? (tradeNe ?? tradeEn) : tradeEn;

  /// Whole months worked so far (or until the end date).
  int monthsWorked([DateTime? today]) {
    final s = parseIsoDate(startDate);
    if (s == null) return 0;
    final e = parseIsoDate(endDate) ?? (today ?? nepalToday());
    final m = (e.year - s.year) * 12 + e.month - s.month - (e.day < s.day ? 1 : 0);
    return m < 0 ? 0 : m;
  }

  /// Contract rule: the worker may rate after 30 days or once it ended.
  bool canRate([DateTime? today]) {
    if (ratedByMe) return false;
    if (!isActive) return true;
    final s = parseIsoDate(startDate);
    if (s == null) return false;
    return (today ?? nepalToday()).difference(s).inDays >= 30;
  }

  factory MyEmployment.fromJson(Json j) {
    final org = asJsonOrNull(j['organization']);
    final site = asJsonOrNull(j['site']);
    final trade = asJsonOrNull(j['trade']);
    final rating = j['my_rating'] ?? j['worker_rating'];
    return MyEmployment(
      id: strOr(j['id']),
      organizationName: strOr(org?['name'] ?? j['organization_name']),
      organizationNameNe: str(org?['name_ne']),
      organizationId: str(org?['id']),
      siteName: str(site?['name']),
      tradeEn: str(trade?['name_en'] ?? (trade == null ? j['trade'] : null)),
      tradeNe: str(trade?['name_ne']),
      designation: str(j['designation']),
      startDate: str(j['start_date']),
      startDateBs: str(j['start_date_bs']),
      endDate: str(j['end_date']),
      endDateBs: str(j['end_date_bs']),
      status: strOr(j['status'], 'active'),
      wageType: str(j['wage_type']),
      basicSalary: str(j['basic_salary']),
      dearnessAllowance: str(j['dearness_allowance']),
      otherAllowance: str(j['other_allowance']),
      dailyWage: str(j['daily_wage']),
      monthlyGross: str(j['monthly_gross']),
      ssfEnrolled: boolOf(j['ssf_enrolled']),
      contract: ContractInfo.fromJson(j['contract']),
      ratedByMe: rating != null && rating != false,
      employerVerified: boolOf(
        j['employer_verified'] ??
            org?['employer_verified'] ??
            (org?['verification_status'] == null ? null : org!['verification_status'] == 'verified'),
      ),
    );
  }
}

class EmploymentRepository {
  EmploymentRepository(this._api);
  final ApiClient _api;

  Future<List<MyEmployment>> employments() async {
    final data = await _api.get<dynamic>('/me/employments', query: {'page_size': 100});
    return resultsOf(data).map(MyEmployment.fromJson).toList();
  }

  /// `GET /me/employments/{id}/contract` (served by the backend though not in
  /// the contract doc). null when there is no contract yet (404).
  Future<ContractInfo?> contract(String employmentId) async {
    try {
      return ContractInfo.fromJson(await _api.get<dynamic>('/me/employments/$employmentId/contract'));
    } on ApiException catch (e) {
      if (e.statusCode == 404) return null;
      rethrow;
    }
  }

  /// Returns the updated contract when the server echoes it.
  Future<ContractInfo?> acceptContract(String employmentId) async {
    final data = await _api.post<dynamic>('/me/employments/$employmentId/contract/accept');
    return ContractInfo.fromJson(data);
  }

  static String contractPdfPath(String employmentId) => '/me/employments/$employmentId/contract.pdf';
}

final employmentRepositoryProvider = Provider<EmploymentRepository>(
  (ref) => EmploymentRepository(ref.watch(apiClientProvider)),
);

final myEmploymentsProvider = FutureProvider.autoDispose<List<MyEmployment>>((ref) {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  return ref.watch(employmentRepositoryProvider).employments();
});

final myEmploymentProvider = FutureProvider.autoDispose.family<MyEmployment, String>((ref, id) async {
  final all = await ref.watch(myEmploymentsProvider.future);
  final e = all.where((x) => x.id == id).firstOrNull;
  if (e == null) throw const ApiException(code: 'not_found', message: '');
  return e;
});

final myContractProvider = FutureProvider.autoDispose.family<ContractInfo?, String>((ref, employmentId) {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  return ref.watch(employmentRepositoryProvider).contract(employmentId);
});
