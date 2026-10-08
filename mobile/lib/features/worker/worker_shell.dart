import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/l10n/l10n.dart';
import '../common/inbox/inbox_data.dart';
import '../common/inbox/inbox_screen.dart';

/// Worker bottom navigation, brand v2 §18 (max five): Home · Jobs · Work
/// (hajiri, shifts, timesheets, payslips) · Learn (training, credentials,
/// career) · Profile (passport, trust, money, settings). Everything else is
/// a full-screen page opened from one of these, or from the inbox bell in
/// each tab's app bar. Branch order matches [workerTabRoots].
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
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: [
            NavigationDestination(key: const Key('nav_home'), icon: const Icon(LucideIcons.house), label: l.navHome),
            NavigationDestination(
              key: const Key('nav_jobs'),
              icon: const Icon(LucideIcons.briefcaseBusiness),
              label: l.navJobsTab,
            ),
            NavigationDestination(
              key: const Key('nav_work'),
              icon: const Icon(LucideIcons.calendarCheck),
              label: l.navWork,
            ),
            NavigationDestination(
              key: const Key('nav_learn'),
              icon: const Icon(LucideIcons.graduationCap),
              label: l.navLearn,
            ),
            NavigationDestination(
              key: const Key('nav_profile'),
              icon: const Icon(LucideIcons.userRound),
              label: l.profileTitle,
            ),
          ],
        ),
      ),
    );
  }
}
