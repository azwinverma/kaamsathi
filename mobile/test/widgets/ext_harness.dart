import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/api_exception.dart';
import 'package:kaamsathi/core/auth/me.dart';
import 'package:kaamsathi/core/auth/session.dart';
import 'package:kaamsathi/core/l10n/l10n.dart';
import 'package:kaamsathi/core/providers.dart';
import 'package:kaamsathi/core/storage/prefs.dart';
import 'package:kaamsathi/core/theme/app_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// "Endpoint not switched on yet" (→ calm coming-soon state).
const off = ApiException(code: 'not_found', message: '', statusCode: 501);

const comingSoonEn = 'This feature is coming soon. Please check again later.';
const comingSoonNe = 'यो सुविधा छिट्टै आउँदैछ। केही समयपछि फेरि हेर्नुहोस्।';

/// A signed-in session (worker by default, supervisor of org o1 / site s1).
class FakeSession extends SessionController {
  FakeSession({this.mode = AppMode.worker, this.meJson});
  final AppMode mode;
  final Map<String, dynamic>? meJson;

  @override
  Session build() => Session(
    status: AuthStatus.loggedIn,
    mode: mode,
    orgId: mode == AppMode.supervisor ? 'o1' : null,
    siteId: mode == AppMode.supervisor ? 's1' : null,
    me: Me.fromJson(
      meJson ??
          {
            'id': 'u1',
            'phone': '9812345678',
            'full_name': 'Ram Bahadur Thapa',
            'worker_id': 'w1',
            'memberships': [
              {
                'id': 'm1',
                'role': 'supervisor',
                'organization': {'id': 'o1', 'name': 'Hotel'},
                'site_ids': ['s1'],
              },
            ],
          },
    ),
  );
}

/// Pumps [screen] at a 360px-wide phone with real (mocked) prefs, a fake
/// signed-in session and the given provider overrides.
Future<void> pumpScreen(
  WidgetTester tester,
  Widget screen,
  List<Object> overrides, {
  String lang = 'en',
  bool settle = true,
  AppMode mode = AppMode.worker,
  Map<String, dynamic>? meJson,
}) async {
  tester.view.physicalSize = const Size(360, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({'lang': lang});
  final prefs = await Prefs.load();
  await tester.pumpWidget(
    ProviderScope(
      key: UniqueKey(),
      overrides: [
        prefsProvider.overrideWithValue(prefs),
        sessionProvider.overrideWith(() => FakeSession(mode: mode, meJson: meJson)),
        ...overrides.cast(),
      ],
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
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
}
