import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../data/attendance_models.dart';
import '../data/attendance_queue.dart';

/// One worker on Today's Hajiri: P/A/H/L toggle, OT stepper, sync status.
class HajiriRow extends StatelessWidget {
  const HajiriRow({
    super.key,
    required this.name,
    this.photo,
    this.designation,
    required this.status,
    this.overtimeMinutes = 0,
    this.syncState,
    this.errorMessage,
    this.enabled = true,
    required this.onStatus,
    required this.onOvertime,
    this.onRetry,
    this.onDiscard,
  });

  static const otStep = 30;
  static const otMax = 12 * 60;

  final String name;
  final String? photo;
  final String? designation;

  /// Effective status (local change if any, else server record), or null.
  final String? status;
  final int overtimeMinutes;

  /// Null when the shown status is confirmed by the server.
  final QueueState? syncState;
  final String? errorMessage;
  final bool enabled;
  final ValueChanged<String> onStatus;
  final ValueChanged<int> onOvertime;
  final VoidCallback? onRetry;
  final VoidCallback? onDiscard;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final c = context.statusColors;
    final showOt = status == AttendanceStatus.present || status == AttendanceStatus.halfDay;
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(KsSpace.s3, KsSpace.s3, KsSpace.s3, KsSpace.s3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                WorkerAvatar(name: name, photo: photo),
                const SizedBox(width: KsSpace.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: t.titleSmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                      if (designation != null && designation!.isNotEmpty)
                        Text(
                          designation!,
                          style: t.bodyMedium?.copyWith(color: c.textSecondary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                    ],
                  ),
                ),
                _SyncIcon(state: syncState),
              ],
            ),
            const SizedBox(height: KsSpace.s3),
            Row(
              children: [
                for (final s in AttendanceStatus.markable) ...[
                  Expanded(
                    child: _StatusButton(
                      key: Key('status_$s'),
                      status: s,
                      selected: status == s,
                      enabled: enabled,
                      onTap: () => onStatus(s),
                    ),
                  ),
                  if (s != AttendanceStatus.markable.last) const SizedBox(width: KsSpace.s2),
                ],
              ],
            ),
            if (showOt) ...[
              const SizedBox(height: KsSpace.s2),
              Row(
                children: [
                  Icon(LucideIcons.timer, size: 18, color: c.textSecondary),
                  const SizedBox(width: KsSpace.s2),
                  Expanded(
                    child: Text(
                      l.hajiriOvertime(formatHours(overtimeMinutes, context.lang)),
                      key: const Key('ot_label'),
                      style: t.bodyMedium,
                    ),
                  ),
                  IconButton(
                    key: const Key('ot_minus'),
                    tooltip: l.hajiriOtDecrease,
                    onPressed: enabled && overtimeMinutes > 0
                        ? () => onOvertime((overtimeMinutes - otStep).clamp(0, otMax))
                        : null,
                    icon: const Icon(LucideIcons.minus),
                  ),
                  IconButton(
                    key: const Key('ot_plus'),
                    tooltip: l.hajiriOtIncrease,
                    onPressed: enabled && overtimeMinutes < otMax
                        ? () => onOvertime((overtimeMinutes + otStep).clamp(0, otMax))
                        : null,
                    icon: const Icon(LucideIcons.plus),
                  ),
                ],
              ),
            ],
            if (syncState == QueueState.error) ...[
              const SizedBox(height: KsSpace.s2),
              Container(
                padding: const EdgeInsets.all(KsSpace.s2),
                decoration: BoxDecoration(
                  color: c.dangerBg,
                  borderRadius: BorderRadius.circular(KsRadius.md),
                ),
                child: Row(
                  children: [
                    Icon(LucideIcons.circleAlert, size: 18, color: c.dangerFg),
                    const SizedBox(width: KsSpace.s2),
                    Expanded(
                      child: Text(
                        errorMessage?.isNotEmpty == true ? errorMessage! : l.commonErrorGeneric,
                        style: t.bodyMedium?.copyWith(color: c.dangerFg),
                      ),
                    ),
                    if (onRetry != null)
                      TextButton(onPressed: onRetry, child: Text(l.hajiriRetrySync)),
                    if (onDiscard != null)
                      TextButton(onPressed: onDiscard, child: Text(l.hajiriDiscard)),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatusButton extends StatelessWidget {
  const _StatusButton({
    super.key,
    required this.status,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final String status;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final (bg, fg) = attendanceColors(context, status);
    final border = context.statusColors.border;
    return Semantics(
      button: true,
      selected: selected,
      label: attendanceLabel(l, status),
      excludeSemantics: true,
      child: Material(
        color: selected ? bg : Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(KsRadius.md),
          side: BorderSide(color: selected ? fg : border, width: selected ? 2 : 1),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(KsRadius.md),
          onTap: enabled ? onTap : null,
          child: SizedBox(
            height: 48,
            child: Center(
              child: Text(
                attendanceShort(l, status),
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: selected ? fg : context.statusColors.textSecondary,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SyncIcon extends StatelessWidget {
  const _SyncIcon({required this.state});
  final QueueState? state;

  @override
  Widget build(BuildContext context) {
    final c = context.statusColors;
    final l = context.l10n;
    return switch (state) {
      null => const SizedBox.shrink(),
      QueueState.pending || QueueState.syncing => Tooltip(
        message: l.hajiriNotSynced,
        child: Icon(LucideIcons.cloudUpload, size: 20, color: c.warningFg, key: const Key('sync_pending')),
      ),
      QueueState.error => Icon(LucideIcons.triangleAlert, size: 20, color: c.dangerFg),
    };
  }
}
