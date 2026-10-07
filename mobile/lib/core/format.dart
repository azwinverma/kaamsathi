/// Nepal-specific formatting: money with lakh grouping, Devanagari numerals,
/// Bikram Sambat (B.S.) dates, phone numbers and times.
///
/// Every function takes a language code (`'en'` or `'ne'`). Pure Dart, no
/// Flutter imports, so it is cheap to unit test.
library;

import 'package:nepali_utils/nepali_utils.dart';

const _devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

bool _isNe(String lang) => lang == 'ne';

/// Replaces ASCII digits 0-9 with Devanagari digits ०-९.
String toDevanagariDigits(String input) {
  final b = StringBuffer();
  for (final unit in input.codeUnits) {
    if (unit >= 0x30 && unit <= 0x39) {
      b.write(_devanagariDigits[unit - 0x30]);
    } else {
      b.writeCharCode(unit);
    }
  }
  return b.toString();
}

/// Replaces Devanagari digits with ASCII digits (for parsing pasted input).
String toLatinDigits(String input) {
  final b = StringBuffer();
  for (final rune in input.runes) {
    final i = rune - 0x0966; // '०'
    if (i >= 0 && i <= 9) {
      b.write(i);
    } else {
      b.writeCharCode(rune);
    }
  }
  return b.toString();
}

/// Localises digits for [lang]: Devanagari for `ne`, untouched otherwise.
String localizeDigits(String input, String lang) =>
    _isNe(lang) ? toDevanagariDigits(input) : input;

/// Groups an unsigned integer string the South Asian way: `123456` →
/// `1,23,456`; `12345678` → `1,23,45,678`.
String groupLakh(String digits) {
  if (digits.length <= 3) return digits;
  final last3 = digits.substring(digits.length - 3);
  var rest = digits.substring(0, digits.length - 3);
  final parts = <String>[];
  while (rest.length > 2) {
    parts.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  if (rest.isNotEmpty) parts.insert(0, rest);
  return '${parts.join(',')},$last3';
}

/// Parses an API money value (decimal string like `"19550.00"`, or a num)
/// into paisa (1/100 rupee) to avoid floating point drift. Returns null when
/// the value is missing or unparsable.
int? parsePaisa(Object? value) {
  if (value == null) return null;
  if (value is int) return value * 100;
  if (value is double) return (value * 100).round();
  var s = toLatinDigits(value.toString()).trim().replaceAll(',', '');
  if (s.isEmpty) return null;
  var negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.substring(1);
  }
  final m = RegExp(r'^(\d*)(?:\.(\d*))?$').firstMatch(s);
  if (m == null) return null;
  final whole = int.tryParse(m.group(1)!.isEmpty ? '0' : m.group(1)!) ?? 0;
  var frac = m.group(2) ?? '';
  // Round half up on the third decimal, like the backend (ROUND_HALF_UP).
  var paisa = 0;
  if (frac.isNotEmpty) {
    frac = frac.padRight(3, '0');
    paisa = int.parse(frac.substring(0, 2));
    if (int.parse(frac[2]) >= 5) paisa += 1;
  }
  final total = whole * 100 + paisa;
  return negative ? -total : total;
}

/// Formats a money amount: `Rs. 1,23,456` (en) / `रु. १,२३,४५६` (ne).
/// Paisa are shown only when non-zero (`Rs. 1,234.50`).
String formatMoney(Object? amount, {String lang = 'en', bool symbol = true}) {
  final paisa = parsePaisa(amount) ?? 0;
  final negative = paisa < 0;
  final abs = paisa.abs();
  final whole = abs ~/ 100;
  final frac = abs % 100;
  var out = groupLakh(whole.toString());
  if (frac != 0) out = '$out.${frac.toString().padLeft(2, '0')}';
  out = localizeDigits(out, lang);
  if (symbol) out = '${_isNe(lang) ? 'रु.' : 'Rs.'} $out';
  return negative ? '-$out' : out;
}

/// Formats a plain number with lakh grouping and localized digits.
/// Decimals are kept only when non-zero (`2.5`, not `2.0`).
String formatNumber(num value, {String lang = 'en', int maxDecimals = 1}) {
  final negative = value < 0;
  final abs = value.abs();
  var s = abs.toStringAsFixed(maxDecimals);
  if (s.contains('.')) {
    s = s.replaceFirst(RegExp(r'0+$'), '');
    if (s.endsWith('.')) s = s.substring(0, s.length - 1);
  }
  final parts = s.split('.');
  var out = groupLakh(parts[0]);
  if (parts.length > 1) out = '$out.${parts[1]}';
  out = localizeDigits(out, lang);
  return negative ? '-$out' : out;
}

