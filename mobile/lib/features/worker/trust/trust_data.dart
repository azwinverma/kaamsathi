import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
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

  /// A Bolau booking dispute (raised from the booking, never from the form).
  static const booking = 'booking';
}

/// Whose endpoints a dispute is read and followed up through.
///
/// The worker on the case (incl. a Sipalu on a booking dispute) uses
/// `/me/disputes/{id}`; the Ghardhani on a booking dispute is not the case's
/// worker and uses `/me/booking-disputes/{id}` (CONTRACT-BOLAU note 9).
enum DisputeParty {
  worker('/me/disputes'),
  ghardhani('/me/booking-disputes');

  const DisputeParty(this.basePath);
  final String basePath;

  String detail(String id) => '$basePath/$id';
  String evidence(String id) => '$basePath/$id/evidence';
  String appeal(String id) => '$basePath/$id/appeal';
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
    this.evidenceCount = 0,
    this.canAppeal = false,
    this.appealDeadline,
    this.appeal,
    this.bookingId,
    this.bookingCode,
    this.respondedAt,
    this.resolvedAt,
  });

  final String id;
  final String kind;
  final String? kindLabel;
  final String description;

  /// open | employer_responded | resolved | rejected | appealed | appeal_resolved
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
  final int evidenceCount;

  /// Server decides (once, within 14 days of the decision).
  final bool canAppeal;
  final DateTime? appealDeadline;
  final DisputeAppeal? appeal;

  /// `booking: {id, code}` on a Bolau booking dispute.
  final String? bookingId;
  final String? bookingCode;

  /// Employer / other party answered (or null).
  final DateTime? respondedAt;

  /// Decision taken (resolved or rejected).
  final DateTime? resolvedAt;

  /// Decided and not under appeal.
  bool get isClosed => const {'resolved', 'rejected', 'appeal_resolved'}.contains(status);

  /// Evidence may be added while the case is still being looked at.
  bool get canAddEvidence => const {'open', 'employer_responded', 'appealed'}.contains(status);

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
      evidenceCount: intOf(j['evidence_count']) ?? 0,
      canAppeal: boolOf(j['can_appeal']),
      appealDeadline: dateTimeOf(j['appeal_deadline']),
      appeal: DisputeAppeal.fromJson(j['appeal']),
      bookingId: str(asJsonOrNull(j['booking'])?['id']),
      bookingCode: str(asJsonOrNull(j['booking'])?['code']),
      respondedAt: dateTimeOf(j['responded_at']),
      resolvedAt: dateTimeOf(j['resolved_at']),
    );
  }
}

/// One row of a dispute's status timeline.
enum DisputeStepKind { raised, responded, decision, appealed, appealDecision }

class DisputeStep {
  const DisputeStep(this.kind, {required this.done, this.at});
  final DisputeStepKind kind;
  final bool done;
  final DateTime? at;
}

/// Raised → (responded) → decision → (appealed → appeal decision), from the
/// shared dispute payload. Optional rows only appear once they happened.
List<DisputeStep> disputeTimeline(Dispute d) {
  const decided = {'resolved', 'rejected', 'appealed', 'appeal_resolved'};
  final a = d.appeal;
  return [
    DisputeStep(DisputeStepKind.raised, done: true, at: d.raisedAt),
    if (d.respondedAt != null || d.status == 'employer_responded')
      DisputeStep(DisputeStepKind.responded, done: true, at: d.respondedAt),
    DisputeStep(DisputeStepKind.decision, done: d.resolvedAt != null || decided.contains(d.status), at: d.resolvedAt),
    if (a != null) ...[
      DisputeStep(DisputeStepKind.appealed, done: true, at: a.appealedAt),
      DisputeStep(
        DisputeStepKind.appealDecision,
        done: a.outcome != null || d.status == 'appeal_resolved',
        at: a.resolvedAt,
      ),
    ],
  ];
}

/// `appeal: {reason, party, appealed_at, outcome, outcome_label, resolution_note, resolved_at}`.
class DisputeAppeal {
  const DisputeAppeal({
    required this.reason,
    this.party,
    this.appealedAt,
    this.outcome,
    this.outcomeLabel,
    this.resolutionNote,
    this.resolvedAt,
  });

  final String reason;
  final String? party;
  final DateTime? appealedAt;

  /// upheld | overturned | null (still waiting)
  final String? outcome;
  final String? outcomeLabel;
  final String? resolutionNote;
  final DateTime? resolvedAt;

