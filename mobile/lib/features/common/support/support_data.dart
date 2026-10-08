import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/providers.dart';

abstract final class SupportCategory {
  static const all = ['payment', 'attendance', 'job', 'account', 'privacy', 'technical', 'other'];
}

/// Safety report kinds (`safety_kind`).
const safetyKinds = ['unsafe_workplace', 'harassment', 'payment_withholding', 'other'];

/// Body for a confidential safety report (`category: safety`).
Json safetyReportBody({
  required String kind,
  required String subject,
  required String description,
  required bool emergency,
  required bool anonymous,
}) => {
  'category': 'safety',
  'safety_kind': kind,
  'subject': subject,
  'description': description.trim(),
  'confidential': true,
  'emergency': emergency,
  'anonymous': anonymous,
  'channel': 'app',
};

/// `GET /me/support-cases` (worker) / `/org/support-cases` (org member) item.
class SupportCase {
  const SupportCase({
    required this.id,
    required this.number,
    required this.category,
    required this.subject,
    this.description = '',
    required this.status,
    this.statusLabel,
    this.priority,
    this.createdAt,
    this.updatedAt,
  });

  final String id;

  /// "KS-000123"
  final String number;
  final String category;
  final String subject;
  final String description;

  /// open | pending_user | resolved | closed
  final String status;
  final String? statusLabel;
  final String? priority;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  bool get isClosed => status == 'closed';

  factory SupportCase.fromJson(Json j) => SupportCase(
    id: strOr(j['id']),
    number: strOr(j['number']),
    category: strOr(j['category'], 'other'),
    subject: strOr(j['subject']),
    description: strOr(j['description']),
    status: strOr(j['status'], 'open'),
    statusLabel: str(j['status_label']),
    priority: str(j['priority']),
    createdAt: dateTimeOf(j['created_at']),
    updatedAt: dateTimeOf(j['updated_at'] ?? j['last_message_at']),
  );
}

/// `GET /…/support-cases/{id}/messages` item.
class CaseMessage {
  const CaseMessage({
    required this.id,
    required this.body,
    this.authorName,
    this.mine = false,
    this.fromStaff = false,
    this.internal = false,
    this.createdAt,
  });

  final String id;
  final String body;
  final String? authorName;

  /// Written by the signed-in user.
  final bool mine;

  /// Written by KaamSathi staff (shown as "KaamSathi team").
  final bool fromStaff;

  /// Staff-only note. Never shown in the app, even if a server sends one.
  final bool internal;
  final DateTime? createdAt;

  factory CaseMessage.fromJson(Json j, {String? meId}) {
    final author = asJsonOrNull(j['author']);
    final authorId = str(author?['id'] ?? j['author_id'] ?? (j['author'] is Map ? null : j['author']));
    final staffRaw = j['from_staff'] ?? j['is_staff'] ?? author?['is_staff'];
    final fromStaff = boolOf(staffRaw);
    final explicit = j['is_mine'] ?? j['mine'];
    final bool mine;
    if (explicit != null) {
      mine = boolOf(explicit);
    } else if (fromStaff) {
      mine = false;
    } else if (meId != null && authorId != null) {
      mine = authorId == meId;
    } else {
      // No author info: anything not from staff came from the requester side.
      mine = staffRaw != null;
    }
    return CaseMessage(
      id: strOr(j['id']),
      body: strOr(j['body']),
      authorName: str(author?['full_name'] ?? author?['name'] ?? j['author_name']),
      mine: mine,
      fromStaff: fromStaff,
      internal: boolOf(j['internal']),
      createdAt: dateTimeOf(j['created_at']),
    );
  }
}

/// Defense in depth: internal (staff-only) notes are dropped client-side too.
List<CaseMessage> visibleMessages(Iterable<CaseMessage> all) {
  final list = all.where((m) => !m.internal).toList();
  list.sort((a, b) => (a.createdAt ?? DateTime(0)).compareTo(b.createdAt ?? DateTime(0)));
  return list;
}

class SupportRepository {
  SupportRepository(this._api, this._base, this._meId);
  final ApiClient _api;

  /// `/me/support-cases` or `/org/support-cases`.
  final String _base;
  final String? _meId;

  Future<List<SupportCase>> cases() async {
    final data = await _api.get<dynamic>(_base, query: {'page_size': 100});
    final list = resultsOf(data).map(SupportCase.fromJson).toList();
    list.sort(
      (a, b) => (b.updatedAt ?? b.createdAt ?? DateTime(0)).compareTo(a.updatedAt ?? a.createdAt ?? DateTime(0)),
    );
    return list;
  }

  Future<SupportCase?> create({required String category, required String subject, required String description}) async {
    final data = await _api.post<dynamic>(
      _base,
      data: {'category': category, 'subject': subject.trim(), 'description': description.trim(), 'channel': 'app'},
    );
    final j = asJsonOrNull(data);
    return j == null || j['id'] == null ? null : SupportCase.fromJson(j);
  }

  /// Safety reports always go to the worker's own (`/me`) cases so the
  /// employer never sees them.
  Future<SupportCase?> reportSafety(Json body) async {
    final data = await _api.post<dynamic>('/me/support-cases', data: body);
    final j = asJsonOrNull(data);
    return j == null || j['id'] == null ? null : SupportCase.fromJson(j);
  }

  Future<List<CaseMessage>> messages(String caseId) async {
    final data = await _api.get<dynamic>('$_base/$caseId/messages', query: {'page_size': 200});
    return visibleMessages(resultsOf(data).map((j) => CaseMessage.fromJson(j, meId: _meId)));
  }

  Future<void> send(String caseId, String body) =>
      _api.postNoContent('$_base/$caseId/messages', data: {'body': body.trim()});
}

/// Worker mode talks to `/me/…`; supervisor mode to the org-scoped list.
final supportRepositoryProvider = Provider<SupportRepository>((ref) {
  final s = ref.watch(sessionProvider);
  final base = s.mode == AppMode.supervisor ? '/org/support-cases' : '/me/support-cases';
  return SupportRepository(ref.watch(apiClientProvider), base, s.me?.id);
});

final supportCasesProvider = FutureProvider.autoDispose<List<SupportCase>>((ref) {
  ref.watch(langCodeProvider);
  return ref.watch(supportRepositoryProvider).cases();
});

final caseMessagesProvider = FutureProvider.autoDispose.family<List<CaseMessage>, String>((ref, id) {
  return ref.watch(supportRepositoryProvider).messages(id);
});

/// One case from the loaded list (thread header).
final supportCaseProvider = FutureProvider.autoDispose.family<SupportCase?, String>((ref, id) async {
  final all = await ref.watch(supportCasesProvider.future);
  return all.where((c) => c.id == id).firstOrNull;
});