// ---------------------------------------------------------------------------
// Bikram Sambat
// ---------------------------------------------------------------------------

/// BS month names (index 1–12) — GLOSSARY.md.
const bsMonthsEn = [
  'Baishakh',
  'Jestha',
  'Asar',
  'Shrawan',
  'Bhadra',
  'Ashwin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
];
const bsMonthsNe = [
  'बैशाख',
  'जेठ',
  'असार',
  'साउन',
  'भदौ',
  'असोज',
  'कात्तिक',
  'मंसिर',
  'पुस',
  'माघ',
  'फागुन',
  'चैत',
];

const _adMonthsEn = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const _adMonthsNe = [
  'जनवरी',
  'फेब्रुअरी',
  'मार्च',
  'अप्रिल',
  'मे',
  'जुन',
  'जुलाई',
  'अगस्ट',
  'सेप्टेम्बर',
  'अक्टोबर',
  'नोभेम्बर',
  'डिसेम्बर',
];

/// Weekday short names, index 0 = Sunday (matches the API's `weekday`).
const weekdaysShortEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekdaysShortNe = ['आइत', 'सोम', 'मंगल', 'बुध', 'बिहि', 'शुक्र', 'शनि'];
const weekdaysLongEn = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const weekdaysLongNe = [
  'आइतबार',
  'सोमबार',
  'मंगलबार',
  'बुधबार',
  'बिहिबार',
  'शुक्रबार',
  'शनिबार',
];

String bsMonthName(int month, String lang) {
  if (month < 1 || month > 12) return '';
  return _isNe(lang) ? bsMonthsNe[month - 1] : bsMonthsEn[month - 1];
}

/// Weekday name for an AD date (Sunday = 0).
String weekdayName(DateTime ad, String lang, {bool short = false}) {
  final i = ad.weekday % 7;
  if (short) return _isNe(lang) ? weekdaysShortNe[i] : weekdaysShortEn[i];
  return _isNe(lang) ? weekdaysLongNe[i] : weekdaysLongEn[i];
}

/// A Bikram Sambat calendar date.
class BsDate implements Comparable<BsDate> {
  const BsDate(this.year, this.month, this.day);

  final int year;
  final int month;
  final int day;

  /// Parses `"2083-06-21"`. Returns null when malformed.
  static BsDate? tryParse(String? s) {
    if (s == null) return null;
    final m = RegExp(r'^(\d{4})-(\d{1,2})-(\d{1,2})').firstMatch(s.trim());
    if (m == null) return null;
    return BsDate(
      int.parse(m.group(1)!),
      int.parse(m.group(2)!),
      int.parse(m.group(3)!),
    );
  }

  /// Converts an AD calendar date (time ignored) to BS.
  factory BsDate.fromAd(DateTime ad) {
    // Use a UTC midnight so the conversion is independent of the device
    // time zone (nepali_utils shifts by +05:45 internally).
    final n = DateTime.utc(ad.year, ad.month, ad.day).toNepaliDateTime();
    return BsDate(n.year, n.month, n.day);
  }

  /// The AD calendar date (local midnight) for this BS date.
  DateTime toAd() {
    final d = NepaliDateTime(year, month, day).toDateTime();
    return DateTime(d.year, d.month, d.day);
  }

  /// Number of days in this BS month.
  int get daysInMonth => NepaliDateTime(year, month).totalDays;

  BsDate get firstOfMonth => BsDate(year, month, 1);

  BsDate addMonths(int delta) {
    var m = month - 1 + delta;
    final y = year + (m / 12).floor();
    m = m % 12;
    return BsDate(y, m + 1, 1);
  }

  /// `2083-06-21`
  String toIso() =>
      '${year.toString().padLeft(4, '0')}-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';

  @override
  int compareTo(BsDate other) {
    if (year != other.year) return year.compareTo(other.year);
    if (month != other.month) return month.compareTo(other.month);
    return day.compareTo(other.day);
  }

  @override
  bool operator ==(Object other) =>
      other is BsDate &&
      other.year == year &&
      other.month == month &&
      other.day == day;

