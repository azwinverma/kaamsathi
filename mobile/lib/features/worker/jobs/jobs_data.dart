import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/cached.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/providers.dart';
import '../../../core/storage/prefs.dart';
import '../../common/ref_data.dart';

/// A job as the worker sees it (`GET /me/jobs/recommended` item, or the
/// `job` summary inside an application).
class JobSummary {
  const JobSummary({
    required this.id,
    required this.title,
    this.trade,
    this.wage,
    this.wageType,
    this.district,
    this.foodProvided = false,
    this.accommodationProvided = false,
    this.startDate,
    this.startDateBs,
    this.organizationName = '',
    this.employerVerified = false,
    this.openings,
    this.matchReasons = const [],
  });

  final String id;
  final String title;
  final Trade? trade;
  final String? wage;

  /// monthly | daily
  final String? wageType;
  final District? district;
  final bool foodProvided;
  final bool accommodationProvided;
  final String? startDate;
  final String? startDateBs;
  final String organizationName;
  final bool employerVerified;
  final int? openings;

  /// Server-sent reasons ("Trade match", "Same district"), when present.
  /// Recommended jobs always match the worker's trade and area (CONTRACT-
  /// EXTENSIONS: `/me/jobs/recommended`), so the UI can explain that much
  /// without them.
  final List<String> matchReasons;

  factory JobSummary.fromJson(Json j) {
    final org = j['organization'];
    final site = asJsonOrNull(j['site']);
    return JobSummary(
      id: strOr(j['id']),
      title: strOr(j['title']),
      trade: Trade.fromAny(j['trade']),
      wage: str(j['wage'] ?? j['wage_amount']),
      wageType: str(j['wage_type']),
      district: District.fromAny(j['district'] ?? site?['district']),
      foodProvided: boolOf(j['food_provided'] ?? j['food']),
      accommodationProvided: boolOf(j['accommodation_provided'] ?? j['accommodation']),
      startDate: str(j['start_date']),
      startDateBs: str(j['start_date_bs']),
      organizationName: strOr(j['organization_name'] ?? (org is Map ? org['name'] : org)),
      employerVerified: boolOf(
        j['employer_verified'] ??
            (org is Map ? (org['employer_verified'] ?? org['verification_status'] == 'verified') : null),
      ),
      openings: intOf(j['openings_count'] ?? j['openings']),
      matchReasons: strList(j['match_reasons'] ?? j['reasons']),
    );
  }
}

/// An interview round (`interviews[]` on a worker application). The worker
/// view never carries the employer's notes.
class Interview {
  const Interview({
    required this.id,
    this.scheduledAt,
    this.scheduledAtBs,
    required this.mode,
    this.modeLabel,
    this.location,
    this.interviewerName,
    this.outcome = 'pending',
    this.outcomeLabel,
  });

  final String id;
  final DateTime? scheduledAt;
  final String? scheduledAtBs;

  /// in_person | phone | video | trade_test
  final String mode;
  final String? modeLabel;
  final String? location;
  final String? interviewerName;

  /// pending | passed | failed | no_show
  final String outcome;
  final String? outcomeLabel;

  bool get isPending => outcome == 'pending';

  factory Interview.fromJson(Json j) => Interview(
    id: strOr(j['id']),
    scheduledAt: dateTimeOf(j['scheduled_at']),
    scheduledAtBs: str(j['scheduled_at_bs']),
    mode: strOr(j['mode'], 'in_person'),
    modeLabel: str(j['mode_label']),
    location: str(j['location']),
    interviewerName: str(j['interviewer_name']),
    outcome: strOr(j['outcome'], 'pending'),
    outcomeLabel: str(j['outcome_label']),
  );
}

/// `GET /me/applications` item.
class MyApplication {
  const MyApplication({
    required this.id,
    required this.stage,
    required this.job,
    this.source,
    this.workerResponse,
    this.interviewAt,
    this.createdAt,
    this.canRespond,
    this.interviews = const [],
  });

