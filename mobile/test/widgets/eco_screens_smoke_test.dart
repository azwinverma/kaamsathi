import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/api_exception.dart';
import 'package:kaamsathi/core/api/cached.dart';
import 'package:kaamsathi/core/api/json.dart';
import 'package:kaamsathi/core/l10n/l10n.dart';
import 'package:kaamsathi/core/theme/app_theme.dart';
import 'package:kaamsathi/features/worker/credentials/credentials_data.dart';
import 'package:kaamsathi/features/worker/credentials/ui/credentials_screen.dart';
import 'package:kaamsathi/features/worker/credentials/ui/passport_screen.dart';
import 'package:kaamsathi/features/worker/crew/crew_data.dart';
import 'package:kaamsathi/features/worker/crew/ui/crew_screen.dart';
import 'package:kaamsathi/features/worker/money/money_data.dart';
import 'package:kaamsathi/features/worker/money/ui/money_screen.dart';
import 'package:kaamsathi/features/worker/privacy/privacy_data.dart';
import 'package:kaamsathi/features/worker/privacy/ui/my_data_screen.dart';
import 'package:kaamsathi/features/worker/roster/my_roster_data.dart';
import 'package:kaamsathi/features/worker/roster/ui/my_shifts_screen.dart';
import 'package:kaamsathi/features/worker/training/training_data.dart';
import 'package:kaamsathi/features/worker/training/ui/training_screen.dart';
import 'package:kaamsathi/features/worker/trust/trust_data.dart';
import 'package:kaamsathi/features/worker/trust/ui/disputes_screen.dart';
import 'package:kaamsathi/features/worker/trust/ui/profile_views_screen.dart';

import '../fixtures/eco_fixtures.dart';

const _off = ApiException(code: 'not_found', message: '', statusCode: 501);

