import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/session.dart';
import 'core/l10n/l10n.dart';
import 'core/providers.dart';
import 'core/router/router.dart';
import 'core/theme/app_theme.dart';

class KaamSathiApp extends ConsumerWidget {
  const KaamSathiApp({super.key, this.useGoogleFonts = true});

  final bool useGoogleFonts;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(langCodeProvider);
    final router = ref.watch(routerProvider);
    // Supervisor mode is the calm "documentary ledger"; worker mode (and the
    // pre-login screens) the "street mural" (docs/design/DIRECTION.md).
    final ledger = ref.watch(sessionProvider.select((s) => s.mode)) == AppMode.supervisor;
    return MaterialApp.router(
      title: 'KaamSathi',
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      locale: Locale(lang),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: buildTheme(Brightness.light, lang: lang, useGoogleFonts: useGoogleFonts, ledger: ledger),
      darkTheme: buildTheme(Brightness.dark, lang: lang, useGoogleFonts: useGoogleFonts, ledger: ledger),
      themeMode: ThemeMode.system,
    );
  }
}