  final String id;

  /// sourced | shortlisted | interview | selected | joined | rejected | dropped
  final String stage;
  final JobSummary job;

  /// ops | worker_interest | employer_invite
  final String? source;

  /// pending | interested | declined | null
  final String? workerResponse;
  final DateTime? interviewAt;
  final DateTime? createdAt;

  /// Server's `can_respond` (non-terminal and past `sourced`), when sent.
  final bool? canRespond;

  /// Interview rounds, upcoming first then most recent.
  final List<Interview> interviews;

  /// A past employer invited the worker back (L004).
  bool get isEmployerInvite => source == 'employer_invite';

  /// Ops shortlisted the worker and is waiting for them to confirm.
  bool get needsResponse {
    if (canRespond == false) return false;
    if (const {'rejected', 'dropped', 'joined', 'sourced'}.contains(stage)) return false;
    // Pending = ops asked; null + can_respond = shortlisted before the worker
    // ever answered (e.g. employer invite).
    return workerResponse == 'pending' || (workerResponse == null && canRespond == true);
  }

  /// The worker's own interest, not yet passed to the employer.
  bool get underReview => stage == 'sourced' && source == 'worker_interest';

  factory MyApplication.fromJson(Json j) {
    final job = asJsonOrNull(j['job']) ?? const <String, dynamic>{};
    return MyApplication(
      id: strOr(j['id']),
      stage: strOr(j['stage'], 'sourced'),
      job: JobSummary.fromJson({
        ...job,
        if (job['organization'] == null && job['organization_name'] == null)
          'organization': j['organization'] ?? j['organization_name'],
        if (job['employer_verified'] == null && j['employer_verified'] != null)
          'employer_verified': j['employer_verified'],
        if (job['id'] == null) 'id': j['job_id'],
      }),
      source: str(j['source']),
      workerResponse: str(j['worker_response']),
      interviewAt: dateTimeOf(j['interview_at']),
      createdAt: dateTimeOf(j['created_at']),
      canRespond: j.containsKey('can_respond') ? boolOf(j['can_respond']) : null,
      interviews: sortInterviews(asJsonList(j['interviews']).map(Interview.fromJson)),
    );
  }
}

/// Pending rounds first (soonest first), then past rounds (newest first).
List<Interview> sortInterviews(Iterable<Interview> list) {
  final out = [...list];
  out.sort((a, b) {
    if (a.isPending != b.isPending) return a.isPending ? -1 : 1;
    final x = a.scheduledAt ?? DateTime(0);
    final y = b.scheduledAt ?? DateTime(0);
    return a.isPending ? x.compareTo(y) : y.compareTo(x);
  });
  return out;
}

/// Applications needing an answer first, then newest.
List<MyApplication> sortApplications(List<MyApplication> list) {
  final out = [...list];
  out.sort((a, b) {
    if (a.needsResponse != b.needsResponse) return a.needsResponse ? -1 : 1;
    return (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0));
  });
  return out;
}

class JobsRepository {
  JobsRepository(this._api, this._prefs);
  final ApiClient _api;
  final Prefs _prefs;

  Future<List<JobSummary>> recommended() async {
    final data = await _api.get<dynamic>('/me/jobs/recommended', query: {'page_size': 50});
    return resultsOf(data).map(JobSummary.fromJson).toList();
  }

  /// "I'm interested": creates a `worker_interest` application that only
  /// KaamSathi's team sees until they shortlist it.
  Future<void> interest(String jobId) => _api.postNoContent('/me/jobs/$jobId/interest');

  Future<Cached<List<MyApplication>>> applications() => cachedFetch(
    prefs: _prefs,
    key: 'me_applications',
    fetch: () async {
      final data = await _api.get<dynamic>('/me/applications', query: {'page_size': 100});
      return {'results': resultsOf(data)};
    },
    parse: (j) => sortApplications(resultsOf(j).map(MyApplication.fromJson).toList()),
  );

