import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/l10n/l10n.dart';
import 'package:kaamsathi/core/theme/app_theme.dart';

/// Pumps [child] inside a localised, themed MaterialApp (no Google Fonts).
/// Uses a tall phone-width viewport so lazily built lists render fully.
Future<void> pumpLocalized(WidgetTester tester, Widget child, {String lang = 'en'}) async {
  tester.view.physicalSize = const Size(420, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      locale: Locale(lang),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: buildTheme(Brightness.light, lang: lang, useGoogleFonts: false),
      home: Scaffold(body: child),
    ),
  );
  await tester.pumpAndSettle();
}
