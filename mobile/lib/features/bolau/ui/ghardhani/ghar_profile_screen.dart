import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/format.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/router/router.dart';
import '../../../../core/theme/tokens.dart';
import '../../../../core/widgets/common.dart';
import '../../../../core/widgets/eco.dart';
import '../../../../core/widgets/language_toggle.dart';
import '../../../common/account_actions.dart';
import '../../../common/inbox/inbox_screen.dart';
import '../../../common/support/safety_report_screen.dart' show DangerCallout;
import '../../bolau_models.dart';
import '../../bolau_repository.dart';
import '../bolau_widgets.dart';

/// Ghardhani → Profile: addresses, favourites, safety & help, mode switch,
/// language, logout.
class GharProfileScreen extends ConsumerWidget {
  const GharProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final me = ref.watch(sessionProvider).me;
    final g = ref.watch(ghardhaniProfileProvider).value;
    final name = (g?.displayName.isNotEmpty ?? false) ? g!.displayName : (me?.fullName ?? '');
    return Scaffold(
      appBar: AppBar(title: Text(l.profileTitle), actions: const [InboxBell()]),
      body: ListView(
        padding: const EdgeInsets.all(KsSpace.page),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(KsSpace.s4),
              child: Row(
                children: [
                  WorkerAvatar(name: name, size: 52),
                  const SizedBox(width: KsSpace.s3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name, style: t.titleLarge),
                        Text(formatPhone(me?.phone, lang: context.lang), style: t.bodyMedium),
                        const SizedBox(height: KsSpace.s1),
                        StatusBadge(label: l.blModeGhardhani, icon: LucideIcons.house),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          GroupLabel(l.blModeGhardhani),
          Card(
            child: Column(
              children: [
                MenuTile(
                  key: const Key('menu_addresses'),
                  icon: LucideIcons.mapPin,
                  title: l.blAddresses,
                  onTap: () => context.push(Routes.gharAddresses),
                ),
                MenuTile(
                  key: const Key('menu_favourites'),
                  icon: LucideIcons.heart,
                  title: l.blFavourites,
                  onTap: () => context.push(Routes.gharFavourites),
                ),
              ],
            ),
          ),
          GroupLabel(l.blSafetyHelp),
          const DangerCallout(),
          const SizedBox(height: KsSpace.s2),
          Card(
            child: Column(
              children: [
                MenuTile(
                  key: const Key('menu_bolau_safety'),
                  icon: LucideIcons.shieldAlert,
                  title: l.blReportProblem,
                  subtitle: l.blSafetySubtitle,
                  onTap: () => context.push(Routes.safetyFor()),
                ),
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
            ),
          ),
          GroupLabel(l.navSettings),
          const Card(child: Padding(padding: EdgeInsets.all(KsSpace.s4), child: LanguageSelector())),
          const SizedBox(height: KsSpace.s3),
          const Card(child: ModeSwitchTile()),
          const SizedBox(height: KsSpace.s6),
          OutlinedButton.icon(
            onPressed: () => confirmLogout(context, ref),
            icon: const Icon(LucideIcons.logOut, size: 20),
            label: Text(l.logout),
          ),
          const SizedBox(height: KsSpace.s4),
        ],
      ),
    );
  }
}

/// Favourite Sipalu.
class FavouritesScreen extends ConsumerWidget {
  const FavouritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final value = ref.watch(favouritesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.blFavourites)),
      body: FeatureAsyncBody<List<SipaluCard>>(
        value: value,
        onRetry: () => ref.invalidate(favouritesProvider),
        data:
            (list) =>
                list.isEmpty
                    ? ListView(children: [EmptyState(icon: LucideIcons.heart, message: l.blNoFavourites)])
                    : ListView.separated(
                      padding: const EdgeInsets.all(KsSpace.page),
                      itemCount: list.length,
                      separatorBuilder: (_, _) => const SizedBox(height: KsSpace.s2),
                      itemBuilder:
                          (_, i) => SipaluCardTile(
                            card: list[i],
                            onTap: () => context.push(Routes.gharSipalu(list[i].handle)),
                          ),
                    ),
      ),
    );
  }
}