  static DisputeAppeal? fromJson(Object? v) {
    final j = asJsonOrNull(v);
    if (j == null) return null;
    return DisputeAppeal(
      reason: strOr(j['reason']),
      party: str(j['party']),
      appealedAt: dateTimeOf(j['appealed_at']),
      outcome: str(j['outcome']),
      outcomeLabel: str(j['outcome_label']),
      resolutionNote: str(j['resolution_note']),
      resolvedAt: dateTimeOf(j['resolved_at']),
    );
  }
}

/// `GET /me/disputes/{id}/evidence` item.
class DisputeEvidence {
  const DisputeEvidence({
    required this.id,
    required this.fileUrl,
    required this.fileType,
    required this.party,
    this.partyLabel,
    this.uploadedBy,
    this.note,
    this.createdAt,
  });

  final String id;

  /// Signed, short-lived (10 min) — re-fetch the list before opening if old.
  final String fileUrl;

  /// image | pdf
  final String fileType;

  /// worker | employer | ops
  final String party;
  final String? partyLabel;
  final String? uploadedBy;
  final String? note;
  final DateTime? createdAt;

  bool get isPdf => fileType == 'pdf';

  factory DisputeEvidence.fromJson(Json j) => DisputeEvidence(
    id: strOr(j['id']),
    fileUrl: strOr(j['file_url']),
    fileType: strOr(j['file_type'], 'image'),
    party: strOr(j['party'], 'worker'),
    partyLabel: str(j['party_label']),
    uploadedBy: str(asJsonOrNull(j['uploaded_by'])?['full_name']),
    note: str(j['note']),
    createdAt: dateTimeOf(j['created_at']),
  );
}

/// Evidence uploads are capped server-side at 10 MB (jpg/png/webp/pdf).
const evidenceMaxBytes = 10 * 1024 * 1024;

/// Multipart body for `POST /me/disputes/{id}/evidence`.
Future<FormData> evidenceForm(String path, {String? note}) async => FormData.fromMap({
  'file': await MultipartFile.fromFile(path),
  if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
});

/// A rating in `GET /me/ratings` (`received` = employers about me,
/// `given` = mine about employers). `rater` is a role, never a person.
class RatingItem {
  const RatingItem({
    required this.id,
    required this.rater,
    required this.scoreA,
    required this.scoreB,
    this.comment,
    this.commentStatus = 'visible',
    this.commentStatusLabel,
    this.voided = false,
    this.organization,
    this.employmentId,
    this.canFlag = false,
    this.createdAt,
  });

  final String id;

  /// employer | worker
  final String rater;

  /// employer→worker: reliability; worker→employer: pay on time.
  final int scoreA;

  /// employer→worker: skill; worker→employer: conditions.
  final int scoreB;

  /// null when hidden by moderation.
  final String? comment;

  /// visible | flagged | hidden
  final String commentStatus;
  final String? commentStatusLabel;
  final bool voided;
  final NamedRef? organization;
  final String? employmentId;
  final bool canFlag;
  final DateTime? createdAt;

  double get average => (scoreA + scoreB) / 2;

  RatingItem flagged() => RatingItem(
    id: id,
    rater: rater,
    scoreA: scoreA,
    scoreB: scoreB,
    comment: comment,
    commentStatus: 'flagged',
    voided: voided,
    organization: organization,
    employmentId: employmentId,
    createdAt: createdAt,
  );

  factory RatingItem.fromJson(Json j) => RatingItem(
    id: strOr(j['id']),
    rater: strOr(j['rater'], 'employer'),
    scoreA: (intOf(j['score_a']) ?? 0).clamp(0, 5),
    scoreB: (intOf(j['score_b']) ?? 0).clamp(0, 5),
    comment: str(j['comment']),
    commentStatus: strOr(j['comment_status'], 'visible'),
    commentStatusLabel: str(j['comment_status_label']),
    voided: boolOf(j['voided']),
    organization: NamedRef.fromJson(j['organization']),
    employmentId: str(j['employment_id']),
    canFlag: boolOf(j['can_flag']),
    createdAt: dateTimeOf(j['created_at']),
  );
}

/// Average of the counted (not voided) ratings, or null when none.
({double a, double b, int count})? ratingAverages(List<RatingItem> list) {
  final counted = list.where((r) => !r.voided && r.scoreA > 0).toList();
  if (counted.isEmpty) return null;
  final a = counted.fold<int>(0, (s, r) => s + r.scoreA) / counted.length;
  final b = counted.fold<int>(0, (s, r) => s + r.scoreB) / counted.length;
  return (a: a, b: b, count: counted.length);
}

class MyRatings {
  const MyRatings({this.received = const [], this.given = const []});
  final List<RatingItem> received;
  final List<RatingItem> given;

