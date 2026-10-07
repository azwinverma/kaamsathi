import 'package:flutter/material.dart';

import '../../l10n/gen/app_localizations.dart';
import '../api/api_exception.dart';
import '../theme/tokens.dart';

export '../../l10n/gen/app_localizations.dart';

const supportedLanguages = ['en', 'ne'];

extension L10nX on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);

  /// Active language code (`en`/`ne`) for format.dart helpers.
  String get lang => Localizations.localeOf(this).languageCode;
}

/// A user-facing message for any error. Known contract codes get friendly,
/// translated copy; otherwise the server's localised `message` is used.
String errorText(BuildContext context, Object? error) {
  final l = context.l10n;
  if (error is! ApiException) return l.commonErrorGeneric;
  switch (error.code) {
    case ApiException.network:
    case ApiException.timeout:
      return l.commonNetworkError;
    case 'otp_invalid':
      return l.errOtpInvalid;
    case 'otp_expired':
      return l.errOtpExpired;
    case 'otp_rate_limited':
      return l.errOtpRateLimited;
    case 'outside_geofence':
      return l.errOutsideGeofence;
    case 'not_authenticated':
      return l.commonSessionExpired;
    case 'permission_denied':
    case 'org_forbidden':
      return error.message.isNotEmpty ? error.message : l.commonPermissionDenied;
    case 'not_found':
      return error.message.isNotEmpty ? error.message : l.commonNotFound;
    case 'invalid_state':
      return error.message.isNotEmpty ? error.message : l.errInvalidState;
    case 'duplicate':
      return error.message.isNotEmpty ? error.message : l.errAlreadyRecorded;
  }
  if (error.fields.isNotEmpty) return error.fields.values.first.first;
  return error.message.isNotEmpty ? error.message : l.commonErrorGeneric;
}

/// Translated attendance status label.
String attendanceLabel(AppLocalizations l, String? status) => switch (status) {
  'present' => l.termPresent,
  'absent' => l.termAbsent,
  'half_day' => l.termHalfDay,
  'leave' => l.termOnLeave,
  'holiday' => l.termPublicHoliday,
  'weekly_off' => l.termWeeklyOff,
  _ => l.termNotMarked,
};

/// One/two-letter code shown in grids and the P/A/H/L toggles.
String attendanceShort(AppLocalizations l, String? status) => switch (status) {
  'present' => l.statusShortPresent,
  'absent' => l.statusShortAbsent,
  'half_day' => l.statusShortHalfDay,
  'leave' => l.statusShortLeave,
  'holiday' => l.statusShortHoliday,
  'weekly_off' => l.statusShortWeeklyOff,
  _ => '–',
};

/// (background, foreground) for an attendance status.
(Color, Color) attendanceColors(BuildContext context, String? status) {
  final c = context.statusColors;
  return switch (status) {
    'present' => (c.successBg, c.successFg),
    'absent' => (c.dangerBg, c.dangerFg),
    'half_day' => (c.warningBg, c.warningFg),
    'leave' => (c.infoBg, c.infoFg),
    'holiday' || 'weekly_off' => (c.neutralBg, c.neutralFg),
    _ => (Colors.transparent, c.textSecondary),
  };
}

String paymentMethodLabel(AppLocalizations l, String? m) => switch (m) {
  'esewa' => l.payEsewa,
  'khalti' => l.payKhalti,
  'bank' => l.payBank,
  'cash' => l.payCash,
  _ => m ?? '',
};

String roleLabel(AppLocalizations l, String role) => switch (role) {
  'owner' => l.roleOwner,
  'admin' => l.roleAdmin,
  'hr' => l.roleHr,
  'supervisor' => l.roleSupervisor,
  _ => role,
};

String leaveTypeLabel(AppLocalizations l, String? t) => switch (t) {
  'home' => l.leaveTypeHome,
  'sick' => l.leaveTypeSick,
  'maternity' => l.leaveTypeMaternity,
  'paternity' => l.leaveTypePaternity,
  'mourning' => l.leaveTypeMourning,
  'unpaid' => l.leaveTypeUnpaid,
  _ => t ?? '',
};

String verificationLabel(AppLocalizations l, String? v) => switch (v) {
  'verified' => l.termVerified,
  'pending' => l.verPending,
  'rejected' => l.verRejected,
  _ => l.verUnverified,
};
