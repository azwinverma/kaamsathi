import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/providers.dart';

abstract final class PrivacyKind {
  static const export = 'export';
  static const correction = 'correction';
  static const deletion = 'deletion';
}

/// `GET /me/privacy-requests` item.
class PrivacyRequest {
  const PrivacyRequest({
    required this.id,
    required this.kind,
    required this.status,
    this.details,
    this.responseNote,
    this.hasFile = false,
    this.fileExpiresAt,
    this.createdAt,
    this.completedAt,
  });

  final String id;

  /// export | correction | deletion
  final String kind;

  /// received | in_progress | completed | rejected
  final String status;
  final String? details;
  final String? responseNote;
  final bool hasFile;
  final DateTime? fileExpiresAt;
  final DateTime? createdAt;
  final DateTime? completedAt;

  /// Export ready and the link has not expired.
  bool canDownload([DateTime? now]) =>
      kind == PrivacyKind.export &&
      status == 'completed' &&
      hasFile &&
      (fileExpiresAt == null || fileExpiresAt!.isAfter(now ?? DateTime.now()));

  bool downloadExpired([DateTime? now]) =>
      kind == PrivacyKind.export &&
      status == 'completed' &&
      fileExpiresAt != null &&
      !fileExpiresAt!.isAfter(now ?? DateTime.now());

  factory PrivacyRequest.fromJson(Json j) {
    final file = j['file'] ?? j['download_url'];
    final expires = dateTimeOf(j['file_expires_at']);
    return PrivacyRequest(
      id: strOr(j['id']),
      kind: strOr(j['kind']),
      status: strOr(j['status'], 'received'),
      details: str(j['details']),
      responseNote: str(j['response_note']),
      // The file URL may be hidden from the worker; an expiry implies a file.
      hasFile:
          j.containsKey('file_available')
              ? boolOf(j['file_available'])
              : (file != null && file != false && '$file'.isNotEmpty) || expires != null,
      fileExpiresAt: expires,
      createdAt: dateTimeOf(j['created_at']),
      completedAt: dateTimeOf(j['completed_at']),
    );
  }
}

/// File extension for a download's `Content-Type` (export bundles are
/// JSON + PDF, typically zipped).
String extensionForContentType(String? contentType) {
  final ct = (contentType ?? '').toLowerCase();
  if (ct.contains('pdf')) return 'pdf';
  if (ct.contains('json')) return 'json';
  if (ct.contains('zip')) return 'zip';
  return 'zip';
}

class PrivacyRepository {
  PrivacyRepository(this._api);
  final ApiClient _api;

  Future<List<PrivacyRequest>> requests() async {
    final data = await _api.get<dynamic>('/me/privacy-requests', query: {'page_size': 100});
    final list = resultsOf(data).map(PrivacyRequest.fromJson).toList();
    list.sort((a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0)));
    return list;
  }

  Future<void> create(String kind, {String? details}) => _api.postNoContent(
    '/me/privacy-requests',
    data: {'kind': kind, if (details != null && details.trim().isNotEmpty) 'details': details.trim()},
  );

  /// Downloads the export into the app's documents folder; returns the path.
  Future<String> download(String id) async {
    final dir = await getApplicationDocumentsDirectory();
    final tmp = '${dir.path}${Platform.pathSeparator}kaamsathi-my-data-$id.part';
    final ct = await _api.downloadFile('/me/privacy-requests/$id/download', tmp);
    final path = '${dir.path}${Platform.pathSeparator}kaamsathi-my-data-$id.${extensionForContentType(ct)}';
    await File(tmp).rename(path);
    return path;
  }
}

final privacyRepositoryProvider = Provider<PrivacyRepository>((ref) => PrivacyRepository(ref.watch(apiClientProvider)));

final privacyRequestsProvider = FutureProvider.autoDispose<List<PrivacyRequest>>((ref) {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  return ref.watch(privacyRepositoryProvider).requests();
});
