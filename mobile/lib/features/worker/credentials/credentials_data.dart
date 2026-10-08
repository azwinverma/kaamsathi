import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/cached.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/providers.dart';
import '../../../core/storage/prefs.dart';
import '../../common/ref_data.dart';

abstract final class CredentialKind {
  static const all = ['nstb', 'ctevt_training', 'training_course', 'license', 'safety', 'language', 'other'];
}

/// `GET /me/credentials` item.
class Credential {
  const Credential({
    required this.id,
    required this.kind,
    required this.title,
    this.issuer,
    this.certificateNo,
    this.level,
    this.issuedOn,
    this.issuedOnBs,
    this.expiresOn,
    this.expiresOnBs,
    required this.status,
    this.statusLabel,
    this.note,
    this.documentUrl,
    this.canResubmit = false,
    this.resubmissionOf,
  });

  final String id;
  final String kind;
  final String title;
  final String? issuer;
  final String? certificateNo;
  final String? level;
  final String? issuedOn;
  final String? issuedOnBs;
  final String? expiresOn;
  final String? expiresOnBs;

  /// pending | verified | rejected | expired
  final String status;
  final String? statusLabel;
  final String? note;
  final String? documentUrl;

  /// Rejected and not yet resubmitted (G012).
  final bool canResubmit;

  /// The rejected credential this one replaces.
  final ResubmissionRef? resubmissionOf;

  bool get canDelete => status == 'pending';

  factory Credential.fromJson(Json j) => Credential(
    id: strOr(j['id']),
    kind: strOr(j['kind'], 'other'),
    title: strOr(j['title']),
    issuer: str(j['issuer']),
    certificateNo: str(j['certificate_no']),
    level: str(j['level']),
    issuedOn: str(j['issued_on']),
    issuedOnBs: str(j['issued_on_bs']),
    expiresOn: str(j['expires_on']),
    expiresOnBs: str(j['expires_on_bs']),
    status: strOr(j['status'], 'pending'),
    statusLabel: str(j['status_label']),
    note: str(j['note']),
    documentUrl: str(j['document']),
    canResubmit: boolOf(j['can_resubmit']),
    resubmissionOf: ResubmissionRef.fromJson(j['resubmission_of']),
  );
}

/// `resubmission_of: {id, status, note, created_at}`.
class ResubmissionRef {
  const ResubmissionRef({required this.id, this.status, this.note, this.createdAt});
  final String id;
  final String? status;
  final String? note;
  final DateTime? createdAt;

  static ResubmissionRef? fromJson(Object? v) {
    final j = asJsonOrNull(v);
    if (j == null) return null;
    return ResubmissionRef(
      id: strOr(j['id']),
      status: str(j['status']),
      note: str(j['note']),
      createdAt: dateTimeOf(j['created_at']),
    );
  }
}

/// Fields for a credential create/resubmit. On resubmit, only fields that
/// changed are sent; the server copies the rest (and the document) from the
/// rejected original.
Map<String, Object> credentialFields({
  required String kind,
  required String title,
  required String issuer,
  String? certificateNo,
  String? level,
  String? issuedOn,
  String? expiresOn,
  Credential? original,
}) {
  final out = <String, Object>{};
  void put(String key, String? value, String? old) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return;
    if (original != null && v == (old ?? '').trim()) return;
    out[key] = v;
  }

  put('kind', kind, original?.kind);
  put('title', title, original?.title);
  put('issuer', issuer, original?.issuer);
  put('certificate_no', certificateNo, original?.certificateNo);
  put('level', level, original?.level);
  put('issued_on', issuedOn, original?.issuedOn);
  put('expires_on', expiresOn, original?.expiresOn);
  return out;
}

/// Verified-only passport payload (ECOSYSTEM §3), shared by public + share views.
class PassportPayload {
  const PassportPayload({
    required this.name,
    this.photoUrl,
    this.tradePrimary,
    this.districts = const [],
    this.verificationLevel = 0,
    this.reliabilityScore,
    this.identity = const {},
    this.skills = const [],
    this.credentials = const [],
    this.verifiedEmployers = 0,
    this.totalMonths = 0,
    this.completedJobs = 0,
    this.attendanceRate,
    this.isAvailable = false,
    this.expectedMonthlyWage,
    this.contactPhone,
    this.verifyUrl,
    this.generatedAt,
  });

  final String name;
  final String? photoUrl;
  final Trade? tradePrimary;
  final List<String> districts;
  final int verificationLevel;
  final int? reliabilityScore;

