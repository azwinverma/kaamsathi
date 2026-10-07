import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaamsathi/core/api/api_exception.dart';

void main() {
  test('parses the contract error envelope', () {
    final e = ApiException.fromResponse(400, {
      'error': {
        'code': 'validation_error',
        'message': 'Invalid input.',
        'fields': {
          'phone': ['Enter a valid number.'],
          'date': 'Bad date',
        },
      },
    });
    expect(e.statusCode, 400);
    expect(e.code, 'validation_error');
    expect(e.message, 'Invalid input.');
    expect(e.fieldError('phone'), 'Enter a valid number.');
    expect(e.fieldError('date'), 'Bad date');
    expect(e.fieldError('missing'), isNull);
    expect(e.isRetryable, isFalse);
  });

  test('domain codes pass through', () {
    final e = ApiException.fromResponse(400, {
      'error': {'code': 'outside_geofence', 'message': 'Too far from site'},
    });
    expect(e.code, 'outside_geofence');
    expect(e.fields, isEmpty);
  });

  test('falls back to DRF detail bodies', () {
    final e = ApiException.fromResponse(401, {'detail': 'Token expired', 'code': 'token_not_valid'});
    expect(e.code, 'token_not_valid');
    expect(e.message, 'Token expired');
    expect(e.isUnauthenticated, isTrue);
  });

  test('falls back to DRF field maps on 400', () {
    final e = ApiException.fromResponse(400, {
      'phone': ['This field is required.'],
    });
    expect(e.code, 'validation_error');
    expect(e.message, 'This field is required.');
  });

  test('derives a code from status when body is unusable', () {
    expect(ApiException.fromResponse(404, null).code, 'not_found');
    expect(ApiException.fromResponse(403, '<html>').code, 'permission_denied');
    final s = ApiException.fromResponse(502, '<html>bad gateway</html>');
    expect(s.code, 'server_error');
    expect(s.isRetryable, isTrue);
  });

  test('maps Dio transport failures to network/timeout codes', () {
    final req = RequestOptions(path: '/x');
    final conn = ApiException.fromDio(DioException.connectionError(requestOptions: req, reason: 'down'));
    expect(conn.code, ApiException.network);
    expect(conn.isNetwork, isTrue);
    expect(conn.isRetryable, isTrue);

    final timeout = ApiException.fromDio(
      DioException(requestOptions: req, type: DioExceptionType.receiveTimeout),
    );
    expect(timeout.code, ApiException.timeout);
  });

  test('maps Dio bad responses through the envelope parser', () {
    final req = RequestOptions(path: '/auth/otp/verify');
    final e = ApiException.fromDio(
      DioException.badResponse(
        statusCode: 400,
        requestOptions: req,
        response: Response(
          requestOptions: req,
          statusCode: 400,
          data: {
            'error': {'code': 'otp_invalid', 'message': 'Wrong code'},
          },
        ),
      ),
    );
    expect(e.code, 'otp_invalid');
    expect(e.message, 'Wrong code');
  });

  test('ApiException.from unwraps nested ApiException and wraps unknowns', () {
    const inner = ApiException(code: 'duplicate', message: 'x');
    final req = RequestOptions(path: '/x');
    expect(ApiException.from(DioException(requestOptions: req, error: inner)), same(inner));
    expect(ApiException.from(StateError('boom')).code, ApiException.unknown);
  });
}
