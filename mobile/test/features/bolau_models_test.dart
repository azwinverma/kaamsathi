import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/json.dart';
import 'package:kaamsathi/core/auth/me.dart';
import 'package:kaamsathi/core/auth/session.dart';
import 'package:kaamsathi/core/providers.dart';
import 'package:kaamsathi/core/router/router.dart';
import 'package:kaamsathi/core/storage/prefs.dart';
import 'package:kaamsathi/features/bolau/bolau_logic.dart';
import 'package:kaamsathi/features/bolau/bolau_models.dart';
import 'package:kaamsathi/features/bolau/bolau_repository.dart';
import 'package:kaamsathi/features/bolau/ui/bolau_widgets.dart';
import 'package:kaamsathi/features/common/inbox/inbox_data.dart';
import 'package:kaamsathi/features/common/inbox/inbox_screen.dart';
import 'package:kaamsathi/features/common/ref_data.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../fixtures/bolau_fixtures.dart';

Booking _b(Map<String, dynamic> j) => Booking.fromJson(j);

Me _me({bool worker = true, bool supervisor = false}) => Me.fromJson({
  'id': 'u1',
  'phone': '9800000010',
  'full_name': 'Ram Bahadur Thapa',
  if (worker) 'worker_id': 'w1',
  'memberships': [
    if (supervisor)
      {
        'id': 'm1',
        'role': 'supervisor',
        'organization': {'id': 'o1', 'name': 'Hotel'},
        'site_ids': ['s1'],
      },
  ],
});

