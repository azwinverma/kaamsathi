import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/cached.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/providers.dart';
import '../../../core/storage/prefs.dart';

/// Reliability score components (ECOSYSTEM §1), in display order.
const trustComponents = ['employer_feedback', 'attendance', 'completion', 'skills', 'repeat_hiring', 'stability'];

/// `GET /me/trust`.
class TrustSummary {
  const TrustSummary({
    required this.verificationLevel,
    this.verificationLevelLabel,
    this.reliabilityScore,
    this.breakdown = const {},
    this.nextSteps = const [],
  });

  /// 0–5.
  final int verificationLevel;
  final String? verificationLevelLabel;

  /// 0–100, or null until the worker has at least one employment.
  final int? reliabilityScore;

  /// Component → 0–1.
  final Map<String, double> breakdown;

  /// Localised hints from the server ("Upload your NSTB certificate").
  final List<String> nextSteps;

  factory TrustSummary.fromJson(Json j) {
    final b = <String, double>{};
    asJson(j['breakdown']).forEach((k, v) {
      final n = numOf(v);
      if (n != null) b[k] = n.toDouble().clamp(0, 1);
    });
    return TrustSummary(
      verificationLevel: (intOf(j['verification_level']) ?? 0).clamp(0, 5),
      verificationLevelLabel: str(j['verification_level_label']),
      reliabilityScore: intOf(j['reliability_score'])?.clamp(0, 100),
      breakdown: b,
      nextSteps: strList(j['next_steps']).where((s) => s.trim().isNotEmpty).toList(),
    );
  }
}

/// A `{id, name}` reference (organization or partner).
class NamedRef {
  const NamedRef({required this.id, required this.name});
  final String id;
  final String name;

  static NamedRef? fromJson(Object? v) {
    final j = asJsonOrNull(v);
    if (j == null) return null;
    return NamedRef(id: strOr(j['id']), name: strOr(j['name']));
  }
}

/// `GET /me/profile-views` item.
class ProfileView {
  const ProfileView({
    required this.id,
    this.organization,
    this.partner,
    required this.context,
    this.contextLabel,
    this.createdAt,
  });

  final String id;
  final NamedRef? organization;
  final NamedRef? partner;
  final String context;
  final String? contextLabel;
  final DateTime? createdAt;

  /// Who looked: organization, partner, or null (KaamSathi staff / public link).
  String? get viewerName => organization?.name ?? partner?.name;

  factory ProfileView.fromJson(Json j) => ProfileView(
    id: strOr(j['id']),
    organization: NamedRef.fromJson(j['organization']),
    partner: NamedRef.fromJson(j['partner']),
    context: strOr(j['context']),
    contextLabel: str(j['context_label']),
    createdAt: dateTimeOf(j['created_at']),
  );
}

abstract final class DisputeKind {
  static const all = ['attendance', 'wage', 'employment_dates', 'rating', 'identity', 'other'];
}

/// `GET /me/disputes` item.
class Dispute {
  const Dispute({
    required this.id,
    required this.kind,
    this.kindLabel,
    required this.description,
    required this.status,
    this.statusLabel,
    this.organization,
    this.employmentId,
    this.payslipId,
    this.attendanceDate,
    this.attendanceDateBs,
    this.employerNote,
    this.resolutionNote,
    this.raisedAt,
  });

  final String id;
  final String kind;
  final String? kindLabel;
  final String description;

  /// open | employer_responded | resolved | rejected
  final String status;
  final String? statusLabel;
  final NamedRef? organization;
  final String? employmentId;
  final String? payslipId;
  final String? attendanceDate;
  final String? attendanceDateBs;
  final String? employerNote;
  final String? resolutionNote;
  final DateTime? raisedAt;

  factory Dispute.fromJson(Json j) {
    String? idOf(Object? v) => v is Map ? str(v['id']) : str(v);
    return Dispute(
      id: strOr(j['id']),
      kind: strOr(j['kind'], 'other'),
      kindLabel: str(j['kind_label']),
      description: strOr(j['description']),
      status: strOr(j['status'], 'open'),
      statusLabel: str(j['status_label']),
      organization: NamedRef.fromJson(j['organization']),
      employmentId: idOf(j['employment'] ?? j['employment_id']),
      payslipId: idOf(j['payslip'] ?? j['payslip_id']),
      attendanceDate: str(j['attendance_date']),
      attendanceDateBs: str(j['attendance_date_bs']),
      employerNote: str(j['employer_note']),
      resolutionNote: str(j['resolution_note']),
      raisedAt: dateTimeOf(j['raised_at'] ?? j['created_at']),
    );
  }
}

/// Body for `POST /me/disputes`.
///
/// Contract ambiguity: the model fields are `employment` / `payslip` while
/// other worker endpoints use `*_id`. We send both spellings; DRF ignores
/// the unknown one.
Json disputeBody({
  required String kind,
  required String description,
  String? employmentId,
  String? payslipId,
  String? attendanceDate,
}) => {
  'kind': kind,
  'description': description.trim(),
  if (employmentId != null) ...{'employment': employmentId, 'employment_id': employmentId},
  if (payslipId != null) ...{'payslip': payslipId, 'payslip_id': payslipId},
  if (attendanceDate != null) 'attendance_date': attendanceDate,
};

class TrustRepository {
  TrustRepository(this._api, this._prefs);
  final ApiClient _api;
  final Prefs _prefs;

  Future<Cached<TrustSummary>> trust() => cachedFetch(
    prefs: _prefs,
    key: 'me_trust',
    fetch: () => _api.get<Map<String, dynamic>>('/me/trust'),
    parse: TrustSummary.fromJson,
  );

  Future<List<ProfileView>> profileViews() async {
    final data = await _api.get<dynamic>('/me/profile-views', query: {'page_size': 100});
    return resultsOf(data).map(ProfileView.fromJson).toList();
  }

  Future<List<Dispute>> disputes() async {
    final data = await _api.get<dynamic>('/me/disputes', query: {'page_size': 100});
    return resultsOf(data).map(Dispute.fromJson).toList();
  }

  Future<void> raiseDispute(Json body) => _api.postNoContent('/me/disputes', data: body);

  /// Worker → employer rating (pay on time, conditions).
  Future<void> rateEmployer(String employmentId, {required int payOnTime, required int conditions, String? comment}) =>
      _api.postNoContent(
        '/me/employments/$employmentId/rate',
        data: {
          'score_a': payOnTime,
          'score_b': conditions,
          if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
        },
      );
}

final trustRepositoryProvider = Provider<TrustRepository>(
  (ref) => TrustRepository(ref.watch(apiClientProvider), ref.watch(prefsProvider)),
);

String? _userId(Ref ref) => ref.watch(sessionProvider.select((s) => s.me?.id));

final trustProvider = FutureProvider.autoDispose<Cached<TrustSummary>>((ref) {
  _userId(ref);
  ref.watch(langCodeProvider); // next steps are localised server-side
  return ref.watch(trustRepositoryProvider).trust();
});

final profileViewsProvider = FutureProvider.autoDispose<List<ProfileView>>((ref) {
  _userId(ref);
  ref.watch(langCodeProvider);
  return ref.watch(trustRepositoryProvider).profileViews();
});

final disputesProvider = FutureProvider.autoDispose<List<Dispute>>((ref) {
  _userId(ref);
  ref.watch(langCodeProvider);
  return ref.watch(trustRepositoryProvider).disputes();
});
