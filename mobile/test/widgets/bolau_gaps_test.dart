import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kaamsathi/core/api/api_client.dart';
import 'package:kaamsathi/core/api/api_exception.dart';
import 'package:kaamsathi/core/api/json.dart';
import 'package:kaamsathi/core/auth/session.dart';
import 'package:kaamsathi/core/auth/token_store.dart';
import 'package:kaamsathi/core/flags.dart';
import 'package:kaamsathi/core/l10n/l10n.dart';
import 'package:kaamsathi/core/providers.dart';
import 'package:kaamsathi/core/storage/prefs.dart';
import 'package:kaamsathi/core/theme/app_theme.dart';
import 'package:kaamsathi/core/widgets/photo_picker.dart';
import 'package:kaamsathi/features/bolau/bolau_logic.dart';
import 'package:kaamsathi/features/bolau/bolau_models.dart';
import 'package:kaamsathi/features/bolau/bolau_repository.dart';
import 'package:kaamsathi/features/bolau/ui/bolau_widgets.dart';
import 'package:kaamsathi/features/bolau/ui/ghardhani/book_screen.dart';
import 'package:kaamsathi/features/bolau/ui/ghardhani/ghar_bookings_screen.dart';
import 'package:kaamsathi/features/bolau/ui/ghardhani/sipalu_profile_screen.dart';
import 'package:kaamsathi/features/bolau/ui/sipalu/bolau_tab.dart';
import 'package:kaamsathi/features/bolau/ui/sipalu/portfolio_screen.dart';
import 'package:kaamsathi/features/bolau/ui/sipalu/sipalu_job_screen.dart';
import 'package:kaamsathi/features/common/ref_data.dart';
import 'package:kaamsathi/features/worker/trust/trust_data.dart';
import 'package:kaamsathi/features/worker/trust/ui/dispute_detail_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../fixtures/bolau_fixtures.dart';
import 'ext_harness.dart';

class _Flags extends FlagsController {
  _Flags(this.flags);
  final Map<String, bool> flags;
  @override
  Map<String, bool> build() => flags;
}

Object _flags([Map<String, bool> extra = const {}]) =>
    flagsProvider.overrideWith(() => _Flags({FlagKeys.bolau: true, ...extra}));

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

const _notConfigured = ApiException(
  code: 'provider_not_configured',
  message: 'eSewa payments are not enabled yet.',
  statusCode: 400,
);

/// Records Bolau calls instead of talking to the server.
class _FakeRepo extends BolauRepository {
  _FakeRepo({this.payError, this.configError, this.config0, this.minWage})
    : super(ApiClient(tokens: _NoTokens(), orgId: () => null, language: () => 'en'));
  final Object? payError;
  final Object? configError;
  final BolauConfig? config0;
  final MinimumHourly? minWage;
  final calls = <(String, Object?)>[];

  @override
  Future<PortfolioItem> addPortfolio(String imagePath, {String? caption, String? captionNe, String? trade}) async {
    calls.add(('add', {'image': imagePath, ...portfolioFields(caption: caption, captionNe: captionNe, trade: trade)}));
    return PortfolioItem.fromJson(_photo('p9'));
  }

  @override
  Future<void> deletePortfolio(String id) async => calls.add(('delete', id));

  @override
  Future<PortfolioItem> updatePortfolio(String id, {String? caption, String? captionNe, String? trade}) async {
    calls.add(('update', {'id': id, 'caption': caption, 'caption_ne': captionNe, 'trade': trade}));
    return PortfolioItem.fromJson(_photo(id));
  }

  @override
  Future<Dispute> raiseDispute(String id, String description) async {
    calls.add(('dispute', {'booking': id, 'description': description}));
    return Dispute.fromJson(_disputeJson);
  }

  @override
  Future<Json> payFee(String id, String provider) async {
    calls.add(('pay', {'booking': id, 'provider': provider}));
    if (payError != null) throw payError!;
    return {'redirect_url': 'https://pay.example/abc', 'reference': 'BK-7Q4M'};
  }

  @override
  Future<BolauConfig> config() async {
    if (configError != null) throw configError!;
    return config0 ?? BolauConfig.fallback;
  }

