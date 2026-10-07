import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../api/json.dart';
import '../format.dart';
import '../providers.dart';
import 'me.dart';
import 'token_store.dart';

enum AuthStatus { unknown, loggedOut, loggedIn }

enum AppMode { supervisor, worker }

/// Who is signed in and which mode / organization / site they're working in.
class Session {
  const Session({
    this.status = AuthStatus.unknown,
    this.me,
    this.mode,
    this.orgId,
    this.siteId,
    this.expired = false,
  });

  final AuthStatus status;
  final Me? me;
  final AppMode? mode;

  /// Selected organization for supervisor mode.
  final String? orgId;

  /// Selected site; null = all sites the user may see.
  final String? siteId;

  /// True when the last logout was forced by a rejected refresh token.
  final bool expired;

  bool get isLoggedIn => status == AuthStatus.loggedIn;

  Membership? get membership {
    final m = me;
    if (m == null || orgId == null) return null;
    for (final x in m.supervisorMemberships) {
      if (x.organization.id == orgId) return x;
    }
    return null;
  }

  /// Supervisor mode needs an explicit org choice when there are several.
  bool get needsOrgPick =>
      mode == AppMode.supervisor && membership == null;

  Session copyWith({
    AuthStatus? status,
    Me? me,
    AppMode? mode,
    String? orgId,
    String? siteId,
    bool clearSite = false,
    bool clearOrg = false,
    bool? expired,
  }) => Session(
    status: status ?? this.status,
    me: me ?? this.me,
    mode: mode ?? this.mode,
    orgId: clearOrg ? null : (orgId ?? this.orgId),
    siteId: clearSite ? null : (siteId ?? this.siteId),
    expired: expired ?? this.expired,
  );
}

class OtpRequestResult {
  const OtpRequestResult({required this.expiresIn, this.devCode});
  final int expiresIn;
  final String? devCode;
}

class SessionController extends Notifier<Session> {
  @override
  Session build() => const Session();

  TokenStore get _tokens => ref.read(tokenStoreProvider);

  /// Called by the splash screen: restores tokens and the user profile.
  /// Works offline when a cached profile exists.
  Future<void> bootstrap() async {
    final t = await _tokens.load();
    if (t == null) {
      state = const Session(status: AuthStatus.loggedOut);
      return;
    }
    try {
      await refreshMe();
    } on ApiException catch (e) {
      final cached = ref.read(prefsProvider).cachedMe;
      if (e.isNetwork && cached != null) {
        _applyMe(Me.fromJson(cached));
      } else if (e.isUnauthenticated) {
        await _clearLocal();
        state = const Session(status: AuthStatus.loggedOut);
      } else if (cached != null) {
        _applyMe(Me.fromJson(cached));
      } else {
        rethrow;
      }
    }
  }

  Future<OtpRequestResult> requestOtp(String phone) async {
    final data = await ref
        .read(apiClientProvider)
        .post<Map<String, dynamic>>(
          '/auth/otp/request',
          data: {'phone': normalizePhone(phone)},
        );
    return OtpRequestResult(
      expiresIn: intOf(data['expires_in']) ?? 300,
      devCode: str(data['dev_code']),
    );
  }

  Future<void> verifyOtp(String phone, String code) async {
    final data = await ref
        .read(apiClientProvider)
        .post<Map<String, dynamic>>(
          '/auth/otp/verify',
          data: {'phone': normalizePhone(phone), 'code': code},
        );
    await _tokens.save(
      Tokens(
        access: strOr(data['access']),
        refresh: strOr(data['refresh']),
      ),
    );
    final meJson = asJson(data['user']);
    await ref.read(prefsProvider).setCachedMe(meJson);
    _applyMe(Me.fromJson(meJson));
  }