void main() {
  group('model parsing (backend payloads)', () {
    test('own Sipalu profile', () {
      final p = MySipalu.fromJson(mySipaluJson);
      expect(p.handle, 'suman-electric');
      expect(p.fullName, 'Suman Tamang');
      expect(p.isVerified, isTrue);
      expect(p.isBookable, isTrue);
      expect(p.skills.single.trade.code, 'electrician');
      expect(p.skills.single.trade.nameNe, 'बिजुली मिस्त्री');
      expect(p.skills.single.years, 8);
      expect(p.services, hasLength(3));
      expect(p.services[2].priceType, PriceType.visitThenQuote);
      expect(p.availability.first.weekday, 0);
      expect(p.weeklyHours, 16);
      expect(p.timeOff.single.note, 'Dashain');
      expect(p.paymentMethod, 'esewa');
      expect(p.walletId, '9800000010');
      expect(p.ratingAvg, 4.8);
      expect(p.ratingCount, 12);
      expect(p.jobsCompleted, 15);
      expect(p.completeness, 100);
      expect(p.onboarding.nextStep, isNull);
    });

    test('a fresh profile is not bookable and resumes at the photo', () {
      final p = MySipalu.fromJson(newSipaluJson);
      expect(p.isBookable, isFalse);
      expect(p.bookableProblems, contains('verified'));
      expect(p.completeness, 8);
      expect(OnboardingStep.resumeIndex(p.onboarding), OnboardingStep.all.indexOf(OnboardingStep.basics));
    });

    test('onboarding response and completeness shapes', () {
      final s = OnboardingState.fromJson(onboardingResponseJson);
      expect(s.completedSteps, ['name', 'photo', 'skills']);
      expect(s.nextStep, 'languages');
      expect(s.completeness, 25);
      expect(parseCompleteness(0.5), 50);
      expect(parseCompleteness(80), 80);
      expect(parseCompleteness({'score': 40}), 40);
    });

    test('public profile: availability ranges, reviews, never a phone', () {
      final p = PublicSipalu.fromJson(publicSipaluJson);
      expect(p.displayName('ne'), 'सुमन तामाङ');
      expect(p.availabilityRules, hasLength(3));
      expect(p.availabilityRules.where((r) => r.weekday == 1).map((r) => r.end), ['12:00', '17:00']);
      expect(p.nextAvailable, isNotNull);
      expect(p.reviews.single.by, 'Sita');
      expect(p.languages, ['ne', 'en']);
      expect(p.verificationLevel, 2);
      expect(publicSipaluJson.containsKey('phone'), isFalse);
    });

    test('search cards and trades', () {
      final cards = resultsOf(searchJson).map(SipaluCard.fromJson).toList();
      expect(cards.first.instantBooking, isTrue);
      expect(cards.first.topTrade?.code, 'electrician');
      expect(cards.last.ratingAvg, isNull);
      final trades = tradesJson.map(BolauTrade.fromJson).toList();
      expect(trades.first.trade.nameEn, 'Electrician');
      expect(trades.first.sipaluCount, 6);
      expect(trades.first.typicalPrice, '600.00');
      expect(trades.last.typicalPrice, isNull);
    });

    test('booking, Sipalu view before acceptance: area only', () {
      final b = _b(bookingRequestedSipaluJson);
      expect(b.status, BookingStatus.requested);
      expect(b.myRole, 'sipalu');
      expect(b.addressLine, isNull);
      expect(b.area('en'), 'Ward 3, Lalitpur Metropolitan City, Lalitpur');
      expect(b.area('ne'), 'वडा ३, Lalitpur Metropolitan City, ललितपुर');
      expect(b.answerBy, DateTime.parse('2030-10-13T09:00:00+05:45'));
      expect(b.events.single.toStatus, 'requested');
      expect(b.events.single.by, 'ghardhani');
    });

    test('booking, Sipalu view after acceptance: exact address', () {
      final b = _b(bookingAcceptedSipaluJson);
      expect(b.addressLine, 'House 12, Jhamsikhel Marg');
      expect(b.address?.landmark, 'Opposite the blue gate school');
      expect(b.contactVisible, isTrue);
    });

    test('booking, Ghardhani view: arrival code and fee', () {
      final b = _b(bookingAcceptedGhardhaniJson);
      expect(b.arrivalCode, '4821');
      expect(b.bookingFeeStatus, 'waived');
      expect(b.sipalu?.handle, 'suman-electric');
      expect(b.freeCancelUntil, DateTime.parse('2030-10-13T08:00:00+05:45'));
    });

    test('visit-then-quote: proposed quote awaits approval', () {
      final b = _b(bookingQuoteGhardhaniJson);
      expect(b.isVisitThenQuote, isTrue);
      expect(b.awaitingQuoteApproval, isTrue);
      expect(b.needsQuote, isFalse);
      expect(b.quoteAmount, '1500.00');
    });

    test('paid and rateable', () {
      final b = _b(bookingConfirmedSipaluJson);
      expect(b.isPaid, isTrue);
      expect(b.paymentMethod, 'esewa');
      expect(b.rateOpen, isTrue);
      expect(b.amount, '600.00');
    });

    test('Kaam request, offers and my offers', () {
      final r = KaamRequest.fromJson(kaamRequestGharJson);
      expect(r.offers, hasLength(4));
      expect(r.offerCount, 3);
      expect(r.isFull, isTrue);
      expect(r.offers.first.sipalu?.name, 'Bikash Rai');
      expect(r.offers.first.sipalu?.ratingCount, 4);
      expect(r.offers.first.sipalu?.verificationLevel, 1);
      final n = KaamRequest.fromJson(nearbyRequestJson);
      expect(n.isFull, isFalse);
      expect(n.address?.line, '');
      expect(n.area('en'), contains('Ward 3'));
      final mine = resultsOf(myOffersJson).map(BolauOffer.fromJson).single;
      expect(mine.requestTitle, 'Bathroom tap leaking');
      expect(mine.requestId, 'kr1');
    });

    test('addresses round-trip to the API body', () {
      final a = BolauAddress.fromJson(addressesJson.first);
      expect(a.isDefault, isTrue);
      final body = a.toJson();
      expect(body['district'], 'lalitpur');
      expect(body['ward'], 3);
      expect(body['line'], 'House 12, Jhamsikhel Marg');
    });

    test('contact', () {
      final c = BookingContact.fromJson({
        'visible': true,
        'phone': '9800000020',
        'phone_masked': '98XXXXX020',
        'visible_until': null,
        'emergency_line': '100',
      });
      expect(c.visible, isTrue);
      expect(c.phone, '9800000020');
      expect(BookingContact.fromJson({'visible': false, 'phone': null}).visible, isFalse);
    });

    test('minimum hourly falls back to Rs 107', () {
      expect(MinimumHourly.fromJson({'hourly': '100.00', 'hourly_part_time': '107.00'}).amount, '107.00');
      expect(MinimumHourly.fromJson(const {}).amount, '107');
    });
  });

  group('onboarding step payloads', () {
    test('wizard screens map to server steps', () {
      expect(OnboardingStep.serverSteps(OnboardingStep.basics), ['name', 'photo']);
      expect(OnboardingStep.serverSteps(OnboardingStep.area), ['service_area']);
      expect(OnboardingStep.serverSteps(OnboardingStep.handle), ['headline', 'consent']);
      expect(OnboardingStep.forServerStep('photo'), OnboardingStep.basics);
      expect(OnboardingStep.forServerStep('consent'), OnboardingStep.handle);
      expect(OnboardingStep.forServerStep('payment'), OnboardingStep.payment);
      expect(
        OnboardingStep.resumeIndex(const OnboardingState(completedSteps: ['name', 'photo'], nextStep: 'service_area')),
        OnboardingStep.all.indexOf(OnboardingStep.area),
      );
    });

    test('name, skills, languages, area, availability', () {
      expect(basicsStep(name: ' Suman Tamang ', nameNe: ' '), {'full_name': 'Suman Tamang'});
      expect(basicsStep(name: 'Suman', nameNe: 'सुमन'), {'full_name': 'Suman', 'full_name_ne': 'सुमन'});
      final skills = skillsStep([
        const SipaluSkill(trade: Trade(code: 'electrician', nameEn: 'Electrician'), years: 8, nstbLevel: 'level2'),
        const SipaluSkill(trade: Trade(code: 'plumber', nameEn: 'Plumber'), years: 2),
      ]);
      expect(skills['primary_trade'], 'electrician');
      expect(skills['skills'], [
        {'trade': 'electrician', 'years_experience': 8, 'nstb_level': 'level2'},
        {'trade': 'plumber', 'years_experience': 2, 'nstb_level': 'none'},
      ]);
      expect(languagesStep([(code: 'ne', proficiency: 'fluent')]), {
        'languages': [
          {'language': 'ne', 'proficiency': 'fluent'},
        ],
      });
      expect(areaStep(districtCodes: ['lalitpur'], radiusKm: 5), {
        'service_districts': ['lalitpur'],
        'service_radius_km': 5,
      });
      expect(availabilityStep([const AvailabilityRule(weekday: 0, start: '09:00', end: '17:00')]), {
        'rules': [
          {'weekday': 0, 'start_time': '09:00', 'end_time': '17:00'},
        ],
      });
    });

    test('services: visit-then-quote sends price 0 and the visit fee', () {
      const s = SipaluService(
        trade: Trade(code: 'electrician', nameEn: 'Electrician'),
        title: 'Fault finding',
        priceType: PriceType.visitThenQuote,
        visitFee: '200',
      );
      final body = servicesStep([s])['services'] as List;
      expect(body.single, {
        'trade': 'electrician',
        'title': 'Fault finding',
        'price_type': 'visit_then_quote',
        'price': '0',
        'visit_fee': '200',
        'is_active': true,
      });
    });

    test('payment, identity, headline, consent', () {
      expect(paymentStep(method: 'esewa', walletId: ' 9800000010 '), {
        'payment_method': 'esewa',
        'wallet_id': '9800000010',
      });
      expect(paymentStep(method: 'bank', bankName: 'NIC Asia', bankAccountNo: '123', bankAccountName: 'Suman'), {
        'payment_method': 'bank',
        'bank_name': 'NIC Asia',
        'bank_account_no': '123',
        'bank_account_name': 'Suman',
      });
      expect(identityStep(idType: 'citizenship', idNumber: '२७-०१-७५'), {'citizenship_no': '27-01-75'});
      expect(identityStep(idType: 'nid', idNumber: '123'), {'nid_no': '123'});
      expect(headlineStep(headline: ' Wiring '), {'headline': 'Wiring'});
      expect(consentStep(publicProfile: true), {'data_processing': true, 'public_profile': true});
    });

    test('handles match the server rule', () {
      expect(isValidHandle('suman-electric'), isTrue);
      expect(isValidHandle('ab'), isFalse);
      expect(isValidHandle('-suman'), isFalse);
      expect(isValidHandle('suman-'), isFalse);
      expect(isValidHandle('Suman'), isTrue); // lower-cased before checking
      expect(suggestHandle('Ram Bahadur Thapa'), 'ram-thapa');
    });
  });

  group('price checks (fair by default)', () {
    test('hourly must reach the minimum hourly wage', () {
      expect(checkPrice('100', priceType: PriceType.hourly, minimumHourly: '107'), PriceProblem.belowMinimum);
      expect(checkPrice('107', priceType: PriceType.hourly, minimumHourly: '107'), isNull);
      expect(checkPrice('१५०', priceType: PriceType.hourly, minimumHourly: '107'), isNull);
      expect(checkPrice('', priceType: PriceType.hourly, minimumHourly: '107'), PriceProblem.missing);
      expect(checkPrice('0', priceType: PriceType.fixed, minimumHourly: '107'), PriceProblem.missing);
    });

    test('fixed must cover the minimum for the time it takes', () {
      expect(
        checkPrice('200', priceType: PriceType.fixed, minimumHourly: '107', estimatedMinutes: 120),
        PriceProblem.belowMinimum,
      );
      expect(checkPrice('214', priceType: PriceType.fixed, minimumHourly: '107', estimatedMinutes: 120), isNull);
      expect(checkPrice('50', priceType: PriceType.fixed, minimumHourly: '107'), isNull);
    });
  });

  group('booking state → actions', () {
    final now = DateTime.parse('2030-10-13T07:00:00+05:45');
    List<BookingAction> s(Map<String, dynamic> j, {Map<String, dynamic> patch = const {}}) =>
        bookingActions(_b({...j, ...patch}), BookingSide.sipalu, now: now);
    List<BookingAction> g(Map<String, dynamic> j, {Map<String, dynamic> patch = const {}, DateTime? at}) =>
        bookingActions(_b({...j, ...patch}), BookingSide.ghardhani, now: at ?? now);

    test('Sipalu path', () {
      expect(s(bookingRequestedSipaluJson), [BookingAction.accept, BookingAction.decline]);
      expect(s(bookingAcceptedSipaluJson), [
        BookingAction.onTheWay,
        BookingAction.enterArrivalCode,
        BookingAction.cancel,
        BookingAction.callOther,
        BookingAction.reportProblem,
      ]);
      expect(s(bookingAcceptedSipaluJson, patch: {'status': 'on_the_way'}).first, BookingAction.enterArrivalCode);
      expect(s(bookingAcceptedSipaluJson, patch: {'status': 'arrived'}).first, BookingAction.start);
      expect(
        s(bookingAcceptedSipaluJson, patch: {'status': 'arrived', 'price_type': 'visit_then_quote'}).first,
        BookingAction.sendQuote,
      );
      expect(
        s(
          bookingAcceptedSipaluJson,
          patch: {'status': 'arrived', 'price_type': 'visit_then_quote', 'quote_status': 'proposed'},
        ),
        isNot(contains(BookingAction.start)),
      );
      expect(s(bookingAcceptedSipaluJson, patch: {'status': 'in_progress'}).first, BookingAction.complete);
      expect(s(bookingAcceptedSipaluJson, patch: {'status': 'completed'}).first, BookingAction.markPaid);
      expect(s(bookingConfirmedSipaluJson), [BookingAction.rate, BookingAction.callOther, BookingAction.reportProblem]);
      expect(s(bookingAcceptedSipaluJson, patch: {'status': 'declined'}), isEmpty);
    });

    test('Ghardhani path', () {
      final req = {...bookingAcceptedGhardhaniJson, 'status': 'requested'};
      expect(g(req), [BookingAction.cancel]);
      expect(g(bookingAcceptedGhardhaniJson), [
        BookingAction.showArrivalCode,
        BookingAction.cancel,
        BookingAction.callOther,
        BookingAction.reportProblem,
      ]);
      // No-show only 30 min after the start.
      expect(
        g(bookingAcceptedGhardhaniJson, at: DateTime.parse('2030-10-13T10:20:00+05:45')),
        isNot(contains(BookingAction.reportNoShow)),
      );
      expect(
        g(bookingAcceptedGhardhaniJson, at: DateTime.parse('2030-10-13T10:31:00+05:45')),
        contains(BookingAction.reportNoShow),
      );
      expect(g(bookingQuoteGhardhaniJson).take(2), [BookingAction.approveQuote, BookingAction.rejectQuote]);
      expect(g(bookingAcceptedGhardhaniJson, patch: {'status': 'completed'}).take(2), [
        BookingAction.confirm,
        BookingAction.markPaid,
      ]);
      expect(g(bookingAcceptedGhardhaniJson, patch: {'status': 'cancelled'}), isEmpty);
    });

    test('free cancellation window', () {
      final b = _b(bookingAcceptedGhardhaniJson);
      expect(isFreeCancellation(b, now: DateTime.parse('2030-10-13T07:59:00+05:45')), isTrue);
      expect(isFreeCancellation(b, now: DateTime.parse('2030-10-13T08:01:00+05:45')), isFalse);
    });
  });

  group('slots and earnings', () {
    test('slots follow the weekly rules (0 = Sunday) with 60 min lead time', () {
      // 2030-10-13 is a Sunday.
      final sunday = DateTime(2030, 10, 13);
      expect(apiWeekday(sunday), 0);
      final rules = PublicSipalu.fromJson(publicSipaluJson).availabilityRules;
      final now = DateTime.parse('2030-10-13T09:30:00+05:45');
      final slots = slotsFor(sunday, rules, minutes: 60, now: now);
      expect(slots.first, DateTime(2030, 10, 13, 11));
      expect(slots.last, DateTime(2030, 10, 13, 16));
      // Monday has a lunch break: 9–12 and 14–17.
      final monday = slotsFor(DateTime(2030, 10, 14), rules, minutes: 120, now: now);
      expect(monday.map((d) => d.hour), [9, 10, 14, 15]);
      expect(slotsFor(DateTime(2030, 10, 15), rules, now: now), isEmpty);
    });

    test('earnings count only jobs marked paid', () {
      final e = earningsFrom([
        _b(bookingConfirmedSipaluJson),
        _b(bookingAcceptedSipaluJson),
      ], now: DateTime.parse('2030-10-14T10:00:00+05:45'));
      expect(e.jobs, 1);
      expect(e.totalPaisa, 60000);
      expect(e.thisMonthPaisa, 60000);
    });

    test('nepalIso keeps the Nepal wall clock', () {
      expect(nepalIso(DateTime(2030, 10, 13, 9)), '2030-10-13T09:00:00+05:45');
      expect(nepalIso(DateTime.utc(2030, 10, 13, 3, 15)), '2030-10-13T09:00:00+05:45');
    });

    test('arrival code accepts Devanagari digits', () {
      expect(normaliseArrivalCode('४८२१'), '4821');
      expect(normaliseArrivalCode('48 21'), '4821');
      expect(normaliseArrivalCode('482'), isNull);
    });
  });

  group('notifications', () {
    AppNotification n(String event, {String? link, Map<String, dynamic>? data}) =>
        AppNotification.fromJson(bolauNotificationJson(event, link: link, data: data));

    test('new request goes to the Sipalu job, in Sipalu mode', () {
      final t = bolauNotificationTarget(n('booking_requested', link: '/bolau/jobs/b1'), AppMode.ghardhani);
      expect(t?.route, Routes.sipaluJob('b1'));
      expect(t?.mode, AppMode.worker);
    });

    test('progress goes to the Ghardhani booking', () {
      for (final e in [
        'booking_accepted',
        'booking_declined',
        'booking_expired',
        'booking_on_the_way',
        'booking_arrived',
        'booking_completed',
      ]) {
        final t = bolauNotificationTarget(n(e), AppMode.worker);
        expect(t?.route, Routes.gharBooking('b1'), reason: e);
        expect(t?.mode, AppMode.ghardhani, reason: e);
      }
    });

    test('cancelled follows the link (either side)', () {
      expect(
        bolauNotificationTarget(n('booking_cancelled', link: '/bolau/jobs/b1'), AppMode.ghardhani)?.route,
        Routes.sipaluJob('b1'),
      );
      expect(
        bolauNotificationTarget(n('booking_cancelled', link: '/ghar/bookings/b1'), AppMode.worker)?.route,
        Routes.gharBooking('b1'),
      );
    });

    test('offers and expired requests go to the Ghardhani request', () {
      final data = {'request_id': 'kr1'};
      expect(bolauNotificationTarget(n('offer_new', data: data), null)?.route, Routes.gharRequest('kr1'));
      expect(bolauNotificationTarget(n('offer_received', data: data), null)?.route, Routes.gharRequest('kr1'));
      expect(bolauNotificationTarget(n('request_expired', data: data), null)?.route, Routes.gharRequest('kr1'));
      expect(
        bolauNotificationTarget(n('request_new', data: data, link: '/bolau/requests/kr1'), AppMode.worker)?.route,
        Routes.sipaluRequest('kr1'),
      );
    });

    test('ids from the link when data has none', () {
      expect(
        bolauNotificationTarget(n('booking_accepted', link: '/ghar/bookings/b9', data: {}), null)?.route,
        Routes.gharBooking('b9'),
      );
    });

    test('a user without a Sipalu profile is not sent to Sipalu pages', () {
      expect(bolauNotificationTarget(n('booking_requested'), AppMode.ghardhani, me: _me(worker: false)), isNull);
    });

    test('flag off: Bolau notifications open nothing; others unchanged', () {
      expect(routeForNotification(n('booking_accepted'), AppMode.worker), isNull);
      expect(routeForNotification(n('offer_new', data: {'request_id': 'kr1'}), AppMode.worker), isNull);
      expect(routeForNotification(n('booking_accepted'), AppMode.worker, bolau: true), Routes.gharBooking('b1'));
      final job = AppNotification.fromJson({'id': 'x', 'kind': 'job_offer', 'title': 't', 'data': <String, dynamic>{}});
      expect(routeForNotification(job, AppMode.worker), Routes.workerOffers);
    });
  });

  group('modes and routing', () {
    Session s(AppMode? mode, Me me) => Session(status: AuthStatus.loggedIn, me: me, mode: mode);

    test('no role yet: first-run choice with Bolau, "ask your employer" without', () {
      final none = s(null, _me(worker: false));
      expect(resolveRedirect(location: Routes.workerHome, session: none, language: 'en'), Routes.noAccess);
      expect(resolveRedirect(location: Routes.workerHome, session: none, language: 'en', bolau: true), Routes.welcome);
      expect(resolveRedirect(location: Routes.welcome, session: none, language: 'en', bolau: true), isNull);
      expect(resolveRedirect(location: Routes.sipaluJoin, session: none, language: 'en', bolau: true), isNull);
    });

    test('Ghardhani mode has its own home and guards', () {
      final g = s(AppMode.ghardhani, _me(worker: false));
      expect(resolveRedirect(location: Routes.splash, session: g, language: 'en', bolau: true), Routes.gharHome);
      expect(resolveRedirect(location: Routes.workerHome, session: g, language: 'en', bolau: true), Routes.gharHome);
      expect(resolveRedirect(location: Routes.supHajiri, session: g, language: 'en', bolau: true), Routes.gharHome);
      expect(resolveRedirect(location: Routes.gharBooking('b1'), session: g, language: 'en', bolau: true), isNull);
      expect(resolveRedirect(location: Routes.inbox, session: g, language: 'en', bolau: true), isNull);
      expect(resolveRedirect(location: Routes.sipaluJoin, session: g, language: 'en', bolau: true), isNull);
    });

    test('worker mode cannot open Ghardhani pages', () {
      final w = s(AppMode.worker, _me());
      expect(resolveRedirect(location: Routes.gharHome, session: w, language: 'en', bolau: true), Routes.workerHome);
      expect(resolveRedirect(location: Routes.sipaluJob('b1'), session: w, language: 'en', bolau: true), isNull);
    });

    test('flag off: Ghardhani mode falls back, Bolau pages are closed', () {
      final g = s(AppMode.ghardhani, _me());
      expect(effectiveMode(g, bolau: false), AppMode.worker);
      expect(effectiveMode(g, bolau: true), AppMode.ghardhani);
      expect(effectiveMode(s(AppMode.ghardhani, _me(worker: false)), bolau: false), isNull);
      expect(resolveRedirect(location: Routes.gharHome, session: g, language: 'en'), Routes.workerHome);
      final w = s(AppMode.worker, _me());
      expect(resolveRedirect(location: Routes.sipaluJob('b1'), session: w, language: 'en'), Routes.workerHome);
      expect(resolveRedirect(location: Routes.sipaluJoin, session: w, language: 'en'), Routes.workerHome);
      expect(resolveRedirect(location: Routes.welcome, session: w, language: 'en'), Routes.workerHome);
    });

    test('isBolauLocation', () {
      expect(isBolauLocation(Routes.gharSearch(trade: 'plumber')), isTrue);
      expect(isBolauLocation(Routes.sipaluServices), isTrue);
      expect(isBolauLocation(Routes.workerBolau), isTrue);
      expect(isBolauLocation(Routes.workerJobs), isFalse);
    });
  });

  group('bolau flag is off unless the server says so', () {
    Future<bool> bolauFor(Map<String, Object> prefs) async {
      SharedPreferences.setMockInitialValues(prefs);
      final p = await Prefs.load();
      final c = ProviderContainer(overrides: [prefsProvider.overrideWithValue(p)]);
      addTearDown(c.dispose);
      return c.read(bolauEnabledProvider);
    }

    test('absent → off; true → on; false → off', () async {
      expect(await bolauFor({}), isFalse);
      expect(await bolauFor({'cache:feature_flags': '{"flags":{"dispute_appeal":true}}'}), isFalse);
      expect(await bolauFor({'cache:feature_flags': '{"flags":{"bolau":true}}'}), isTrue);
      expect(await bolauFor({'cache:feature_flags': '{"flags":{"bolau":false}}'}), isFalse);
    });
  });

  test('status labels cover every status', () async {
    // Every contract status has a Tone and an icon (never colour-only).
    for (final st in [...BookingStatus.path, ...BookingStatus.terminal, BookingStatus.disputed]) {
      expect(bookingStatusTone(st), isNotNull);
      expect(bookingStatusIcon(st), isNotNull);
    }
  });
}
