import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/session.dart';
import '../../core/format.dart';
import '../../core/l10n/l10n.dart';
import '../../core/router/router.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/language_toggle.dart';
import '../common/account_actions.dart';
import 'hajiri/hajiri_providers.dart';
import 'hajiri/ui/site_picker.dart';

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final s = ref.watch(sessionProvider);
    final me = s.me;
    final mem = s.membership;
    final sites = ref.watch(sitesProvider).value ?? const [];
    final siteName = sites.where((x) => x.id == s.siteId).firstOrNull?.name ?? l.allSites;
    final multiOrg = (me?.supervisorMemberships.length ?? 0) > 1;
    final canPickSite = mem != null && (mem.allSites || mem.siteIds.length > 1);
    return Scaffold(
      appBar: AppBar(title: Text(l.moreTitle)),
      body: ListView(
        padding: const EdgeInsets.all(KsSpace.page),
        children: [
          Card(
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              leading: WorkerAvatar(name: me?.fullName ?? ''),
              title: Text(me?.fullName ?? ''),
              subtitle: Text(formatPhone(me?.phone, lang: context.lang)),
            ),
          ),
          const SizedBox(height: KsSpace.s4),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(LucideIcons.building2),
                  title: Text(mem?.organization.name ?? ''),
                  subtitle: Text('${l.organization} · ${mem == null ? '' : roleLabel(l, mem.role)}'),
                  trailing: multiOrg ? const Icon(LucideIcons.chevronRight) : null,
                  onTap: multiOrg ? () => context.push(Routes.orgPick) : null,
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(LucideIcons.mapPin),
                  title: Text(siteName),
                  subtitle: Text(l.workSite),
                  trailing: canPickSite ? const Icon(LucideIcons.chevronRight) : null,
                  onTap: canPickSite ? () => showSitePicker(context, ref) : null,
                ),
                const ModeSwitchTile(),
              ],
            ),
          ),
          const SizedBox(height: KsSpace.s4),
          const Card(child: Padding(padding: EdgeInsets.all(KsSpace.s4), child: LanguageSelector())),
          const SizedBox(height: KsSpace.s4),
          Card(
            child: ListTile(
              leading: const Icon(LucideIcons.refreshCw),
              title: Text(l.hajiriSyncNow),
              onTap: () => ref.read(syncControllerProvider.notifier).syncNow(),
            ),
          ),
          const SizedBox(height: KsSpace.s6),
          OutlinedButton.icon(
            onPressed: () => confirmLogout(context, ref),
            icon: const Icon(LucideIcons.logOut, size: 20),
            label: Text(l.logout),
          ),
        ],
      ),
    );
  }
}
