import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/cached.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../../core/storage/prefs.dart';
import '../money/money_data.dart';

abstract final class MobilityKinds {
  static const travel = ['passport', 'labour_permit', 'visa'];
  static const clearance = [
    'police_clearance',
    'medical_fitness',
    'pre_departure_orientation',
    'insurance',
    'language_test',
  ];

  static String groupOf(String kind) => travel.contains(kind) ? 'travel' : 'clearance';
}

/// Warn this many days before a document expires (matches the server's
/// 60/30/7-day reminders).
const mobilityExpiryWarnDays = 60;

/// `GET /me/mobility/documents` item — TravelDocument or ClearanceDocument.
class MobilityDocument {
  const MobilityDocument({
    required this.id,
    required this.kindGroup,
    required this.kind,
    this.number,
    this.title,
    this.issuer,
    this.issuingCountry,
    this.issuedOn,
    this.issuedOnBs,
    this.expiresOn,
    this.expiresOnBs,
    this.scoreOrLevel,
    required this.status,
    this.statusLabel,
    this.note,
  });

  final String id;

  /// travel | clearance
  final String kindGroup;
  final String kind;

  /// Masked by the server (never shown in full to partners).
  final String? number;
  final String? title;
  final String? issuer;
  final String? issuingCountry;
  final String? issuedOn;
  final String? issuedOnBs;
  final String? expiresOn;
  final String? expiresOnBs;
  final String? scoreOrLevel;

  /// pending | verified | rejected | expired
  final String status;
  final String? statusLabel;
  final String? note;

  /// Days until expiry (negative = already expired); null without a date.
  int? daysToExpiry([DateTime? today]) {
    final e = parseIsoDate(expiresOn);
    if (e == null) return null;
    final t = today ?? nepalToday();
    return DateTime(e.year, e.month, e.day).difference(DateTime(t.year, t.month, t.day)).inDays;
  }

  bool isExpired([DateTime? today]) {
    final d = daysToExpiry(today);
    return status == 'expired' || (d != null && d < 0);
  }

  /// Expires within [mobilityExpiryWarnDays] (and not yet expired).
  bool expiresSoon([DateTime? today]) {
    final d = daysToExpiry(today);
    return !isExpired(today) && d != null && d <= mobilityExpiryWarnDays;
  }

  factory MobilityDocument.fromJson(Json j) {
    final kind = strOr(j['kind'], 'passport');
    return MobilityDocument(
      id: strOr(j['id']),
      kindGroup: strOr(j['kind_group'], MobilityKinds.groupOf(kind)),
      kind: kind,
      number: str(j['number_masked'] ?? j['number'] ?? j['reference_no_masked'] ?? j['reference_no']),
      title: str(j['title']),
      issuer: str(j['issuer']),
      issuingCountry: str(j['issuing_country']),
      issuedOn: str(j['issued_on']),
      issuedOnBs: str(j['issued_on_bs']),
      expiresOn: str(j['expires_on']),
      expiresOnBs: str(j['expires_on_bs']),
      scoreOrLevel: str(j['score_or_level']),
      status: strOr(j['status'], 'pending'),
      statusLabel: str(j['status_label']),
      note: str(j['note']),
    );
  }
}

/// Server `safety_guidance` = `{title_en, title_ne, en: [..], ne: [..], dofe_url}`.
class SafetyGuidance {
  const SafetyGuidance({this.titleEn, this.titleNe, this.en = const [], this.ne = const [], this.dofeUrl});
  final String? titleEn;
  final String? titleNe;
  final List<String> en;
  final List<String> ne;
  final String? dofeUrl;

  List<String> points(String lang) => lang == 'ne' && ne.isNotEmpty ? ne : en;
  String? title(String lang) => lang == 'ne' && (titleNe?.isNotEmpty ?? false) ? titleNe : titleEn;

  static SafetyGuidance? fromJson(Object? v) {
    final j = asJsonOrNull(v);
    if (j == null) return null;
    final g = SafetyGuidance(
      titleEn: str(j['title_en']),
      titleNe: str(j['title_ne']),
      en: strList(j['en']).where((s) => s.trim().isNotEmpty).toList(),
      ne: strList(j['ne']).where((s) => s.trim().isNotEmpty).toList(),
      dofeUrl: str(j['dofe_url']),
    );
    return g.en.isEmpty && g.ne.isEmpty ? null : g;
  }
}

/// Documents list + the server's safety guidance that comes with it.
class MobilityDocuments {
  const MobilityDocuments({this.items = const [], this.guidance});
  final List<MobilityDocument> items;
  final SafetyGuidance? guidance;

  factory MobilityDocuments.fromJson(Json j) => MobilityDocuments(
    items: resultsOf(j).map(MobilityDocument.fromJson).toList(),
    guidance: SafetyGuidance.fromJson(j['safety_guidance']),
  );
}

/// `GET /me/mobility/agencies` item — eligible (licensed, verified) agency.
class RecruitmentAgency {
  const RecruitmentAgency({
    required this.id,
    required this.name,
    this.licenseNo,
    this.licenseValidUntil,
    this.licenseValidUntilBs,
    this.address,
    this.phone,
  });