Future<void> _pump(WidgetTester tester, Widget screen, List<Object> overrides, {String lang = 'en'}) async {
  tester.view.physicalSize = const Size(360, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      key: UniqueKey(),
      overrides: overrides.cast(),
      child: MaterialApp(
        locale: Locale(lang),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: buildTheme(Brightness.light, lang: lang, useGoogleFonts: false),
        home: screen,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Every new worker screen with all of its endpoints "not enabled yet".
final _unavailable = <(String, Widget, List<Object>)>[
  ('profile views', const ProfileViewsScreen(), [profileViewsProvider.overrideWith((ref) => throw _off)]),
  ('disputes', const DisputesScreen(), [disputesProvider.overrideWith((ref) => throw _off)]),
  ('crew', const CrewScreen(), [crewProvider.overrideWith((ref) => throw _off)]),
  ('credentials', const CredentialsScreen(), [credentialsProvider.overrideWith((ref) => throw _off)]),
  ('passport', const PassportScreen(), [passportProvider.overrideWith((ref) => throw _off)]),
  (
    'training',
    const TrainingScreen(),
    [coursesProvider.overrideWith((ref) => throw _off), enrollmentsProvider.overrideWith((ref) => throw _off)],
  ),
  (
    'money',
    const MoneyScreen(),
    [
      financialProfileProvider.overrideWith((ref) => throw _off),
      offersProvider.overrideWith((ref) => throw _off),
      partnersProvider.overrideWith((ref) => throw _off),
      financeReferralsProvider.overrideWith((ref) => throw _off),
      grantsProvider.overrideWith((ref) => throw _off),
      partnerAccessProvider.overrideWith((ref) => throw _off),
    ],
  ),
  ('my data', const MyDataScreen(), [privacyRequestsProvider.overrideWith((ref) => throw _off)]),
  ('my shifts', const MyShiftsScreen(), [myRosterProvider.overrideWith((ref, _) => throw _off)]),
];

void main() {
  for (final (name, screen, overrides) in _unavailable) {
    testWidgets('$name: friendly "coming soon" when the endpoint is off', (tester) async {
      await _pump(tester, screen, overrides);
      expect(tester.takeException(), isNull);
      expect(find.text('This feature is coming soon. Please check again later.'), findsWidgets);
    });
  }

  testWidgets('crew: 404 means "become a team lead"', (tester) async {
    await _pump(tester, const CrewScreen(), [crewProvider.overrideWith((ref) async => null)]);
    expect(find.text('Become a team lead (Naike)'), findsOneWidget);
  });

  testWidgets('crew with members renders (ne)', (tester) async {
    await _pump(tester, const CrewScreen(), [
      crewProvider.overrideWith((ref) async => Crew.fromJson(crewJson)),
      crewReferralsProvider.overrideWith(
        (ref) async => resultsOf(crewReferralsJson).map(CrewReferral.fromJson).toList(),
      ),
    ], lang: 'ne');
    expect(tester.takeException(), isNull);
    expect(find.text('Hari Tamang'), findsOneWidget);
    expect(find.text('Shivam Builders मा काम गर्दै'), findsOneWidget);
    await tester.tap(find.text('रेफरल इनाम'));
    await tester.pumpAndSettle();
    expect(find.text('पर्खाइमा'), findsOneWidget);
  });

  testWidgets('passport preview + shares render', (tester) async {
    await _pump(tester, const PassportScreen(), [
      passportProvider.overrideWith(
        (ref) async =>
            Cached(Passport.fromJson({'public_code': 'ab12cd34ef', 'is_public': true, 'payload': passportPayloadJson})),
      ),
      passportSharesProvider.overrideWith((ref) async => [PassportShare.fromJson(shareJson)]),
    ]);
    expect(tester.takeException(), isNull);
    expect(find.text('Ram Bahadur Thapa'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Passport code: ab12cd34ef'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.scrollUntilVisible(find.text('Hotel Everest HR'), 300, scrollable: find.byType(Scrollable).first);
    expect(tester.takeException(), isNull);
  });

  testWidgets('money tabs render with data', (tester) async {
    await _pumpMoney(tester, 'en');
    expect(find.text('Rs. 19,800.50'), findsOneWidget);
    for (final tab in ['Offers', 'Applied', 'Sharing']) {
      await tester.tap(find.text(tab));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }
    expect(find.text('Sunrise Bank'), findsWidgets);
  });

  testWidgets('money tabs render in Nepali at 360px', (tester) async {
    await _pumpMoney(tester, 'ne');
    expect(find.text('रु. १९,८००.५०'), findsOneWidget);
    for (final tab in ['प्रस्ताव', 'आवेदन', 'सेयरिङ']) {
      await tester.tap(find.text(tab));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('passport renders in Nepali at 360px', (tester) async {
    await _pump(tester, const PassportScreen(), [
      passportProvider.overrideWith(
        (ref) async => Cached(
          Passport.fromJson({
            'public_code': 'ab12cd34ef',
            'is_public': true,
            'payload': passportPayloadJson,
          }, lang: 'ne'),
        ),
      ),
      passportSharesProvider.overrideWith((ref) async => [PassportShare.fromJson(shareJson)]),
    ], lang: 'ne');
    await tester.scrollUntilVisible(find.text('Hotel Everest HR'), 300, scrollable: find.byType(Scrollable).first);
    expect(tester.takeException(), isNull);
  });

  testWidgets('every unavailable screen also renders in Nepali', (tester) async {
    for (final (_, screen, overrides) in _unavailable) {
      await _pump(tester, screen, overrides, lang: 'ne');
      expect(tester.takeException(), isNull);
      expect(find.text('यो सुविधा छिट्टै आउँदैछ। केही समयपछि फेरि हेर्नुहोस्।'), findsWidgets);
    }
  });
  testWidgets('training, disputes, my data, shifts render with data', (tester) async {
    await _pump(tester, const TrainingScreen(), [
      coursesProvider.overrideWith((ref) async => sortCourses(resultsOf(coursesJson).map(Course.fromJson).toList())),
      enrollmentsProvider.overrideWith((ref) async => <Enrollment>[]),
    ]);
    expect(find.text('Recommended for you'), findsOneWidget);

    await _pump(tester, const DisputesScreen(), [
      disputesProvider.overrideWith((ref) async => [Dispute.fromJson(disputeJson)]),
    ]);
    expect(find.text('Employer responded'), findsOneWidget);

    await _pump(tester, const MyDataScreen(), [
      privacyRequestsProvider.overrideWith(
        (ref) async => resultsOf(privacyRequestsJson).map(PrivacyRequest.fromJson).toList(),
      ),
    ]);
    expect(find.text('Download'), findsOneWidget);

    await _pump(tester, const MyShiftsScreen(), [
      myRosterProvider.overrideWith(
        (ref, week) async => Cached(MyRosterWeek.fromJson({'entries': <Object>[]}, week), fromCache: true),
      ),
    ]);
    expect(tester.takeException(), isNull);
    expect(find.textContaining('Offline'), findsOneWidget);
  });
}

Future<void> _pumpMoney(WidgetTester tester, String lang) => _pump(tester, const MoneyScreen(), lang: lang, [
  financialProfileProvider.overrideWith((ref) async => Cached(FinancialProfile.fromJson(financialProfileJson))),
  offersProvider.overrideWith((ref) async => resultsOf(offersJson).map(Offer.fromJson).toList()),
  partnersProvider.overrideWith((ref) async => <PartnerRef>[]),
  financeReferralsProvider.overrideWith((ref) async => [FinanceReferral.fromJson(financeReferralJson)]),
  grantsProvider.overrideWith((ref) async => [ConsentGrant.fromJson(grantJson)]),
  partnerAccessProvider.overrideWith((ref) async => [PartnerAccess.fromJson(partnerAccessJson)]),
]);
