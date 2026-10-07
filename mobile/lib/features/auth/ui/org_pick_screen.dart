import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/session.dart';
import '../../../core/l10n/l10n.dart';
import '../../../core/router/router.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/common.dart';

class OrgPickScreen extends ConsumerWidget {
  const OrgPickScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final session = ref.watch(sessionProvider);
    final orgs = session.me?.supervisorMemberships ?? const [];
    return Scaffold(
      appBar: AppBar(title: Text(l.orgPickTitle)),
      body: ListView.separated(
        padding: const EdgeInsets.all(KsSpace.page),
        itemCount: orgs.length,
        separatorBuilder: (_, _) => const SizedBox(height: KsSpace.s3),
        itemBuilder: (context, i) {
          final m = orgs[i];
          final selected = m.organization.id == session.orgId;
          return Card(
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              leading: WorkerAvatar(name: m.organization.name, photo: m.organization.logo),
              title: Text(m.organization.name),
              subtitle: Text(roleLabel(l, m.role)),
              trailing: Icon(
                selected ? LucideIcons.circleCheck : LucideIcons.chevronRight,
                color: selected ? Theme.of(context).colorScheme.primary : null,
              ),
              onTap: () async {
                await ref.read(sessionProvider.notifier).selectOrg(m.organization.id);
                if (context.mounted) context.go(Routes.supHajiri);
              },
            ),
          );
        },
      ),
    );
  }
}
