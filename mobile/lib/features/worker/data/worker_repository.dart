import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/json.dart';
import '../../../core/auth/session.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';
import 'worker_models.dart';

/// Worker self-service endpoints (`/me/*`).
class WorkerRepository {
  WorkerRepository(this._api);
  final ApiClient _api;

  Future<WorkerProfile> profile() async => WorkerProfile.fromJson(await _api.get<Map<String, dynamic>>('/me/worker'));

  Future<WorkerProfile> updateProfile(Map<String, dynamic> patch) async =>
      WorkerProfile.fromJson(await _api.patch<Map<String, dynamic>>('/me/worker', data: patch));

  Future<MyAttendanceMonth> attendance(int bsYear, int bsMonth) async => MyAttendanceMonth.fromJson(
    await _api.get<Map<String, dynamic>>('/me/attendance', query: {'bs_year': bsYear, 'bs_month': bsMonth}),
  );

  Future<List<Payslip>> payslips() async {
    final data = await _api.get<dynamic>('/me/payslips', query: {'page_size': 100});
    final list = resultsOf(data).map(Payslip.fromJson).toList();
    list.sort((a, b) {
      final y = b.bsYear.compareTo(a.bsYear);
      return y != 0 ? y : b.bsMonth.compareTo(a.bsMonth);
    });
    return list;
  }

  Future<Payslip> payslip(String id) async =>
      Payslip.fromJson(await _api.get<Map<String, dynamic>>('/me/payslips/$id'));

  /// Downloads the payslip PDF to a temp file and returns its path.
  Future<String> downloadPayslipPdf(String id) async {
    final dir = await getTemporaryDirectory();
    final path = '${dir.path}${Platform.pathSeparator}payslip-$id.pdf';
    await _api.download('/me/payslips/$id/payslip.pdf', path);
    return path;
  }

  Future<List<HistoryItem>> history(String lang) async {
    final data = await _api.get<dynamic>('/me/history');
    return resultsOf(data).map((j) => HistoryItem.fromJson(j, lang)).toList();
  }

  Future<List<ConsentRecord>> consents() async {
    final data = await _api.get<dynamic>('/me/consents');
    return resultsOf(data).map(ConsentRecord.fromJson).toList();
  }

  Future<void> setConsent(String scope, bool granted, {String? organizationId}) => _api.postNoContent(
    '/me/consents',
    data: {'scope': scope, 'granted': granted, if (organizationId != null) 'organization_id': organizationId},
  );

  Future<Json> checkIn({
    required bool checkOut,
    required String qrToken,
    required double lat,
    required double lng,
    required String clientUuid,
  }) async {
    final data = await _api.post<dynamic>(
      checkOut ? '/me/attendance/check-out' : '/me/attendance/check-in',
      data: {
        'site_qr_token': qrToken,
        'lat': double.parse(lat.toStringAsFixed(6)),
        'lng': double.parse(lng.toStringAsFixed(6)),
        'client_uuid': clientUuid,
      },
    );
    return asJson(data);
  }
}

final workerRepositoryProvider = Provider<WorkerRepository>((ref) => WorkerRepository(ref.watch(apiClientProvider)));

/// Invalidate on user change.
String? _userId(Ref ref) => ref.watch(sessionProvider.select((s) => s.me?.id));

final workerProfileProvider = FutureProvider.autoDispose<WorkerProfile>((ref) {
  _userId(ref);
  return ref.watch(workerRepositoryProvider).profile();
});

typedef MonthKey = ({int year, int month});

final myAttendanceProvider = FutureProvider.autoDispose.family<MyAttendanceMonth, MonthKey>((ref, key) {
  _userId(ref);
  return ref.watch(workerRepositoryProvider).attendance(key.year, key.month);
});

/// Current BS month's attendance (home screen).
final currentMonthAttendanceProvider = FutureProvider.autoDispose<MyAttendanceMonth>((ref) {
  final bs = BsDate.fromAd(nepalToday());
  return ref.watch(myAttendanceProvider((year: bs.year, month: bs.month)).future);
});

final payslipsProvider = FutureProvider.autoDispose<List<Payslip>>((ref) {
  _userId(ref);
  return ref.watch(workerRepositoryProvider).payslips();
});

final payslipProvider = FutureProvider.autoDispose.family<Payslip, String>((ref, id) {
  return ref.watch(workerRepositoryProvider).payslip(id);
});

final historyProvider = FutureProvider.autoDispose<List<HistoryItem>>((ref) {
  _userId(ref);
  final lang = ref.watch(langCodeProvider);
  return ref.watch(workerRepositoryProvider).history(lang);
});

final consentsProvider = FutureProvider.autoDispose<List<ConsentRecord>>((ref) {
  _userId(ref);
  return ref.watch(workerRepositoryProvider).consents();
});
