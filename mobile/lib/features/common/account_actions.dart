import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/session.dart';
import '../../core/format.dart';
import '../../core/l10n/l10n.dart';
import '../../core/router/router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/eco.dart';
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
              style: pending > 0 ? destructiveFilledStyle(ctx) : null,
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

/// Help & support, safety report (worker), notification settings and
/// Login & security rows (both modes).
class AccountHelpTiles extends ConsumerWidget {
  const AccountHelpTiles({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final worker = ref.watch(sessionProvider.select((s) => s.mode)) != AppMode.supervisor;
    return Column(
      children: [
        MenuTile(
          icon: LucideIcons.bookOpen,
          title: l.helpCenterTitle,
          subtitle: l.helpCenterSubtitle,
          onTap: () => context.push(Routes.helpCenter),
        ),
        MenuTile(
          icon: LucideIcons.lifeBuoy,
          title: l.supportTitle,
          subtitle: l.supportMenuSubtitle,
          onTap: () => context.push(Routes.help),
        ),
        if (worker)
          MenuTile(
            icon: LucideIcons.shieldAlert,
            title: l.safetyTitle,
            subtitle: l.safetyMenuSubtitle,
            onTap: () => context.push(Routes.helpSafety),
          ),
        MenuTile(
          icon: LucideIcons.bellRing,
          title: l.notifPrefsTitle,
          onTap: () => context.push(Routes.notificationPrefs),
        ),
        MenuTile(
          icon: LucideIcons.lockKeyhole,
          title: l.securityTitle,
          subtitle: l.securityMenuSubtitle,
          onTap: () => context.push(Routes.security),
        ),
      ],
    );
  }
}
