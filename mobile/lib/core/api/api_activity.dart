import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// App-wide view of API traffic for the slow-network hint
/// (`NetworkActivityIndicator`): which requests are in flight and since
/// when, and whether the last one failed to reach the server at all.
///
/// File downloads (payslip PDFs, privacy exports) are not tracked — a big
/// file taking a while is not a slow connection.
class ApiActivity extends ChangeNotifier {
  ApiActivity({DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  final DateTime Function() _clock;
  final Map<RequestOptions, DateTime> _pending = {};
  DateTime? _offlineAt;

  /// Start of the oldest request still in flight, or null when idle.
  DateTime? get oldestStart => _pending.isEmpty ? null : _pending.values.reduce((a, b) => a.isBefore(b) ? a : b);

  bool get busy => _pending.isNotEmpty;

  /// When the last request failed to connect (no success since), or null.
  DateTime? get offlineAt => _offlineAt;

  DateTime now() => _clock();

  late final Interceptor interceptor = InterceptorsWrapper(
    onRequest: (o, h) {
      if (o.responseType != ResponseType.stream) {
        _pending[o] = _clock();
        notifyListeners();
      }
      h.next(o);
    },
    onResponse: (r, h) {
      _end(r.requestOptions, offline: false);
      h.next(r);
    },
    onError: (e, h) {
      final offline = _isConnectionFailure(e) ? true : (e.response != null ? false : null);
      _end(e.requestOptions, offline: offline);
      h.next(e);
    },
  );

  /// [offline]: true = could not reach the server, false = the server
  /// answered (even with an error), null = unknown (e.g. cancelled).
  void _end(RequestOptions o, {required bool? offline}) {
    final removed = _pending.remove(o) != null;
    final before = _offlineAt;
    if (offline == true) _offlineAt = _clock();
    if (offline == false) _offlineAt = null;
    if (removed || before != _offlineAt) notifyListeners();
  }

  static bool _isConnectionFailure(DioException e) => switch (e.type) {
    DioExceptionType.connectionError || DioExceptionType.connectionTimeout => true,
    DioExceptionType.unknown => e.response == null && e.error != null,
    _ => false,
  };
}
