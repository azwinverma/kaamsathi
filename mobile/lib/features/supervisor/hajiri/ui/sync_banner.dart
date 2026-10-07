import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../hajiri_providers.dart';

/// Pending-sync / failed / offline strip shown above the hajiri list.
class SyncBanner extends ConsumerWidget {
  const SyncBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = context.lang;
    final s = ref.watch(syncControllerProvider);
    final c = context.statusColors;
    final ctrl = ref.read(syncControllerProvider.notifier);

    if (s.failedCount > 0) {
      return _Strip(
        bg: c.dangerBg,
        fg: c.dangerFg,
        icon: LucideIcons.triangleAlert,
        text: l.hajiriSyncFailed(localizeDigits('${s.failedCount}', lang)),
        action: TextButton(onPressed: ctrl.retryAllFailed, child: Text(l.hajiriRetrySync)),
      );
    }
    if (s.pendingCount > 0) {
      return _Strip(
        key: const Key('pending_banner'),
        bg: c.warningBg,
        fg: c.warningFg,
        icon: s.online ? LucideIcons.cloudUpload : LucideIcons.wifiOff,
        text: s.syncing
            ? l.hajiriSyncing
            : l.hajiriPendingSync(localizeDigits('${s.pendingCount}', lang)),
        action: s.syncing
            ? const Padding(
                padding: EdgeInsets.all(12),
                child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
              )
            : TextButton(onPressed: ctrl.syncNow, child: Text(l.hajiriSyncNow)),
      );
    }
    if (!s.online) {
      return _Strip(bg: c.neutralBg, fg: c.neutralFg, icon: LucideIcons.wifiOff, text: l.commonOffline);
    }
    return const SizedBox.shrink();
  }
}

class _Strip extends StatelessWidget {
  const _Strip({super.key, required this.bg, required this.fg, required this.icon, required this.text, this.action});

  final Color bg;
  final Color fg;
  final IconData icon;
  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: KsSpace.s3),
      padding: const EdgeInsets.symmetric(horizontal: KsSpace.s3, vertical: 2),
      constraints: const BoxConstraints(minHeight: 48),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(KsRadius.md)),
      child: Row(
        children: [
          Icon(icon, size: 18, color: fg),
          const SizedBox(width: KsSpace.s2),
          Expanded(child: Text(text, style: TextStyle(color: fg, fontWeight: FontWeight.w500))),
          if (action != null) action!,
        ],
      ),
    );
  }
}
