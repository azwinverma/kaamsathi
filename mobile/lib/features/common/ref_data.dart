import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/json.dart';
import '../../core/providers.dart';

/// `GET /ref/trades` item (seeded list in GLOSSARY).
class Trade {
  const Trade({required this.code, required this.nameEn, this.nameNe, this.category});
  final String code;
  final String nameEn;
  final String? nameNe;
  final String? category;

  String name(String lang) => lang == 'ne' && (nameNe?.isNotEmpty ?? false) ? nameNe! : nameEn;

  factory Trade.fromJson(Json j) => Trade(
    code: strOr(j['code']),
    nameEn: strOr(j['name_en'], strOr(j['code'])),
    nameNe: str(j['name_ne']),
    category: str(j['category']),
  );

  /// A trade field that may be a code string or `{code, name_en, name_ne}`.
  static Trade? fromAny(Object? v) {
    if (v == null) return null;
    if (v is Map) return Trade.fromJson(asJson(v));
    final s = '$v';
    return s.isEmpty ? null : Trade(code: s, nameEn: s);
  }
}

final tradesProvider = FutureProvider<List<Trade>>((ref) async {
  final data = await ref.watch(apiClientProvider).get<dynamic>('/ref/trades');
  return resultsOf(data).map(Trade.fromJson).toList();
});

/// `GET /ref/districts` item: `{code, name_en, name_ne, province}`.
class District {
  const District({required this.code, required this.nameEn, this.nameNe, this.province});
  final String code;
  final String nameEn;
  final String? nameNe;
  final int? province;

  String name(String lang) => lang == 'ne' && (nameNe?.isNotEmpty ?? false) ? nameNe! : nameEn;

  factory District.fromJson(Json j) {
    final p = j['province'];
    return District(
      code: strOr(j['code']),
      nameEn: strOr(j['name_en'], strOr(j['code'])),
      nameNe: str(j['name_ne']),
      province: p is Map ? intOf(p['id'] ?? p['number']) : intOf(p),
    );
  }

  /// A district field that may be a code string or a `{code, name_en, ...}` ref.
  static District? fromAny(Object? v) {
    if (v == null) return null;
    if (v is Map) return District.fromJson(asJson(v));
    final s = '$v';
    return s.isEmpty ? null : District(code: s, nameEn: s);
  }
}

/// All 77 districts (public, rarely changes — kept for the app session).
final districtsProvider = FutureProvider<List<District>>((ref) async {
  final data = await ref.watch(apiClientProvider).get<dynamic>('/ref/districts');
  return resultsOf(data).map(District.fromJson).toList();
});
