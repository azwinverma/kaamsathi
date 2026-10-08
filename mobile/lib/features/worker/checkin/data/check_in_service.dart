import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:uuid/uuid.dart';

import '../../../../core/api/json.dart';
import '../../../../core/format.dart';
import '../../../../core/providers.dart';
import '../../data/worker_repository.dart';

/// Why a check-in could not start (before reaching the server).
enum CheckInProblem { invalidQr, locationOff, locationDenied, locationDeniedForever }

class CheckInFailure implements Exception {
  const CheckInFailure(this.problem);
  final CheckInProblem problem;
}

/// Extracts `<qr_token>` from `kaamsathi://site/<qr_token>`.
String? parseSiteQr(String? raw) {
  if (raw == null) return null;
  final m = RegExp(r'^kaamsathi://site/([A-Za-z0-9-]{8,})/?$').firstMatch(raw.trim());
  return m?.group(1);
}

/// Today's self check-in state, remembered on the device (the API's
/// monthly view only exposes a status per day).
class CheckInState {
  const CheckInState({this.checkedInAt, this.checkedOutAt});
  final DateTime? checkedInAt;
  final DateTime? checkedOutAt;

  bool get isIn => checkedInAt != null && checkedOutAt == null;
}

class CheckInController extends Notifier<CheckInState> {
  @override
  CheckInState build() {
    final j = ref.read(prefsProvider).checkInState;
    if (j == null || j['date'] != isoDate(nepalToday())) return const CheckInState();
    return CheckInState(checkedInAt: dateTimeOf(j['in']), checkedOutAt: dateTimeOf(j['out']));
  }

  /// Gets a fresh GPS fix, handling permissions.
  Future<Position> _position() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const CheckInFailure(CheckInProblem.locationOff);
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.deniedForever) {
      throw const CheckInFailure(CheckInProblem.locationDeniedForever);
    }
    if (perm == LocationPermission.denied || perm == LocationPermission.unableToDetermine) {
      throw const CheckInFailure(CheckInProblem.locationDenied);
    }
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 20)),
    );
  }

  /// Full flow after a QR scan. Throws [CheckInFailure] or ApiException.
  Future<void> submit({required String rawQr, required bool checkOut}) async {
    final token = parseSiteQr(rawQr);
    if (token == null) throw const CheckInFailure(CheckInProblem.invalidQr);
    final pos = await _position();
    await ref
        .read(workerRepositoryProvider)
        .checkIn(
          checkOut: checkOut,
          qrToken: token,
          lat: pos.latitude,
          lng: pos.longitude,
          clientUuid: const Uuid().v4(),
        );
    final now = DateTime.now();
    state =
        checkOut
            ? CheckInState(checkedInAt: state.checkedInAt ?? now, checkedOutAt: now)
            : CheckInState(checkedInAt: now);
    await ref.read(prefsProvider).setCheckInState({
      'date': isoDate(nepalToday()),
      'in': state.checkedInAt?.toIso8601String(),
      'out': state.checkedOutAt?.toIso8601String(),
    });
    ref.invalidate(myAttendanceProvider);
  }

  static Future<void> openSettings(CheckInProblem p) async {
    if (p == CheckInProblem.locationOff) {
      await Geolocator.openLocationSettings();
    } else {
      await Geolocator.openAppSettings();
    }
  }
}

final checkInProvider = NotifierProvider<CheckInController, CheckInState>(CheckInController.new);