  final String id;
  final String name;
  final String? licenseNo;
  final String? licenseValidUntil;
  final String? licenseValidUntilBs;
  final String? address;
  final String? phone;

  factory RecruitmentAgency.fromJson(Json j) => RecruitmentAgency(
    id: strOr(j['id'] ?? j['partner_id']),
    name: strOr(j['name']),
    licenseNo: str(j['license_no'] ?? j['licence_no']),
    licenseValidUntil: str(j['license_valid_until']),
    licenseValidUntilBs: str(j['license_valid_until_bs']),
    address: str(j['address'] ?? asJsonOrNull(j['district'])?['name_en']),
    phone: str(j['phone'] ?? j['contact_phone']),
  );
}

/// Form values for a new document.
class MobilityDocInput {
  const MobilityDocInput({
    required this.kind,
    this.number,
    this.title,
    this.issuer,
    this.issuingCountry,
    this.issuedOn,
    this.expiresOn,
    this.scoreOrLevel,
    required this.documentPath,
  });

  final String kind;
  final String? number;
  final String? title;
  final String? issuer;
  final String? issuingCountry;
  final String? issuedOn;
  final String? expiresOn;
  final String? scoreOrLevel;
  final String documentPath;

  String get kindGroup => MobilityKinds.groupOf(kind);

  /// Multipart fields (without the file). Travel docs carry `number`;
  /// clearance docs carry `title`, `issuer`, `reference_no`, `score_or_level`.
  Map<String, String> fields() {
    String? t(String? s) => (s == null || s.trim().isEmpty) ? null : s.trim();
    final travel = kindGroup == 'travel';
    final m = <String, String?>{
      'kind_group': kindGroup,
      'kind': kind,
      if (travel) 'number': t(number) else 'reference_no': t(number),
      if (travel) 'issuing_country': t(issuingCountry),
      if (!travel) 'title': t(title),
      if (!travel) 'issuer': t(issuer),
      if (!travel) 'score_or_level': t(scoreOrLevel),
      'issued_on': issuedOn,
      'expires_on': expiresOn,
    };
    return {
      for (final e in m.entries)
        if (e.value != null) e.key: e.value!,
    };
  }
}

class MobilityRepository {
  MobilityRepository(this._api, this._prefs);
  final ApiClient _api;
  final Prefs _prefs;

  Future<Cached<MobilityDocuments>> documents() => cachedFetch(
    prefs: _prefs,
    key: 'me_mobility_documents',
    fetch: () async {
      final data = await _api.get<dynamic>('/me/mobility/documents', query: {'page_size': 100});
      return {'results': resultsOf(data), if (data is Map) 'safety_guidance': data['safety_guidance']};
    },
    parse: MobilityDocuments.fromJson,
  );

  Future<void> add(MobilityDocInput input) async {
    final form = FormData.fromMap({...input.fields(), 'document': await MultipartFile.fromFile(input.documentPath)});
    await _api.post<dynamic>('/me/mobility/documents', data: form);
  }

  Future<void> delete(String id) => _api.delete('/me/mobility/documents/$id');

  Future<List<RecruitmentAgency>> agencies() async {
    final data = await _api.get<dynamic>('/me/mobility/agencies', query: {'page_size': 100});
    return resultsOf(data).map(RecruitmentAgency.fromJson).toList();
  }

  /// `GET /me/mobility/shares` — the worker's recruitment grants.
  Future<List<ConsentGrant>> shares() async {
    final data = await _api.get<dynamic>('/me/mobility/shares', query: {'page_size': 100});
    return resultsOf(data).map(ConsentGrant.fromJson).toList();
  }

  /// Creates a recruitment ConsentGrant (passport.read + mobility.read).
  Future<void> share(String partnerId, int days) =>
      _api.postNoContent('/me/mobility/shares', data: {'partner_id': partnerId, 'days': days.clamp(1, 90)});
}

final mobilityRepositoryProvider = Provider<MobilityRepository>(
  (ref) => MobilityRepository(ref.watch(apiClientProvider), ref.watch(prefsProvider)),
);

String? _userId(Ref ref) => ref.watch(sessionProvider.select((s) => s.me?.id));

final mobilityDocumentsProvider = FutureProvider.autoDispose<Cached<MobilityDocuments>>((ref) {
  _userId(ref);
  return ref.watch(mobilityRepositoryProvider).documents();
});

final mobilityAgenciesProvider = FutureProvider.autoDispose<List<RecruitmentAgency>>((ref) {
  _userId(ref);
  return ref.watch(mobilityRepositoryProvider).agencies();
});

/// Recruitment shares (ConsentGrants); revoked via the existing
/// `/me/grants/{id}/revoke`.
final mobilitySharesProvider = FutureProvider.autoDispose<List<ConsentGrant>>((ref) {
  _userId(ref);
  return ref.watch(mobilityRepositoryProvider).shares();
});