  factory MyRatings.fromJson(Json j) => MyRatings(
    received: asJsonList(j['received']).map(RatingItem.fromJson).toList(),
    given: asJsonList(j['given']).map(RatingItem.fromJson).toList(),
  );
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

  /// The Ghardhani's own booking disputes (`GET /me/booking-disputes`).
  Future<List<Dispute>> bookingDisputes({List<String> status = const []}) async {
    final data = await _api.get<dynamic>(
      DisputeParty.ghardhani.basePath,
      query: {'page_size': 100, if (status.isNotEmpty) 'status': status.join(',')},
    );
    return resultsOf(data).map(Dispute.fromJson).toList();
  }

  /// One of the Ghardhani's booking disputes (`GET /me/booking-disputes/{id}`).
  Future<Dispute> bookingDispute(String id) async =>
      Dispute.fromJson(asJson(await _api.get<dynamic>(DisputeParty.ghardhani.detail(id))));

  Future<List<DisputeEvidence>> evidence(String disputeId, {DisputeParty party = DisputeParty.worker}) async {
    final data = await _api.get<dynamic>(party.evidence(disputeId));
    return resultsOf(data).map(DisputeEvidence.fromJson).toList();
  }

  Future<DisputeEvidence> addEvidence(
    String disputeId, {
    required String path,
    String? note,
    DisputeParty party = DisputeParty.worker,
  }) async => DisputeEvidence.fromJson(
    asJson(await _api.post<dynamic>(party.evidence(disputeId), data: await evidenceForm(path, note: note))),
  );

  Future<Dispute> appeal(String disputeId, String reason, {DisputeParty party = DisputeParty.worker}) async =>
      Dispute.fromJson(asJson(await _api.post<dynamic>(party.appeal(disputeId), data: {'reason': reason.trim()})));

  Future<MyRatings> ratings() async => MyRatings.fromJson(asJson(await _api.get<dynamic>('/me/ratings')));

  Future<void> flagRating(String ratingId, String reason) =>
      _api.postNoContent('/me/ratings/$ratingId/flag', data: {'reason': reason.trim()});

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

/// One dispute from the list (the list is small and already cached by the
/// list screen; a missing id surfaces as not-found).
final disputeProvider = FutureProvider.autoDispose.family<Dispute, String>((ref, id) async {
  final all = await ref.watch(disputesProvider.future);
  final d = all.where((x) => x.id == id).firstOrNull;
  if (d == null) throw const ApiException(code: 'not_found', message: '', statusCode: 410);
  return d;
});

final disputeEvidenceProvider = FutureProvider.autoDispose.family<List<DisputeEvidence>, String>((ref, id) {
  _userId(ref);
  return ref.watch(trustRepositoryProvider).evidence(id);
});

/// The Ghardhani's booking disputes (Profile → My disputes).
final bookingDisputesProvider = FutureProvider.autoDispose<List<Dispute>>((ref) {
  _userId(ref);
  ref.watch(langCodeProvider);
  return ref.watch(trustRepositoryProvider).bookingDisputes();
});

/// One booking dispute as the Ghardhani sees it.
final bookingDisputeProvider = FutureProvider.autoDispose.family<Dispute, String>((ref, id) {
  _userId(ref);
  ref.watch(langCodeProvider);
  return ref.watch(trustRepositoryProvider).bookingDispute(id);
});

final bookingDisputeEvidenceProvider = FutureProvider.autoDispose.family<List<DisputeEvidence>, String>((ref, id) {
  _userId(ref);
  return ref.watch(trustRepositoryProvider).evidence(id, party: DisputeParty.ghardhani);
});

/// The detail / evidence providers for [party].
FutureProvider<Dispute> disputeDetailProvider(DisputeParty party, String id) =>
    party == DisputeParty.ghardhani ? bookingDisputeProvider(id) : disputeProvider(id);

FutureProvider<List<DisputeEvidence>> evidenceListProvider(DisputeParty party, String id) =>
    party == DisputeParty.ghardhani ? bookingDisputeEvidenceProvider(id) : disputeEvidenceProvider(id);

/// Drops the cached dispute (list + detail) for [party] after a change.
void invalidateDispute(WidgetRef ref, DisputeParty party, String id) {
  if (party == DisputeParty.ghardhani) {
    ref.invalidate(bookingDisputesProvider);
    ref.invalidate(bookingDisputeProvider(id));
  } else {
    ref.invalidate(disputesProvider);
  }
}

final myRatingsProvider = FutureProvider.autoDispose<MyRatings>((ref) {
  _userId(ref);
  ref.watch(langCodeProvider);
  return ref.watch(trustRepositoryProvider).ratings();
});
