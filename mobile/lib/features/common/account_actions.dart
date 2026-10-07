import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/session.dart';
import '../../core/format.dart';
import '../../core/l10n/l10n.dart';
import '../supervisor/hajiri/hajiri_providers.dart';

/// Confirms and performs logout, warning about unsynced hajiri.
Future<void> confirmLogout(BuildContext context, WidgetRef ref) async {
  final l = context.l10n;
  final pending = ref.read(syncControllerProvider).records.length;
  final ok = await showDialog<bool>(
    context: context,
    builder:
        (ctx) => AlertDialog(
          title: Text(l.logoutConfirm),
          content: pending > 0 ? Text(l.logoutPendingWarning(localizeDigits('$pending', ctx.lang))) : null,
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.commonCancel)),
            FilledButton(
              style: pending > 0 ? FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error) : null,
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(l.logout),
            ),
          ],
        ),
  );
  if (ok != true) return;
  await ref.read(syncControllerProvider.notifier).clearAll();
  await ref.read(sessionProvider.notifier).logout();
}

/// "Switch to worker/supervisor view" tile, shown only with both roles.
class ModeSwitchTile extends ConsumerWidget {
  const ModeSwitchTile({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final s = ref.watch(sessionProvider);
    if (!(s.me?.hasBothModes ?? false)) return const SizedBox.shrink();
    final toWorker = s.mode == AppMode.supervisor;
    return ListTile(
      leading: const Icon(LucideIcons.arrowLeftRight),
      title: Text(toWorker ? l.modeSwitchToWorker : l.modeSwitchToSupervisor),
      trailing: const Icon(LucideIcons.chevronRight),
      onTap: () => ref.read(sessionProvider.notifier).setMode(toWorker ? AppMode.worker : AppMode.supervisor),
    );
  }
}
