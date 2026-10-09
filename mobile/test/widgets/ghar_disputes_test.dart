import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kaamsathi/core/api/api_client.dart';
import 'package:kaamsathi/core/api/api_exception.dart';
import 'package:kaamsathi/core/auth/session.dart';
import 'package:kaamsathi/core/auth/token_store.dart';
import 'package:kaamsathi/core/flags.dart';
import 'package:kaamsathi/core/l10n/l10n.dart';
import 'package:kaamsathi/core/providers.dart';
import 'package:kaamsathi/core/router/router.dart';
import 'package:kaamsathi/core/storage/prefs.dart';
import 'package:kaamsathi/core/theme/app_theme.dart';
import 'package:kaamsathi/core/widgets/photo_picker.dart';
import 'package:kaamsathi/features/bolau/bolau_models.dart';
import 'package:kaamsathi/features/bolau/bolau_repository.dart';
import 'package:kaamsathi/features/bolau/ui/ghardhani/ghar_bookings_screen.dart';
import 'package:kaamsathi/features/bolau/ui/ghardhani/ghar_disputes_screen.dart';
import 'package:kaamsathi/features/bolau/ui/ghardhani/ghar_profile_screen.dart';
import 'package:kaamsathi/features/common/inbox/inbox_data.dart';
import 'package:kaamsathi/features/common/inbox/inbox_screen.dart';
import 'package:kaamsathi/features/worker/trust/trust_data.dart';
import 'package:kaamsathi/features/worker/trust/ui/dispute_detail_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../fixtures/bolau_fixtures.dart';
import 'ext_harness.dart';

class _NoTokens implements TokenStore {
  @override
  Tokens? get current => null;
  @override
  Future<Tokens?> load() async => null;
  @override
  Future<void> save(Tokens tokens) async {}
  @override
  Future<void> clear() async {}
}

class _Flags extends FlagsController {
  _Flags(this.flags);
  final Map<String, bool> flags;
  @override
  Map<String, bool> build() => flags;
}

Object _flags([Map<String, bool> extra = const {}]) =>
    flagsProvider.overrideWith(() => _Flags({FlagKeys.bolau: true, ...extra}));

/// Answers from [routes] (`"GET /path"` → JSON body) and records every call;
/// anything else is a 404.
class _Api implements HttpClientAdapter {
  _Api(this.routes);
  final Map<String, Object?> routes;
  final calls = <RequestOptions>[];

