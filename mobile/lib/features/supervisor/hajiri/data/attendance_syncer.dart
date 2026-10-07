import '../../../../core/api/api_exception.dart';
import 'attendance_queue.dart';

class BulkError {
  const BulkError(this.clientUuid, this.code, this.message);
  final String clientUuid;
  final String code;
  final String message;
}

/// Parsed `POST /org/attendance/bulk` response.
class BulkResult {
  const BulkResult({required this.saved, required this.errors});
  final List<String> saved;
  final List<BulkError> errors;
}

/// Sends one batch for one organization.
typedef BulkSender =
    Future<BulkResult> Function(
      String orgId,
      List<Map<String, dynamic>> records,
    );

class SyncOutcome {
  const SyncOutcome({
    this.saved = 0,
    this.failed = 0,
    this.retryLater = false,
    this.error,
  });

  final int saved;
  final int failed;

  /// True when a retryable problem (offline, timeout, 5xx, auth refresh)
  /// stopped the sync; the caller should schedule another attempt.
  final bool retryLater;
  final ApiException? error;
}

/// Drains [AttendanceQueue] into the bulk endpoint in batches.
class AttendanceSyncer {
  AttendanceSyncer(this.queue, this.send, {this.batchSize = 50});

  final AttendanceQueue queue;
  final BulkSender send;
  final int batchSize;

  /// Syncs everything pending, org by org. Stops early on a retryable error.
  Future<SyncOutcome> syncAll() async {
    var saved = 0;
    var failed = 0;
    for (final org in await queue.orgsWithPending()) {
      while (true) {
        final batch = await queue.pending(orgId: org, limit: batchSize);
        if (batch.isEmpty) break;
        final ids = batch.map((r) => r.clientUuid).toList();
        await queue.markSyncing(ids);
        BulkResult result;
        try {
          result = await send(org, batch.map((r) => r.toBulkJson()).toList());
        } catch (e) {
          final ex = ApiException.from(e);
          if (ex.isRetryable || ex.isUnauthenticated) {
            await queue.markRetry(ids);
            return SyncOutcome(
              saved: saved,
              failed: failed,
              retryLater: true,
              error: ex,
            );
          }
          // The whole batch was refused (e.g. 403 org_forbidden / 400).
          for (final id in ids) {
            await queue.markFailed(id, ex.code, ex.message);
          }
          failed += ids.length;
          continue;
        }
        await queue.markSaved(result.saved);
        saved += result.saved.length;
        final handled = {...result.saved};
        for (final err in result.errors) {
          await queue.markFailed(err.clientUuid, err.code, err.message);
          handled.add(err.clientUuid);
          failed++;
        }
        // Anything the server didn't mention goes back in line.
        final unmentioned = ids.where((id) => !handled.contains(id)).toList();
        if (unmentioned.isNotEmpty) {
          await queue.markRetry(unmentioned);
          return SyncOutcome(saved: saved, failed: failed, retryLater: true);
        }
      }
    }
    return SyncOutcome(saved: saved, failed: failed);
  }
}
