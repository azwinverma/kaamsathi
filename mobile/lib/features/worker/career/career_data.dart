import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/cached.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/providers.dart';
import '../../../core/storage/prefs.dart';
import '../../common/ref_data.dart';

/// One `GET /me/career` recommendation (EXTENSIONS §5).
class CareerRecommendation {
  const CareerRecommendation({
    required this.kind,
    required this.title,
    this.titleNe,
    this.reason = '',
    this.reasonNe,
    this.expectedUpliftPct,
    this.courseId,
    this.link,
  });

  /// credential | course | skill | profile
  final String kind;
  final String title;
  final String? titleNe;
  final String reason;
  final String? reasonNe;
  final num? expectedUpliftPct;
  final String? courseId;
  final String? link;

  String titleFor(String lang) => lang == 'ne' && (titleNe?.isNotEmpty ?? false) ? titleNe! : title;
  String reasonFor(String lang) => lang == 'ne' && (reasonNe?.isNotEmpty ?? false) ? reasonNe! : reason;

  factory CareerRecommendation.fromJson(Json j) => CareerRecommendation(
    kind: strOr(j['kind'], 'profile'),
    title: strOr(j['title']),
    titleNe: str(j['title_ne']),
    reason: strOr(j['reason']),
    reasonNe: str(j['reason_ne']),
    expectedUpliftPct: numOf(j['expected_uplift_pct']),
    courseId: str(j['course_id']),
    link: str(j['link']),
  );
}

class CareerSummary {
  const CareerSummary({this.trades = const [], this.recommendations = const []});
  final List<Trade> trades;
  final List<CareerRecommendation> recommendations;

  factory CareerSummary.fromJson(Json j) => CareerSummary(
    trades: [
      for (final t in (j['trades'] is List ? j['trades'] as List : const <Object>[]))
        if (Trade.fromAny(t is Map && t['trade'] != null ? t['trade'] : t) case final x?) x,
    ],
    recommendations: _byUplift(
      asJsonList(j['recommendations']).map(CareerRecommendation.fromJson).where((r) => r.title.isNotEmpty).toList(),
    ),
  );

  /// Biggest pay uplift first; ties (and those without an estimate) keep the
  /// server's order.
  static List<CareerRecommendation> _byUplift(List<CareerRecommendation> list) {
    final indexed = [for (var i = 0; i < list.length; i++) (i, list[i])];
    indexed.sort((a, b) {
      final c = (b.$2.expectedUpliftPct ?? -1).compareTo(a.$2.expectedUpliftPct ?? -1);
      return c != 0 ? c : a.$1.compareTo(b.$1);
    });
    return [for (final e in indexed) e.$2];
  }
}

class CareerRepository {
  CareerRepository(this._api, this._prefs);
  final ApiClient _api;
  final Prefs _prefs;

  Future<Cached<CareerSummary>> career() => cachedFetch(
    prefs: _prefs,
    key: 'me_career',
    fetch: () => _api.get<Map<String, dynamic>>('/me/career'),
    parse: CareerSummary.fromJson,
  );
}

final careerRepositoryProvider = Provider<CareerRepository>(
  (ref) => CareerRepository(ref.watch(apiClientProvider), ref.watch(prefsProvider)),
);

final careerProvider = FutureProvider.autoDispose<Cached<CareerSummary>>((ref) {
  ref.watch(sessionProvider.select((s) => s.me?.id));
  ref.watch(langCodeProvider);
  return ref.watch(careerRepositoryProvider).career();
});