  List<String> get paths => [for (final c in calls) '${c.method} ${c.path}'];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls.add(options);
    final key = '${options.method} ${options.path}';
    final found = routes.containsKey(key);
    return ResponseBody.fromString(
      jsonEncode(found ? routes[key] : {'code': 'not_found', 'message': 'Not found.'}),
      found ? (options.method == 'POST' ? 201 : 200) : 404,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

ApiClient _client(_Api api) =>
    ApiClient(tokens: _NoTokens(), orgId: () => null, language: () => 'en', baseUrl: 'http://api.test', adapter: api);

/// Records uploads and appeals with their party; reads go through the API.
class _RecTrust extends TrustRepository {
  _RecTrust(super.api, super.prefs);
  final uploads = <(String, String, String?, DisputeParty)>[];
  final appeals = <(String, String, DisputeParty)>[];

  @override
  Future<DisputeEvidence> addEvidence(
    String disputeId, {
    required String path,
    String? note,
    DisputeParty party = DisputeParty.worker,
  }) async {
    uploads.add((disputeId, path, note, party));
    return DisputeEvidence.fromJson(_evidence('e9', party: party.name));
  }

  @override
  Future<Dispute> appeal(String disputeId, String reason, {DisputeParty party = DisputeParty.worker}) async {
    appeals.add((disputeId, reason, party));
    return Dispute.fromJson(_dispute());
  }
}

Map<String, dynamic> _dispute({
  String id = 'd1',
  String status = 'open',
  bool canAppeal = false,
  String? resolutionNote,
  String? resolvedAt,
  Map<String, dynamic>? appeal,
}) => {
  'id': id,
  'worker': {'id': 'w1', 'full_name': 'Suman', 'phone_masked': '98•••••678'},
  'organization': null,
  'employment': null,
  'payslip': null,
  'booking': {'id': 'b3', 'code': 'BK-7Q4M'},
  'attendance_date': null,
  'attendance_date_bs': null,
  'kind': 'booking',
  'kind_label': 'Booking',
  'description': '[BK-7Q4M · raised by ghardhani] The tap still leaks',
  'status': status,
  'status_label': null,
  'employer_note': '',
  'resolution_note': resolutionNote ?? '',
  'raised_at': '2030-10-13T12:00:00+05:45',
  'responded_at': null,
  'resolved_at': resolvedAt,
  'evidence_count': 1,
  'can_appeal': canAppeal,
  'appeal_deadline': canAppeal ? '2030-10-30T12:00:00+05:45' : null,
  'appeal': appeal,
};

Map<String, dynamic> _evidence(String id, {String party = 'ghardhani'}) => {
  'id': id,
  'file_url': 'https://cdn.example/$id.jpg',
  'file_type': 'image',
  'party': party,
  'party_label': party == 'ghardhani' ? 'Household' : 'Worker',
  'uploaded_by': {'full_name': 'Sita'},
  'note': 'Photo of the leak',
  'created_at': '2030-10-13T13:00:00+05:45',
};

final _decided = _dispute(
  status: 'resolved',
  canAppeal: true,
  resolutionNote: 'Sipalu will come back to fix the tap.',
  resolvedAt: '2030-10-16T12:00:00+05:45',
);

final _appealed = _dispute(
  status: 'appealed',
  resolutionNote: 'Sipalu will come back to fix the tap.',
  resolvedAt: '2030-10-16T12:00:00+05:45',
  appeal: {
    'reason': 'He never came back.',
    'party': 'ghardhani',
    'appealed_at': '2030-10-18T09:00:00+05:45',
    'outcome': null,
    'outcome_label': null,
    'resolution_note': '',
    'resolved_at': null,
  },
);

/// Pumps [home] in a GoRouter (360 px) with the dispute and booking routes.
Future<void> _pumpRouted(
  WidgetTester tester,
  Widget home,
  List<Object> overrides, {
  String lang = 'en',
  AppMode mode = AppMode.ghardhani,
}) async {
  tester.view.physicalSize = const Size(360, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({'lang': lang});
  final prefs = await Prefs.load();
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, _) => home),
      GoRoute(path: Routes.gharDisputes, builder: (_, _) => const GharDisputesScreen()),
      GoRoute(
        path: '/g/dispute/:id',
        builder:
            (_, s) => DisputeDetailScreen(
              id: s.pathParameters['id']!,
              initial: s.extra is Dispute ? s.extra! as Dispute : null,
              party: DisputeParty.ghardhani,
            ),
      ),
      GoRoute(path: '/g/booking/:id', builder: (_, s) => Text('booking ${s.pathParameters['id']}')),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        prefsProvider.overrideWithValue(prefs),
        sessionProvider.overrideWith(() => FakeSession(mode: mode)),
        ...overrides.cast(),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        locale: Locale(lang),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: buildTheme(Brightness.light, lang: lang, useGoogleFonts: false),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

typedef _Case = (String, Widget, List<Object>, List<Object>);

final _cases = <_Case>[
  (
    'My disputes (Ghardhani)',
    const GharDisputesScreen(),
    [
      bookingDisputesProvider.overrideWith(
        (ref) async => [Dispute.fromJson(_dispute()), Dispute.fromJson(_decided), Dispute.fromJson(_appealed)],
      ),
    ],
    [bookingDisputesProvider.overrideWith((ref) => throw off)],
  ),
  (
    'My disputes (empty)',
    const GharDisputesScreen(),
    [bookingDisputesProvider.overrideWith((ref) async => const <Dispute>[])],
    [bookingDisputesProvider.overrideWith((ref) => throw off)],
  ),
  (
    'Booking dispute detail, decided + appealable',
    const DisputeDetailScreen(id: 'd1', party: DisputeParty.ghardhani),
    [
      bookingDisputeProvider.overrideWith((ref, id) async => Dispute.fromJson(_decided)),
      bookingDisputeEvidenceProvider.overrideWith(
        (ref, id) async => [DisputeEvidence.fromJson(_evidence('e1')), DisputeEvidence.fromJson(_evidence('e2'))],
      ),
    ],
    [
      bookingDisputeProvider.overrideWith((ref, id) => throw off),
      bookingDisputeEvidenceProvider.overrideWith((ref, id) => throw off),
    ],
  ),
  (
    'Booking dispute detail, appealed',
    const DisputeDetailScreen(id: 'd1', party: DisputeParty.ghardhani),
    [
      bookingDisputeProvider.overrideWith((ref, id) async => Dispute.fromJson(_appealed)),
      bookingDisputeEvidenceProvider.overrideWith((ref, id) async => const <DisputeEvidence>[]),
    ],
    [
      bookingDisputeProvider.overrideWith((ref, id) => throw off),
      bookingDisputeEvidenceProvider.overrideWith((ref, id) => throw off),
    ],
  ),
  (
    'Booking with a dispute section',
    const GharBookingScreen(id: 'b3'),
    [
      bolauConfigProvider.overrideWith((ref) async => BolauConfig.fallback),
      bookingProvider.overrideWith((ref, id) async => Booking.fromJson(bookingAcceptedGhardhaniJson)),
      disputeOfBookingProvider.overrideWith((ref, id) async => Dispute.fromJson(_decided)),
    ],
    [
      bolauConfigProvider.overrideWith((ref) async => BolauConfig.fallback),
      bookingProvider.overrideWith((ref, id) => throw off),
      disputeOfBookingProvider.overrideWith((ref, id) => throw off),
    ],
  ),
  (
    'Ghardhani profile with My disputes',
    const GharProfileScreen(),
    [ghardhaniProfileProvider.overrideWith((ref) async => GhardhaniProfile.fromJson(ghardhaniJson))],
    [ghardhaniProfileProvider.overrideWith((ref) => throw off)],
  ),
];

void main() {
  late File photo;

  setUpAll(() {
    final dir = Directory.systemTemp.createTempSync('ks_ev');
    photo = File('${dir.path}/leak.jpg')..writeAsBytesSync(List.filled(64, 1));
  });

  group('360px smoke (en/ne, data and backend off)', () {
    for (final (name, screen, data, offOverrides) in _cases) {
      for (final lang in ['en', 'ne']) {
        testWidgets('$name · $lang · data', (tester) async {
          await pumpScreen(tester, screen, [_flags(), ...data], lang: lang, mode: AppMode.ghardhani);
          expect(tester.takeException(), isNull);
          expect(find.byType(ErrorWidget), findsNothing);
        });
        testWidgets('$name · $lang · backend off', (tester) async {
          await pumpScreen(tester, screen, [_flags(), ...offOverrides], lang: lang, mode: AppMode.ghardhani);
          expect(tester.takeException(), isNull);
          expect(find.byType(ErrorWidget), findsNothing);
        });
      }
    }
  });

  group('payload', () {
    test('dispute parses booking, responded/resolved times', () {
      final d = Dispute.fromJson({..._decided, 'responded_at': '2030-10-14T10:00:00+05:45'});
      expect(d.bookingId, 'b3');
      expect(d.bookingCode, 'BK-7Q4M');
      expect(d.respondedAt, isNotNull);
      expect(d.resolvedAt, isNotNull);
      expect(d.isClosed, isTrue);
      expect(Dispute.fromJson(_dispute()).isClosed, isFalse);
      expect(Dispute.fromJson(_appealed).isClosed, isFalse);
    });

    test('timeline: raised → decision → appeal, ticked as each happens', () {
      List<(DisputeStepKind, bool)> steps(Map<String, dynamic> j) => [
        for (final s in disputeTimeline(Dispute.fromJson(j))) (s.kind, s.done),
      ];
      expect(steps(_dispute()), [(DisputeStepKind.raised, true), (DisputeStepKind.decision, false)]);
      expect(steps(_decided), [(DisputeStepKind.raised, true), (DisputeStepKind.decision, true)]);
      expect(steps(_appealed), [
        (DisputeStepKind.raised, true),
        (DisputeStepKind.decision, true),
        (DisputeStepKind.appealed, true),
        (DisputeStepKind.appealDecision, false),
      ]);
      expect(steps({..._dispute(), 'responded_at': '2030-10-14T10:00:00+05:45'})[1], (DisputeStepKind.responded, true));
    });
  });

  group('endpoints per role', () {
    late Prefs prefs;
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      prefs = await Prefs.load();
    });

    test('Ghardhani reads, uploads and appeals through /me/booking-disputes', () async {
      final api = _Api({
        'GET /me/booking-disputes': {
          'count': 1,
          'results': [_dispute()],
        },
        'GET /me/booking-disputes/d1': _dispute(),
        'GET /me/booking-disputes/d1/evidence': [_evidence('e1')],
        'POST /me/booking-disputes/d1/evidence': _evidence('e2'),
        'POST /me/booking-disputes/d1/appeal': _appealed,
      });
      final repo = TrustRepository(_client(api), prefs);
      final list = await repo.bookingDisputes(status: ['open', 'appealed']);
      expect(list.single.bookingCode, 'BK-7Q4M');
      expect(api.calls.last.queryParameters, {'page_size': 100, 'status': 'open,appealed'});
      expect((await repo.bookingDispute('d1')).id, 'd1');
      expect((await repo.evidence('d1', party: DisputeParty.ghardhani)).single.party, 'ghardhani');
      final ev = await repo.addEvidence(
        'd1',
        path: photo.path,
        note: '  Photo of the leak  ',
        party: DisputeParty.ghardhani,
      );
      expect(ev.id, 'e2');
      final upload = api.calls.last;
      expect(upload.data, isA<FormData>());
      final form = upload.data as FormData;
      expect(form.files.single.key, 'file');
      expect(form.files.single.value.filename, 'leak.jpg');
      expect(Map.fromEntries(form.fields), {'note': 'Photo of the leak'});
      final appealed = await repo.appeal('d1', '  He never came back.  ', party: DisputeParty.ghardhani);
      expect(appealed.appeal?.party, 'ghardhani');
      expect(api.calls.last.data, {'reason': 'He never came back.'});
      expect(api.paths, [
        'GET /me/booking-disputes',
        'GET /me/booking-disputes/d1',
        'GET /me/booking-disputes/d1/evidence',
        'POST /me/booking-disputes/d1/evidence',
        'POST /me/booking-disputes/d1/appeal',
      ]);
    });

    test('Sipalu (worker on the case) keeps /me/disputes', () async {
      final api = _Api({
        'GET /me/disputes/d1/evidence': [_evidence('e1', party: 'worker')],
        'POST /me/disputes/d1/evidence': _evidence('e2', party: 'worker'),
        'POST /me/disputes/d1/appeal': _appealed,
      });
      final repo = TrustRepository(_client(api), prefs);
      await repo.evidence('d1');
      await repo.addEvidence('d1', path: photo.path);
      expect((api.calls.last.data as FormData).fields, isEmpty); // blank note left out
      await repo.appeal('d1', 'Paid less than agreed');
      expect(api.paths, [
        'GET /me/disputes/d1/evidence',
        'POST /me/disputes/d1/evidence',
        'POST /me/disputes/d1/appeal',
      ]);
      expect(api.paths.where((p) => p.contains('booking-disputes')), isEmpty);
    });

    test('GET /bolau/bookings/{id}/dispute: the dispute, null on 404', () async {
      final api = _Api({'GET /bolau/bookings/b3/dispute': _decided});
      final repo = BolauRepository(_client(api));
      expect((await repo.bookingDispute('b3'))?.resolutionNote, 'Sipalu will come back to fix the tap.');
      expect(await repo.bookingDispute('b4'), isNull);
      expect(api.paths, ['GET /bolau/bookings/b3/dispute', 'GET /bolau/bookings/b4/dispute']);
    });

    test('Ghardhani dispute notifications open the Ghardhani dispute', () {
      AppNotification n(String kind, [Map<String, dynamic> data = const {}]) =>
          AppNotification.fromJson({'id': 'n1', 'kind': kind, 'title': 't', 'data': data});
      expect(routeForNotification(n('dispute_resolved', {'dispute_id': 'd1'}), AppMode.ghardhani), '/g/dispute/d1');
      expect(routeForNotification(n('dispute_resolved'), AppMode.ghardhani), Routes.gharDisputes);
      expect(routeForNotification(n('dispute_resolved', {'dispute_id': 'd1'}), AppMode.worker), '/w/disputes/d1');
    });
  });

