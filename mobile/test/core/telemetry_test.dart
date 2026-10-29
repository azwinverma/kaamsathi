import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/telemetry.dart';

void main() {
  group('sanitizeProperties', () {
    test('keeps allowed keys and safe values only', () {
      final out = sanitizeProperties({
        'screen': '/w/jobs/:id',
        'count': 3,
        'instant': true, // not a client key
        'phone': '9800000010',
        'via': 'call 9812345678',
        'source': 'x' * 121,
        'role': null,
      });
      expect(out, {'screen': '/w/jobs/:id', 'count': 3, 'role': null});
    });

    test('drops emails under an allowed key', () {
      expect(sanitizeProperties({'source': 'ram@example.com'}), isEmpty);
    });
  });

  group('screenTemplate', () {
    test('masks ids and keeps templates', () {
      expect(screenTemplate('/w/jobs/3f2b8c1e-1d2a-4b5c-9d8e-7f6a5b4c3d2e'), '/w/jobs/:id');
      expect(screenTemplate('/w/jobs/:id'), '/w/jobs/:id');
      expect(screenTemplate('/s/hajiri/2083/7?x=1'), '/s/hajiri/:n/:n');
      expect(screenTemplate('/g/sipalu/${'a' * 41}'), '/g/sipalu/:id');
    });
  });

  group('Telemetry', () {
    late List<List<Map<String, Object?>>> sent;
    Telemetry make({bool enabled = true}) => Telemetry(
      send: (batch) async => sent.add(batch),
      platform: 'android',
      anonymousId: 'anon12345',
      enabled: enabled,
      clock: () => DateTime.utc(2026, 10, 29, 6),
    );

    setUp(() => sent = []);

    test('queues known events with platform, version and anonymous id', () async {
      final t = make();
      t.track('page_view', {'screen': '/w/home'});
      t.track('made_up_event');
      expect(t.queued, hasLength(1));
      await t.flush();
      expect(sent.single.single, {
        'name': 'page_view',
        'platform': 'android',
        'properties': {'app_version': appVersion, 'screen': '/w/home'},
        'occurred_at': '2026-10-29T06:00:00.000Z',
        'anonymous_id': 'anon12345',
      });
      t.dispose();
    });

    test('flushes in batches of 50', () async {
      final t = make();
      for (var i = 0; i < 120; i++) {
        t.track('feature_used', {'feature': 'x'});
      }
      await t.flush();
      expect(sent.map((b) => b.length), [50, 50, 20]);
      t.dispose();
    });

    test('a failing send never throws and drops the batch', () async {
      final t = Telemetry(send: (_) async => throw Exception('offline'), platform: 'ios', anonymousId: null);
      t.track('app_open');
      await t.flush();
      expect(t.queued, isEmpty);
      t.dispose();
    });

    test('disabled recorder ignores everything', () {
      final t = make(enabled: false);
      t.track('app_open');
      expect(t.queued, isEmpty);
    });
  });
}