  Future<void> respond(String applicationId, {required bool interested, String? note}) => _api.postNoContent(
    '/me/applications/$applicationId/respond',
    data: {
      'response': interested ? 'interested' : 'declined',
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    },
  );
}

final jobsRepositoryProvider = Provider<JobsRepository>(
  (ref) => JobsRepository(ref.watch(apiClientProvider), ref.watch(prefsProvider)),
);

String? _userId(Ref ref) => ref.watch(sessionProvider.select((s) => s.me?.id));

final recommendedJobsProvider = FutureProvider.autoDispose<List<JobSummary>>((ref) {
  _userId(ref);
  return ref.watch(jobsRepositoryProvider).recommended();
});

final myApplicationsProvider = FutureProvider.autoDispose<Cached<List<MyApplication>>>((ref) {
  _userId(ref);
  return ref.watch(jobsRepositoryProvider).applications();
});

/// `GET /me/job-offers` item.
class JobOffer {
  const JobOffer({
    required this.id,
    required this.status,
    this.title,
    this.designation,
    this.organizationName = '',
    this.employerVerified = false,
    this.siteName,
    this.district,
    this.wageType,
    this.basicSalary,
    this.dearnessAllowance,
    this.otherAllowance,
    this.dailyWage,
    this.monthlyGross,
    this.startDate,
    this.startDateBs,
    this.contractType,
    this.contractTypeLabel,
    this.expiresAt,
    this.note,
    this.endsOn,
    this.endsOnBs,
  });

  final String id;

  /// Fixed-term end date.
  final String? endsOn;
  final String? endsOnBs;

  /// pending | accepted | declined | expired | withdrawn
  final String status;
  final String? title;
  final String? designation;
  final String organizationName;
  final bool employerVerified;
  final String? siteName;
  final District? district;

  /// monthly | daily
  final String? wageType;
  final String? basicSalary;
  final String? dearnessAllowance;
  final String? otherAllowance;
  final String? dailyWage;
  final String? monthlyGross;
  final String? startDate;
  final String? startDateBs;
  final String? contractType;
  final String? contractTypeLabel;
  final DateTime? expiresAt;
  final String? note;

  bool get isDaily => wageType == 'daily' || (dailyWage != null && basicSalary == null);

  bool isExpired([DateTime? now]) =>
      status == 'expired' || (status == 'pending' && expiresAt != null && !expiresAt!.isAfter(now ?? DateTime.now()));

  bool canAnswer([DateTime? now]) => status == 'pending' && !isExpired(now);

  /// Time left to answer (null without an expiry or when past it).
  Duration? timeLeft([DateTime? now]) {
    if (expiresAt == null) return null;
    final d = expiresAt!.difference(now ?? DateTime.now());
    return d.isNegative ? null : d;
  }

  factory JobOffer.fromJson(Json j) {
    final job = asJsonOrNull(j['job']) ?? const <String, dynamic>{};
    final org = j['organization'] ?? job['organization'];
    final site = asJsonOrNull(j['site'] ?? job['site']);
    Object? pick(String k) => j[k] ?? job[k];
    return JobOffer(
      id: strOr(j['id']),
      status: strOr(j['status'], 'pending'),
      title: str(pick('title')),
      designation: str(j['designation']),
      organizationName: strOr(j['organization_name'] ?? (org is Map ? org['name'] : org)),
      employerVerified: boolOf(j['employer_verified'] ?? job['employer_verified']),
      siteName: str(site?['name'] ?? j['site_name']),
      district: District.fromAny(pick('district') ?? site?['district']),
      wageType: str(pick('wage_type')),
      basicSalary: str(j['basic_salary']),
      dearnessAllowance: str(j['dearness_allowance']),
      otherAllowance: str(j['other_allowance']),
      dailyWage: str(j['daily_wage'] ?? (pick('wage_type') == 'daily' ? pick('wage_amount') : null)),
      monthlyGross: str(
        j['monthly_gross'] ?? j['monthly_amount'] ?? (pick('wage_type') == 'monthly' ? pick('wage_amount') : null),
      ),
      endsOn: str(j['ends_on']),
      endsOnBs: str(j['ends_on_bs']),
      startDate: str(pick('start_date')),
      startDateBs: str(pick('start_date_bs')),
      contractType: str(j['contract_type'] ?? j['employment_type']),
      contractTypeLabel: str(j['contract_type_label'] ?? j['employment_type_label']),
      expiresAt: dateTimeOf(j['expires_at']),
      note: str(j['note'] ?? j['message']),
    );
  }
}

