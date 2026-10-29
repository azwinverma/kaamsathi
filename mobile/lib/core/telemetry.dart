import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart' show AppLifecycleListener;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import 'providers.dart';

/// First-party product analytics, same contract as web `lib/telemetry.ts` and backend
/// `apps/telemetry/schema.py`: events are batched to `POST /telemetry/events`.
///
/// NO PII: only [allowedProperties] leave the phone, and values that look like a phone number or
/// email are dropped. Screens are reported as route templates (`/w/jobs/:id`), never ids or names.
/// Analytics must never break the app: every failure is swallowed and the batch is dropped.
///
/// On in release builds; `--dart-define=KS_TELEMETRY=true|false` overrides (off in tests).
const telemetryEnabled = bool.fromEnvironment('KS_TELEMETRY', defaultValue: kReleaseMode);
const appVersion = String.fromEnvironment('APP_VERSION', defaultValue: '1.0.0');

const clientEvents = {
  'app_open',
  'page_view',
  'login_success',
  'otp_requested',
  'onboarding_step',
  'search_performed',
  'feature_used',
};

const allowedProperties = {
  'app_version',
  'channel',
  'count',
  'duration_ms',
  'error_code',
  'feature',
  'kind',
  'lang',
  'method',
  'page',
  'result',
  'role',
  'screen',
  'source',
  'status',
  'step',
  'trade',
  'via',
};

final _pii = RegExp(r'(?:\+?977[- ]?)?9[678]\d{8}|[^@\s]+@[^@\s]+\.[A-Za-z]{2,}');

/// Allowed keys only; strings ≤ 120 chars that don't look like a phone number or email.
Map<String, Object?> sanitizeProperties(Map<String, Object?> props) {
  final out = <String, Object?>{};
  props.forEach((k, v) {
    if (!allowedProperties.contains(k)) return;
    if (v == null || v is num || v is bool) {
      out[k] = v;
    } else if (v is String && v.length <= 120 && !_pii.hasMatch(v)) {
      out[k] = v;
    }
  });
  return out;
}

typedef TelemetrySender = Future<void> Function(List<Map<String, Object?>> batch);

class Telemetry {
  Telemetry({
    required TelemetrySender send,
    required this.platform,
    required this.anonymousId,
    this.enabled = true,
    this.flushAfter = const Duration(seconds: 5),
    DateTime Function()? clock,
  }) : _send = send,
       _clock = clock ?? DateTime.now;

  /// A recorder that drops everything (debug builds, tests, unsupported platforms).
  Telemetry.disabled() : this(send: (_) async {}, platform: 'android', anonymousId: null, enabled: false);

  static const maxBatch = 50;

  final TelemetrySender _send;
  final String platform;
  final String? anonymousId;
  final bool enabled;
  final Duration flushAfter;
  final DateTime Function() _clock;
  final List<Map<String, Object?>> _queue = [];
  Timer? _timer;

  @visibleForTesting
  List<Map<String, Object?>> get queued => List.unmodifiable(_queue);

  void track(String name, [Map<String, Object?> props = const {}]) {
    if (!enabled || !clientEvents.contains(name)) return;
    try {
      _queue.add({
        'name': name,
        'platform': platform,
        'properties': {'app_version': appVersion, ...sanitizeProperties(props)},
        'occurred_at': _clock().toUtc().toIso8601String(),
        if (anonymousId != null) 'anonymous_id': anonymousId,
      });
      if (_queue.length >= maxBatch) {
        unawaited(flush());
      } else {
        _timer ??= Timer(flushAfter, () => unawaited(flush()));
      }
    } catch (_) {
      // analytics must never break the app
    }
  }

  Future<void> flush() async {
    _timer?.cancel();
    _timer = null;
    while (_queue.isNotEmpty) {
      final n = _queue.length < maxBatch ? _queue.length : maxBatch;
      final batch = _queue.sublist(0, n);
      _queue.removeRange(0, n);
      try {
        await _send(batch);
      } catch (_) {
        // offline or rejected: drop this batch rather than grow without bound
      }
    }
  }

  void dispose() {
    _timer?.cancel();
    _timer = null;
  }
}

/// Route template for `page_view` (`/w/jobs/:id`); ids and long tokens are masked.
String screenTemplate(String location) {
  final uuid = RegExp(r'^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$');
  final parts = location.split(RegExp('[?#]')).first.split('/').where((s) => s.isNotEmpty);
  final out = parts.map((s) {
    if (s.startsWith(':')) return s; // already a template parameter
    if (uuid.hasMatch(s)) return ':id';
    if (RegExp(r'^\d+$').hasMatch(s)) return ':n';
    if (s.length > 40) return ':id';
    return s;
  });
  final path = '/${out.join('/')}';
  return path.length > 120 ? path.substring(0, 120) : path;
}

final telemetryProvider = Provider<Telemetry>((ref) {
  final supported =
      !kIsWeb && (defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS);
  if (!telemetryEnabled || !supported) return Telemetry.disabled();
  final prefs = ref.read(prefsProvider);
  var anon = prefs.analyticsId;
  if (anon == null) {
    anon = const Uuid().v4().replaceAll('-', '');
    unawaited(prefs.setAnalyticsId(anon));
  }
  final telemetry = Telemetry(
    platform: defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
    anonymousId: anon,
    send: (batch) => ref.read(apiClientProvider).postNoContent('/telemetry/events', data: {'events': batch}),
  );
  // Send what's queued when the app goes to the background (it may be killed there).
  final lifecycle = AppLifecycleListener(onPause: () => unawaited(telemetry.flush()));
  ref.onDispose(() {
    lifecycle.dispose();
    telemetry.dispose();
  });
  return telemetry;
});