  group('Ghardhani dispute screens', () {
    testWidgets('detail reads /me/booking-disputes/{id} (+ evidence) and shows timeline + decision', (tester) async {
      final api = _Api({
        'GET /me/booking-disputes/d1': _decided,
        'GET /me/booking-disputes/d1/evidence': [_evidence('e1')],
      });
      await pumpScreen(tester, const DisputeDetailScreen(id: 'd1', party: DisputeParty.ghardhani), [
        _flags(),
        apiClientProvider.overrideWithValue(_client(api)),
      ], mode: AppMode.ghardhani);
      expect(api.paths, containsAll(['GET /me/booking-disputes/d1', 'GET /me/booking-disputes/d1/evidence']));
      expect(api.paths.where((p) => p.startsWith('GET /me/disputes')), isEmpty);
      expect(find.byKey(const Key('dispute_timeline')), findsOneWidget);
      expect(find.byKey(const Key('dispute_step_decision')), findsOneWidget);
      expect(find.text('Sipalu will come back to fix the tap.'), findsOneWidget);
      expect(find.text('Booking BK-7Q4M'), findsOneWidget);
      // Decided → no more evidence, no support note.
      expect(find.byKey(const Key('evidence_e1')), findsOneWidget);
      expect(find.byKey(const Key('evidence_add')), findsNothing);
      expect(find.byKey(const Key('dispute_support_note')), findsNothing);
    });

    testWidgets('worker detail still reads /me/disputes', (tester) async {
      final api = _Api({
        'GET /me/disputes': [_dispute()],
        'GET /me/disputes/d1/evidence': <Object>[],
      });
      await pumpScreen(tester, const DisputeDetailScreen(id: 'd1'), [
        _flags(),
        apiClientProvider.overrideWithValue(_client(api)),
      ]);
      expect(api.paths, containsAll(['GET /me/disputes', 'GET /me/disputes/d1/evidence']));
      expect(api.paths.where((p) => p.contains('booking-disputes')), isEmpty);
      expect(find.byKey(const Key('evidence_add')), findsOneWidget);
    });

    testWidgets('evidence upload from the Ghardhani view goes out as party ghardhani', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await Prefs.load();
      final api = _Api({'GET /me/booking-disputes/d1': _dispute(), 'GET /me/booking-disputes/d1/evidence': <Object>[]});
      final trust = _RecTrust(_client(api), prefs);
      await pumpScreen(tester, const DisputeDetailScreen(id: 'd1', party: DisputeParty.ghardhani), [
        _flags(),
        trustRepositoryProvider.overrideWithValue(trust),
        photoPickProvider.overrideWithValue((source) async => '/nonexistent/leak.jpg'),
      ], mode: AppMode.ghardhani);
      expect(find.byKey(const Key('dispute_support_note')), findsOneWidget);
      await tester.ensureVisible(find.byKey(const Key('evidence_add')));
      await tester.tap(find.byKey(const Key('evidence_add')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('photo_gallery')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('evidence_note')), 'Photo of the leak');
      await tester.ensureVisible(find.byKey(const Key('evidence_upload')));
      await tester.tap(find.byKey(const Key('evidence_upload')));
      await tester.pumpAndSettle();
      expect(trust.uploads, [('d1', '/nonexistent/leak.jpg', 'Photo of the leak', DisputeParty.ghardhani)]);
      expect(find.text('Evidence added.'), findsOneWidget);
    });

    testWidgets('appeal: offered with the deadline when can_appeal, sent as party ghardhani', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await Prefs.load();
      final api = _Api({'GET /me/booking-disputes/d1': _decided, 'GET /me/booking-disputes/d1/evidence': <Object>[]});
      final trust = _RecTrust(_client(api), prefs);
      await pumpScreen(tester, const DisputeDetailScreen(id: 'd1', party: DisputeParty.ghardhani), [
        _flags(),
        trustRepositoryProvider.overrideWithValue(trust),
      ], mode: AppMode.ghardhani);
      expect(find.byKey(const Key('appeal_deadline')), findsOneWidget);
      await tester.ensureVisible(find.byKey(const Key('appeal_button')));
      await tester.tap(find.byKey(const Key('appeal_button')));
      await tester.pumpAndSettle();
      expect(tester.widget<FilledButton>(find.byKey(const Key('appeal_confirm'))).onPressed, isNull);
      await tester.enterText(find.byKey(const Key('appeal_reason')), 'He never came back.');
      await tester.pump();
      await tester.tap(find.byKey(const Key('appeal_confirm')));
      await tester.pumpAndSettle();
      expect(trust.appeals, [('d1', 'He never came back.', DisputeParty.ghardhani)]);
    });

