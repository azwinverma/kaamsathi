import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/l10n/l10n.dart';
import 'hajiri/hajiri_providers.dart';

class SupervisorShell extends ConsumerWidget {
  const SupervisorShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final pending = ref.watch(syncControllerProvider.select((s) => s.records.length));
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: [
          NavigationDestination(
            icon: Badge(
              isLabelVisible: pending > 0,
              label: Text(localizeDigits('$pending', context.lang)),
              child: const Icon(LucideIcons.clipboardCheck),
            ),
            label: l.navAttendance,
          ),
          NavigationDestination(icon: const Icon(LucideIcons.calendarDays), label: l.hajiriRegister),
          NavigationDestination(icon: const Icon(LucideIcons.calendarOff), label: l.navLeave),
          NavigationDestination(icon: const Icon(LucideIcons.ellipsis), label: l.moreTitle),
        ],
      ),
    );
  }
}