  /// citizenship / phone / address → verified?
  final Map<String, bool> identity;
  final List<({Trade trade, num years, String? nstbLevel})> skills;
  final List<Credential> credentials;
  final int verifiedEmployers;
  final num totalMonths;
  final int completedJobs;

  /// 0–1 (accepts 0–100 too).
  final double? attendanceRate;
  final bool isAvailable;
  final String? expectedMonthlyWage;
  final String? contactPhone;
  final String? verifyUrl;
  final DateTime? generatedAt;

  static String _district(Object? d, String lang) {
    if (d is Map) {
      final j = asJson(d);
      return strOr(lang == 'ne' ? (j['name_ne'] ?? j['name_en']) : j['name_en']);
    }
    return '$d';
  }

  factory PassportPayload.fromJson(Json j, {String lang = 'en'}) {
    final work = asJson(j['work']);
    final avail = asJson(j['availability']);
    final ident = <String, bool>{};
    asJson(j['identity']).forEach((k, v) => ident[k] = boolOf(v));
    var att = numOf(work['attendance_rate'])?.toDouble();
    if (att != null && att > 1) att = att / 100;
    return PassportPayload(
      name: strOr(j['name']),
      photoUrl: str(j['photo_url']),
      tradePrimary: Trade.fromAny(j['trade_primary']),
      districts:
          j['districts'] is List
              ? [for (final d in j['districts'] as List) _district(d, lang)]
              : [if (j['districts'] != null) _district(j['districts'], lang)],
      verificationLevel: intOf(j['verification_level']) ?? 0,
      reliabilityScore: intOf(j['reliability_score']),
      identity: ident,
      skills: [
        for (final s in asJsonList(j['skills']))
          if (Trade.fromAny(s['trade']) case final t?)
            (trade: t, years: numOf(s['years']) ?? numOf(s['years_experience']) ?? 0, nstbLevel: str(s['nstb_level'])),
      ],
      credentials: asJsonList(j['credentials']).map((c) => Credential.fromJson({...c, 'status': 'verified'})).toList(),
      verifiedEmployers: intOf(work['verified_employers']) ?? 0,
      totalMonths: numOf(work['total_months']) ?? 0,
      completedJobs: intOf(work['completed_jobs']) ?? 0,
      attendanceRate: att,
      isAvailable: boolOf(avail['is_available']),
      expectedMonthlyWage: str(avail['expected_monthly_wage']),
      contactPhone: str(asJsonOrNull(j['contact'])?['phone']),
      verifyUrl: str(j['verify_url']),
      generatedAt: dateTimeOf(j['generated_at']),
    );
  }
}

/// `GET /me/passport`.
///
/// Contract ambiguity: the response shape is not spelled out. We accept the
/// passport settings (`public_code`, `is_public`, `show_contact`) at the top
/// level and the payload either under `payload` or merged at the top level.
class Passport {
  const Passport({
    this.publicCode,
    this.isPublic = false,
    this.showContact = false,
    this.publicUrl,
    required this.payload,
  });

  final String? publicCode;
  final bool isPublic;
  final bool showContact;
  final String? publicUrl;
  final PassportPayload payload;

  Passport copyWith({bool? isPublic, bool? showContact}) => Passport(
    publicCode: publicCode,
    isPublic: isPublic ?? this.isPublic,
    showContact: showContact ?? this.showContact,
    publicUrl: publicUrl,
    payload: payload,
  );

  factory Passport.fromJson(Json j, {String lang = 'en'}) {
    final p = asJsonOrNull(j['payload']) ?? asJsonOrNull(j['passport']) ?? j;
    return Passport(
      publicCode: str(j['public_code']),
      isPublic: boolOf(j['is_public']),
      showContact: boolOf(j['show_contact']),
      publicUrl: str(j['public_url'] ?? j['url']) ?? str(p['verify_url']),
      payload: PassportPayload.fromJson(p, lang: lang),
    );
  }
}

abstract final class SharePurpose {
  static const all = ['job', 'recruitment_agency', 'bank', 'other'];
}

/// `GET /me/passport/shares` item.
class PassportShare {
  const PassportShare({
    required this.id,
    required this.audienceLabel,
    required this.purpose,
    this.expiresAt,
    this.includeContact = false,
    this.views = 0,
    this.revokedAt,
    this.createdAt,
    this.url,
  });

  final String id;
  final String audienceLabel;
  final String purpose;
  final DateTime? expiresAt;
  final bool includeContact;
  final int views;
  final DateTime? revokedAt;
  final DateTime? createdAt;
  final String? url;

