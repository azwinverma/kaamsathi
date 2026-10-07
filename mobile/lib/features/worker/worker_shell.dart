import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/l10n/l10n.dart';

class WorkerShell extends StatelessWidget {
  const WorkerShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: [
          NavigationDestination(icon: const Icon(LucideIcons.house), label: l.navDashboard),
          NavigationDestination(icon: const Icon(LucideIcons.calendarCheck), label: l.navAttendance),
          NavigationDestination(icon: const Icon(LucideIcons.wallet), label: l.navPayslip),
          NavigationDestination(icon: const Icon(LucideIcons.userRound), label: l.profileTitle),
        ],
      ),
    );
  }
}
