import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/cached.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/providers.dart';
import '../../../core/storage/prefs.dart';

/// A licensed partner (bank, insurer, ...). ECOSYSTEM §8.
class PartnerRef {
  const PartnerRef({
    required this.id,
    required this.name,
    this.kind,
    this.regulator,
    this.regulatorLabel,
    this.licenseNo,
  });
  final String id;
  final String name;

  /// bank | microfinance | insurer | wallet | training | recruitment_agency | government
  final String? kind;

  /// nrb | beema_samiti | dofe | ctevt | other
  final String? regulator;
  final String? regulatorLabel;
  final String? licenseNo;

  static PartnerRef fromJson(Json j) => PartnerRef(
    id: strOr(j['id']),
    name: strOr(j['name']),
    kind: str(j['kind']),
    regulator: str(j['regulator']),
    regulatorLabel: str(j['regulator_label']),
    licenseNo: str(j['license_no']),
  );

  /// Reads `partner` as an object, or falls back to flat `partner_*` keys.
  static PartnerRef of(Json j) {
    final p = asJsonOrNull(j['partner']);
    if (p != null) return PartnerRef.fromJson(p);
    return PartnerRef(
      id: strOr(j['partner_id'] ?? j['partner']),
      name: strOr(j['partner_name']),
      regulator: str(j['partner_regulator'] ?? j['regulator']),
      regulatorLabel: str(j['regulator_label']),
    );
  }
}

/// One month in the financial profile (verified = paid payslips).
class EarningMonth {
  const EarningMonth({
    required this.bsYear,
    required this.bsMonth,
    this.gross,
    this.net,
    this.employer,
    this.paid = false,
  });
  final int bsYear;
  final int bsMonth;
  final String? gross;
  final String? net;
  final String? employer;
  final bool paid;

  factory EarningMonth.fromJson(Json j) {
    final e = j['employer'];
    return EarningMonth(
      bsYear: intOf(j['bs_year']) ?? 0,
      bsMonth: intOf(j['bs_month']) ?? 0,
      gross: str(j['gross']),
      net: str(j['net']),
      employer: e is Map ? str(e['name']) : str(e),
      paid: boolOf(j['paid'], true),
    );
  }
}

/// `GET /me/financial-profile`.
class FinancialProfile {
  const FinancialProfile({
    this.monthsOnPlatform = 0,
    this.verifiedMonths = 0,
    this.avgMonthlyNet,
    this.minMonthlyNet,
    this.maxMonthlyNet,
    this.incomeStability,
    this.employersCount = 0,
    this.currentEmploymentMonths = 0,
    this.ssfMonths = 0,
    this.monthly = const [],
    this.computedAt,
  });

  final int monthsOnPlatform;
  final int verifiedMonths;
  final String? avgMonthlyNet;
  final String? minMonthlyNet;
  final String? maxMonthlyNet;

  /// 0–1 (1 − coefficient of variation).
  final double? incomeStability;
  final int employersCount;
  final int currentEmploymentMonths;
  final int ssfMonths;

  /// Oldest → newest.
  final List<EarningMonth> monthly;
  final DateTime? computedAt;

  bool get isEmpty => verifiedMonths == 0 && monthly.isEmpty;

  factory FinancialProfile.fromJson(Json j) {
    final months =
        asJsonList(j['monthly']).map(EarningMonth.fromJson).toList()
          ..sort((a, b) => a.bsYear != b.bsYear ? a.bsYear.compareTo(b.bsYear) : a.bsMonth.compareTo(b.bsMonth));
    return FinancialProfile(
      monthsOnPlatform: intOf(j['months_on_platform']) ?? 0,
      verifiedMonths: intOf(j['verified_months']) ?? 0,
      avgMonthlyNet: str(j['avg_monthly_net']),
      minMonthlyNet: str(j['min_monthly_net']),
      maxMonthlyNet: str(j['max_monthly_net']),
      incomeStability: numOf(j['income_stability'])?.toDouble().clamp(0, 1),
      employersCount: intOf(j['employers_count']) ?? 0,
      currentEmploymentMonths: intOf(j['current_employment_months']) ?? 0,
      ssfMonths: intOf(j['ssf_months']) ?? 0,
      monthly: months,
      computedAt: dateTimeOf(j['computed_at']),
    );
  }
}

/// `GET /me/offers` item (with eligibility).
class Offer {
  const Offer({
    required this.id,
    required this.partner,
    required this.kind,
    required this.title,
    this.titleNe,
    this.description,
    this.descriptionNe,
    this.openReferralId,
    this.minVerifiedMonths = 0,
    this.minAvgNet,
    this.maxAmount,
    this.interestNote,
    this.eligible = false,
    this.reasons = const [],
  });