    for (final (name, json, flags) in [
      ('open (no decision yet)', _dispute(), const <String, bool>{}),
      (
        'decided but the window closed',
        _dispute(status: 'resolved', resolvedAt: '2030-09-01T12:00:00+05:45'),
        const <String, bool>{},
      ),
      ('appeal switched off', _decided, const {FlagKeys.disputeAppeal: false}),
    ]) {
      testWidgets('appeal hidden: $name', (tester) async {
        await pumpScreen(tester, const DisputeDetailScreen(id: 'd1', party: DisputeParty.ghardhani), [
          _flags(flags),
          bookingDisputeProvider.overrideWith((ref, id) async => Dispute.fromJson(json)),
          bookingDisputeEvidenceProvider.overrideWith((ref, id) async => const <DisputeEvidence>[]),
        ], mode: AppMode.ghardhani);
        expect(find.byKey(const Key('appeal_button')), findsNothing);
        expect(find.byKey(const Key('appeal_card')), findsNothing);
      });
    }

    testWidgets('an appeal already sent shows its state and no second appeal', (tester) async {
      await pumpScreen(tester, const DisputeDetailScreen(id: 'd1', party: DisputeParty.ghardhani), [
        _flags(),
        bookingDisputeProvider.overrideWith((ref, id) async => Dispute.fromJson(_appealed)),
        bookingDisputeEvidenceProvider.overrideWith((ref, id) async => const <DisputeEvidence>[]),
      ], mode: AppMode.ghardhani);
      expect(find.byKey(const Key('appeal_card')), findsOneWidget);
      expect(find.byKey(const Key('appeal_button')), findsNothing);
      expect(find.text('He never came back.'), findsOneWidget);
      expect(find.byKey(const Key('dispute_step_appealDecision')), findsOneWidget);
    });

