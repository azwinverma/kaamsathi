import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/format.dart';

void main() {
  test('weekStartSunday returns the Sunday of the week', () {
    // 7 Oct 2026 is a Wednesday.
    expect(weekStartSunday(DateTime(2026, 10, 7)), DateTime(2026, 10, 4));
    expect(weekStartSunday(DateTime(2026, 10, 4)), DateTime(2026, 10, 4));
    expect(weekStartSunday(DateTime(2026, 10, 10, 23, 59)), DateTime(2026, 10, 4));
    expect(weekStartSunday(DateTime(2026, 10, 11)), DateTime(2026, 10, 11));
  });

  test('formatPercent rounds, clamps and localises digits', () {
    expect(formatPercent(0.824, 'en'), '82%');
    expect(formatPercent(0.824, 'ne'), '८२%');
    expect(formatPercent(1.4, 'en'), '100%');
    expect(formatPercent(-0.2, 'en'), '0%');
  });

  test('formatBsOrAd prefers the BS string, else converts AD', () {
    expect(formatBsOrAd('2083-06-21', '2026-10-07', 'en'), '21 Ashwin 2083');
    expect(formatBsOrAd(null, '2026-10-07', 'ne'), '२१ असोज २०८३');
    expect(formatBsOrAd(null, null, 'en'), '');
  });

  test('formatBsDateTime uses Nepal time', () {
    // 20:00 UTC on 6 Oct is 01:45 on 7 Oct in Kathmandu.
    expect(formatBsDateTime(DateTime.utc(2026, 10, 6, 20), 'en'), '21 Ashwin 2083');
    expect(formatBsDateTime(null, 'en'), '');
  });

  test('maskPhone keeps the first 2 and last 3 digits', () {
    expect(maskPhone('9812345678'), '98XXXXX678');
    expect(maskPhone('+977-981-234-5678'), '98XXXXX678');
    expect(maskPhone('123'), '123');
  });

  test('formatClock reads API clock times', () {
    expect(formatClock('07:00:00', 'en'), '7:00 AM');
    expect(formatClock('19:30', 'en'), '7:30 PM');
    expect(formatClock('00:15', 'ne'), '१२:१५ AM');
    expect(formatClock('bad', 'en'), 'bad');
    expect(formatClock(null, 'en'), '');
  });
}
