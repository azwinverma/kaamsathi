import 'dart:async';

import 'package:dio/dio.dart';

import '../auth/token_store.dart';
import '../config.dart';
import 'api_exception.dart';

/// Thin wrapper around [Dio] wired with the contract conventions:
/// bearer auth, `X-Org-Id` on `/org/*`, `Accept-Language`, a single-flight
/// token refresh on 401, and the error envelope mapped to [ApiException].
class ApiClient {
  ApiClient({
    required this.tokens,
    required this.orgId,
    required this.language,
    this.onSessionExpired,
    String? baseUrl,
    Dio? dio,
    HttpClientAdapter? adapter,
  }) : dio = dio ?? Dio() {
    this.dio.options
      ..baseUrl = baseUrl ?? AppConfig.apiBaseUrl
      ..connectTimeout = AppConfig.connectTimeout
      ..receiveTimeout = AppConfig.receiveTimeout
      ..contentType = Headers.jsonContentType
      ..responseType = ResponseType.json;
    _refreshDio = Dio(
      BaseOptions(
        baseUrl: this.dio.options.baseUrl,
        connectTimeout: AppConfig.connectTimeout,
        receiveTimeout: AppConfig.receiveTimeout,
        contentType: Headers.jsonContentType,
      ),
    );
    if (adapter != null) {
      this.dio.httpClientAdapter = adapter;
      _refreshDio.httpClientAdapter = adapter;
    }
    this.dio.interceptors.add(
      InterceptorsWrapper(onRequest: _onRequest, onError: _onError),
    );
  }

  final Dio dio;
  late final Dio _refreshDio;
  final TokenStore tokens;

  /// Currently selected organization (for `/org/*`).
  final String? Function() orgId;

  /// Current UI language code (`en`/`ne`).
  final String Function() language;

  /// Called when the refresh token is rejected — the user must log in again.
  final void Function()? onSessionExpired;

  Future<Tokens?>? _refreshing;

  static const _kRetried = 'ks_retried';
  static const _kNoAuth = 'ks_no_auth';

  /// Options for endpoints that must not carry a bearer token.
  static Options get noAuth => Options(extra: {_kNoAuth: true});

  void _onRequest(RequestOptions o, RequestInterceptorHandler h) {
    o.headers['Accept-Language'] = language();
    o.headers['Accept'] = 'application/json';
    final t = tokens.current;
    if (t != null && o.extra[_kNoAuth] != true) {
      o.headers['Authorization'] = 'Bearer ${t.access}';
    }
    final path = o.path;
    final org = orgId();
    if (org != null &&
        !o.headers.containsKey('X-Org-Id') &&
        (path == '/org' || path.startsWith('/org/'))) {
      o.headers['X-Org-Id'] = org;
    }
    h.next(o);
  }

  Future<void> _onError(DioException e, ErrorInterceptorHandler h) async {
    final req = e.requestOptions;
    final status = e.response?.statusCode;
    final isAuthCall = req.path.startsWith('/auth/otp') ||
        req.path.startsWith('/auth/token');
    if (status == 401 &&
        !isAuthCall &&
        req.extra[_kRetried] != true &&
        req.extra[_kNoAuth] != true &&
        tokens.current != null) {
      final fresh = await refreshTokens();
      if (fresh != null) {
        req.extra[_kRetried] = true;
        req.headers['Authorization'] = 'Bearer ${fresh.access}';
        try {
          final r = await dio.fetch<dynamic>(req);
          return h.resolve(r);
        } on DioException catch (e2) {
          return h.next(_wrap(e2));
        }
      }
      onSessionExpired?.call();
    }
    h.next(_wrap(e));
  }

  DioException _wrap(DioException e) =>
      e.error is ApiException ? e : e.copyWith(error: ApiException.fromDio(e));

  /// Refreshes the JWT pair. Concurrent callers share one in-flight request.
  Future<Tokens?> refreshTokens() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<Tokens?> _doRefresh() async {
    final current = tokens.current;
    if (current == null) return null;
    try {
      final r = await _refreshDio.post<Map<String, dynamic>>(
        '/auth/token/refresh',
        data: {'refresh': current.refresh},
      );
      final data = r.data ?? const {};
      final access = data['access'] as String?;
      if (access == null) return null;
      final next = Tokens(
        access: access,
        refresh: (data['refresh'] as String?) ?? current.refresh,
      );
      await tokens.save(next);
      return next;
    } on DioException catch (e) {
      final s = e.response?.statusCode;
      if (s == 401 || s == 400) {
        await tokens.clear();
      }
      // Network failure: keep tokens so the next attempt can retry.
      return null;
    }
  }

  // ---- convenience wrappers that throw ApiException ----

  Future<T> get<T>(String path, {Map<String, dynamic>? query}) =>
      _call(() => dio.get<T>(path, queryParameters: _clean(query)));

  /// Options that pin `X-Org-Id` (e.g. syncing a queue recorded for
  /// another organization than the one currently selected).
  static Options forOrg(String orgId) =>
      Options(headers: {'X-Org-Id': orgId});

  Future<T> post<T>(String path, {Object? data, Options? options}) =>
      _call(() => dio.post<T>(path, data: data ?? const {}, options: options));

  Future<T> patch<T>(String path, {Object? data}) =>
      _call(() => dio.patch<T>(path, data: data));

  Future<void> postNoContent(String path, {Object? data}) =>
      _call(() => dio.post<dynamic>(path, data: data ?? const {}));

  /// Downloads binary content (e.g. payslip PDF) to [savePath].
  Future<void> download(String path, String savePath) => _call(
    () => dio.download(
      path,
      savePath,
      options: Options(headers: {'Accept': 'application/pdf'}),
    ),
  );

  Future<T> _call<T>(Future<Response<T>> Function() fn) async {
    try {
      final r = await fn();
      return r.data as T;
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  static Map<String, dynamic>? _clean(Map<String, dynamic>? q) {
    if (q == null) return null;
    return {
      for (final e in q.entries)
        if (e.value != null && '${e.value}'.isNotEmpty) e.key: e.value,
    };
  }
}