    testWidgets('Profile → My disputes lists /me/booking-disputes and opens one', (tester) async {
      final api = _Api({
        'GET /me/booking-disputes': {
          'count': 2,
          'results': [
            _dispute(),
            {..._decided, 'id': 'd2'},
          ],
        },
        'GET /me/booking-disputes/d1': _dispute(),
        'GET /me/booking-disputes/d1/evidence': <Object>[],
      });
      await _pumpRouted(tester, const GharProfileScreen(), [
        _flags(),
        apiClientProvider.overrideWithValue(_client(api)),
        ghardhaniProfileProvider.overrideWith((ref) async => GhardhaniProfile.fromJson(ghardhaniJson)),
      ]);
      await tester.tap(find.byKey(const Key('menu_ghar_disputes')));
      await tester.pumpAndSettle();
      expect(find.byType(GharDisputesScreen), findsOneWidget);
      expect(find.byKey(const Key('dispute_d1')), findsOneWidget);
      expect(find.byKey(const Key('dispute_d2')), findsOneWidget);
      await tester.tap(find.byKey(const Key('dispute_d1')));
      await tester.pumpAndSettle();
      final screen = tester.widget<DisputeDetailScreen>(find.byType(DisputeDetailScreen));
      expect(screen.party, DisputeParty.ghardhani);
      expect(api.paths, containsAll(['GET /me/booking-disputes', 'GET /me/booking-disputes/d1']));
      expect(api.paths.where((p) => p.startsWith('GET /me/disputes')), isEmpty);
      // The booking reference opens the booking.
      await tester.tap(find.byKey(const Key('dispute_booking')));
      await tester.pumpAndSettle();
      expect(find.text('booking b3'), findsOneWidget);
    });

    testWidgets('My disputes: empty state', (tester) async {
      await pumpScreen(tester, const GharDisputesScreen(), [
        _flags(),
        bookingDisputesProvider.overrideWith((ref) async => const <Dispute>[]),
      ], mode: AppMode.ghardhani);
      expect(find.text('No disputes about your bookings.'), findsOneWidget);
    });
  });

  test('backend off surfaces as an ApiException, not a crash', () async {
    SharedPreferences.setMockInitialValues({});
    final repo = TrustRepository(_client(_Api({})), await Prefs.load());
    await expectLater(repo.bookingDispute('nope'), throwsA(isA<ApiException>()));
  });
}
