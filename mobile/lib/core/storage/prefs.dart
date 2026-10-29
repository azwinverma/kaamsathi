import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../api/json.dart';

/// Non-secret app preferences (language, chosen mode/org/site, cached `Me`).
/// Tokens live in secure storage, never here.
class Prefs {
  Prefs(this._p);
  final SharedPreferences _p;

  static Future<Prefs> load() async => Prefs(await SharedPreferences.getInstance());

  static const _kLang = 'lang';
  static const _kMode = 'mode';
  static const _kOrg = 'org_id';
  static const _kSite = 'site_id';
  static const _kMe = 'me_json';
  static const _kCheckIn = 'check_in_state';
  static const _kAnalytics = 'analytics_id';

  String? get language => _p.getString(_kLang);
  Future<void> setLanguage(String lang) => _p.setString(_kLang, lang);

  /// Random install id for product analytics (`core/telemetry.dart`); not tied to the account.
  String? get analyticsId => _p.getString(_kAnalytics);
  Future<void> setAnalyticsId(String v) => _p.setString(_kAnalytics, v);

  String? get mode => _p.getString(_kMode);
  Future<void> setMode(String? v) => _set(_kMode, v);

  String? get orgId => _p.getString(_kOrg);
  Future<void> setOrgId(String? v) => _set(_kOrg, v);

  /// `''` means "all my sites".
  String? get siteId => _p.getString(_kSite);
  Future<void> setSiteId(String? v) => _set(_kSite, v);

  /// Last `GET /auth/me` so the app can start offline.
  Json? get cachedMe {
    final s = _p.getString(_kMe);
    if (s == null) return null;
    try {
      return asJson(jsonDecode(s));
    } catch (_) {
      return null;
    }
  }

  Future<void> setCachedMe(Json? me) => _set(_kMe, me == null ? null : jsonEncode(me));

  /// Worker self check-in state for today: `{"date": "2026-10-07", "in": iso, "out": iso?}`.
  Json? get checkInState {
    final s = _p.getString(_kCheckIn);
    if (s == null) return null;
    try {
      return asJson(jsonDecode(s));
    } catch (_) {
      return null;
    }
  }

  Future<void> setCheckInState(Json? v) => _set(_kCheckIn, v == null ? null : jsonEncode(v));

  static const _kMilestonePrefix = 'milestone:';

  /// Last observed state of a worker milestone (`null` = never observed).
  /// Kept across sign-out so a celebration never repeats for the same user.
  bool? milestone(String userId, String kind) => _p.getBool('$_kMilestonePrefix$userId:$kind');

  Future<void> setMilestone(String userId, String kind, bool reached) =>
      _p.setBool('$_kMilestonePrefix$userId:$kind', reached);

  static const _kCachePrefix = 'cache:';

  /// Last successful response for an offline-friendly screen (trust card,
  /// my shifts, passport, financial profile). Small JSON only.
  Json? cachedJson(String key) {
    final s = _p.getString('$_kCachePrefix$key');
    if (s == null) return null;
    try {
      return asJson(jsonDecode(s));
    } catch (_) {
      return null;
    }
  }

  Future<void> setCachedJson(String key, Json value) => _p.setString('$_kCachePrefix$key', jsonEncode(value));

  /// Clears everything tied to the signed-in user (keeps language).
  Future<void> clearSession() async {
    for (final k in [_kMode, _kOrg, _kSite, _kMe, _kCheckIn]) {
      await _p.remove(k);
    }
    for (final k in _p.getKeys().where((k) => k.startsWith(_kCachePrefix)).toList()) {
      await _p.remove(k);
    }
  }

  Future<void> _set(String k, String? v) async {
    if (v == null) {
      await _p.remove(k);
    } else {
      await _p.setString(k, v);
    }
  }
}
