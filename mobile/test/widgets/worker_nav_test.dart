import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kaamsathi/app.dart';
import 'package:kaamsathi/core/api/api_client.dart';
import 'package:kaamsathi/core/auth/session.dart';
import 'package:kaamsathi/core/auth/token_store.dart';
import 'package:kaamsathi/core/providers.dart';
import 'package:kaamsathi/core/router/router.dart';
import 'package:kaamsathi/core/storage/prefs.dart';
import 'package:kaamsathi/features/auth/ui/splash_screen.dart';
import 'package:kaamsathi/features/worker/home/ui/worker_home_screen.dart';
import 'package:kaamsathi/features/worker/jobs/ui/jobs_screen.dart';
import 'package:kaamsathi/features/worker/learn/learn_screen.dart';
import 'package:kaamsathi/features/worker/my_hajiri/ui/my_hajiri_screen.dart';
import 'package:kaamsathi/features/worker/profile/ui/profile_screen.dart';
import 'package:kaamsathi/features/worker/talab/ui/talab_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'ext_harness.dart';

/// Every API call answers "not switched on yet" (501), so each screen shows
/// its calm unavailable state without network.
class _OffAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => ResponseBody.fromString(
    jsonEncode({'code': 'not_found', 'message': ''}),
    501,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );

  @override
  void close({bool force = false}) {}
}

class _Tokens implements TokenStore {
  @override
  Tokens? get current => const Tokens(access: 'a', refresh: 'r');
  @override
  Future<Tokens?> load() async => current;
  @override
  Future<void> save(Tokens tokens) async {}
  @override
  Future<void> clear() async {}
}

/// Routes the worker app had before the bottom-nav redesign. Every one must
/// still resolve, as a tab or as a page pushed over the tabs.
final _oldWorkerRoutes = <String>[
  Routes.workerHome,
  Routes.workerHajiri,
  Routes.workerTalab,
  Routes.payslip('p1'),
  Routes.workerProfile,
  Routes.workerHistory,
  Routes.workerJob('e1'),
  Routes.workerJobContract('e1'),
  Routes.workerProfileViews,
  Routes.workerDisputes,
  Routes.workerDispute('d1'),
  Routes.workerDisputeNew,
  Routes.workerCrew,
  Routes.workerCredentials,
  Routes.workerPassport,
  Routes.workerTraining,
  Routes.workerMoney,
  Routes.workerOfferApply('of1'),
  Routes.workerPrivacy,
  Routes.workerShifts,
  Routes.workerJobs,
  Routes.workerApplications,
  Routes.workerOffers,
  Routes.workerJobAlerts,
  Routes.workerWorkHistory,
  Routes.workerAvailability,
  Routes.workerMobility,
  Routes.workerCareer,
  Routes.workerTimesheets,
  Routes.workerLanguages,
  Routes.workerRatings,
  Routes.workerCorrections,
  Routes.inbox,
  Routes.security,
  Routes.help,
  Routes.helpNew,
  Routes.helpCenter,
  Routes.helpSafety,
  Routes.notificationPrefs,
];

Future<ProviderContainer> _pumpApp(WidgetTester tester, {String lang = 'en'}) async {
  tester.view.physicalSize = const Size(360, 780);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({'lang': lang});
  final prefs = await Prefs.load();
  final api = ApiClient(
    tokens: _Tokens(),
    orgId: () => null,
    language: () => lang,
    baseUrl: 'http://test.invalid/api/v1',
    adapter: _OffAdapter(),
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        prefsProvider.overrideWithValue(prefs),
        sessionProvider.overrideWith(FakeSession.new),
        apiClientProvider.overrideWithValue(api),
      ],
      child: const KaamSathiApp(useGoogleFonts: false),
    ),
  );
  await tester.pumpAndSettle();
  return ProviderScope.containerOf(tester.element(find.byType(KaamSathiApp)));
}

Finder _navLabel(String text) => find.descendant(of: find.byType(NavigationBar), matching: find.text(text));

void main() {
  test('tab roots match brand v2 §18 and tab locations are recognised', () {
    expect(workerTabRoots, [
      Routes.workerHome,
      Routes.workerJobs,
      Routes.workerHajiri,
      Routes.workerLearn,
      Routes.workerProfile,
    ]);
    for (final r in [...workerTabRoots, Routes.workerTalab, Routes.payslip('p1'), Routes.workerHistory]) {
      expect(isWorkerTabLocation(r), isTrue, reason: r);
    }
    expect(isWorkerTabLocation(Routes.workerOffers), isTrue);
    for (final r in [Routes.workerPassport, Routes.workerTraining, Routes.workerShifts, Routes.inbox]) {
      expect(isWorkerTabLocation(r), isFalse, reason: r);
    }
  });

  testWidgets('worker nav has five destinations and each tab opens its screen', (tester) async {
    await _pumpApp(tester);
    expect(find.byType(SplashScreen), findsNothing);
    expect(find.byType(WorkerHomeScreen), findsOneWidget);
    expect(find.byType(NavigationDestination), findsNWidgets(5));
    for (final label in ['Home', 'Jobs', 'Work', 'Learn', 'Profile']) {
      expect(_navLabel(label), findsOneWidget, reason: label);
    }

    final tabs = <(String, Type)>[
      ('nav_jobs', JobsScreen),
      ('nav_work', MyHajiriScreen),
      ('nav_learn', LearnScreen),
      ('nav_profile', ProfileScreen),
      ('nav_home', WorkerHomeScreen),
    ];
    for (final (key, type) in tabs) {
      await tester.tap(find.byKey(Key(key)));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: key);
      expect(find.byType(type), findsOneWidget, reason: key);
    }

    // Work tab: payslips are one segment away and keep the tab selected.
    await tester.tap(find.byKey(const Key('nav_work')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('work_seg_payslips')));
    await tester.pumpAndSettle();
    expect(find.byType(TalabScreen), findsOneWidget);
    final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(bar.selectedIndex, 2);
  });

  testWidgets('Nepali nav labels at 360px', (tester) async {
    await _pumpApp(tester, lang: 'ne');
    for (final label in ['गृह', 'काम', 'हाजिरी', 'सिक्नुहोस्', 'प्रोफाइल']) {
      expect(_navLabel(label), findsOneWidget, reason: label);
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets('every pre-redesign worker route still resolves', (tester) async {
    final container = await _pumpApp(tester);
    final router = container.read(routerProvider);
    for (final route in _oldWorkerRoutes) {
      router.go(route);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: route);
      final at = router.routerDelegate.currentConfiguration.uri.toString();
      expect(at, route, reason: 'redirected away from $route');
    }
    // Sanity: an unknown path is not silently accepted.
    expect(router.configuration.findMatch(Uri.parse('/w/not-a-route')).isEmpty, isTrue);
    expect(GoRouter.of(tester.element(find.byType(Scaffold).first)), same(router));
  });
}
