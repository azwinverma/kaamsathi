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