  /// Re-fetches `GET /auth/me`.
  Future<Me> refreshMe() async {
    final data = await ref
        .read(apiClientProvider)
        .get<Map<String, dynamic>>('/auth/me');
    await ref.read(prefsProvider).setCachedMe(data);
    final me = Me.fromJson(data);
    _applyMe(me);
    return me;
  }

  /// `POST /me/worker/claim` then reload the profile.
  Future<Me> claimWorker() async {
    try {
      await ref.read(apiClientProvider).postNoContent('/me/worker/claim');
    } on ApiException catch (e) {
      // not_found just means no worker record matches this phone yet.
      if (e.code != 'not_found') rethrow;
    }
    return refreshMe();
  }

  void _applyMe(Me me) {
    final prefs = ref.read(prefsProvider);
    // Mode: keep the saved one if still allowed; else prefer supervisor.
    AppMode? mode;
    final saved = prefs.mode;
    if (saved == 'supervisor' && me.canSupervise) mode = AppMode.supervisor;
    if (saved == 'worker' && me.isWorker) mode = AppMode.worker;
    mode ??= me.canSupervise
        ? AppMode.supervisor
        : (me.isWorker ? AppMode.worker : null);

    // Org: saved if still a membership; auto-pick when there's only one.
    final orgs = me.supervisorMemberships;
    String? orgId = prefs.orgId;
    if (!orgs.any((m) => m.organization.id == orgId)) {
      orgId = orgs.length == 1 ? orgs.first.organization.id : null;
    }
    // Site: saved choice, or the only assigned site.
    String? siteId = prefs.siteId;
    final mem = orgs.where((m) => m.organization.id == orgId).firstOrNull;
    if (mem != null) {
      if (siteId != null && siteId.isNotEmpty && !mem.allSites &&
          !mem.siteIds.contains(siteId)) {
        siteId = null;
      }
      if ((siteId == null || siteId.isEmpty) && mem.siteIds.length == 1 &&
          !mem.allSites) {
        siteId = mem.siteIds.first;
      }
    }
    state = Session(
      status: AuthStatus.loggedIn,
      me: me,
      mode: mode,
      orgId: orgId,
      siteId: (siteId == null || siteId.isEmpty) ? null : siteId,
    );
  }

  Future<void> setMode(AppMode mode) async {
    await ref.read(prefsProvider).setMode(mode.name);
    state = state.copyWith(mode: mode);
  }

  Future<void> selectOrg(String orgId) async {
    final prefs = ref.read(prefsProvider);
    await prefs.setOrgId(orgId);
    await prefs.setSiteId(null);
    final me = state.me;
    String? site;
    final mem = me?.supervisorMemberships
        .where((m) => m.organization.id == orgId)
        .firstOrNull;
    if (mem != null && !mem.allSites && mem.siteIds.length == 1) {
      site = mem.siteIds.first;
    }
    state = state.copyWith(orgId: orgId, siteId: site, clearSite: site == null);
  }

  Future<void> selectSite(String? siteId) async {
    await ref.read(prefsProvider).setSiteId(siteId ?? '');
    state = state.copyWith(siteId: siteId, clearSite: siteId == null);
  }

  Future<void> logout() async {
    final t = _tokens.current;
    if (t != null) {
      try {
        await ref
            .read(apiClientProvider)
            .postNoContent('/auth/logout', data: {'refresh': t.refresh});
      } catch (_) {
        // Offline logout still clears the device.
      }
    }
    await _clearLocal();
    state = const Session(status: AuthStatus.loggedOut);
  }

  /// Refresh token rejected — force a fresh login.
  void expire() {
    if (state.status != AuthStatus.loggedIn) return;
    unawaited(_clearLocal());
    state = const Session(status: AuthStatus.loggedOut, expired: true);
  }

  Future<void> _clearLocal() async {
    await _tokens.clear();
    await ref.read(prefsProvider).clearSession();
  }
}

final sessionProvider = NotifierProvider<SessionController, Session>(
  SessionController.new,
);
