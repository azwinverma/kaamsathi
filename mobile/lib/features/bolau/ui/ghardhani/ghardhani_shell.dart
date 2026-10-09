import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../common/inbox/inbox_data.dart';
import '../../../common/inbox/inbox_screen.dart';

/// Ghardhani mode (street mural, B): Home · Bookings · Requests · Profile.
/// Branch order matches `gharTabRoots`.
class GhardhaniShell extends ConsumerWidget {
  const GhardhaniShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    return UnreadPoller(
      child: Scaffold(
        body: shell,
        bottomNavigationBar: NavigationBar(
          selectedIndex: shell.currentIndex,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          onDestinationSelected: (i) {
            ref.read(unreadCountProvider.notifier).refresh();
            shell.goBranch(i, initialLocation: i == shell.currentIndex);
          },
          destinations: [
            NavigationDestination(key: const Key('gnav_home'), icon: const Icon(LucideIcons.house), label: l.navHome),
            NavigationDestination(
              key: const Key('gnav_bookings'),
              icon: const Icon(LucideIcons.calendarCheck),
              label: l.blSegBookings,
            ),
            NavigationDestination(
              key: const Key('gnav_requests'),
              icon: const Icon(LucideIcons.messageSquareQuote),
              label: l.blRequests,
            ),
            NavigationDestination(
              key: const Key('gnav_profile'),
              icon: const Icon(LucideIcons.userRound),
              label: l.profileTitle,
            ),
          ],
        ),
      ),
    );
  }
}
