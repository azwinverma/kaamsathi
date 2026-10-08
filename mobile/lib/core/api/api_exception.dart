import 'package:dio/dio.dart';

/// A typed API failure, parsed from the contract error envelope:
/// `{"error": {"code": "snake_code", "message": "Human text", "fields": {"f": ["msg"]}}}`.
class ApiException implements Exception {
  const ApiException({required this.code, required this.message, this.statusCode, this.fields = const {}});

  /// Contract code (e.g. `otp_invalid`, `outside_geofence`) or one of the
  /// client-side codes below.
  final String code;
  final String message;
  final int? statusCode;
  final Map<String, List<String>> fields;

  // Client-side codes (never sent by the server).
  static const network = 'network_error';
  static const timeout = 'timeout';
  static const unknown = 'unknown_error';
  static const cancelled = 'cancelled';

  bool get isNetwork => code == network || code == timeout;
  bool get isUnauthenticated => code == 'not_authenticated' || statusCode == 401;

  /// True for failures worth retrying automatically (offline, 5xx, timeouts).
  bool get isRetryable => isNetwork || (statusCode != null && statusCode! >= 500);

  /// First message for [field], if the server flagged it.
  String? fieldError(String field) {
    final l = fields[field];
    return (l == null || l.isEmpty) ? null : l.first;
  }

  /// Parses an HTTP response body. Handles the contract envelope, plain DRF
  /// `{"detail": "..."}` bodies, and DRF field-error maps as fallbacks.
  factory ApiException.fromResponse(int? statusCode, Object? data) {
    if (data is Map) {
      final err = data['error'];
      if (err is Map) {
        return ApiException(
          statusCode: statusCode,
          code: (err['code'] as String?) ?? _codeForStatus(statusCode),
          message: (err['message'] as String?) ?? '',
          fields: _parseFields(err['fields']),
        );
      }
      final detail = data['detail'];
      if (detail is String) {
        return ApiException(
          statusCode: statusCode,
          code: (data['code'] as String?) ?? _codeForStatus(statusCode),
          message: detail,
        );
      }
      if (statusCode == 400) {
        final fields = _parseFields(data);
        if (fields.isNotEmpty) {
          return ApiException(
            statusCode: statusCode,
            code: 'validation_error',
            message: fields.values.first.first,
            fields: fields,
          );
        }
      }
    }
    return ApiException(
      statusCode: statusCode,
      code: _codeForStatus(statusCode),
      message: data is String && data.length < 200 ? data : '',
    );
  }

  /// Converts any Dio failure into an [ApiException].
  factory ApiException.fromDio(DioException e) {
    final inner = e.error;
    if (inner is ApiException) return inner;
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return const ApiException(code: timeout, message: '');
      case DioExceptionType.connectionError:
        return const ApiException(code: network, message: '');
      case DioExceptionType.cancel:
        return const ApiException(code: cancelled, message: '');
      case DioExceptionType.badResponse:
        return ApiException.fromResponse(e.response?.statusCode, e.response?.data);
      case DioExceptionType.badCertificate:
      case DioExceptionType.unknown:
        if (e.response != null) {
          return ApiException.fromResponse(e.response!.statusCode, e.response!.data);
        }
        // SocketException et al. surface as `unknown` on some platforms.
        return const ApiException(code: network, message: '');
    }
  }

  /// Wraps anything thrown by an API call.
  static ApiException from(Object error) {
    if (error is ApiException) return error;
    if (error is DioException) return ApiException.fromDio(error);
    return ApiException(code: unknown, message: error.toString());
  }

  static Map<String, List<String>> _parseFields(Object? raw) {
    if (raw is! Map) return const {};
    final out = <String, List<String>>{};
    raw.forEach((k, v) {
      if (v is List) {
        out['$k'] = v.map((e) => '$e').toList();
      } else if (v is String) {
        out['$k'] = [v];
      }
    });
    return out;
  }

  static String _codeForStatus(int? status) => switch (status) {
    400 => 'validation_error',
    401 => 'not_authenticated',
    403 => 'permission_denied',
    404 => 'not_found',
    429 => 'otp_rate_limited',
    null => unknown,
    _ when status >= 500 => 'server_error',
    _ => unknown,
  };

  @override
  String toString() => 'ApiException($statusCode $code: $message)';
}
