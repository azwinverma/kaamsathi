import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/providers.dart';
import '../../common/ref_data.dart';

/// `GET /me/work-history` item — work done outside KaamSathi (EXTENSIONS §3).
class WorkHistoryEntry {
  const WorkHistoryEntry({
    required this.id,
    required this.employerName,
    required this.roleTitle,
    this.trade,
    this.district,
    this.startDate,
    this.startDateBs,
    this.endDate,
    this.endDateBs,
    this.description,
    this.referenceName,
    this.referencePhone,
    required this.status,
    this.statusLabel,
    this.verificationMethod,
    this.note,
    this.documentUrl,
    this.employerOnPlatform = false,
    this.editable,
  });

  final String id;
  final String employerName;
  final String roleTitle;
  final Trade? trade;
  final District? district;
  final String? startDate;
  final String? startDateBs;
  final String? endDate;
  final String? endDateBs;
  final String? description;
  final String? referenceName;
  final String? referencePhone;

  /// self_reported | reference_pending | verified | unverifiable | rejected
  final String status;
  final String? statusLabel;

  /// reference_call | document | employer_confirmed
  final String? verificationMethod;
  final String? note;
  final String? documentUrl;

  /// `employer_org` is set: the employer confirms it on KaamSathi.
  final bool employerOnPlatform;

  bool get isVerified => status == 'verified';

  /// The contract only allows PATCH/DELETE while not verified.
  bool get canEdit => editable ?? !isVerified;

  /// Server's `editable` flag, when sent.
  final bool? editable;

  factory WorkHistoryEntry.fromJson(Json j) {
    final org = j['employer_org'];
    return WorkHistoryEntry(
      id: strOr(j['id']),
      employerName: strOr(j['employer_name'] ?? (org is Map ? org['name'] : null)),
      roleTitle: strOr(j['role_title']),
      trade: Trade.fromAny(j['trade']),
      district: District.fromAny(j['district']),
      startDate: str(j['start_date']),
      startDateBs: str(j['start_date_bs']),
      endDate: str(j['end_date']),
      endDateBs: str(j['end_date_bs']),
      description: str(j['description']),
      referenceName: str(j['reference_name']),
      referencePhone: str(j['reference_phone'] ?? j['reference_phone_masked']),
      status: strOr(j['status'], 'self_reported'),
      statusLabel: str(j['status_label']),
      verificationMethod: str(j['verification_method']),
      note: str(j['note']),
      documentUrl: str(j['document_url'] ?? j['document']),
      employerOnPlatform: org != null && org != '',
      editable: j.containsKey('editable') ? boolOf(j['editable']) : null,
    );
  }
}

/// Form values for create / update.
class WorkHistoryInput {
  const WorkHistoryInput({
    required this.employerName,
    required this.roleTitle,
    this.tradeCode,
    this.districtCode,
    required this.startDate,
    this.endDate,
    this.description,
    this.referenceName,
    this.referencePhone,
    this.documentPath,
  });

  final String employerName;
  final String roleTitle;
  final String? tradeCode;
  final String? districtCode;
  final String startDate;
  final String? endDate;
  final String? description;
  final String? referenceName;
  final String? referencePhone;
  final String? documentPath;

  static String? _t(String? s) => (s == null || s.trim().isEmpty) ? null : s.trim();

  /// JSON body; nulls are sent so a PATCH can clear a field (e.g. end date).
  Json toJson() => {
    'employer_name': employerName.trim(),
    'role_title': roleTitle.trim(),
    'trade': tradeCode,
    'district': districtCode,
    'start_date': startDate,
    'end_date': endDate,
    'description': _t(description),
    'reference_name': _t(referenceName),
    'reference_phone': _t(referencePhone),
  };
}

class ExperienceRepository {
  ExperienceRepository(this._api);
  final ApiClient _api;

  Future<List<WorkHistoryEntry>> list() async {
    final data = await _api.get<dynamic>('/me/work-history', query: {'page_size': 100});
    final list = resultsOf(data).map(WorkHistoryEntry.fromJson).toList();
    list.sort((a, b) => (b.startDate ?? '').compareTo(a.startDate ?? ''));
    return list;
  }

  Future<Object> _body(WorkHistoryInput input) async {
    final json = input.toJson();
    final path = input.documentPath;
    if (path == null) return json;
    // Multipart can't carry null; omitted fields keep their stored value.
    return FormData.fromMap({
      for (final e in json.entries)
        if (e.value != null) e.key: e.value,
      'document': await MultipartFile.fromFile(path),
    });
  }

  Future<void> create(WorkHistoryInput input) async => _api.post<dynamic>('/me/work-history', data: await _body(input));

  Future<void> update(String id, WorkHistoryInput input) async =>
      _api.patch<dynamic>('/me/work-history/$id', data: await _body(input));

  Future<void> delete(String id) => _api.delete('/me/work-history/$id');
}

final experienceRepositoryProvider = Provider<ExperienceRepository>(
  (ref) => ExperienceRepository(ref.watch(apiClientProvider)),
);

final workHistoryProvider = FutureProvider.autoDispose<List<WorkHistoryEntry>>((ref) {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  ref.watch(langCodeProvider);
  return ref.watch(experienceRepositoryProvider).list();
});
