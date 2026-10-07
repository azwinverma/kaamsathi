import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_exception.dart';
import '../../../../core/api/json.dart';
import 'attendance_models.dart';
import 'attendance_syncer.dart';

/// Supervisor-side hajiri API plus the on-device roster cache.
class AttendanceRepository {
  AttendanceRepository(this._api, this._db);

  final ApiClient _api;
  final Database _db;

  static String _siteKey(String? siteId) => siteId ?? '*';

  /// `GET /org/attendance/day`. Falls back to the cached roster when offline:
  /// first the same day, else the latest cached day (with records stripped,
  /// since the roster rarely changes but statuses do).
  Future<DayRoster> fetchDay({
    required String orgId,
    String? siteId,
    required String date,
  }) async {
    final key = '$orgId|${_siteKey(siteId)}|$date';
    try {
      final data = await _api.get<Map<String, dynamic>>(
        '/org/attendance/day',
        query: {'date': date, 'site': siteId},
      );
      await _db.insert('day_cache', {
        'cache_key': key,
        'org_id': orgId,
        'site_key': _siteKey(siteId),
        'date': date,
        'json': jsonEncode(data),
        'saved_at': DateTime.now().millisecondsSinceEpoch,
      }, conflictAlgorithm: ConflictAlgorithm.replace);
      return DayRoster.fromJson(data);
    } on ApiException catch (e) {
      if (!e.isNetwork) rethrow;
      final exact = await _db.query(
        'day_cache',
        where: 'cache_key = ?',
        whereArgs: [key],
      );
      if (exact.isNotEmpty) {
        return DayRoster.fromJson(
          asJson(jsonDecode(exact.first['json']! as String)),
          fromCache: true,
        );
      }
      final latest = await _db.query(
        'day_cache',
        where: 'org_id = ? AND site_key = ?',
        whereArgs: [orgId, _siteKey(siteId)],
        orderBy: 'saved_at DESC',
        limit: 1,
      );
      if (latest.isEmpty) rethrow;
      final j = asJson(jsonDecode(latest.first['json']! as String));
      final rows = asJsonList(j['rows'])
          .map((r) => {...r, 'record': null})
          .toList();
      return DayRoster.fromJson({
        'date': date,
        'rows': rows,
      }, fromCache: true);
    }
  }

  /// `POST /org/attendance/bulk` for one organization.
  Future<BulkResult> postBulk(
    String orgId,
    List<Map<String, dynamic>> records,
  ) async {
    final data = await _api.post<Map<String, dynamic>>(
      '/org/attendance/bulk',
      data: {'records': records},
      options: ApiClient.forOrg(orgId),
    );
    return BulkResult(
      saved: strList(data['saved']),
      errors: asJsonList(data['errors'])
          .map(
            (e) => BulkError(
              strOr(e['client_uuid']),
              strOr(e['code'], 'validation_error'),
              strOr(e['message']),
            ),
          )
          .toList(),
    );
  }

  Future<Register> fetchRegister({
    required int bsYear,
    required int bsMonth,
    String? siteId,
  }) async {
    final data = await _api.get<Map<String, dynamic>>(
      '/org/attendance/register',
      query: {'bs_year': bsYear, 'bs_month': bsMonth, 'site': siteId},
    );
    return Register.fromJson(data);
  }

  /// `GET /org/sites` (may be forbidden for some roles — caller handles).
  Future<List<SiteRef>> fetchSites() async {
    final data = await _api.get<dynamic>('/org/sites', query: {'page_size': 100});
    return resultsOf(data).map(SiteRef.fromJson).toList();
  }

  Future<void> clearCache() => _db.delete('day_cache');
}
