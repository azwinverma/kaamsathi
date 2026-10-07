import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/format.dart';

void main() {
  group('digits', () {
    test('toDevanagariDigits / toLatinDigits round-trip', () {
      expect(toDevanagariDigits('Rs. 1,23,456.07'), 'Rs. १,२३,४५६.०७');
      expect(toLatinDigits('९८०००००००१'), '9800000001');
      expect(localizeDigits('2083', 'en'), '2083');
      expect(localizeDigits('2083', 'ne'), '२०८३');
    });
  });

  group('groupLakh', () {
    test('groups the South Asian way', () {
      expect(groupLakh('0'), '0');
      expect(groupLakh('999'), '999');
      expect(groupLakh('1000'), '1,000');
      expect(groupLakh('19550'), '19,550');
      expect(groupLakh('123456'), '1,23,456');
      expect(groupLakh('1234567'), '12,34,567');
      expect(groupLakh('123456789'), '12,34,56,789');
    });
  });

  group('money', () {
    test('parsePaisa handles API decimal strings', () {
      expect(parsePaisa('19550.00'), 1955000);
      expect(parsePaisa('0.5'), 50);
      expect(parsePaisa('12.345'), 1235); // half-up
      expect(parsePaisa('-200.10'), -20010);
      expect(parsePaisa(1500), 150000);
      expect(parsePaisa(null), isNull);
      expect(parsePaisa('abc'), isNull);
    });

    test('formatMoney en', () {
      expect(formatMoney('123456.00'), 'Rs. 1,23,456');
      expect(formatMoney('19550.00'), 'Rs. 19,550');
      expect(formatMoney('1234.50'), 'Rs. 1,234.50');
      expect(formatMoney('0.00'), 'Rs. 0');
      expect(formatMoney('-2150.00'), '-Rs. 2,150');
      expect(formatMoney('5000', symbol: false), '5,000');
    });

    test('formatMoney ne uses रु. and Devanagari numerals', () {
      expect(formatMoney('123456.00', lang: 'ne'), 'रु. १,२३,४५६');
      expect(formatMoney('1234.50', lang: 'ne'), 'रु. १,२३४.५०');
    });

    test('formatNumber trims zero decimals', () {
      expect(formatNumber(2.0), '2');
      expect(formatNumber(2.5), '2.5');
      expect(formatNumber(123456), '1,23,456');
      expect(formatNumber(1.5, lang: 'ne'), '१.५');
    });

    test('formatHours from minutes', () {
      expect(formatHours(90, 'en'), '1.5');
      expect(formatHours(0, 'en'), '0');
      expect(formatHours(120, 'ne'), '२');
    });
  });

  group('BS dates', () {
    test('month names follow GLOSSARY', () {
      expect(bsMonthName(1, 'en'), 'Baishakh');
      expect(bsMonthName(6, 'en'), 'Ashwin');
      expect(bsMonthName(6, 'ne'), 'असोज');
      expect(bsMonthName(12, 'ne'), 'चैत');
      expect(bsMonthName(13, 'en'), '');
    });

    test('AD → BS matches the contract example (7 Oct 2026 = 21 Ashwin 2083)', () {
      final bs = BsDate.fromAd(DateTime(2026, 10, 7));
      expect(bs, const BsDate(2083, 6, 21));
      expect(formatBsDate(bs, 'en'), '21 Ashwin 2083');
      expect(formatBsDate(bs, 'ne'), '२१ असोज २०८३');
    });

    test('BS → AD round trip', () {
      const bs = BsDate(2083, 6, 21);
      expect(bs.toAd(), DateTime(2026, 10, 7));
      expect(BsDate.fromAd(const BsDate(2083, 1, 1).toAd()), const BsDate(2083, 1, 1));
    });

    test('parse and format API *_bs strings', () {
      expect(BsDate.tryParse('2083-06-21'), const BsDate(2083, 6, 21));
      expect(BsDate.tryParse('bad'), isNull);
      expect(formatBsString('2083-06-21', 'en'), '21 Ashwin 2083');
      expect(formatBsString('oops', 'en'), 'oops');
      expect(const BsDate(2083, 6, 1).toIso(), '2083-06-01');
    });

    test('addMonths wraps years', () {
      expect(const BsDate(2083, 12, 5).addMonths(1), const BsDate(2084, 1, 1));
      expect(const BsDate(2083, 1, 5).addMonths(-1), const BsDate(2082, 12, 1));
      expect(const BsDate(2083, 6, 5).addMonths(-13), const BsDate(2082, 5, 1));
    });

    test('formatBsMonthYear and formatAdDate', () {
      expect(formatBsMonthYear(2083, 6, 'en'), 'Ashwin 2083');
      expect(formatBsMonthYear(2083, 6, 'ne'), 'असोज २०८३');
      expect(formatAdDate(DateTime(2026, 10, 7), 'en'), '7 Oct 2026');
      expect(formatAdDate(DateTime(2026, 10, 7), 'ne'), '७ अक्टोबर २०२६');
    });

    test('nepalToday uses UTC+05:45 regardless of device zone', () {
      // 2026-10-06 18:30 UTC is already 7 Oct 00:15 in Kathmandu.
      expect(nepalToday(DateTime.utc(2026, 10, 6, 18, 30)), DateTime(2026, 10, 7));
      expect(nepalToday(DateTime.utc(2026, 10, 6, 18, 0)), DateTime(2026, 10, 6));
    });

    test('isoDate / parseIsoDate', () {
      expect(isoDate(DateTime(2026, 1, 5)), '2026-01-05');
      expect(parseIsoDate('2026-10-07'), DateTime(2026, 10, 7));
      expect(parseIsoDate('2026-10-07T10:00:00+05:45'), DateTime(2026, 10, 7));
      expect(parseIsoDate(null), isNull);
    });

    test('weekday names (Sunday = 0)', () {
      expect(weekdayName(DateTime(2026, 10, 7), 'en'), 'Wednesday');
      expect(weekdayName(DateTime(2026, 10, 7), 'ne', short: true), 'बुध');
    });
  });

  group('time', () {
    test('formatTime converts API UTC instants to Nepal time', () {
      final t = DateTime.parse('2026-10-07T09:05:00+05:45');
      expect(formatTime(t, 'en'), '9:05 AM');
      expect(formatTime(t, 'ne'), '९:०५ AM');
      expect(formatTime(DateTime(2026, 10, 7, 17, 30), 'en'), '5:30 PM');
      expect(formatTime(DateTime(2026, 10, 7, 0, 0), 'en'), '12:00 AM');
    });
  });

  group('phone', () {
    test('validation accepts 97/98 ten-digit numbers only', () {
      expect(isValidNepaliMobile('9800000001'), isTrue);
      expect(isValidNepaliMobile('9712345678'), isTrue);
      expect(isValidNepaliMobile('+977 980-000-0001'), isTrue);
      expect(isValidNepaliMobile('९८०००००००१'), isTrue);
      expect(isValidNepaliMobile('9612345678'), isFalse);
      expect(isValidNepaliMobile('980000000'), isFalse);
      expect(isValidNepaliMobile('98000000012'), isFalse);
      expect(isValidNepaliMobile(''), isFalse);
    });

    test('formatPhone', () {
      expect(formatPhone('9812345678'), '+977 981-234-5678');
      expect(formatPhone('9812345678', lang: 'ne'), '+९७७ ९८१-२३४-५६७८');
      expect(formatPhone('12345'), '12345');
      expect(formatPhone(null), '');
    });

    test('normalizePhone strips prefixes', () {
      expect(normalizePhone('+977-9812345678'), '9812345678');
      expect(normalizePhone('9779812345678'), '9812345678');
      expect(normalizePhone(' 981 234 5678 '), '9812345678');
    });
  });

  test('initials', () {
    expect(initials('Ram Bahadur Thapa'), 'RT');
    expect(initials('sita'), 'S');
    expect(initials(''), '?');
    expect(initials('राम थापा'), 'रथ');
  });
}
