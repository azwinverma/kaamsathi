import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sqflite/sqflite.dart';

import 'api/api_client.dart';
import 'auth/session.dart';
import 'auth/token_store.dart';
import 'storage/prefs.dart';

/// Overridden in `main()` (and in tests) with a loaded instance.
final prefsProvider = Provider<Prefs>(
  (ref) => throw UnimplementedError('prefsProvider must be overridden'),
);

/// Overridden in `main()` with the opened sqflite database.
final databaseProvider = Provider<Database>(
  (ref) => throw UnimplementedError('databaseProvider must be overridden'),
);

final tokenStoreProvider = Provider<TokenStore>((ref) => SecureTokenStore());

/// UI language (`en`/`ne`), or null before the first-run choice.
class LanguageController extends Notifier<String?> {
  @override
  String? build() => ref.read(prefsProvider).language;

  Future<void> set(String lang) async {
    state = lang;
    await ref.read(prefsProvider).setLanguage(lang);
    // Best effort: keep the server-side preference (SMS language) in sync.
    final session = ref.read(sessionProvider);
    if (session.isLoggedIn) {
      try {
        await ref
            .read(apiClientProvider)
            .patch<dynamic>('/auth/me', data: {'preferred_language': lang});
      } catch (_) {}
    }
  }
}

final languageProvider = NotifierProvider<LanguageController, String?>(
  LanguageController.new,
);

/// Language code to format with (defaults to English before the choice).
final langCodeProvider = Provider<String>(
  (ref) => ref.watch(languageProvider) ?? 'en',
);

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    tokens: ref.watch(tokenStoreProvider),
    orgId: () => ref.read(sessionProvider).orgId,
    language: () => ref.read(languageProvider) ?? 'en',
    onSessionExpired: () => ref.read(sessionProvider.notifier).expire(),
  );
});