  bool get isRevoked => revokedAt != null;
  bool isExpired([DateTime? now]) => expiresAt != null && expiresAt!.isBefore(now ?? DateTime.now());
  bool isActive([DateTime? now]) => !isRevoked && !isExpired(now);

  factory PassportShare.fromJson(Json j) => PassportShare(
    id: strOr(j['id']),
    audienceLabel: strOr(j['audience_label']),
    purpose: strOr(j['purpose'], 'other'),
    expiresAt: dateTimeOf(j['expires_at']),
    includeContact: boolOf(j['include_contact']),
    views: intOf(j['views']) ?? 0,
    revokedAt: dateTimeOf(j['revoked_at']),
    createdAt: dateTimeOf(j['created_at']),
    url: str(j['url']),
  );
}

class CredentialsRepository {
  CredentialsRepository(this._api, this._prefs);
  final ApiClient _api;
  final Prefs _prefs;

  Future<List<Credential>> credentials() async {
    final data = await _api.get<dynamic>('/me/credentials', query: {'page_size': 100});
    return resultsOf(data).map(Credential.fromJson).toList();
  }

  /// Multipart upload: fields + optional `document` image.
  Future<void> addCredential({
    required String kind,
    required String title,
    required String issuer,
    String? certificateNo,
    String? level,
    String? issuedOn,
    String? expiresOn,
    String? documentPath,
  }) async {
    final form = FormData.fromMap({
      'kind': kind,
      'title': title.trim(),
      'issuer': issuer.trim(),
      if (certificateNo?.trim().isNotEmpty ?? false) 'certificate_no': certificateNo!.trim(),
      if (level?.trim().isNotEmpty ?? false) 'level': level!.trim(),
      if (issuedOn != null) 'issued_on': issuedOn,
      if (expiresOn != null) 'expires_on': expiresOn,
      if (documentPath != null) 'document': await MultipartFile.fromFile(documentPath),
    });
    await _api.post<dynamic>('/me/credentials', data: form);
  }

  Future<void> deleteCredential(String id) => _api.delete('/me/credentials/$id');

  /// `POST /me/credentials/{id}/resubmit` (multipart; every field optional).
  Future<void> resubmit(String id, Map<String, Object> fields, {String? documentPath}) async {
    final form = FormData.fromMap({
      ...fields,
      if (documentPath != null) 'document': await MultipartFile.fromFile(documentPath),
    });
    await _api.post<dynamic>('/me/credentials/$id/resubmit', data: form);
  }

  Future<Cached<Passport>> passport(String lang) => cachedFetch(
    prefs: _prefs,
    key: 'me_passport',
    fetch: () => _api.get<Map<String, dynamic>>('/me/passport'),
    parse: (j) => Passport.fromJson(j, lang: lang),
  );

  Future<void> updatePassport({bool? isPublic, bool? showContact}) => _api.patch<dynamic>(
    '/me/passport',
    data: {if (isPublic != null) 'is_public': isPublic, if (showContact != null) 'show_contact': showContact},
  );

  Future<List<PassportShare>> shares() async {
    final data = await _api.get<dynamic>('/me/passport/shares', query: {'page_size': 100});
    return resultsOf(data).map(PassportShare.fromJson).toList();
  }

  Future<PassportShare> createShare({
    required String audienceLabel,
    required String purpose,
    required int days,
    required bool includeContact,
  }) async => PassportShare.fromJson(
    await _api.post<Map<String, dynamic>>(
      '/me/passport/shares',
      data: {
        'audience_label': audienceLabel.trim(),
        'purpose': purpose,
        'days': days,
        'include_contact': includeContact,
      },
    ),
  );

  Future<void> revokeShare(String id) => _api.postNoContent('/me/passport/shares/$id/revoke');

  static const passportPdfPath = '/me/passport.pdf';
}

final credentialsRepositoryProvider = Provider<CredentialsRepository>(
  (ref) => CredentialsRepository(ref.watch(apiClientProvider), ref.watch(prefsProvider)),
);

String? _userId(Ref ref) => ref.watch(sessionProvider.select((s) => s.me?.id));

final credentialsProvider = FutureProvider.autoDispose<List<Credential>>((ref) {
  _userId(ref);
  return ref.watch(credentialsRepositoryProvider).credentials();
});

final passportProvider = FutureProvider.autoDispose<Cached<Passport>>((ref) {
  _userId(ref);
  return ref.watch(credentialsRepositoryProvider).passport(ref.watch(langCodeProvider));
});

final passportSharesProvider = FutureProvider.autoDispose<List<PassportShare>>((ref) {
  _userId(ref);
  return ref.watch(credentialsRepositoryProvider).shares();
});
