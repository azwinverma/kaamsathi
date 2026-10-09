import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/api_client.dart';
import 'package:kaamsathi/core/api/json.dart';
import 'package:kaamsathi/core/auth/session.dart';
import 'package:kaamsathi/core/auth/token_store.dart';
import 'package:kaamsathi/core/flags.dart';
import 'package:kaamsathi/core/widgets/photo_picker.dart';
import 'package:kaamsathi/features/bolau/bolau_models.dart';
import 'package:kaamsathi/features/bolau/bolau_repository.dart';
import 'package:kaamsathi/features/bolau/ui/ghardhani/addresses_screen.dart';
import 'package:kaamsathi/features/bolau/ui/ghardhani/book_screen.dart';
import 'package:kaamsathi/features/bolau/ui/ghardhani/ghar_bookings_screen.dart';
import 'package:kaamsathi/features/bolau/ui/ghardhani/ghar_home_screen.dart';
import 'package:kaamsathi/features/bolau/ui/ghardhani/ghar_profile_screen.dart';
import 'package:kaamsathi/features/bolau/ui/ghardhani/requests_screens.dart';
import 'package:kaamsathi/features/bolau/ui/ghardhani/search_screen.dart';
import 'package:kaamsathi/features/bolau/ui/ghardhani/sipalu_profile_screen.dart';
import 'package:kaamsathi/features/bolau/ui/mode/welcome_screen.dart';
import 'package:kaamsathi/features/bolau/ui/sipalu/bolau_tab.dart';
import 'package:kaamsathi/features/bolau/ui/sipalu/onboarding_screen.dart';
import 'package:kaamsathi/features/bolau/ui/sipalu/request_offer_screen.dart';
import 'package:kaamsathi/features/bolau/ui/sipalu/services_editor_screen.dart';
import 'package:kaamsathi/features/bolau/ui/sipalu/sipalu_editors.dart';
import 'package:kaamsathi/features/bolau/ui/sipalu/sipalu_job_screen.dart';
import 'package:kaamsathi/features/common/account_actions.dart';
import 'package:kaamsathi/features/common/ref_data.dart';
import 'package:kaamsathi/features/worker/jobs/jobs_data.dart';
import 'package:kaamsathi/features/worker/jobs/ui/jobs_screen.dart';
import 'package:kaamsathi/features/worker/trust/trust_data.dart' show Dispute;

import '../fixtures/bolau_fixtures.dart';
import 'ext_harness.dart';

class _Flags extends FlagsController {
  _Flags(this.flags);
  final Map<String, bool> flags;
  @override
  Map<String, bool> build() => flags;
}

Object _bolauOn() => flagsProvider.overrideWith(() => _Flags({FlagKeys.bolau: true}));
Object _bolauOff() => flagsProvider.overrideWith(() => _Flags(const {}));

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

/// Records calls instead of talking to the server.
class _FakeRepo extends BolauRepository {
  _FakeRepo() : super(ApiClient(tokens: _NoTokens(), orgId: () => null, language: () => 'en'));
  final calls = <(String, Json, Map<String, String>)>[];

  @override
  Future<OnboardingState> onboardingStep(String step, Json data, {Map<String, String> files = const {}}) async {
    calls.add((step, data, files));
    return const OnboardingState(completedSteps: ['name', 'photo'], nextStep: 'skills', completeness: 17);
  }

  @override
  Future<Dispute?> bookingDispute(String id) async => null;

  @override
  Future<Booking> sipaluAction(String id, String action, [Json body = const {}]) async {
    calls.add((action, body, const {}));
    return Booking.fromJson(bookingAcceptedSipaluJson);
  }
}

List<District> _districts() => [const District(code: 'lalitpur', nameEn: 'Lalitpur', nameNe: 'ललितपुर')];