  @override
  int get hashCode => Object.hash(year, month, day);

  @override
  String toString() => toIso();
}

/// `21 Ashwin 2083` / `२१ असोज २०८३`.
String formatBsDate(BsDate d, String lang) =>
    localizeDigits('${d.day} ${bsMonthName(d.month, lang)} ${d.year}', lang);

/// Formats an API `*_bs` string (`"2083-06-21"`). Falls back to the raw
/// string when unparsable.
String formatBsString(String? bs, String lang) {
  final d = BsDate.tryParse(bs);
  if (d == null) return bs ?? '';
  return formatBsDate(d, lang);
}

/// `Ashwin 2083` / `असोज २०८३`.
String formatBsMonthYear(int year, int month, String lang) =>
    localizeDigits('${bsMonthName(month, lang)} $year', lang);

/// `7 Oct 2026` / `७ अक्टोबर २०२६`.
String formatAdDate(DateTime d, String lang) {
  final months = _isNe(lang) ? _adMonthsNe : _adMonthsEn;
  return localizeDigits('${d.day} ${months[d.month - 1]} ${d.year}', lang);
}

/// AD ISO date `YYYY-MM-DD` as sent to the API.
String isoDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Parses an AD ISO date (`YYYY-MM-DD`, ignoring any time part) as a local
/// calendar date.
DateTime? parseIsoDate(String? s) {
  if (s == null || s.length < 10) return null;
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(s);
  if (m == null) return null;
  return DateTime(
    int.parse(m.group(1)!),
    int.parse(m.group(2)!),
    int.parse(m.group(3)!),
  );
}

/// Today's calendar date in Nepal (Asia/Kathmandu, UTC+05:45), regardless
/// of the device time zone.
DateTime nepalToday([DateTime? now]) {
  final t = (now ?? DateTime.now()).toUtc().add(
    const Duration(hours: 5, minutes: 45),
  );
  return DateTime(t.year, t.month, t.day);
}

/// `9:05 AM` / `९:०५ AM` (DESIGN.md: keep AM/PM in Nepali too).
String formatTime(DateTime t, String lang) {
  final local = t.isUtc
      ? t.add(const Duration(hours: 5, minutes: 45))
      : t; // API datetimes carry an offset; DateTime.parse yields UTC.
  final h12 = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final mm = local.minute.toString().padLeft(2, '0');
  final ampm = local.hour < 12 ? 'AM' : 'PM';
  return localizeDigits('$h12:$mm $ampm', lang);
}

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

final _mobileRe = RegExp(r'^9[78]\d{8}$');

/// Strips spaces, dashes, a leading `+977`/`977`/`0` and Devanagari digits.
String normalizePhone(String input) {
  var s = toLatinDigits(input).replaceAll(RegExp(r'[^\d+]'), '');
  if (s.startsWith('+977')) {
    s = s.substring(4);
  } else if (s.startsWith('977') && s.length == 13) {
    s = s.substring(3);
  }
  return s.replaceAll('+', '');
}

/// True for 10-digit Nepali mobile numbers starting with 97 or 98.
bool isValidNepaliMobile(String input) =>
    _mobileRe.hasMatch(normalizePhone(input));

/// `9812345678` → `+977 981-234-5678`. Unknown shapes are returned as-is.
String formatPhone(String? phone, {String lang = 'en'}) {
  if (phone == null) return '';
  final p = normalizePhone(phone);
  if (p.length != 10) return localizeDigits(phone, lang);
  return localizeDigits(
    '+977 ${p.substring(0, 3)}-${p.substring(3, 6)}-${p.substring(6)}',
    lang,
  );
}

/// Overtime minutes → hours text (`1.5`), localized digits.
String formatHours(num minutes, String lang) =>
    formatNumber(minutes / 60, lang: lang, maxDecimals: 1);

/// Initials for avatar placeholders: `Ram Bahadur Thapa` → `RT`.
String initials(String? name) {
  final parts = (name ?? '')
      .trim()
      .split(RegExp(r'\s+'))
      .where((p) => p.isNotEmpty)
      .toList();
  if (parts.isEmpty) return '?';
  String first(String s) => String.fromCharCode(s.runes.first);
  if (parts.length == 1) return first(parts.first).toUpperCase();
  return (first(parts.first) + first(parts.last)).toUpperCase();
}
