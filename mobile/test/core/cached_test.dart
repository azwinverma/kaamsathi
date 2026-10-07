import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/api_exception.dart';
import 'package:kaamsathi/core/api/cached.dart';
import 'package:kaamsathi/core/storage/prefs.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late Prefs prefs;
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await Prefs.load();
  });

  test('isFeatureUnavailable: 404/405/501 only', () {
    expect(isFeatureUnavailable(const ApiException(code: 'not_found', message: '', statusCode: 404)), isTrue);
    expect(isFeatureUnavailable(const ApiException(code: 'x', message: '', statusCode: 501)), isTrue);
    expect(isFeatureUnavailable(const ApiException(code: 'x', message: '', statusCode: 405)), isTrue);
    expect(isFeatureUnavailable(const ApiException(code: 'x', message: '', statusCode: 500)), isFalse);
    expect(isFeatureUnavailable(const ApiException(code: ApiException.network, message: '')), isFalse);
    expect(isFeatureUnavailable(StateError('x')), isFalse);
  });

  test('cachedFetch stores fresh data and serves it offline', () async {
    final fresh = await cachedFetch(prefs: prefs, key: 'k', fetch: () async => {'n': 1}, parse: (j) => j['n']);
    expect(fresh.data, 1);
    expect(fresh.fromCache, isFalse);

    final offline = await cachedFetch(
      prefs: prefs,
      key: 'k',
      fetch: () async => throw const ApiException(code: ApiException.network, message: ''),
      parse: (j) => j['n'],
    );
    expect(offline.data, 1);
    expect(offline.fromCache, isTrue);
  });

  test('cachedFetch rethrows server errors and offline-without-cache', () async {
    expect(
      () => cachedFetch(
        prefs: prefs,
        key: 'k2',
        fetch: () async => throw const ApiException(code: ApiException.network, message: ''),
        parse: (j) => j,
      ),
      throwsA(isA<ApiException>()),
    );
    await prefs.setCachedJson('k3', {'n': 1});
    expect(
      () => cachedFetch(
        prefs: prefs,
        key: 'k3',
        fetch: () async => throw const ApiException(code: 'not_found', message: '', statusCode: 404),
        parse: (j) => j,
      ),
      throwsA(isA<ApiException>()),
    );
  });

  test('clearSession removes cached screens', () async {
    await prefs.setCachedJson('me_trust', {'a': 1});
    await prefs.setLanguage('ne');
    await prefs.clearSession();
    expect(prefs.cachedJson('me_trust'), isNull);
    expect(prefs.language, 'ne');
  });
}
