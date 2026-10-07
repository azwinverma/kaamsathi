import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../common/ref_data.dart';

/// WorkerCard + `{is_available, current_employer}` (ECOSYSTEM §2).
class CrewMember {
  const CrewMember({
    required this.id,
    required this.fullName,
    this.phoneMasked,
    this.photo,
    this.verificationStatus = 'unverified',
    this.trades = const [],
    this.isAvailable = false,
    this.currentEmployer,
  });

  final String id;
  final String fullName;
  final String? phoneMasked;
  final String? photo;
  final String verificationStatus;
  final List<({Trade trade, int years})> trades;
  final bool isAvailable;
  final String? currentEmployer;

  factory CrewMember.fromJson(Json j) {
    final emp = j['current_employer'];
    return CrewMember(
      id: strOr(j['id']),
      fullName: strOr(j['full_name']),
      phoneMasked: str(j['phone_masked']) ?? (j['phone'] == null ? null : maskPhone(str(j['phone']))),
      photo: str(j['photo']),
      verificationStatus: strOr(j['verification_status'], 'unverified'),
      trades: [
        for (final s in asJsonList(j['skills']))
          if (Trade.fromAny(s['trade']) case final t?) (trade: t, years: intOf(s['years_experience']) ?? 0),
      ],
      isAvailable: boolOf(j['is_available']),
      currentEmployer: emp is Map ? str(emp['name']) : str(emp),
    );
  }
}

class CrewStats {
  const CrewStats({this.members = 0, this.placed90d = 0, this.earnedTotal = '0', this.pendingTotal = '0'});
  final int members;
  final int placed90d;
  final String earnedTotal;
  final String pendingTotal;

  factory CrewStats.fromJson(Json j) => CrewStats(
    members: intOf(j['members']) ?? 0,
    placed90d: intOf(j['placed_90d']) ?? 0,
    earnedTotal: strOr(j['earned_total'], '0'),
    pendingTotal: strOr(j['pending_total'], '0'),
  );
}

/// `GET /me/crew`.
class Crew {
  const Crew({required this.id, required this.name, this.members = const [], this.stats = const CrewStats()});
  final String id;
  final String name;
  final List<CrewMember> members;
  final CrewStats stats;

  factory Crew.fromJson(Json j) => Crew(
    id: strOr(j['id']),
    name: strOr(j['name']),
    members: asJsonList(j['members']).map(CrewMember.fromJson).toList(),
    stats: CrewStats.fromJson(asJson(j['stats'])),
  );
}

/// `GET /me/crew/referrals` item (naike referral reward).
class CrewReferral {
  const CrewReferral({
    required this.id,
    required this.workerName,
    this.organizationName,
    required this.amount,
    required this.status,
    this.eligibleAt,
    this.paidAt,
    this.createdAt,
    this.voidReason,
  });

  final String id;
  final String workerName;
  final String? organizationName;
  final String amount;

  /// pending | eligible | paid | void
  final String status;
  final DateTime? eligibleAt;
  final DateTime? paidAt;
  final DateTime? createdAt;
  final String? voidReason;

  factory CrewReferral.fromJson(Json j) {
    final w = asJsonOrNull(j['worker']);
    final app = asJsonOrNull(j['application']);
    final job = asJsonOrNull(app?['job'] ?? j['job']);
    final org = asJsonOrNull(j['organization'] ?? job?['organization']);
    return CrewReferral(
      id: strOr(j['id']),
      workerName: strOr(w?['full_name'] ?? j['worker_name']),
      organizationName: str(org?['name'] ?? j['organization_name']),
      amount: strOr(j['amount'], '0'),
      status: strOr(j['status'], 'pending'),
      eligibleAt: dateTimeOf(j['eligible_at']),
      paidAt: dateTimeOf(j['paid_at']),
      createdAt: dateTimeOf(j['created_at']),
      voidReason: str(j['void_reason']),
    );
  }
}

class CrewRepository {
  CrewRepository(this._api);
  final ApiClient _api;

  /// The crew this worker leads, or null when they don't lead one (404).
  Future<Crew?> crew() async {
    try {
      return Crew.fromJson(await _api.get<Map<String, dynamic>>('/me/crew'));
    } on ApiException catch (e) {
      if (e.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<void> create(String name) => _api.postNoContent('/me/crew', data: {'name': name.trim()});

  Future<void> addMember({required String phone, required String fullName, required String trade, int? years}) =>
      _api.postNoContent(
        '/me/crew/members',
        data: {
          'phone': normalizePhone(phone),
          'full_name': fullName.trim(),
          'trade': trade,
          if (years != null) 'years_experience': years,
        },
      );

  Future<void> removeMember(String workerId) => _api.delete('/me/crew/members/$workerId');

  Future<List<CrewReferral>> referrals() async {
    final data = await _api.get<dynamic>('/me/crew/referrals', query: {'page_size': 100});
    return resultsOf(data).map(CrewReferral.fromJson).toList();
  }
}

final crewRepositoryProvider = Provider<CrewRepository>((ref) => CrewRepository(ref.watch(apiClientProvider)));

final crewProvider = FutureProvider.autoDispose<Crew?>((ref) {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  return ref.watch(crewRepositoryProvider).crew();
});

final crewReferralsProvider = FutureProvider.autoDispose<List<CrewReferral>>((ref) {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  return ref.watch(crewRepositoryProvider).referrals();
});
