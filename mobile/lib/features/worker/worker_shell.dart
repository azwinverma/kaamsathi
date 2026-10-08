import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/l10n/l10n.dart';
import '../common/inbox/inbox_data.dart';
import '../common/inbox/inbox_screen.dart';

/// Four tabs only (small phones); everything else lives under Profile, the
/// Home "Jobs for you" card, or the bell in each tab's app bar.
class WorkerShell extends ConsumerWidget {
  const WorkerShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    return UnreadPoller(
      child: Scaffold(
        body: shell,
        bottomNavigationBar: NavigationBar(
          selectedIndex: shell.currentIndex,
          onDestinationSelected: (i) {
            ref.read(unreadCountProvider.notifier).refresh();
            shell.goBranch(i, initialLocation: i == shell.currentIndex);
          },
          destinations: [
            NavigationDestination(icon: const Icon(LucideIcons.house), label: l.navDashboard),
            NavigationDestination(icon: const Icon(LucideIcons.calendarCheck), label: l.navAttendance),
            NavigationDestination(icon: const Icon(LucideIcons.wallet), label: l.navPayslip),
            NavigationDestination(icon: const Icon(LucideIcons.userRound), label: l.profileTitle),
          ],
        ),
      ),
    );
  }
}