  final String id;
  final PartnerRef partner;

  /// loan | ewa | insurance | savings | tool_finance | vehicle_finance
  final String kind;
  final String title;
  final String? titleNe;
  final String? description;
  final String? descriptionNe;

  /// Set when the worker already has an open application for this offer.
  final String? openReferralId;
  final int minVerifiedMonths;
  final String? minAvgNet;
  final String? maxAmount;

  /// Partner-stated; displayed verbatim.
  final String? interestNote;
  final bool eligible;
  final List<String> reasons;

  String displayTitle(String lang) => lang == 'ne' && (titleNe?.isNotEmpty ?? false) ? titleNe! : title;
  String? displayDescription(String lang) =>
      lang == 'ne' && (descriptionNe?.isNotEmpty ?? false) ? descriptionNe : description;
  bool get alreadyApplied => openReferralId != null;

  /// ConsentGrant purpose the server derives from the offer kind (display only).
  String get grantPurpose => switch (kind) {
    'ewa' => 'ewa',
    'insurance' => 'insurance',
    _ => 'loan_assessment',
  };

  /// Scopes the server grants when applying (ECOSYSTEM §9).
  static const applyScopes = ['earnings.read', 'profile.read'];

  factory Offer.fromJson(Json j) {
    final elig = j['eligibility'];
    final e = elig is Map ? asJson(elig) : j;
    return Offer(
      id: strOr(j['id']),
      partner: PartnerRef.of(j),
      kind: strOr(j['kind'], 'loan'),
      title: strOr(j['title']),
      titleNe: str(j['title_ne']),
      description: str(j['description']),
      descriptionNe: str(j['description_ne']),
      openReferralId: str(j['open_referral_id']),
      minVerifiedMonths: intOf(j['min_verified_months']) ?? 0,
      minAvgNet: str(j['min_avg_net']),
      maxAmount: str(j['max_amount']),
      interestNote: str(j['interest_note']),
      eligible: boolOf(e['eligible']),
      reasons: strList(e['reasons']),
    );
  }
}

/// `GET /me/referrals` item (finance referral to a partner).
class FinanceReferral {
  const FinanceReferral({
    required this.id,
    this.offerTitle,
    required this.partner,
    required this.status,
    this.amountRequested,
    this.amountApproved,
    this.partnerRef,
    this.createdAt,
  });

  final String id;
  final String? offerTitle;
  final PartnerRef partner;

  /// submitted | under_review | approved | rejected | disbursed | closed
  final String status;
  final String? amountRequested;
  final String? amountApproved;
  final String? partnerRef;
  final DateTime? createdAt;

  factory FinanceReferral.fromJson(Json j, {String lang = 'en'}) {
    final o = asJsonOrNull(j['offer']);
    final title = o == null ? str(j['offer_title']) : str(lang == 'ne' ? (o['title_ne'] ?? o['title']) : o['title']);
    return FinanceReferral(
      id: strOr(j['id']),
      offerTitle: title,
      partner: PartnerRef.of(j),
      status: strOr(j['status'], 'submitted'),
      amountRequested: str(j['amount_requested']),
      amountApproved: str(j['amount_approved']),
      partnerRef: str(j['partner_ref']),
      createdAt: dateTimeOf(j['created_at']),
    );
  }
}

/// `GET /me/grants` item.
class ConsentGrant {
  const ConsentGrant({
    required this.id,
    required this.partner,
    required this.purpose,
    this.scopes = const [],
    this.grantedAt,
    this.expiresAt,
    this.revokedAt,
  });

  final String id;
  final PartnerRef partner;
  final String purpose;
  final List<String> scopes;
  final DateTime? grantedAt;
  final DateTime? expiresAt;
  final DateTime? revokedAt;

  bool get isRevoked => revokedAt != null;
  bool isExpired([DateTime? now]) => expiresAt != null && expiresAt!.isBefore(now ?? DateTime.now());
  bool isActive([DateTime? now]) => !isRevoked && !isExpired(now);

  factory ConsentGrant.fromJson(Json j) => ConsentGrant(
    id: strOr(j['id']),
    partner: PartnerRef.of(j),
    purpose: strOr(j['purpose']),
    scopes: [
      for (final x in (j['scopes'] is List ? j['scopes'] as List : const <Object>[])) x is Map ? '${x['scope']}' : '$x',
    ],
    grantedAt: dateTimeOf(j['granted_at']),
    expiresAt: dateTimeOf(j['expires_at']),
    revokedAt: dateTimeOf(j['revoked_at']),
  );
}

