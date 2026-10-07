import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

/// Build-time configuration.
///
/// Override the API with `--dart-define=API_BASE_URL=https://api.example.com/api/v1`.
/// Without it, debug builds talk to the local Django dev server: the Android
/// emulator reaches the host at 10.0.2.2, the iOS simulator at localhost.
abstract final class AppConfig {
  static const _fromEnv = String.fromEnvironment('API_BASE_URL');

  /// Production default (used by release builds without a dart-define).
  static const productionBaseUrl = 'https://api.kaamsathi.com/api/v1';

  static String get apiBaseUrl {
    if (_fromEnv.isNotEmpty) return _stripSlash(_fromEnv);
    if (kReleaseMode) return productionBaseUrl;
    if (!kIsWeb && Platform.isAndroid) return 'http://10.0.2.2:8000/api/v1';
    return 'http://localhost:8000/api/v1';
  }

  static String _stripSlash(String s) =>
      s.endsWith('/') ? s.substring(0, s.length - 1) : s;

  static const connectTimeout = Duration(seconds: 15);
  static const receiveTimeout = Duration(seconds: 30);
}