  @override
  Future<MinimumHourly> minimumHourly() async {
    if (minWage == null) throw const ApiException(code: 'network_error', message: '');
    return minWage!;
  }
}

Map<String, dynamic> _photo(String id, {String? caption = 'Kitchen wiring'}) => {
  'id': id,
  'image_url': 'https://cdn.example/$id.jpg',
  'thumb_url': 'https://cdn.example/$id.jpg',
  'caption': caption,
  'caption_ne': 'भान्साको तार',
  'trade': {'code': 'electrician', 'name_en': 'Electrician', 'name_ne': 'बिजुली मिस्त्री'},
  'created_at': '2030-10-01T09:00:00+05:45',
};

const _disputeJson = {
  'id': 'd1',
  'worker': {'id': 'w1', 'full_name': 'Suman', 'phone_masked': '98•••••678'},
  'organization': null,
  'booking': {'id': 'b3', 'code': 'BK-7Q4M'},
  'kind': 'booking',
  'kind_label': 'Booking',
  'description': '[BK-7Q4M · raised by ghardhani] The tap still leaks',
  'status': 'open',
  'created_at': '2030-10-13T12:00:00+05:45',
};

List<PortfolioItem> _photos(int n) => [for (var i = 1; i <= n; i++) PortfolioItem.fromJson(_photo('p$i'))];

final _commonBase = <Object>[
  minimumHourlyProvider.overrideWith((ref) async => const MinimumHourly('107')),
  tradesProvider.overrideWith(
    (ref) async => const [
      Trade(code: 'electrician', nameEn: 'Electrician', nameNe: 'बिजुली मिस्त्री'),
      Trade(code: 'plumber', nameEn: 'Plumber', nameNe: 'प्लम्बर'),
    ],
  ),
];

final _configOverrides = <Object>{};

Object _config(BolauConfig c) {
  final o = bolauConfigProvider.overrideWith((ref) async => c);
  _configOverrides.add(o);
  return o;
}

/// Smoke overrides: the case's own config when it has one, else the default.
List<Object> _smoke(List<Object> data) => [
  _flags(),
  ..._commonBase,
  if (!data.any(_configOverrides.contains)) _config(BolauConfig.fallback),
  ...data,
];

/// Shared overrides; [config] replaces the default `/bolau/config`.
List<Object> _commonWith([BolauConfig config = BolauConfig.fallback]) => [..._commonBase, _config(config)];

Map<String, dynamic> _gharBooking(String feeStatus, {String fee = '49.00'}) => {
  ...bookingAcceptedGhardhaniJson,
  'booking_fee': fee,
  'booking_fee_status': feeStatus,
};

typedef _Case = (String, Widget, List<Object>, List<Object>, AppMode);