final _common = <Object>[
  minimumHourlyProvider.overrideWith((ref) async => const MinimumHourly('107')),
  bolauConfigProvider.overrideWith((ref) async => BolauConfig.fallback),
  tradesProvider.overrideWith(
    (ref) async => const [
      Trade(code: 'electrician', nameEn: 'Electrician', nameNe: 'बिजुली मिस्त्री'),
      Trade(code: 'plumber', nameEn: 'Plumber', nameNe: 'प्लम्बर'),
    ],
  ),
  districtsProvider.overrideWith((ref) async => _districts()),
];

List<Booking> _jobs() => [
  Booking.fromJson(bookingRequestedSipaluJson),
  Booking.fromJson(bookingAcceptedSipaluJson),
  Booking.fromJson(bookingConfirmedSipaluJson),
];

typedef _Case = (String, Widget, List<Object>, List<Object>, AppMode);

final _cases = <_Case>[
  (
    'Sipalu Bolau tab',
    const Scaffold(body: SipaluBolauTab()),
    [
      mySipaluProvider.overrideWith((ref) async => MySipalu.fromJson(mySipaluJson)),
      sipaluJobsProvider.overrideWith((ref) async => _jobs()),
      nearbyRequestsProvider.overrideWith((ref) async => [KaamRequest.fromJson(nearbyRequestJson)]),
      myOffersProvider.overrideWith((ref) async => resultsOf(myOffersJson).map(BolauOffer.fromJson).toList()),
    ],
    [
      mySipaluProvider.overrideWith((ref) => throw off),
      sipaluJobsProvider.overrideWith((ref) => throw off),
      nearbyRequestsProvider.overrideWith((ref) => throw off),
      myOffersProvider.overrideWith((ref) => throw off),
    ],
    AppMode.worker,
  ),
  (
    'Sipalu job',
    const SipaluJobScreen(id: 'b1'),
    [bookingProvider.overrideWith((ref, id) async => Booking.fromJson(bookingRequestedSipaluJson))],
    [bookingProvider.overrideWith((ref, id) => throw off)],
    AppMode.worker,
  ),
  (
    'Nearby request + offer',
    const RequestOfferScreen(id: 'kr2'),
    [sipaluRequestProvider.overrideWith((ref, id) async => KaamRequest.fromJson(nearbyRequestJson))],
    [sipaluRequestProvider.overrideWith((ref, id) => throw off)],
    AppMode.worker,
  ),
  (
    'Services and hours',
    const SipaluServicesScreen(),
    [mySipaluProvider.overrideWith((ref) async => MySipalu.fromJson(mySipaluJson))],
    [mySipaluProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  (
    'Onboarding',
    const SipaluOnboardingScreen(),
    [mySipaluProvider.overrideWith((ref) async => MySipalu.fromJson(newSipaluJson))],
    [mySipaluProvider.overrideWith((ref) => throw off)],
    AppMode.worker,
  ),
  ('Welcome', const WelcomeScreen(), <Object>[], <Object>[], AppMode.worker),
  (
    'Ghardhani home',
    const GharHomeScreen(),
    [
      bolauTradesProvider.overrideWith((ref) async => tradesJson.map(BolauTrade.fromJson).toList()),
      ghardhaniBookingsProvider.overrideWith((ref) async => [Booking.fromJson(bookingAcceptedGhardhaniJson)]),
    ],
    [bolauTradesProvider.overrideWith((ref) => throw off), ghardhaniBookingsProvider.overrideWith((ref) => throw off)],
    AppMode.ghardhani,
  ),
  (
    'Search results',
    const BolauSearchScreen(trade: 'electrician'),
    [bolauSearchProvider.overrideWith((ref, q) async => resultsOf(searchJson).map(SipaluCard.fromJson).toList())],
    [bolauSearchProvider.overrideWith((ref, q) => throw off)],
    AppMode.ghardhani,
  ),
  (
    'Sipalu profile',
    const SipaluProfileScreen(handle: 'suman-electric'),
    [
      publicSipaluProvider.overrideWith((ref, h) async => PublicSipalu.fromJson(publicSipaluJson)),
      favouritesProvider.overrideWith((ref) async => const <SipaluCard>[]),
    ],
    [publicSipaluProvider.overrideWith((ref, h) => throw off), favouritesProvider.overrideWith((ref) => throw off)],
    AppMode.ghardhani,
  ),
  (
    'Book',
    const BookScreen(handle: 'suman-electric'),
    [
      publicSipaluProvider.overrideWith((ref, h) async => PublicSipalu.fromJson(publicSipaluJson)),
      addressesProvider.overrideWith((ref) async => addressesJson.map(BolauAddress.fromJson).toList()),
    ],
    [publicSipaluProvider.overrideWith((ref, h) => throw off), addressesProvider.overrideWith((ref) => throw off)],
    AppMode.ghardhani,
  ),
  (
    'Ghardhani bookings',
    const GharBookingsScreen(),
    [
      ghardhaniBookingsProvider.overrideWith(
        (ref) async => [Booking.fromJson(bookingAcceptedGhardhaniJson), Booking.fromJson(bookingQuoteGhardhaniJson)],
      ),
    ],
    [ghardhaniBookingsProvider.overrideWith((ref) => throw off)],
    AppMode.ghardhani,
  ),
  (
    'Ghardhani booking tracking',
    const GharBookingScreen(id: 'b3'),
    [bookingProvider.overrideWith((ref, id) async => Booking.fromJson(bookingAcceptedGhardhaniJson))],
    [bookingProvider.overrideWith((ref, id) => throw off)],
    AppMode.ghardhani,
  ),
  (
    'Ghardhani requests',
    const GharRequestsScreen(),
    [
      myRequestsProvider.overrideWith((ref) async => [KaamRequest.fromJson(kaamRequestGharJson)]),
    ],
    [myRequestsProvider.overrideWith((ref) => throw off)],
    AppMode.ghardhani,
  ),
  (
    'Post a Kaam request',
    const RequestNewScreen(),
    [addressesProvider.overrideWith((ref) async => addressesJson.map(BolauAddress.fromJson).toList())],
    [addressesProvider.overrideWith((ref) => throw off)],
    AppMode.ghardhani,
  ),
  (
    'Offers compare',
    const GharRequestScreen(id: 'kr1'),
    [kaamRequestProvider.overrideWith((ref, id) async => KaamRequest.fromJson(kaamRequestGharJson))],
    [kaamRequestProvider.overrideWith((ref, id) => throw off)],
    AppMode.ghardhani,
  ),
  (
    'Ghardhani profile',
    const GharProfileScreen(),
    [ghardhaniProfileProvider.overrideWith((ref) async => GhardhaniProfile.fromJson(ghardhaniJson))],
    [ghardhaniProfileProvider.overrideWith((ref) => throw off)],
    AppMode.ghardhani,
  ),
  (
    'Addresses',
    const AddressesScreen(),
    [addressesProvider.overrideWith((ref) async => addressesJson.map(BolauAddress.fromJson).toList())],
    [addressesProvider.overrideWith((ref) => throw off)],
    AppMode.ghardhani,
  ),
  (
    'Favourites',
    const FavouritesScreen(),
    [favouritesProvider.overrideWith((ref) async => resultsOf(searchJson).map(SipaluCard.fromJson).toList())],
    [favouritesProvider.overrideWith((ref) => throw off)],
    AppMode.ghardhani,
  ),
];

void main() {
  group('360px smoke (en/ne, data and backend off)', () {
    for (final (name, screen, data, offOverrides, mode) in _cases) {
      for (final lang in ['en', 'ne']) {
        testWidgets('$name · $lang · data', (tester) async {
          await pumpScreen(tester, screen, [_bolauOn(), ..._common, ...data], lang: lang, mode: mode);
          expect(tester.takeException(), isNull);
          expect(find.byType(ErrorWidget), findsNothing);
        });
        testWidgets('$name · $lang · backend off', (tester) async {
          await pumpScreen(tester, screen, [_bolauOn(), ..._common, ...offOverrides], lang: lang, mode: mode);
          expect(tester.takeException(), isNull);
          expect(find.byType(ErrorWidget), findsNothing);
        });
      }
    }
  });

  group('Sipalu', () {
    testWidgets('Bolau tab shows the incoming request countdown, earnings and toggles', (tester) async {
      await pumpScreen(tester, _cases.first.$2, [_bolauOn(), ..._common, ..._cases.first.$3]);
      expect(find.text('Ghardhani can book you'), findsOneWidget);
      expect(find.byKey(const Key('incoming_b1')), findsOneWidget);
      expect(find.byKey(const Key('countdown')), findsOneWidget);
      expect(find.byKey(const Key('bolau_enabled')), findsOneWidget);
      expect(find.byKey(const Key('bolau_instant')), findsOneWidget);
      expect(find.byKey(const Key('bolau_earnings')), findsOneWidget);
      expect(find.text('Rs. 600'), findsWidgets);
    });

    testWidgets('a worker without a Sipalu profile is invited to join', (tester) async {
      await pumpScreen(tester, const Scaffold(body: SipaluBolauTab()), [
        _bolauOn(),
        ..._common,
        mySipaluProvider.overrideWith((ref) async => MySipalu.fromJson(newSipaluJson)),
      ]);
      expect(find.byKey(const Key('join_bolau')), findsOneWidget);
    });

    testWidgets('arrival code: four digits (Devanagari too) are sent as Latin digits', (tester) async {
      final repo = _FakeRepo();
      await pumpScreen(tester, const SipaluJobScreen(id: 'b2'), [
        _bolauOn(),
        ..._common,
        bolauRepositoryProvider.overrideWithValue(repo),
        bookingProvider.overrideWith(
          (ref, id) async => Booking.fromJson({...bookingAcceptedSipaluJson, 'status': 'on_the_way'}),
        ),
      ]);
      final submit = find.byKey(const Key('arrival_code_submit'));
      await tester.enterText(find.byKey(const Key('arrival_code_input')), '४८२');
      await tester.pump();
      expect(tester.widget<FilledButton>(submit).onPressed, isNull);
      await tester.enterText(find.byKey(const Key('arrival_code_input')), '४८२१');
      await tester.pump();
      await tester.ensureVisible(submit);
      await tester.tap(submit);
      await tester.pumpAndSettle();
      expect(repo.calls.single.$1, 'arrive');
      expect(repo.calls.single.$2, {'code': '4821'});
    });

    testWidgets('accepted job shows the exact address; a request shows the area only', (tester) async {
      await pumpScreen(tester, const SipaluJobScreen(id: 'b2'), [
        _bolauOn(),
        ..._common,
        bookingProvider.overrideWith((ref, id) async => Booking.fromJson(bookingAcceptedSipaluJson)),
      ]);
      expect(find.byKey(const Key('contact_address')), findsOneWidget);
      await pumpScreen(tester, const SipaluJobScreen(id: 'b1'), [
        _bolauOn(),
        ..._common,
        bookingProvider.overrideWith((ref, id) async => Booking.fromJson(bookingRequestedSipaluJson)),
      ]);
      expect(find.byKey(const Key('contact_hidden')), findsOneWidget);
      expect(find.text('House 12, Jhamsikhel Marg'), findsNothing);
      expect(find.byKey(const Key('action_accept')), findsOneWidget);
    });

    testWidgets('hourly price below the minimum wage is refused, with the hint shown', (tester) async {
      SipaluService? saved;
      await pumpScreen(
        tester,
        Scaffold(
          body: Builder(
            builder:
                (context) => TextButton(
                  onPressed:
                      () async =>
                          saved = await showServiceSheet(
                            context,
                            trades: const [Trade(code: 'electrician', nameEn: 'Electrician')],
                          ),
                  child: const Text('open'),
                ),
          ),
        ),
        [_bolauOn(), ..._common],
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('service_title')), 'House wiring');
      await tester.tap(find.byKey(const Key('price_type_hourly')));
      await tester.pumpAndSettle();
      expect(find.text('At least Rs. 107 an hour — the legal minimum wage.'), findsOneWidget);
      await tester.enterText(find.byKey(const Key('service_price')), '100');
      await tester.ensureVisible(find.byKey(const Key('service_save')));
      await tester.tap(find.byKey(const Key('service_save')));
      await tester.pumpAndSettle();
      expect(find.text('Hourly price must be at least Rs. 107, the minimum wage.'), findsOneWidget);
      expect(saved, isNull);
      await tester.enterText(find.byKey(const Key('service_price')), '150');
      await tester.ensureVisible(find.byKey(const Key('service_save')));
      await tester.tap(find.byKey(const Key('service_save')));
      await tester.pumpAndSettle();
      expect(saved?.priceType, PriceType.hourly);
      expect(saved?.price, '150');
      expect(saved?.trade.code, 'electrician');
    });

    testWidgets('onboarding basics posts the name and photo steps', (tester) async {
      final repo = _FakeRepo();
      await pumpScreen(tester, const SipaluOnboardingScreen(), [
        _bolauOn(),
        ..._common,
        bolauRepositoryProvider.overrideWithValue(repo),
        mySipaluProvider.overrideWith((ref) async => MySipalu.fromJson(newSipaluJson)),
        photoPickProvider.overrideWithValue((source) async => '/tmp/face.jpg'),
      ]);
      expect(find.byKey(const Key('completeness_meter')), findsOneWidget);
      await tester.enterText(find.byKey(const Key('ob_name')), 'Ram Bahadur Thapa');
      await tester.enterText(find.byKey(const Key('ob_name_ne')), 'राम बहादुर थापा');
      await tester.ensureVisible(find.byKey(const Key('photo_gallery')));
      await tester.tap(find.byKey(const Key('photo_gallery')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('onboarding_next')));
      await tester.pumpAndSettle();
      expect(repo.calls.map((c) => c.$1), ['name', 'photo']);
      expect(repo.calls.first.$2, {'full_name': 'Ram Bahadur Thapa', 'full_name_ne': 'राम बहादुर थापा'});
      expect(repo.calls.last.$3, {'photo': '/tmp/face.jpg'});
      // Moved on to the skills screen.
      expect(find.text('Your skills'), findsOneWidget);
    });
  });

  group('Ghardhani', () {
    testWidgets('tracking shows the arrival code large', (tester) async {
      await pumpScreen(tester, const GharBookingScreen(id: 'b3'), [
        _bolauOn(),
        ..._common,
        bookingProvider.overrideWith((ref, id) async => Booking.fromJson(bookingAcceptedGhardhaniJson)),
      ], mode: AppMode.ghardhani);
      expect(find.byKey(const Key('arrival_code')), findsOneWidget);
      expect(find.text('4 8 2 1'), findsOneWidget);
      expect(find.byKey(const Key('booking_timeline')), findsOneWidget);
      await tester.scrollUntilVisible(
        find.byKey(const Key('booking_report')),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.byKey(const Key('booking_report')), findsOneWidget);
      expect(find.byKey(const Key('safety_danger')), findsOneWidget);
    });

    testWidgets('a proposed quote can be approved or declined', (tester) async {
      await pumpScreen(tester, const GharBookingScreen(id: 'b4'), [
        _bolauOn(),
        ..._common,
        bookingProvider.overrideWith((ref, id) async => Booking.fromJson(bookingQuoteGhardhaniJson)),
      ], mode: AppMode.ghardhani);
      expect(find.byKey(const Key('quote_to_approve')), findsOneWidget);
      expect(find.byKey(const Key('action_approveQuote')), findsOneWidget);
      expect(find.byKey(const Key('action_rejectQuote')), findsOneWidget);
      expect(find.byKey(const Key('arrival_code')), findsNothing);
    });

    testWidgets('offers compare shows at most three offers', (tester) async {
      await pumpScreen(tester, const GharRequestScreen(id: 'kr1'), [
        _bolauOn(),
        ..._common,
        kaamRequestProvider.overrideWith((ref, id) async => KaamRequest.fromJson(kaamRequestGharJson)),
      ], mode: AppMode.ghardhani);
      expect(find.text('Offers (3 of 3)'), findsOneWidget);
      for (final id in ['o1', 'o2', 'o3']) {
        expect(find.byKey(Key('offer_$id')), findsOneWidget);
      }
      expect(find.byKey(const Key('offer_o4')), findsNothing);
      expect(find.text('Lowest price'), findsOneWidget);
      expect(find.byKey(const Key('accept_offer_o1')), findsOneWidget);
    });

    testWidgets('book flow shows the price, the fee line and free cancellation', (tester) async {
      await pumpScreen(tester, const BookScreen(handle: 'suman-electric', serviceId: 's1'), [
        _bolauOn(),
        ..._common,
        publicSipaluProvider.overrideWith((ref, h) async => PublicSipalu.fromJson(publicSipaluJson)),
        addressesProvider.overrideWith((ref) async => addressesJson.map(BolauAddress.fromJson).toList()),
      ], mode: AppMode.ghardhani);
      expect(find.byKey(const Key('book_fee')), findsOneWidget);
      expect(find.text('Free for now'), findsOneWidget);
      expect(find.text('Free to cancel until 2 hours before the start.'), findsOneWidget);
      expect(find.byKey(const Key('book_confirm')), findsOneWidget);
    });
  });

  group('modes and the bolau flag', () {
    testWidgets('mode switcher lists Sipalu, Ghardhani and supervisor, and switches', (tester) async {
      await pumpScreen(tester, const Scaffold(body: ModeSwitchTile()), [_bolauOn(), ..._common]);
      await tester.tap(find.byKey(const Key('mode_switch')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('mode_worker')), findsOneWidget);
      expect(find.byKey(const Key('mode_ghardhani')), findsOneWidget);
      expect(find.byKey(const Key('mode_supervisor')), findsOneWidget);
      await tester.tap(find.byKey(const Key('mode_ghardhani')));
      await tester.pumpAndSettle();
      final c = ProviderScope.containerOf(tester.element(find.byType(ModeSwitchTile)));
      expect(c.read(sessionProvider).mode, AppMode.ghardhani);
    });

    testWidgets('without a worker the switcher offers "Become a Sipalu"', (tester) async {
      await pumpScreen(
        tester,
        const Scaffold(body: ModeSwitchTile()),
        [_bolauOn(), ..._common],
        mode: AppMode.ghardhani,
        meJson: {'id': 'u20', 'phone': '9800000020', 'full_name': 'Sita Sharma', 'memberships': <Object>[]},
      );
      await tester.tap(find.byKey(const Key('mode_switch')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('mode_join')), findsOneWidget);
      expect(find.byKey(const Key('mode_supervisor')), findsNothing);
    });

    testWidgets('flag off: no mode switcher for a worker-only user', (tester) async {
      await pumpScreen(
        tester,
        const Scaffold(body: ModeSwitchTile()),
        [_bolauOff()],
        meJson: {'id': 'u1', 'phone': '9800000010', 'full_name': 'Ram', 'worker_id': 'w1', 'memberships': <Object>[]},
      );
      expect(find.byKey(const Key('mode_switch')), findsNothing);
      expect(find.byType(ListTile), findsNothing);
    });

    for (final on in [false, true]) {
      testWidgets('Jobs tab ${on ? 'shows' : 'hides'} the Bolau segment when the flag is ${on ? 'on' : 'off'}', (
        tester,
      ) async {
        await pumpScreen(tester, const JobsScreen(), [
          on ? _bolauOn() : _bolauOff(),
          ..._common,
          recommendedJobsProvider.overrideWith((ref) => throw off),
        ]);
        expect(find.byKey(const Key('tab_bolau')), on ? findsOneWidget : findsNothing);
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('Jobs → Bolau opens on the Sipalu Bolau tab', (tester) async {
      await pumpScreen(tester, const JobsScreen(initialTab: JobsScreen.bolauTab), [
        _bolauOn(),
        ..._common,
        ..._cases.first.$3,
      ], lang: 'ne');
      expect(find.byType(SipaluBolauTab), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
