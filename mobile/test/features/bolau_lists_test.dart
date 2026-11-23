import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/api_client.dart';
import 'package:kaamsathi/core/auth/token_store.dart';
import 'package:kaamsathi/features/bolau/bolau_repository.dart';

import '../fixtures/bolau_fixtures.dart';

class _NoTokens implements TokenStore {
  @override
  Tokens? get current => null;
  @override
  Future<Tokens?> load() async => null;
  @override
  Future<void> save(Tokens tokens) async {}
  @override
  Future<void> clear() async {}
}

/// Answers GETs from [routes]; records each request.
class _Api implements HttpClientAdapter {
  _Api(this.routes);
  final Map<String, Object?> routes;
  final calls = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls.add(options);
    return ResponseBody.fromString(
      jsonEncode(routes['${options.method} ${options.path}']),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

BolauRepository _repo(_Api api) => BolauRepository(
  ApiClient(tokens: _NoTokens(), orgId: () => null, language: () => 'en', baseUrl: 'http://api.test', adapter: api),
);

Map<String, Object?> _page(List<Object?> results) => {
  'count': results.length,
  'next': null,
  'previous': null,
  'results': results,
};

void main() {
  // /me/addresses and /me/favourites are paginated like every other list (API convention).
  test('addresses read the paginated envelope and ask for a full page', () async {
    final api = _Api({'GET /me/addresses': _page(addressesJson)});
    final list = await _repo(api).addresses();
    expect(list.single.id, 'a1');
    expect(api.calls.single.queryParameters['page_size'], 100);
  });

  test('favourites read the paginated envelope and ask for a full page', () async {
    final cards = (searchJson['results'] as List).cast<Object?>();
    final api = _Api({'GET /me/favourites': _page(cards)});
    final list = await _repo(api).favourites();
    expect(list.map((c) => c.handle), [for (final c in cards) (c as Map)['handle']]);
    expect(api.calls.single.queryParameters['page_size'], 100);
  });

  test('a plain list (older API) still works', () async {
    final api = _Api({'GET /me/addresses': addressesJson});
    expect((await _repo(api).addresses()).single.id, 'a1');
  });
}