final _cases = <_Case>[
  (
    'Portfolio editor',
    const SipaluPortfolioScreen(),
    [portfolioProvider.overrideWith((ref) async => _photos(3))],
    [portfolioProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'Portfolio editor (full)',
    const SipaluPortfolioScreen(),
    [portfolioProvider.overrideWith((ref) async => _photos(12))],
    [portfolioProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'Sipalu profile with work photos',
    const SipaluProfileScreen(handle: 'suman-electric'),
    [
      publicSipaluProvider.overrideWith(
        (ref, h) async => PublicSipalu.fromJson({
          ...publicSipaluJson,
          'portfolio': [_photo('p1'), _photo('p2', caption: null)],
        }),
      ),
      favouritesProvider.overrideWith((ref) async => const <SipaluCard>[]),
    ],
    [publicSipaluProvider.overrideWith((ref, h) => throw off), favouritesProvider.overrideWith((ref) => throw off)],
    AppMode.ghardhani,
  ),
  (
    'Booking with a fee to pay',
    const GharBookingScreen(id: 'b3'),
    [
      _config(const BolauConfig(bookingFeeEnabled: true)),
      bookingProvider.overrideWith((ref, id) async => Booking.fromJson(_gharBooking('pending'))),
    ],
    [bookingProvider.overrideWith((ref, id) => throw off)],
    AppMode.ghardhani,
  ),
  (
    'Booking with a paid fee',
    const GharBookingScreen(id: 'b3'),
    [bookingProvider.overrideWith((ref, id) async => Booking.fromJson(_gharBooking('paid')))],
    [bookingProvider.overrideWith((ref, id) => throw off)],
    AppMode.ghardhani,
  ),
  (
    'Booking dispute (Ghardhani view)',
    DisputeDetailScreen(id: 'd1', initial: Dispute.fromJson(_disputeJson), partyView: true),
    <Object>[],
    <Object>[],
    AppMode.ghardhani,
  ),
  (
    'Booking dispute (Ghardhani, nothing passed)',
    const DisputeDetailScreen(id: 'd1', partyView: true),
    <Object>[],
    <Object>[],
    AppMode.ghardhani,
  ),
];

/// Pumps [home] inside a GoRouter so pushes to the dispute routes resolve.
Future<GoRouter> _pumpRouted(
  WidgetTester tester,
  Widget home,
  List<Object> overrides, {
  AppMode mode = AppMode.worker,
}) async {
  tester.view.physicalSize = const Size(360, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({'lang': 'en'});
  final prefs = await Prefs.load();
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, _) => home),
      GoRoute(
        path: '/g/dispute/:id',
        builder:
            (_, s) => DisputeDetailScreen(
              id: s.pathParameters['id']!,
              initial: s.extra is Dispute ? s.extra! as Dispute : null,
              partyView: true,
            ),
      ),
      GoRoute(
        path: '/w/disputes/:id',
        builder:
            (_, s) => DisputeDetailScreen(
              id: s.pathParameters['id']!,
              initial: s.extra is Dispute ? s.extra! as Dispute : null,
            ),
      ),
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
        locale: const Locale('en'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: buildTheme(Brightness.light, lang: 'en', useGoogleFonts: false),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

Future<void> _scrollTo(WidgetTester tester, Finder f) async {
  await tester.scrollUntilVisible(f, 300, scrollable: find.byType(Scrollable).first);
  await tester.pumpAndSettle();
}

void main() {
  group('360px smoke (en/ne, data and backend off)', () {
    for (final (name, screen, data, offOverrides, mode) in _cases) {
      for (final lang in ['en', 'ne']) {
        testWidgets('$name · $lang · data', (tester) async {
          await pumpScreen(tester, screen, _smoke(data), lang: lang, mode: mode);
          expect(tester.takeException(), isNull);
          expect(find.byType(ErrorWidget), findsNothing);
        });
        testWidgets('$name · $lang · backend off', (tester) async {
          await pumpScreen(tester, screen, _smoke(offOverrides), lang: lang, mode: mode);
          expect(tester.takeException(), isNull);
          expect(find.byType(ErrorWidget), findsNothing);
        });
      }
    }
  });

  group('portfolio', () {
    test('multipart fields leave blanks out and trim', () {
      expect(portfolioFields(caption: ' Kitchen wiring ', captionNe: '', trade: 'electrician'), {
        'caption': 'Kitchen wiring',
        'trade': 'electrician',
      });
      expect(portfolioFields(), isEmpty);
    });

    test('parses own and public portfolio items', () {
      final me = MySipalu.fromJson({
        ...mySipaluJson,
        'portfolio': [_photo('p1')],
      });
      expect(me.portfolio.single.thumb, 'https://cdn.example/p1.jpg');
      expect(me.portfolio.single.trade?.code, 'electrician');
      expect(me.portfolio.single.captionFor('ne'), 'भान्साको तार');
      final pub = PublicSipalu.fromJson({
        ...publicSipaluJson,
        'portfolio': [
          {'id': 'p2', 'thumb_url': 'https://cdn.example/t.jpg', 'caption': null, 'caption_ne': null},
        ],
      });
      expect(pub.portfolio.single.full, 'https://cdn.example/t.jpg');
      expect(pub.portfolio.single.captionFor('en'), isNull);
    });

    testWidgets('add: picks a compressed photo and posts image, captions and trade', (tester) async {
      final repo = _FakeRepo();
      await pumpScreen(tester, const SipaluPortfolioScreen(), [
        _flags(),
        ..._commonWith(),
        bolauRepositoryProvider.overrideWithValue(repo),
        portfolioProvider.overrideWith((ref) async => _photos(2)),
        photoPickProvider.overrideWithValue((source) async => '/tmp/work.jpg'),
      ]);
      expect(find.text('2 of 12 photos'), findsOneWidget);
      await tester.tap(find.byKey(const Key('portfolio_add')));
      await tester.pumpAndSettle();
      // Save stays off until a photo is chosen.
      expect(tester.widget<FilledButton>(find.byKey(const Key('portfolio_save'))).onPressed, isNull);
      await tester.tap(find.byKey(const Key('photo_gallery')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('portfolio_caption')), 'New switchboard');
      await tester.enterText(find.byKey(const Key('portfolio_caption_ne')), 'नयाँ स्विचबोर्ड');
      await tester.tap(find.byKey(const Key('portfolio_trade')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Electrician').last);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('portfolio_save')));
      await tester.tap(find.byKey(const Key('portfolio_save')));
      await tester.pumpAndSettle();
      expect(repo.calls.single.$1, 'add');
      expect(repo.calls.single.$2, {
        'image': '/tmp/work.jpg',
        'caption': 'New switchboard',
        'caption_ne': 'नयाँ स्विचबोर्ड',
        'trade': 'electrician',
      });
      expect(find.text('Photo saved'), findsOneWidget);
    });

    testWidgets('delete asks first, then deletes that photo', (tester) async {
      final repo = _FakeRepo();
      await pumpScreen(tester, const SipaluPortfolioScreen(), [
        _flags(),
        ..._commonWith(),
        bolauRepositoryProvider.overrideWithValue(repo),
        portfolioProvider.overrideWith((ref) async => _photos(2)),
      ]);
      await tester.tap(find.byKey(const Key('portfolio_p2')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('portfolio_delete')));
      await tester.tap(find.byKey(const Key('portfolio_delete')));
      await tester.pumpAndSettle();
      expect(repo.calls, isEmpty);
      await tester.tap(find.widgetWithText(FilledButton, 'Delete photo'));
      await tester.pumpAndSettle();
      expect(repo.calls.single, ('delete', 'p2'));
    });

    testWidgets('at 12 photos there is no add tile and the limit is explained', (tester) async {
      await pumpScreen(tester, const SipaluPortfolioScreen(), [
        _flags(),
        ..._commonWith(),
        portfolioProvider.overrideWith((ref) async => _photos(12)),
      ]);
      expect(find.byKey(const Key('portfolio_add')), findsNothing);
      expect(find.byKey(const Key('portfolio_full')), findsOneWidget);
      expect(find.text('12 of 12 photos'), findsOneWidget);
    });

    testWidgets('own preview on the Bolau tab and the public profile show the photos', (tester) async {
      await pumpScreen(tester, const Scaffold(body: SipaluBolauTab()), [
        _flags(),
        ..._commonWith(),
        mySipaluProvider.overrideWith(
          (ref) async => MySipalu.fromJson({
            ...mySipaluJson,
            'portfolio': [_photo('p1')],
          }),
        ),
        sipaluJobsProvider.overrideWith((ref) async => const <Booking>[]),
      ]);
      expect(find.byKey(const Key('portfolio_preview')), findsOneWidget);
      expect(find.byKey(const Key('portfolio_strip')), findsOneWidget);
      expect(find.byKey(const Key('portfolio_manage')), findsOneWidget);

      await pumpScreen(tester, const SipaluProfileScreen(handle: 'suman-electric'), [
        _flags(),
        ..._commonWith(),
        publicSipaluProvider.overrideWith(
          (ref, h) async => PublicSipalu.fromJson({
            ...publicSipaluJson,
            'portfolio': [_photo('p1')],
          }),
        ),
        favouritesProvider.overrideWith((ref) async => const <SipaluCard>[]),
      ], mode: AppMode.ghardhani);
      await _scrollTo(tester, find.byKey(const Key('sipalu_portfolio')));
      expect(find.bySemanticsLabel('Work photo: Kitchen wiring'), findsOneWidget);
    });
  });

  group('booking fee', () {
    test('fee states', () {
      Booking b(String s, [String fee = '49.00']) => Booking.fromJson(_gharBooking(s, fee: fee));
      expect(feeState(b('waived', '0.00'), feeEnabled: true), FeeState.waived);
      expect(feeState(b('pending'), feeEnabled: true), FeeState.payable);
      expect(feeState(b('pending'), feeEnabled: false), FeeState.pending);
      expect(feeState(b('pending', '0.00'), feeEnabled: true), FeeState.waived);
      expect(feeState(b('paid'), feeEnabled: true), FeeState.paid);
      expect(feeState(b('refunded'), feeEnabled: false), FeeState.refunded);
      expect(feeReceiptPath('b3'), '/bolau/bookings/b3/receipt.pdf');
    });

    testWidgets('waived: "Free for now", no pay button', (tester) async {
      await pumpScreen(tester, const GharBookingScreen(id: 'b3'), [
        _flags(),
        ..._commonWith(),
        bookingProvider.overrideWith((ref, id) async => Booking.fromJson(_gharBooking('waived', fee: '0.00'))),
      ], mode: AppMode.ghardhani);
      await _scrollTo(tester, find.byKey(const Key('fee_waived')));
      expect(find.text('Free for now'), findsOneWidget);
      expect(find.byKey(const Key('fee_pay')), findsNothing);
    });

    testWidgets('pending + fees on: pay with eSewa; not configured keeps the booking confirmed', (tester) async {
      final repo = _FakeRepo(payError: _notConfigured);
      await pumpScreen(tester, const GharBookingScreen(id: 'b3'), [
        _flags(),
        ..._commonWith(const BolauConfig(bookingFeeEnabled: true)),
        bolauRepositoryProvider.overrideWithValue(repo),
        bookingProvider.overrideWith((ref, id) async => Booking.fromJson(_gharBooking('pending'))),
      ], mode: AppMode.ghardhani);
      await _scrollTo(tester, find.byKey(const Key('fee_pay')));
      expect(find.textContaining("KaamSathi's own fee"), findsOneWidget);
      await tester.tap(find.byKey(const Key('fee_pay')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('fee_provider_esewa')));
      await tester.pumpAndSettle();
      expect(repo.calls.single.$1, 'pay');
      expect(repo.calls.single.$2, {'booking': 'b3', 'provider': 'esewa'});
      expect(find.byKey(const Key('fee_not_configured')), findsOneWidget);
      expect(find.byKey(const Key('fee_pay')), findsNothing);
      expect(find.text("Online payment isn't available yet — your booking is still confirmed."), findsWidgets);
    });

    testWidgets('pending but fees off: amount shown, nothing to pay', (tester) async {
      await pumpScreen(tester, const GharBookingScreen(id: 'b3'), [
        _flags(),
        ..._commonWith(const BolauConfig(bookingFeeEnabled: false)),
        bookingProvider.overrideWith((ref, id) async => Booking.fromJson(_gharBooking('pending'))),
      ], mode: AppMode.ghardhani);
      await _scrollTo(tester, find.byKey(const Key('fee_pending')));
      expect(find.byKey(const Key('fee_pay')), findsNothing);
    });

    testWidgets('paid: receipt link', (tester) async {
      await pumpScreen(tester, const GharBookingScreen(id: 'b3'), [
        _flags(),
        ..._commonWith(),
        bookingProvider.overrideWith((ref, id) async => Booking.fromJson(_gharBooking('paid'))),
      ], mode: AppMode.ghardhani);
      await _scrollTo(tester, find.byKey(const Key('fee_receipt')));
      expect(find.text('Booking fee receipt'), findsOneWidget);
      expect(find.byKey(const Key('fee_pay')), findsNothing);
    });

    testWidgets('book screen uses the config fee and says it is KaamSathi’s', (tester) async {
      await pumpScreen(tester, const BookScreen(handle: 'suman-electric', serviceId: 's1'), [
        _flags(),
        ..._commonWith(
          const BolauConfig(bookingFee: '59', bookingFeeEnabled: true, freeCancelHours: 3, acceptTimeoutMinutes: 20),
        ),
        publicSipaluProvider.overrideWith(
          (ref, h) async => PublicSipalu.fromJson({...publicSipaluJson, 'booking_fee': null, 'instant_booking': false}),
        ),
        addressesProvider.overrideWith((ref) async => addressesJson.map(BolauAddress.fromJson).toList()),
      ], mode: AppMode.ghardhani);
      await _scrollTo(tester, find.byKey(const Key('book_fee_note')));
      expect(find.text('Rs. 59'), findsOneWidget);
      await _scrollTo(tester, find.text('Free to cancel until 3 hours before the start.'));
      await _scrollTo(tester, find.textContaining('The Sipalu has 20 minutes to accept.'));
    });
  });

  group('booking disputes', () {
    testWidgets('Ghardhani raises a dispute → payload sent, party view opens', (tester) async {
      final repo = _FakeRepo();
      final router = await _pumpRouted(tester, const GharBookingScreen(id: 'b3'), [
        _flags(),
        ..._commonWith(),
        bolauRepositoryProvider.overrideWithValue(repo),
        bookingProvider.overrideWith((ref, id) async => Booking.fromJson(bookingAcceptedGhardhaniJson)),
      ], mode: AppMode.ghardhani);
      await _scrollTo(tester, find.byKey(const Key('booking_dispute')));
      await tester.tap(find.byKey(const Key('booking_dispute')));
      await tester.pumpAndSettle();
      expect(tester.widget<FilledButton>(find.byKey(const Key('dispute_send'))).onPressed, isNull);
      await tester.enterText(find.byKey(const Key('dispute_description')), '  The tap still leaks  ');
      await tester.pump();
      await tester.tap(find.byKey(const Key('dispute_send')));
      await tester.pumpAndSettle();
      expect(repo.calls.single.$1, 'dispute');
      expect(repo.calls.single.$2, {'booking': 'b3', 'description': 'The tap still leaks'});
      expect(bookingDisputeRoute(BookingSide.ghardhani, 'd1'), '/g/dispute/d1');
      final screen = tester.widget<DisputeDetailScreen>(find.byType(DisputeDetailScreen));
      expect(screen.id, 'd1');
      expect(screen.partyView, isTrue);
      expect(screen.initial?.id, 'd1');
      expect(router.canPop(), isTrue);
      expect(find.byKey(const Key('dispute_support_note')), findsOneWidget);
      expect(find.byKey(const Key('evidence_card')), findsNothing);
      expect(find.text('[BK-7Q4M · raised by ghardhani] The tap still leaks'), findsOneWidget);
    });

    testWidgets('Sipalu raises a dispute → worker dispute detail (evidence + appeal reuse)', (tester) async {
      final repo = _FakeRepo();
      final router = await _pumpRouted(tester, const SipaluJobScreen(id: 'b2'), [
        _flags({FlagKeys.disputeEvidence: true}),
        ..._commonWith(),
        bolauRepositoryProvider.overrideWithValue(repo),
        bookingProvider.overrideWith((ref, id) async => Booking.fromJson(bookingAcceptedSipaluJson)),
        disputesProvider.overrideWith((ref) async => [Dispute.fromJson(_disputeJson)]),
        disputeEvidenceProvider.overrideWith((ref, id) async => const <DisputeEvidence>[]),
      ]);
      await _scrollTo(tester, find.byKey(const Key('booking_dispute')));
      await tester.tap(find.byKey(const Key('booking_dispute')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('dispute_description')), 'Paid less than agreed');
      await tester.pump();
      await tester.tap(find.byKey(const Key('dispute_send')));
      await tester.pumpAndSettle();
      expect(repo.calls.single.$1, 'dispute');
      expect(repo.calls.single.$2, {'booking': 'b2', 'description': 'Paid less than agreed'});
      expect(bookingDisputeRoute(BookingSide.sipalu, 'd1'), '/w/disputes/d1');
      final screen = tester.widget<DisputeDetailScreen>(find.byType(DisputeDetailScreen));
      expect(screen.id, 'd1');
      expect(screen.partyView, isFalse);
      expect(router.canPop(), isTrue);
      expect(find.byKey(const Key('evidence_card')), findsOneWidget);
      expect(find.byKey(const Key('dispute_support_note')), findsNothing);
    });

    test('dispute is offered only in disputable states', () {
      Booking b(String s) => Booking.fromJson({...bookingAcceptedGhardhaniJson, 'status': s});
      expect(canDisputeBooking(b('requested')), isFalse);
      expect(canDisputeBooking(b('declined')), isFalse);
      expect(canDisputeBooking(b('disputed')), isFalse);
      for (final s in ['accepted', 'in_progress', 'completed', 'confirmed', 'cancelled', 'no_show']) {
        expect(canDisputeBooking(b(s)), isTrue, reason: s);
      }
    });
  });

  group('/bolau/config', () {
    test('parses values and falls back per field', () {
      final c = BolauConfig.fromJson({
        'booking_fee': '59.00',
        'booking_fee_enabled': true,
        'free_cancel_hours': 3,
        'accept_timeout_minutes': 20,
        'min_hourly_rate': '120.00',
        'max_offers': 3,
        'emergency_line': '100',
      });
      expect(c.bookingFee, '59.00');
      expect(c.bookingFeeEnabled, isTrue);
      expect(c.freeCancelHours, 3);
      expect(c.acceptTimeoutMinutes, 20);
      expect(c.minHourlyRate, '120.00');
      final d = BolauConfig.fromJson({'free_cancel_hours': 0, 'min_hourly_rate': '0'});
      expect(d.bookingFee, defaultBookingFee);
      expect(d.bookingFeeEnabled, isNull);
      expect(d.freeCancelHours, 2);
      expect(d.acceptTimeoutMinutes, 30);
      expect(d.minHourlyRate, isNull);
      expect(d.maxOffers, 3);
      expect(d.emergencyLine, '100');
    });

    test('config 404 (Bolau off) → defaults; fee falls back to the bolau_fee flag', () async {
      final c = ProviderContainer(
        overrides:
            <Object>[
              bolauRepositoryProvider.overrideWithValue(
                _FakeRepo(configError: const ApiException(code: 'not_found', message: '', statusCode: 404)),
              ),
              _flags({FlagKeys.bolauFee: true}),
            ].cast(),
      );
      addTearDown(c.dispose);
      expect(await c.read(bolauConfigProvider.future), same(BolauConfig.fallback));
      expect(c.read(bookingFeeEnabledProvider), isTrue);
    });

    test('config says fees are off → wins over the flag', () async {
      final c = ProviderContainer(
        overrides:
            <Object>[
              bolauRepositoryProvider.overrideWithValue(
                _FakeRepo(config0: const BolauConfig(bookingFeeEnabled: false)),
              ),
              _flags({FlagKeys.bolauFee: true}),
            ].cast(),
      );
      addTearDown(c.dispose);
      await c.read(bolauConfigProvider.future);
      expect(c.read(bookingFeeEnabledProvider), isFalse);
    });

    test('minimum hourly: config → /ref/minimum-wage → 107', () async {
      Future<String> min(_FakeRepo repo) async {
        final c = ProviderContainer(overrides: <Object>[bolauRepositoryProvider.overrideWithValue(repo)].cast());
        addTearDown(c.dispose);
        return (await c.read(minimumHourlyProvider.future)).amount;
      }

      expect(
        await min(_FakeRepo(config0: const BolauConfig(minHourlyRate: '125'), minWage: const MinimumHourly('110'))),
        '125',
      );
      expect(await min(_FakeRepo(configError: off, minWage: const MinimumHourly('110'))), '110');
      expect(await min(_FakeRepo(configError: off)), '107');
    });

    test('accept countdown and free cancellation follow the config', () {
      final b = Booking.fromJson({...bookingRequestedSipaluJson, 'expires_at': null});
      final created = b.createdAt!;
      final start = b.scheduledStart!;
      final expected20 = created.add(const Duration(minutes: 20));
      final cap = start.subtract(const Duration(minutes: 15));
      expect(b.answerWithin(20), expected20.isBefore(cap) ? expected20 : cap);
      final accepted = Booking.fromJson({...bookingAcceptedGhardhaniJson, 'free_cancel_until': null});
      final s = accepted.scheduledStart!;
      final at = s.subtract(const Duration(hours: 2, minutes: 30));
      expect(isFreeCancellation(accepted, now: at), isTrue);
      expect(isFreeCancellation(accepted, now: at, freeHours: 3), isFalse);
    });
  });
}