/// `GET|POST|PATCH|DELETE /me/job-alerts`.
class JobAlert {
  const JobAlert({
    required this.id,
    this.trade,
    this.districts = const [],
    this.minWage,
    this.frequency = 'daily',
    this.isActive = true,
  });

  final String id;
  final Trade? trade;
  final List<District> districts;
  final String? minWage;

  /// instant | daily | weekly
  final String frequency;
  final bool isActive;

  factory JobAlert.fromJson(Json j) => JobAlert(
    id: strOr(j['id']),
    trade: Trade.fromAny(j['trade']),
    districts: [
      for (final d in (j['districts'] is List ? j['districts'] as List : const <Object>[]))
        if (District.fromAny(d) case final x?) x,
    ],
    minWage: str(j['min_wage']),
    frequency: strOr(j['frequency'], 'daily'),
    isActive: boolOf(j['is_active'], true),
  );

  /// Request body (codes only).
  static Json body({
    String? tradeCode,
    required List<String> districtCodes,
    String? minWage,
    required String frequency,
    required bool isActive,
  }) => {
    'trade': tradeCode,
    'districts': districtCodes,
    'min_wage': (minWage == null || minWage.trim().isEmpty) ? null : minWage.trim(),
    'frequency': frequency,
    'is_active': isActive,
  };
}

class OffersRepository {
  OffersRepository(this._api);
  final ApiClient _api;

  Future<List<JobOffer>> offers() async {
    final data = await _api.get<dynamic>('/me/job-offers', query: {'page_size': 50});
    final list = resultsOf(data).map(JobOffer.fromJson).toList();
    // Open offers first.
    list.sort((a, b) => (b.canAnswer() ? 1 : 0).compareTo(a.canAnswer() ? 1 : 0));
    return list;
  }

  Future<void> accept(String id) => _api.postNoContent('/me/job-offers/$id/accept');

  Future<void> decline(String id, {String? reason}) => _api.postNoContent(
    '/me/job-offers/$id/decline',
    data: {if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim()},
  );

  Future<List<JobAlert>> alerts() async {
    final data = await _api.get<dynamic>('/me/job-alerts', query: {'page_size': 50});
    return resultsOf(data).map(JobAlert.fromJson).toList();
  }

  Future<void> createAlert(Json body) => _api.postNoContent('/me/job-alerts', data: body);

  Future<void> updateAlert(String id, Json body) => _api.patch<dynamic>('/me/job-alerts/$id', data: body);

  Future<void> deleteAlert(String id) => _api.delete('/me/job-alerts/$id');
}

final offersRepositoryProvider = Provider<OffersRepository>((ref) => OffersRepository(ref.watch(apiClientProvider)));

final jobOffersProvider = FutureProvider.autoDispose<List<JobOffer>>((ref) {
  _userId(ref);
  return ref.watch(offersRepositoryProvider).offers();
});

final jobAlertsProvider = FutureProvider.autoDispose<List<JobAlert>>((ref) {
  _userId(ref);
  return ref.watch(offersRepositoryProvider).alerts();
});
