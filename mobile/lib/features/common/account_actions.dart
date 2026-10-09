import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/session.dart';
import '../../core/format.dart';
import '../../core/l10n/l10n.dart';
import '../../core/router/router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/eco.dart';
import '../bolau/bolau_repository.dart';
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

/// Mode switch row. Without Bolau: "Switch to worker/supervisor view",
/// shown only with both roles. With Bolau on: "Switch mode" opens a sheet
/// with every mode this person can use — Sipalu (or "Become a Sipalu"),
/// Ghardhani and supervisor.
class ModeSwitchTile extends ConsumerWidget {
  const ModeSwitchTile({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final s = ref.watch(sessionProvider);
    final bolau = ref.watch(bolauEnabledProvider);
    if (bolau) {
      final mode = effectiveMode(s, bolau: true);
      return ListTile(
        key: const Key('mode_switch'),
        leading: const Icon(LucideIcons.arrowLeftRight),
        title: Text(l.blSwitchMode),
        subtitle: Text(modeLabel(l, mode)),
        trailing: const Icon(LucideIcons.chevronRight),
        onTap: () => showModeSheet(context, ref),
      );
    }
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

String modeLabel(AppLocalizations l, AppMode? m) => switch (m) {
  AppMode.worker => l.blModeSipalu,
  AppMode.ghardhani => l.blModeGhardhani,
  AppMode.supervisor => l.blModeSupervisor,
  null => '',
};

/// Bottom sheet listing the modes (Bolau on).
Future<void> showModeSheet(BuildContext context, WidgetRef ref) async {
  final s = ref.read(sessionProvider);
  final me = s.me;
  final current = effectiveMode(s, bolau: true);
  final picked = await showModalBottomSheet<String>(
    context: context,
    builder: (ctx) {
      final l = ctx.l10n;
      Widget tile(String key, IconData icon, String title, String subtitle, {bool selected = false}) => ListTile(
        key: Key('mode_$key'),
        leading: Icon(icon),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: selected ? const Icon(LucideIcons.check) : null,
        selected: selected,
        onTap: () => Navigator.pop(ctx, key),
      );
      return SafeArea(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.all(KsSpace.page),
                child: Text(l.blSwitchMode, style: Theme.of(ctx).textTheme.titleLarge),
              ),
              if (me?.isWorker ?? false)
                tile(
                  'worker',
                  LucideIcons.hammer,
                  l.blModeSipalu,
                  l.blModeSipaluHint,
                  selected: current == AppMode.worker,
                )
              else
                tile('join', LucideIcons.userPlus, l.blBecomeSipalu, l.blBecomeSipaluHint),
              tile(
                'ghardhani',
                LucideIcons.house,
                l.blModeGhardhani,
                l.blModeGhardhaniHint,
                selected: current == AppMode.ghardhani,
              ),
              if (me?.canSupervise ?? false)
                tile(
                  'supervisor',
                  LucideIcons.clipboardCheck,
                  l.blModeSupervisor,
                  l.blModeSupervisorHint,
                  selected: current == AppMode.supervisor,
                ),
            ],
          ),
        ),
      );
    },
  );
  if (picked == null || !context.mounted) return;
  final session = ref.read(sessionProvider.notifier);
  switch (picked) {
    case 'join':
      await context.push(Routes.sipaluJoin);
    case 'worker':
      await session.setMode(AppMode.worker);
    case 'ghardhani':
      await session.setMode(AppMode.ghardhani);
    case 'supervisor':
      await session.setMode(AppMode.supervisor);
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
            key: const Key('menu_safety'),
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
