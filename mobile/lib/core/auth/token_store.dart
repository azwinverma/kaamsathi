import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Access + refresh JWT pair.
class Tokens {
  const Tokens({required this.access, required this.refresh});
  final String access;
  final String refresh;
}

/// Persists the JWT pair. Keeps an in-memory copy so request interceptors
/// don't hit the keystore on every call.
abstract class TokenStore {
  Tokens? get current;
  Future<Tokens?> load();
  Future<void> save(Tokens tokens);
  Future<void> clear();
}

class SecureTokenStore implements TokenStore {
  SecureTokenStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  Tokens? _cache;

  static const _kAccess = 'ks_access';
  static const _kRefresh = 'ks_refresh';

  @override
  Tokens? get current => _cache;

  @override
  Future<Tokens?> load() async {
    final a = await _storage.read(key: _kAccess);
    final r = await _storage.read(key: _kRefresh);
    _cache = (a != null && r != null) ? Tokens(access: a, refresh: r) : null;
    return _cache;
  }

  @override
  Future<void> save(Tokens tokens) async {
    _cache = tokens;
    await _storage.write(key: _kAccess, value: tokens.access);
    await _storage.write(key: _kRefresh, value: tokens.refresh);
  }

  @override
  Future<void> clear() async {
    _cache = null;
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
  }
}

/// For tests.
class MemoryTokenStore implements TokenStore {
  MemoryTokenStore([this._cache]);
  Tokens? _cache;

  @override
  Tokens? get current => _cache;
  @override
  Future<Tokens?> load() async => _cache;
  @override
  Future<void> save(Tokens tokens) async => _cache = tokens;
  @override
  Future<void> clear() async => _cache = null;
}
