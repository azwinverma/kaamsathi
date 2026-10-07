import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/auth/me.dart';
import 'package:kaamsathi/core/auth/session.dart';
import 'package:kaamsathi/core/l10n/l10n.dart';
import 'package:kaamsathi/core/theme/app_theme.dart';
import 'package:kaamsathi/features/common/roster_models.dart';
import 'package:kaamsathi/features/supervisor/hajiri/hajiri_providers.dart';
import 'package:kaamsathi/features/supervisor/roster/roster_data.dart';
import 'package:kaamsathi/features/supervisor/roster/ui/roster_week_screen.dart';

import '../fixtures/eco_fixtures.dart';

class _FakeSession extends SessionController {
  @override
  Session build() => Session(
    status: AuthStatus.loggedIn,
    mode: AppMode.supervisor,
    orgId: 'o1',
    siteId: 's1',
    me: Me.fromJson({
      'id': 'u1',
      'phone': '9800000002',
      'full_name': 'Sup',
      'memberships': [
        {
          'id': 'm1',
          'role': 'supervisor',
          'organization': {'id': 'o1', 'name': 'Hotel'},
          'site_ids': ['s1'],
        },
      ],
    }),
  );
}

void main() {
  testWidgets('supervisor roster grid renders shifts, off days and empty cells', (tester) async {
    tester.view.physicalSize = const Size(360, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(_FakeSession.new),
          sitesProvider.overrideWith((ref) async => []),
          orgShiftsProvider.overrideWith(
            (ref) async => [const ShiftRef(id: 'sh-m', name: 'Morning', startTime: '07:00', endTime: '15:00')],
          ),
          rosterWeekProvider.overrideWith((ref, key) async => RosterWeek.fromJson(orgRosterJson, key.weekStart)),
        ],
        child: MaterialApp(
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          theme: buildTheme(Brightness.light, useGoogleFonts: false),
          home: const RosterWeekScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('Ram Bahadur Thapa'), findsOneWidget);
    expect(find.text('Mor'), findsOneWidget);
    expect(find.text('Off'), findsOneWidget);
    expect(find.text('Mor = Morning · 7:00 AM – 3:00 PM'), findsOneWidget);
  });
}
