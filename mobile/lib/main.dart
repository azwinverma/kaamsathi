import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app.dart';
import 'core/providers.dart';
import 'core/storage/local_db.dart';
import 'core/storage/prefs.dart';
import 'core/widgets/signature/illustration.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Fonts are bundled under assets/google_fonts so the app looks right offline.
  GoogleFonts.config.allowRuntimeFetching = false;
  LicenseRegistry.addLicense(() async* {
    final ofl = await rootBundle.loadString('assets/fonts/OFL.txt');
    yield LicenseEntryWithLineBreaks(['Noto Sans Devanagari'], ofl);
  });
  // Parse the illustrations on the first screens while storage opens, so
  // they are ready for the first frame on low-end phones.
  unawaited(KsArt.precacheFirstScreens());
  final prefs = await Prefs.load();
  final db = await LocalDb.open();
  runApp(
    ProviderScope(
      // Repositories surface errors to the UI; don't auto-retry providers.
      retry: (_, _) => null,
      overrides: [
        prefsProvider.overrideWithValue(prefs),
        databaseProvider.overrideWithValue(db),
      ],
      child: const KaamSathiApp(),
    ),
  );
}
