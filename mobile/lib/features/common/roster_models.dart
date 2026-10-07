import '../../core/api/json.dart';
import '../../core/format.dart';

/// `orgs.Shift` (`GET /org/shifts`, or embedded in roster entries).
class ShiftRef {
  const ShiftRef({required this.id, required this.name, this.startTime, this.endTime});
  final String id;
  final String name;
  final String? startTime;
  final String? endTime;

  /// `Morning · 7:00 AM – 3:00 PM`
  String label(String lang) {
    final times = startTime == null ? '' : '${formatClock(startTime, lang)} – ${formatClock(endTime, lang)}';
    return [name, times].where((s) => s.isNotEmpty).join(' · ');
  }

  /// Short code for grid cells: first letters of up to two words.
  String get short {
    final words = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '?';
    if (words.length == 1) return words.first.characters3;
    return words.take(2).map((w) => String.fromCharCode(w.runes.first)).join().toUpperCase();
  }

  static ShiftRef? fromJson(Object? v) {
    final j = asJsonOrNull(v);
    if (j == null) return null;
    return ShiftRef(
      id: strOr(j['id']),
      name: strOr(j['name']),
      startTime: str(j['start_time']),
      endTime: str(j['end_time']),
    );
  }
}

extension on String {
  /// First up to 3 user-perceived chars (good enough for Latin + Devanagari).
  String get characters3 {
    final r = runes.toList();
    return String.fromCharCodes(r.take(3));
  }
}

/// Sunday-start week helpers.
List<DateTime> weekDays(DateTime weekStart) => [for (var i = 0; i < 7; i++) weekStart.add(Duration(days: i))];