/// `GET /me/partner-access` item.
class PartnerAccess {
  const PartnerAccess({required this.id, required this.partner, this.scope, this.endpoint, this.createdAt});
  final String id;
  final PartnerRef partner;
  final String? scope;
  final String? endpoint;
  final DateTime? createdAt;

  factory PartnerAccess.fromJson(Json j) => PartnerAccess(
    id: strOr(j['id']),
    partner: PartnerRef.of(j),
    scope: str(j['scope']),
    endpoint: str(j['endpoint']),
    createdAt: dateTimeOf(j['created_at']),
  );
}

class MoneyRepository {
  MoneyRepository(this._api, this._prefs);
  final ApiClient _api;
  final Prefs _prefs;

  Future<Cached<FinancialProfile>> financialProfile() => cachedFetch(
    prefs: _prefs,
    key: 'me_financial_profile',
    fetch: () => _api.get<Map<String, dynamic>>('/me/financial-profile'),
    parse: FinancialProfile.fromJson,
  );

  Future<List<Offer>> offers() async {
    final data = await _api.get<dynamic>('/me/offers', query: {'page_size': 100});
    final list = resultsOf(data).map(Offer.fromJson).toList();
    // Eligible first; keep server order otherwise.
    return [...list.where((o) => o.eligible), ...list.where((o) => !o.eligible)];
  }

  Future<List<PartnerRef>> partners() async {
    final data = await _api.get<dynamic>('/me/partners', query: {'page_size': 100});
    return resultsOf(data).map(PartnerRef.fromJson).toList();
  }

  Future<void> apply(String offerId, {String? amountRequested, String? purposeNote, int? days}) => _api.postNoContent(
    '/me/offers/$offerId/apply',
    data: {
      if (amountRequested != null && amountRequested.isNotEmpty) 'amount_requested': amountRequested,
      if (purposeNote != null && purposeNote.trim().isNotEmpty) 'purpose_note': purposeNote.trim(),
      if (days != null) 'days': days,
    },
  );

  Future<List<FinanceReferral>> referrals(String lang) async {
    final data = await _api.get<dynamic>('/me/referrals', query: {'page_size': 100});
    return resultsOf(data).map((j) => FinanceReferral.fromJson(j, lang: lang)).toList();
  }

  Future<List<ConsentGrant>> grants() async {
    final data = await _api.get<dynamic>('/me/grants', query: {'page_size': 100});
    return resultsOf(data).map(ConsentGrant.fromJson).toList();
  }

  Future<void> revokeGrant(String id) => _api.postNoContent('/me/grants/$id/revoke');

  Future<List<PartnerAccess>> partnerAccess() async {
    final data = await _api.get<dynamic>('/me/partner-access', query: {'page_size': 100});
    return resultsOf(data).map(PartnerAccess.fromJson).toList();
  }
}

final moneyRepositoryProvider = Provider<MoneyRepository>(
  (ref) => MoneyRepository(ref.watch(apiClientProvider), ref.watch(prefsProvider)),
);

String? _userId(Ref ref) => ref.watch(sessionProvider.select((s) => s.me?.id));

final financialProfileProvider = FutureProvider.autoDispose<Cached<FinancialProfile>>((ref) {
  _userId(ref);
  return ref.watch(moneyRepositoryProvider).financialProfile();
});

final offersProvider = FutureProvider.autoDispose<List<Offer>>((ref) {
  _userId(ref);
  ref.watch(langCodeProvider);
  return ref.watch(moneyRepositoryProvider).offers();
});

final partnersProvider = FutureProvider.autoDispose<List<PartnerRef>>((ref) {
  _userId(ref);
  return ref.watch(moneyRepositoryProvider).partners();
});

final financeReferralsProvider = FutureProvider.autoDispose<List<FinanceReferral>>((ref) {
  _userId(ref);
  return ref.watch(moneyRepositoryProvider).referrals(ref.watch(langCodeProvider));
});

final grantsProvider = FutureProvider.autoDispose<List<ConsentGrant>>((ref) {
  _userId(ref);
  return ref.watch(moneyRepositoryProvider).grants();
});

final partnerAccessProvider = FutureProvider.autoDispose<List<PartnerAccess>>((ref) {
  _userId(ref);
  return ref.watch(moneyRepositoryProvider).partnerAccess();
});

/// Offer by id from the loaded list (consent screen deep link).
final offerProvider = FutureProvider.autoDispose.family<Offer?, String>((ref, id) async {
  final all = await ref.watch(offersProvider.future);
  return all.where((o) => o.id == id).firstOrNull;
});
