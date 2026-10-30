import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/widgets/skeleton.dart';
import '../hajiri_providers.dart';

/// App-bar button showing the current site; opens a picker sheet.
class SitePickerButton extends ConsumerWidget {
  const SitePickerButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final session = ref.watch(sessionProvider);
    final mem = session.membership;
    if (mem == null) return const SizedBox.shrink();
    final sites = ref.watch(sitesProvider).value ?? const [];
    // Nothing to choose for a supervisor with a single site.
    if (!mem.allSites && mem.siteIds.length <= 1) return const SizedBox.shrink();
    final current = sites.where((s) => s.id == session.siteId).firstOrNull;
    final label = current?.name ?? l.allSites;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 180),
        child: TextButton.icon(
          onPressed: () => showSitePicker(context, ref),
          icon: const Icon(LucideIcons.mapPin, size: 18),
          label: Text(label, overflow: TextOverflow.ellipsis),
        ),
      ),
    );
  }
}

Future<void> showSitePicker(BuildContext context, WidgetRef ref) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder:
        (ctx) => Consumer(
          builder: (ctx, ref, _) {
            final l = ctx.l10n;
            final session = ref.watch(sessionProvider);
            final sites = ref.watch(sitesProvider);
            Future<void> pick(String? id) async {
              await ref.read(sessionProvider.notifier).selectSite(id);
              if (ctx.mounted) Navigator.pop(ctx);
            }

            return SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Text(l.sitePickTitle, style: Theme.of(ctx).textTheme.titleLarge),
                  ),
                  ListTile(
                    leading: const Icon(LucideIcons.building2),
                    title: Text(l.allSites),
                    trailing: session.siteId == null ? const Icon(LucideIcons.check) : null,
                    onTap: () => pick(null),
                  ),
                  ...switch (sites) {
                    AsyncData(:final value) => [
                      for (final s in value)
                        ListTile(
                          leading: const Icon(LucideIcons.mapPin),
                          title: Text(s.name),
                          subtitle: s.address == null ? null : Text(s.address!),
                          trailing: session.siteId == s.id ? const Icon(LucideIcons.check) : null,
                          onTap: () => pick(s.id),
                        ),
                    ],
                    AsyncError(:final error) => [
                      Padding(padding: const EdgeInsets.all(16), child: Text(errorText(ctx, error))),
                    ],
                    _ => [const SkeletonList(count: 3, avatar: false)],
                  },
                  const SizedBox(height: 16),
                ],
              ),
            );
          },
        ),
  );
}
